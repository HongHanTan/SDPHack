import sqlite3
import threading
import time
import hashlib

import pytest
from fastapi.testclient import TestClient

from services.api.app.main import create_app
from services.api.app.schemas import SimulationRequest
from simulation.swmm.model import ROOT, canonical_hash, read_json

REQUEST = {"model_version_id":"taman_kyra_synthetic_v1","storm_id":"synthetic_80mmh_60min","debris_scenario_id":"demo_inlet_clean","tailwater_case":"normal","intervention":None}


def test_retained_actual_http_restart_evidence():
    directory = ROOT / "data/validation/t2"
    summary = read_json(directory / "summary.json")
    assert summary["status"] == "passed"
    assert summary["transport"] == "actual TCP HTTP on loopback"
    assert summary["restart_persistence_verified"] and summary["baseline_input_unchanged"]
    for name,digest in summary["artifact_sha256"].items():
        assert hashlib.sha256((directory / name).read_bytes()).hexdigest() == digest


def wait_run(client,run_id,timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        response = client.get(f"/api/simulations/{run_id}")
        assert response.status_code == 200
        run = response.json()
        if run["status"] in ("succeeded","failed"):
            return run
        time.sleep(0.02)
    pytest.fail(f"Run {run_id} did not reach a terminal state")


@pytest.fixture(scope="module")
def http_runs(tmp_path_factory):
    pytest.importorskip("swmm.toolkit.solver")
    directory = tmp_path_factory.mktemp("api-real") / "runtime"
    with TestClient(create_app(directory)) as client:
        storm_request = {"name":"Assumed custom 120 mm/h","intensity_mmh":120,"duration_s":3600,"source_type":"assumed"}
        storm_response = client.post("/api/storms",json=storm_request)
        assert storm_response.status_code == 201
        custom_storm = storm_response.json()
        runs = []
        for storm_id in (REQUEST["storm_id"],custom_storm["storm_id"]):
            response = client.post("/api/simulations",json={**REQUEST,"storm_id":storm_id})
            assert response.status_code == 202 and response.json()["status"] == "queued"
            run = wait_run(client,response.json()["run_id"])
            assert run["status"] == "succeeded", run["error"]
            runs.append({"run":run,"frames":client.get(f"/api/simulations/{run['run_id']}/frames").json(),"metrics":client.get(f"/api/simulations/{run['run_id']}/metrics").json()})
        yield client,directory,custom_storm,runs


def test_http_real_rainfall_response_and_frozen_inputs(http_runs):
    client,_directory,storm,runs = http_runs
    baseline,stronger = runs
    assert baseline["metrics"]["total_flooding_volume_m3"] < 0.1
    assert stronger["metrics"]["total_flooding_volume_m3"] > 700
    assert storm["parameters"]["intensity_mmh"] == 120
    assert baseline["run"]["input_hash"] != stronger["run"]["input_hash"]
    for result in runs:
        run = result["run"]
        assert canonical_hash(run["input_snapshot"]) == run["input_hash"]
        assert run["created_at"] <= run["started_at"] <= run["completed_at"]
        assert result["metrics"]["result_type"] == "simulated"
        assert result["metrics"]["is_verified_site_model"] is False
        assert len(result["frames"]["frames"]) == 120
        assert client.get(f"/api/simulations/{run['run_id']}").json() == run
    assert client.get(f"/api/storms/{storm['storm_id']}").json() == storm
    assert {r["run"]["run_id"] for r in runs} <= {r["run_id"] for r in client.get("/api/simulations").json()["items"]}


def test_raw_evidence_download_and_result_integrity(http_runs):
    client,directory,_storm,runs = http_runs
    run_id = runs[1]["run"]["run_id"]
    for name in ("model.inp","model.rpt","model.out","qa.json","worker.log"):
        response = client.get(f"/api/simulations/{run_id}/artifacts/{name}")
        assert response.status_code == 200
        assert response.content == (directory / "runs" / run_id / name).read_bytes()
    assert client.get(f"/api/simulations/{run_id}/artifacts/floodops.sqlite3").status_code == 404
    assert client.get(f"/api/simulations/{run_id}/artifacts/metrics.json").status_code == 404
    path = directory / "runs" / run_id / "metrics.json"
    original = path.read_bytes()
    try:
        path.write_bytes(b'{"fabricated":true}')
        response = client.get(f"/api/simulations/{run_id}/metrics")
        assert response.status_code == 500
        assert response.json()["error"]["code"] == "RESULT_ARTIFACT_INVALID"
        path.unlink()
        assert client.get(f"/api/simulations/{run_id}/metrics").status_code == 500
    finally:
        path.write_bytes(original)


def test_sqlite_enforces_storm_and_input_immutability(http_runs):
    _client,directory,storm,runs = http_runs
    with sqlite3.connect(directory / "floodops.sqlite3") as db:
        with pytest.raises(sqlite3.IntegrityError,match="immutable"):
            db.execute("UPDATE storms SET payload='{}' WHERE id=?",(storm["storm_id"],))
        with pytest.raises(sqlite3.IntegrityError,match="immutable"):
            db.execute("UPDATE runs SET payload=json_set(payload,'$.input_hash','altered') WHERE id=?",(runs[0]["run"]["run_id"],))


def test_restart_preserves_custom_storm_run_and_result(tmp_path):
    pytest.importorskip("swmm.toolkit.solver")
    directory = tmp_path / "runtime"
    with TestClient(create_app(directory)) as client:
        storm = client.post("/api/storms",json={"name":"Shorter 120 mm/h","intensity_mmh":120,"duration_s":1800}).json()
        accepted = client.post("/api/simulations",json={**REQUEST,"storm_id":storm["storm_id"]}).json()
        run = wait_run(client,accepted["run_id"])
        assert run["status"] == "succeeded",run["error"]
        frames = client.get(f"/api/simulations/{run['run_id']}/frames").json()
        metrics = client.get(f"/api/simulations/{run['run_id']}/metrics").json()
        assert frames["frames"][-1]["timestamp_s"] == 5400
        assert len(frames["frames"]) == 90
    with TestClient(create_app(directory)) as restarted:
        assert restarted.get(f"/api/storms/{storm['storm_id']}").json() == storm
        assert restarted.get(f"/api/simulations/{run['run_id']}").json() == run
        assert restarted.get(f"/api/simulations/{run['run_id']}/frames").json() == frames
        assert restarted.get(f"/api/simulations/{run['run_id']}/metrics").json() == metrics
        assert storm["storm_id"] in {s["storm_id"] for s in restarted.get("/api/bootstrap").json()["storms"]}


def test_zero_rainfall_is_executed_as_zero_not_a_default_storm(tmp_path):
    pytest.importorskip("swmm.toolkit.solver")
    with TestClient(create_app(tmp_path / "runtime")) as client:
        storm = client.post("/api/storms",json={"name":"Dry control","intensity_mmh":0,"duration_s":300}).json()
        accepted = client.post("/api/simulations",json={**REQUEST,"storm_id":storm["storm_id"]}).json()
        run = wait_run(client,accepted["run_id"])
        assert run["status"] == "succeeded",run["error"]
        metrics = client.get(f"/api/simulations/{run['run_id']}/metrics").json()
        assert metrics["total_flooding_volume_m3"] == 0
        assert run["input_snapshot"]["storm"]["parameters"]["intensity_mmh"] == 0
        frames = client.get(f"/api/simulations/{run['run_id']}/frames").json()["frames"]
        assert len(frames) == 65 and frames[-1]["timestamp_s"] == 3900


def test_queue_is_nonblocking_and_not_ready_has_no_fake_results(tmp_path,monkeypatch):
    pytest.importorskip("swmm.toolkit.solver")
    import services.api.app.service as module
    original = module.run_model
    gate = threading.Event()
    started = threading.Event()

    def delayed(*args,**kwargs):
        started.set()
        if not gate.wait(10):
            raise RuntimeError("Test routing gate timed out")
        return original(*args,**kwargs)

    monkeypatch.setattr(module,"run_model",delayed)
    with TestClient(create_app(tmp_path / "runtime",max_pending=2)) as client:
        try:
            first = client.post("/api/simulations",json=REQUEST)
            assert first.status_code == 202
            assert started.wait(3),"Native job never started"
            run_id = first.json()["run_id"]
            for kind in ("frames","metrics"):
                response = client.get(f"/api/simulations/{run_id}/{kind}")
                assert response.status_code == 409
                assert response.json()["error"]["code"] == "RESULTS_NOT_READY"
                assert "frames" not in response.json()
            second = client.post("/api/simulations",json=REQUEST)
            assert second.status_code == 202
            assert client.get(f"/api/simulations/{second.json()['run_id']}").json()["status"] == "queued"
            full = client.post("/api/simulations",json=REQUEST)
            assert full.status_code == 429 and full.json()["error"]["code"] == "QUEUE_FULL"
        finally:
            gate.set()
        assert wait_run(client,run_id)["status"] == "succeeded"
        assert wait_run(client,second.json()["run_id"])["status"] == "succeeded"


@pytest.mark.parametrize("case",["unavailable","timeout"])
def test_engine_failure_is_persisted_with_logs_and_survives_restart(tmp_path,monkeypatch,case):
    directory = tmp_path / "runtime"
    if case == "unavailable":
        import services.api.app.service as module
        monkeypatch.setattr(module,"probe_engine",lambda:{"available":False,"message":"Test native loader failure"})
        timeout = 120
        expected = "ENGINE_UNAVAILABLE"
    else:
        pytest.importorskip("swmm.toolkit.solver")
        timeout = 0.000001
        expected = "SWMM_TIMEOUT"
    with TestClient(create_app(directory,run_timeout_s=timeout)) as client:
        response = client.post("/api/simulations",json=REQUEST)
        assert response.status_code == 202
        run = wait_run(client,response.json()["run_id"])
        assert run["status"] == "failed"
        assert run["error"]["code"] == expected
        failed = client.get(f"/api/simulations/{run['run_id']}/metrics")
        assert failed.status_code == 409 and failed.json()["error"]["code"] == "SIMULATION_FAILED"
        assert client.get(run["error"]["details"]["events_url"]).status_code == 200
    with TestClient(create_app(directory)) as restarted:
        assert restarted.get(f"/api/simulations/{run['run_id']}").json() == run


def test_restart_marks_unfinished_runs_failed_without_retrying(tmp_path):
    directory = tmp_path / "runtime"
    with TestClient(create_app(directory)) as client:
        service = client.app.state.scenarios
        snapshot = service.resolve(SimulationRequest(**REQUEST))
        frozen = {"run_id":"run_interrupted","status":"queued","model_version_id":REQUEST["model_version_id"],"input_snapshot":snapshot,"input_hash":canonical_hash(snapshot),"engine":"EPA SWMM","engine_version":None,"is_verified_site_model":False,"assumptions":[],"warnings":[],"error":None,"evidence_references":[],"created_at":"2026-10-19T00:00:00+00:00"}
    # Simulate a persisted job left by an abruptly terminated API, without
    # invoking the normal shutdown cancellation path.
    service.store.create_run(frozen,max_pending=8)
    with TestClient(create_app(directory)) as restarted:
        run = restarted.get("/api/simulations/run_interrupted").json()
        assert run["status"] == "failed" and run["error"]["code"] == "RUN_INTERRUPTED"
        assert run["input_hash"] == frozen["input_hash"]
        assert restarted.get("/api/simulations/run_interrupted/frames").status_code == 409


def test_same_runtime_cannot_be_opened_by_two_api_processes(tmp_path):
    directory = tmp_path / "runtime"
    with TestClient(create_app(directory)):
        with pytest.raises(RuntimeError,match="already in use"):
            with TestClient(create_app(directory)):
                pytest.fail("Second API instance acquired the runtime")
    with TestClient(create_app(directory)) as restarted:
        assert restarted.get("/api/bootstrap").status_code == 200


@pytest.mark.parametrize("patch,code,status",[
    ({"model_version_id":"missing"},"NOT_FOUND",404),
    ({"storm_id":"missing"},"NOT_FOUND",404),
    ({"debris_scenario_id":"missing"},"NOT_FOUND",404),
    ({"tailwater_case":"missing"},"NOT_FOUND",404),
    ({"tailwater_case":"high"},"UNSUPPORTED_SCENARIO",422),
])
def test_bad_references_and_unsupported_scenarios_do_not_create_runs(tmp_path,patch,code,status):
    with TestClient(create_app(tmp_path / "runtime")) as client:
        response = client.post("/api/simulations",json={**REQUEST,**patch})
        assert response.status_code == status
        assert response.json()["error"]["code"] == code
        assert client.get("/api/simulations").json()["items"] == []


@pytest.mark.parametrize("patch",[
    {"duration_s":301},{"duration_s":0},{"duration_s":86400},{"duration_s":"3600"},
    {"intensity_mmh":-1},{"intensity_mmh":301},{"intensity_mmh":"NaN"},
    {"hyetograph":[1,2,3]},{"pattern":"hyetograph"},{"name":"  "},
])
def test_custom_storm_validation_is_explicit(tmp_path,patch):
    with TestClient(create_app(tmp_path / "runtime")) as client:
        response = client.post("/api/storms",json={"name":"Assumed rain","intensity_mmh":80,"duration_s":3600,**patch})
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "VALIDATION_ERROR"
        assert len(client.get("/api/bootstrap").json()["storms"]) == 2
