"""Verify actual TCP HTTP execution and persistence across an API restart.

Run: python -m services.api.check_http [--output a-new-directory]
Requires the SWMM and development dependencies. All input is synthetic/assumed.
"""

import argparse
import hashlib
import os
import socket
import subprocess
import sys
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

import httpx

from services.api.app.schemas import FramesResponse, MetricsResponse, RunResponse, StormRecord
from simulation.swmm.model import ROOT, canonical_hash, read_json
from simulation.swmm.runner import write_json


def expect(response: httpx.Response, status: int = 200):
    if response.status_code != status:
        raise RuntimeError(f"Unexpected HTTP {response.status_code} from {response.request.url}: {response.text}")
    return response.json()


@contextmanager
def server(directory: Path, label: str):
    with socket.socket() as probe:
        probe.bind(("127.0.0.1",0))
        port = probe.getsockname()[1]
    env = {**os.environ,"FLOODOPS_DATA_DIR":str(directory / "runtime")}
    with (directory / f"{label}-server.log").open("w",encoding="utf-8") as log:
        process = subprocess.Popen([sys.executable,"-m","uvicorn","services.api.app.main:app","--host","127.0.0.1","--port",str(port),"--workers","1"],cwd=ROOT,env=env,stdout=log,stderr=subprocess.STDOUT,creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
        try:
            with httpx.Client(base_url=f"http://127.0.0.1:{port}",timeout=10,trust_env=False) as client:
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    if process.poll() is not None:
                        raise RuntimeError(f"API exited; inspect {label}-server.log")
                    try:
                        expect(client.get("/api/health"))
                        break
                    except httpx.TransportError:
                        time.sleep(0.05)
                else:
                    raise RuntimeError("API startup timed out")
                yield client
        finally:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def execute_run(client: httpx.Client, directory: Path, label: str, storm_id: str) -> dict:
    path = directory / label
    path.mkdir()
    request = {"model_version_id":"taman_kyra_synthetic_v1","storm_id":storm_id,"debris_scenario_id":"demo_inlet_clean","tailwater_case":"normal","intervention":None}
    write_json(path / "request.json",request)
    accepted = expect(client.post("/api/simulations",json=request),202)
    write_json(path / "accepted.json",accepted)
    run_id = accepted["run_id"]
    initial_result = client.get(f"/api/simulations/{run_id}/frames")
    if initial_result.status_code == 409:
        if initial_result.json()["error"]["code"] != "RESULTS_NOT_READY":
            raise RuntimeError("Unexpected pre-completion error")
        write_json(path / "not-ready.json",initial_result.json())
    elif initial_result.status_code != 200:
        expect(initial_result)
    statuses = []
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        run = expect(client.get(f"/api/simulations/{run_id}"))
        statuses.append(run["status"])
        if run["status"] == "failed":
            raise RuntimeError(f"Actual SWMM HTTP run failed: {run['error']}")
        if run["status"] == "succeeded":
            break
        time.sleep(0.05)
    else:
        raise RuntimeError("HTTP simulation completion timed out")
    RunResponse.model_validate(run)
    if canonical_hash(run["input_snapshot"]) != run["input_hash"]:
        raise RuntimeError("HTTP run input hash mismatch")
    frames = expect(client.get(f"/api/simulations/{run_id}/frames"))
    metrics = expect(client.get(f"/api/simulations/{run_id}/metrics"))
    FramesResponse.model_validate(frames)
    MetricsResponse.model_validate(metrics)
    for kind,value in (("run",run),("frames",frames),("metrics",metrics)):
        write_json(path / f"{kind}.json",value)
    for name in ("model.inp","model.rpt","model.out","qa.json","worker.log"):
        response = client.get(f"/api/simulations/{run_id}/artifacts/{name}")
        if response.status_code != 200 or response.content != (directory / "runtime/runs" / run_id / name).read_bytes():
            raise RuntimeError(f"HTTP artifact download differs from retained native file: {name}")
    return {"run":run,"frames":frames,"metrics":metrics,"observed_statuses":statuses}


def check(directory: Path) -> dict:
    directory = directory.resolve()
    directory.mkdir(parents=True,exist_ok=False)
    with server(directory,"initial") as client:
        health = expect(client.get("/api/health"))
        if not health["swmm"]["available"] or not health["capabilities"]["simulations"]:
            raise RuntimeError("Actual native engine or implemented simulation API is unavailable")
        write_json(directory / "health.json",health)
        write_json(directory / "bootstrap.json",expect(client.get("/api/bootstrap")))
        baseline = execute_run(client,directory,"baseline","synthetic_80mmh_60min")
        storm_request = {"name":"Assumed custom 120 mm/h","intensity_mmh":120,"duration_s":3600,"source_type":"assumed","pattern":"constant","notes":"Synthetic demonstration rainfall; not a measured site event."}
        storm = expect(client.post("/api/storms",json=storm_request),201)
        StormRecord.model_validate(storm)
        write_json(directory / "storm-create-request.json",storm_request)
        write_json(directory / "storm-created.json",storm)
        stronger = execute_run(client,directory,"stronger",storm["storm_id"])
        if stronger["metrics"]["total_flooding_volume_m3"] <= baseline["metrics"]["total_flooding_volume_m3"] + 100:
            raise RuntimeError("HTTP rainfall change did not produce expected controlled flood response")
        if expect(client.get(f"/api/simulations/{baseline['run']['run_id']}")) != baseline["run"]:
            raise RuntimeError("Creating another storm/run altered the baseline")
        unsupported = expect(client.post("/api/simulations",json={**read_json(directory / "baseline/request.json"),"debris_scenario_id":"demo_inlet_40pct"}),422)
        write_json(directory / "unsupported.json",unsupported)
        unknown = expect(client.get("/api/simulations/missing"),404)
        write_json(directory / "not-found.json",unknown)
    # The API process is stopped and a new process opens the same SQLite/files.
    # No old in-memory service object is reused for these persistence assertions.
    with server(directory,"restart") as restarted:
        if expect(restarted.get(f"/api/storms/{storm['storm_id']}")) != storm:
            raise RuntimeError("Custom storm did not survive API process restart")
        for label,value in (("baseline",baseline),("stronger",stronger)):
            run_id = value["run"]["run_id"]
            for kind,suffix in (("run",""),("frames","/frames"),("metrics","/metrics")):
                if expect(restarted.get(f"/api/simulations/{run_id}{suffix}")) != value[kind]:
                    raise RuntimeError(f"Saved {label} {kind} changed across API restart")
        ids = {r["run_id"] for r in expect(restarted.get("/api/simulations"))["items"]}
        if not {baseline["run"]["run_id"],stronger["run"]["run_id"]} <= ids:
            raise RuntimeError("Persisted run history is incomplete")
    summary = {
        "status":"passed","transport":"actual TCP HTTP on loopback","api_version":health["api_version"],
        "engine_version":health["swmm"]["engine_version"],"is_verified_site_model":False,
        "restart_persistence_verified":True,"baseline_input_unchanged":True,
        "runs":{label:{"run_id":value["run"]["run_id"],"input_hash":value["run"]["input_hash"],"total_flooding_volume_m3":value["metrics"]["total_flooding_volume_m3"],"frame_count":len(value["frames"]["frames"]),"observed_statuses":value["observed_statuses"]} for label,value in (("baseline",baseline),("stronger",stronger))},
        "artifact_sha256":{str(path.relative_to(directory)).replace("\\","/"):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.rglob("*")) if path.is_file()},
    }
    write_json(directory / "summary.json",summary)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=ROOT / "data/runtime" / f"t2-http-{uuid.uuid4().hex[:10]}")
    args = parser.parse_args()
    summary = check(args.output)
    print(f"Actual HTTP and API-restart persistence checks passed: {args.output.resolve()}")
    for label,run in summary["runs"].items():
        print(f"{label}: {run['run_id']}, flood volume={run['total_flooding_volume_m3']:.6f} m3")
