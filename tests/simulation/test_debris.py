import pytest

from services.api.app.schemas import DebrisMassParameters, DebrisMassResult
from simulation.debris.mass_balance import simulate_mass


@pytest.mark.parametrize("rain",[0,80,300])
@pytest.mark.parametrize("capture",[0,0.6,1])
def test_stock_and_flow_mass_conservation_with_cleaning_and_extreme_washoff(rain,capture):
    params = DebrisMassParameters(
        initial_surface_kg=2,initial_retained_kg=0.5,loading_kg_per_day=1,
        wash_off_per_mm=10,capture_fraction=capture,
        cleaning_events=[{"timestamp_s":300,"surface_removal_fraction":0.5,"inlet_removal_fraction":1}],
    ).model_dump()
    result = simulate_mass(params,{"parameters":{"intensity_mmh":rain,"duration_s":600}})
    DebrisMassResult.model_validate(result)
    for frame in result["time_series"]:
        budget = frame["surface_mass_kg"] + frame["retained_mass_kg"] + frame["cumulative_exported_kg"] + frame["cumulative_removed_kg"]
        assert budget == pytest.approx(2.5+frame["cumulative_added_kg"],abs=1e-12)
    assert result["max_abs_balance_error_kg"] < 1e-12
    assert result["time_series"][-1]["timestamp_s"] == 4200
    if rain == 0:
        assert result["time_series"][-1]["cumulative_washed_kg"] == 0
        assert result["time_series"][-1]["cumulative_exported_kg"] == 0
    else:
        assert result["time_series"][-1]["cumulative_washed_kg"] > 0
    assert result["time_series"][-1]["cumulative_removed_kg"] > 0


def test_empty_stocks_and_loading_stay_zero():
    params = DebrisMassParameters(initial_surface_kg=0,initial_retained_kg=0,loading_kg_per_day=0).model_dump()
    result = simulate_mass(params,{"parameters":{"intensity_mmh":300,"duration_s":300}})
    assert all(f["surface_mass_kg"] == f["retained_mass_kg"] == f["cumulative_washed_kg"] == 0 for f in result["time_series"])


@pytest.mark.parametrize("times",[[60,60],[4260]])
def test_ambiguous_or_outside_window_cleaning_is_rejected(times):
    params = DebrisMassParameters(cleaning_events=[{"timestamp_s":t} for t in times]).model_dump()
    with pytest.raises(ValueError,match="Cleaning event times"):
        simulate_mass(params,{"parameters":{"intensity_mmh":80,"duration_s":600}})
