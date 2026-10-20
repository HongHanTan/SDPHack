import sqlite3
import hashlib

import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.schemas import DebrisScenario
from simulation.swmm.model import ROOT, canonical_hash, read_json, resolve_inputs
from simulation.swmm.runner import run_model
from test_inspections import INSPECTION, PNG
from test_simulations import REQUEST, wait_run

DEBRIS = {"name":"Assumed D07 loss","inlet_id":"INLET-D07","storm_id":"synthetic_120mmh_60min","hydraulic_inlet_clogging_fraction":0.4}


def test_retained_t3_tcp_restart_native_and_mass_evidence():
    directory = ROOT / "data/validation/t3"
    summary = read_json(directory / "summary.json")
    assert summary["status"] == "passed" and summary["engine_version"] == "5.2.4"
    assert summary["restart_persistence_verified"] and summary["baseline_input_unchanged"]
    assert summary["inspection_media_snapshot_immutable"] and summary["repeat_binary_exact"]
    assert summary["debris_max_abs_balance_error_kg"] < 1e-12
    for name,digest in summary["artifact_sha256"].items():
        assert hashlib.sha256((directory / name).read_bytes()).hexdigest() == digest


@pytest.fixture(scope="module")
def inlet_runs(tmp_path_factory):
    pytest.importorskip("swmm.toolkit.solver")
    directory = tmp_path_factory.mktemp("t3") / "runtime"
    values = []
    with TestClient(create_app(directory)) as client:
        inspection = client.post("/api/inspections",json=INSPECTION).json()
        for fraction in (0,0.2,0.4,0.6):
            created = client.post("/api/debris/scenarios",json={**DEBRIS,"inspection_id":inspection["inspection_id"],"hydraulic_inlet_clogging_fraction":fraction})
            assert created.status_code == 201,created.text
            scenario = created.json()
            DebrisScenario.model_validate(scenario)
            assert scenario["parameters"]["hydraulic_inlet_clogging_fraction"] == fraction
            assert scenario["inspection_snapshot"]["visible_grate_coverage_fraction"] == 0.65
            accepted = client.post("/api/simulations",json={**REQUEST,"storm_id":DEBRIS["storm_id"],"debris_scenario_id":scenario["debris_scenario_id"]})
            assert accepted.status_code == 202,accepted.text
            run = wait_run(client,accepted.json()["run_id"])
            assert run["status"] == "succeeded",run["error"]
            metrics = client.get(f"/api/simulations/{run['run_id']}/metrics").json()
            frames = client.get(f"/api/simulations/{run['run_id']}/frames").json()
            values.append({"scenario":scenario,"run":run,"metrics":metrics,"frames":frames})
        yield client,directory,inspection,values


def test_native_capacity_loss_changes_capture_bypass_and_sewer_results(inlet_runs):
    client,directory,_inspection,runs = inlet_runs
    captures, bypasses = [], []
    original_assets = resolve_inputs("synthetic_120mmh_60min")["assets"]
    for value in runs:
        run,frames,metrics,scenario = (value[k] for k in ("run","frames","metrics","scenario"))
        snapshot = run["input_snapshot"]
        assert snapshot["assets"] == original_assets  # No pipe diameter/roughness substitution.
        assert canonical_hash(snapshot) == run["input_hash"]
        assert snapshot["debris_scenario"]["mass_balance"] == scenario["mass_balance"]
        assert snapshot["debris_scenario"]["inspection_snapshot"] == scenario["inspection_snapshot"]
        native_inp = snapshot["swmm_input"]
        assert "[INLET_USAGE]" in native_inp and "[INLETS]" in native_inp
        assert "AUX-BYPASS-INLET-D07" in native_inp
        qa = read_json(directory / "runs" / run["run_id"] / "qa.json")
        assert all(abs(x)<1 for x in qa["continuity_error_percent"].values())
        assert qa["nonconverging_steps_percent"] < 1
        assert len(frames["frames"]) == 120
        for frame in frames["frames"]:
            assert len(frame["node_states"]) == 9 and len(frame["pipe_states"]) == 8 and len(frame["inlet_states"]) == 4
            inlet = next(x for x in frame["inlet_states"] if x["inlet_id"] == "INLET-D07")
            assert inlet["hydraulic_inlet_clogging_fraction"] == scenario["parameters"]["hydraulic_inlet_clogging_fraction"]
            assert inlet["capture_flow_m3s"] is not None and inlet["bypass_flow_m3s"] is not None
        inlet = next(x for x in metrics["inlet_volumes"] if x["inlet_id"] == "INLET-D07")
        captures.append(inlet["captured_volume_m3"])
        bypasses.append(inlet["bypass_volume_m3"])
        assert metrics["warnings"] and "not a calibrated" in metrics["metric_definitions"]["inlet_volumes"]
        assert client.get(f"/api/debris/scenarios/{scenario['debris_scenario_id']}").json() == scenario
    assert all(a>b+100 for a,b in zip(captures,captures[1:]))
    assert all(a+100<b for a,b in zip(bypasses,bypasses[1:]))
    assert runs[0]["metrics"]["surcharge_duration_s"] != runs[-1]["metrics"]["surcharge_duration_s"]
    assert len({r["run"]["input_hash"] for r in runs}) == 4
    assert all(r["scenario"]["mass_balance"] == runs[0]["scenario"]["mass_balance"] for r in runs)


