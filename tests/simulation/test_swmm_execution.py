import hashlib

import pytest

from services.api.app.schemas import FramesResponse, MetricsResponse, RunResponse
from simulation.swmm.demo import VALIDATION_DIR, validate_suite
from simulation.swmm.engine import verified_execution
from simulation.swmm.model import MODEL_DIR, build_inp, canonical_hash, read_json, resolve_inputs
from simulation.swmm.results import NumericalQAError, check_qa, parse_results
from simulation.swmm.runner import SimulationError, run_model


@pytest.fixture(scope="module")
def real_suite(tmp_path_factory):
    pytest.importorskip("swmm.toolkit.solver")
    directory = tmp_path_factory.mktemp("t1") / "evidence"
    return directory, validate_suite(directory)


def test_real_rainfall_response_reproducibility_and_step_refinement(real_suite):
    directory, summary = real_suite
    assert summary["status"] == "passed"
    assert summary["engine_version"] == "5.2.4"
    assert summary["rainfall_comparison"]["only_storm_changed"]
    assert summary["runs"]["baseline"]["total_flooding_volume_m3"] < 0.1
    assert summary["runs"]["stronger"]["total_flooding_volume_m3"] > 700
    for label in ("baseline", "stronger"):
        assert summary["reproducibility"][label]["parsed_results_exactly_equal"]
        for error in summary["runs"][label]["continuity_error_percent"].values():
            assert abs(error) < 1
        refinement = summary["routing_step_refinement"][label]
        assert refinement["flood_volume_absolute_difference_m3"] < refinement["acceptance_tolerance_m3"]
        path = directory / label
        assert (path / "model.inp").stat().st_size > 1000
        assert (path / "model.rpt").stat().st_size > 1000
        assert (path / "model.out").stat().st_size > 1000


def test_real_outputs_match_contract_and_asset_ids(real_suite):
    directory, _summary = real_suite
    for label in ("baseline", "stronger"):
        path = directory / label
        run = RunResponse.model_validate(read_json(path / "run.json"))
        frames = FramesResponse.model_validate(read_json(path / "frames.json"))
        metrics = MetricsResponse.model_validate(read_json(path / "metrics.json"))
        assert canonical_hash(run.input_snapshot) == run.input_hash
        assert run.status == "succeeded" and run.error is None
        assert frames.result_type == metrics.result_type == "simulated"
        assert frames.is_verified_site_model is False
        assert [f.timestamp_s for f in frames.frames] == list(range(60,7201,60))
        assets = run.input_snapshot["assets"]
        for frame in frames.frames:
            assert {n.node_id for n in frame.node_states} == {n["node_id"] for n in assets["nodes"]}
            assert {p.conduit_id for p in frame.pipe_states} == {p["conduit_id"] for p in assets["conduits"]}
            assert {i.inlet_id for i in frame.inlet_states} == {i["inlet_id"] for i in assets["inlets"]}
        native = read_json(path / "native.json")
        assert metrics.total_flooding_volume_m3 == pytest.approx(sum(x["flooding_volume_m3"] for x in native["node_statistics"].values()))
        assert metrics.surcharge_duration_s <= sum(x["surcharge_duration_s"] for x in native["node_statistics"].values())
        # Offline parsing again uses the binary file, not UI fixtures or cached frames.
        parsed, reparsed_metrics, _qa = parse_results(path, run.input_snapshot, run.run_id)
        assert parsed == frames.model_dump()
        assert reparsed_metrics == metrics.model_dump()


def test_preserved_evidence_hashes():
    summary = read_json(VALIDATION_DIR / "summary.json")
    for label, run in summary["runs"].items():
        for name, digest in run["artifact_sha256"].items():
            assert hashlib.sha256((VALIDATION_DIR / label / name).read_bytes()).hexdigest() == digest
    for label,intensity in (("baseline",80),("stronger",120)):
        assert (MODEL_DIR / f"{label}.inp").read_text() == build_inp(resolve_inputs(f"synthetic_{intensity}mmh_60min"))


def test_invalid_native_input_is_failed_with_logs_and_no_fake_results(tmp_path):
    pytest.importorskip("swmm.toolkit.solver")
    inputs = resolve_inputs("synthetic_80mmh_60min")
    inputs["assets"]["conduits"][0]["manning_n"] = -0.013
    directory = tmp_path / "failed"
    with pytest.raises(SimulationError) as error:
        run_model(inputs, directory)
    assert error.value.code == "SWMM_EXECUTION_FAILED"
    assert read_json(directory / "run.json")["status"] == "failed"
    assert (directory / "worker.log").stat().st_size > 0
    assert "ERROR" in (directory / "model.rpt").read_text()
    assert not (directory / "frames.json").exists()
    assert not (directory / "metrics.json").exists()


def test_existing_run_evidence_is_never_overwritten(real_suite):
    directory, _summary = real_suite
    original = (directory / "baseline/model.out").read_bytes()
    with pytest.raises(FileExistsError):
        run_model(resolve_inputs("synthetic_120mmh_60min"), directory / "baseline")
    assert (directory / "baseline/model.out").read_bytes() == original


@pytest.mark.parametrize("kind", ["continuity", "rainfall", "report_flood", "convergence"])
def test_numerical_qa_rejects_unusable_results(kind):
    path = VALIDATION_DIR / "stronger"
    native = read_json(path / "native.json")
    inputs = read_json(path / "inputs.json")
    report = (path / "model.rpt").read_text()
    if kind == "continuity":
        native["continuity_error_percent"]["routing"] = 10
    elif kind == "rainfall":
        native["water_balance"]["rainfall_mm"] = 0
    elif kind == "report_flood":
        native["node_statistics"]["NODE-J01"]["flooding_volume_m3"] += 50
    else:
        import re
        report = re.sub(r"(% of Steps Not Converging\s*:\s*)[\d.]+", r"\g<1>20.0", report)
    with pytest.raises(NumericalQAError):
        check_qa(native,report,inputs)


def test_engine_verification_requires_matching_retained_evidence(monkeypatch,tmp_path):
    pytest.importorskip("swmm.toolkit.solver")
    assert verified_execution("5.2.4") is True
    assert verified_execution("5.2.3") is False
    import simulation.swmm.engine as engine
    monkeypatch.setattr(engine,"VALIDATION_DIR",tmp_path)
    assert verified_execution("5.2.4") is False


def test_unsupported_inlet_restriction_is_rejected():
    inputs = resolve_inputs("synthetic_80mmh_60min")
    inputs["debris_scenario"]["hydraulic_inlet_clogging_fraction"] = 0.4
    with pytest.raises(ValueError,match="restriction/interventions"):
        build_inp(inputs)