def test_native_repeat_and_half_step_keep_physical_effect(inlet_runs,tmp_path):
    _client,_directory,_inspection,values = inlet_runs
    value = values[2]
    snapshot = value["run"]["input_snapshot"]
    original = next(x for x in value["metrics"]["inlet_volumes"] if x["inlet_id"] == "INLET-D07")
    repeated = run_model(snapshot,tmp_path / "repeat")
    assert repeated["input_hash"] == value["run"]["input_hash"]
    repeat = read_json(tmp_path / "repeat/metrics.json")
    assert repeat["inlet_volumes"] == value["metrics"]["inlet_volumes"]
    import copy
    half = copy.deepcopy(snapshot)
    half["hydrology"]["simulation_parameters"]["routing_step_s"] = 0.5
    run_model(half,tmp_path / "half")
    finer = next(x for x in read_json(tmp_path / "half/metrics.json")["inlet_volumes"] if x["inlet_id"] == "INLET-D07")
    assert finer["captured_volume_m3"] == pytest.approx(original["captured_volume_m3"],rel=0.005)
    assert finer["bypass_volume_m3"] == pytest.approx(original["bypass_volume_m3"],rel=0.005)


def test_debris_inspection_snapshot_does_not_change_when_media_is_appended(inlet_runs):
    client,directory,inspection,values = inlet_runs
    scenario = values[2]["scenario"]
    response = client.post(f"/api/inspections/{inspection['inspection_id']}/media",files={"file":("test.png",PNG,"image/png")})
    assert response.status_code == 201
    assert client.get(f"/api/debris/scenarios/{scenario['debris_scenario_id']}").json() == scenario
    assert client.get(f"/api/inspections/{inspection['inspection_id']}").json()["media"]
    with sqlite3.connect(directory / "floodops.sqlite3") as db:
        with pytest.raises(sqlite3.IntegrityError,match="append-only"):
            db.execute("UPDATE debris_scenarios SET payload='{}'")
    boot = client.get("/api/bootstrap").json()
    assert scenario["debris_scenario_id"] in {x["debris_scenario_id"] for x in boot["debris_scenarios"]}
    assert boot["capabilities"]["inspections"] and boot["capabilities"]["debris"]


@pytest.mark.parametrize("patch,status,code",[
    ({"inlet_id":"missing"},404,"NOT_FOUND"),({"inlet_id":"PIPE-P07"},422,"VALIDATION_ERROR"),
    ({"storm_id":"missing"},404,"NOT_FOUND"),({"inspection_id":"missing"},404,"NOT_FOUND"),
    ({"hydraulic_inlet_clogging_fraction":0.7},422,"VALIDATION_ERROR"),
    ({"debris_parameters":{"capture_fraction":-0.1}},422,"VALIDATION_ERROR"),
    ({"debris_parameters":{"cleaning_events":[{"timestamp_s":7800}]}},422,"VALIDATION_ERROR"),
])
def test_invalid_debris_is_rejected(tmp_path,patch,status,code):
    with TestClient(create_app(tmp_path / "runtime")) as client:
        result = client.post("/api/debris/scenarios",json={**DEBRIS,**patch})
        assert result.status_code == status and result.json()["error"]["code"] == code


def test_inspection_join_storm_binding_and_restart(tmp_path):
    directory = tmp_path / "runtime"
    with TestClient(create_app(directory)) as client:
        inspection = client.post("/api/inspections",json={**INSPECTION,"asset_id":"INLET-D01"}).json()
        assert client.post("/api/debris/scenarios",json={**DEBRIS,"inspection_id":inspection["inspection_id"]}).status_code == 422
        scenario = client.post("/api/debris/scenarios",json=DEBRIS).json()
        error = client.post("/api/simulations",json={**REQUEST,"debris_scenario_id":scenario["debris_scenario_id"]})
        assert error.status_code == 422 and error.json()["error"]["code"] == "SCENARIO_STORM_MISMATCH"
        assert client.get("/api/simulations").json()["items"] == []
        assert client.get("/api/debris/scenarios/missing").status_code == 404
    with TestClient(create_app(directory)) as restarted:
        assert restarted.get(f"/api/debris/scenarios/{scenario['debris_scenario_id']}").json() == scenario


@pytest.mark.parametrize("intensity,duration",[(0,300),(300,21600)])
def test_native_inlets_execute_dry_control_and_maximum_supported_storm(tmp_path,intensity,duration):
    pytest.importorskip("swmm.toolkit.solver")
    with TestClient(create_app(tmp_path / "runtime")) as client:
        storm = client.post("/api/storms",json={"name":"Native boundary control","intensity_mmh":intensity,"duration_s":duration}).json()
        accepted = client.post("/api/simulations",json={**REQUEST,"storm_id":storm["storm_id"],"debris_scenario_id":"demo_inlet_40pct"})
        assert accepted.status_code == 202
        run = wait_run(client,accepted.json()["run_id"])
        assert run["status"] == "succeeded",run["error"]
        frames = client.get(f"/api/simulations/{run['run_id']}/frames").json()["frames"]
        metrics = client.get(f"/api/simulations/{run['run_id']}/metrics").json()
        assert len(frames) == (duration+3600)//60
        if intensity == 0:
            assert metrics["total_flooding_volume_m3"] == 0
            assert all(i["captured_volume_m3"] == i["backflow_volume_m3"] == i["bypass_volume_m3"] == 0 for i in metrics["inlet_volumes"])
