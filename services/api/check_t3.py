"""Retain real TCP inspection -> media -> debris -> native inlet runs + restart proof.

Run from repository root: python -m services.api.check_t3 [--output new-directory]
All records and the tiny image are synthetic test evidence, not site observations.
"""

import argparse
import base64
import copy
import hashlib
import uuid
from pathlib import Path

from services.api.check_http import execute_run, expect, server
from simulation.swmm.model import ROOT, canonical_hash, read_json
from simulation.swmm.runner import run_model, write_json

PIXEL = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lRkAAAAASUVORK5CYII=")


def require(condition: bool, message: str):
    if not condition:
        raise RuntimeError(message)


def d07(metrics):
    return next(x for x in metrics["inlet_volumes"] if x["inlet_id"] == "INLET-D07")


def check(directory: Path) -> dict:
    directory = directory.resolve()
    directory.mkdir(parents=True,exist_ok=False)
    runs, scenarios = {}, {}
    with server(directory,"initial") as client:
        health = expect(client.get("/api/health"))
        require(health["swmm"]["available"] and health["capabilities"]["debris"],"Native engine/debris API unavailable")
        write_json(directory / "health.json",health)
        inspection_request = {
            "asset_id":"INLET-D07","timestamp":"2026-10-19T01:00:00Z","inspector":"Synthetic validation inspector",
            "method":"visual","source_type":"synthetic","visible_grate_coverage_fraction":0.65,
            "debris_category":"leaf_litter","notes":"Generated integration record, not a site observation.",
            "source_reference":"Synthetic one-pixel image used to verify upload integrity only.",
        }
        inspection = expect(client.post("/api/inspections",json=inspection_request),201)
        write_json(directory / "inspection-request.json",inspection_request)
        write_json(directory / "inspection-created.json",inspection)
        endpoint = f"/api/inspections/{inspection['inspection_id']}"
        media = expect(client.post(endpoint+"/media",files={"file":("synthetic-pixel.png",PIXEL,"image/png")}),201)
        require(client.get(media["url"]).content == PIXEL,"Uploaded media bytes changed")
        require(media["sha256"] == hashlib.sha256(PIXEL).hexdigest(),"Media hash mismatch")
        write_json(directory / "media-created.json",media)
        (directory / "synthetic-pixel.png").write_bytes(PIXEL)
        initial_inspection = expect(client.get(endpoint))
        baseline = execute_run(client,directory,"retained-direct-baseline","synthetic_80mmh_60min")
        storm = expect(client.post("/api/storms",json={"name":"T3 assumed 120 mm/h","intensity_mmh":120,"duration_s":3600,"source_type":"assumed"}),201)
        write_json(directory / "storm-created.json",storm)
        for pct in (0,20,40,60):
            payload = {
                "name":f"T3 D07 assumed {pct}% capacity loss","inlet_id":"INLET-D07",
                "storm_id":storm["storm_id"],"inspection_id":inspection["inspection_id"],
                "hydraulic_inlet_clogging_fraction":pct/100,
                "debris_parameters":{"cleaning_events":[{"timestamp_s":1800,"surface_removal_fraction":0.5,"inlet_removal_fraction":0.5}]},
            }
            scenario = expect(client.post("/api/debris/scenarios",json=payload),201)
            require(scenario["inspection_snapshot"] == initial_inspection,"Inspection provenance not frozen")
            require(scenario["parameters"]["hydraulic_inlet_clogging_fraction"] != 0.65,"Visible coverage silently used as hydraulic loss")
            require(scenario["mass_balance"]["max_abs_balance_error_kg"] < 1e-9,"Debris mass not conserved")
            write_json(directory / f"debris-{pct}-request.json",payload)
            write_json(directory / f"debris-{pct}-created.json",scenario)
            scenarios[str(pct)] = scenario
            result = execute_run(client,directory,f"native-{pct}",storm["storm_id"],scenario["debris_scenario_id"])
            runs[str(pct)] = result
            snapshot = result["run"]["input_snapshot"]
            require(snapshot["debris_scenario"]["inspection_snapshot"] == initial_inspection,"Run lost evidence snapshot")
            require(snapshot["assets"] == baseline["run"]["input_snapshot"]["assets"],"Base asset geometry changed")
            require(len(result["frames"]["frames"][0]["node_states"]) == 9,"Auxiliary nodes leaked into public asset frames")
            qa = read_json(directory / "runtime/runs" / result["run"]["run_id"] / "qa.json")
            require(all(abs(x)<1 for x in qa["continuity_error_percent"].values()),"Inlet run exceeded 1% continuity validation limit")
            require(qa["nonconverging_steps_percent"] < 1,"Inlet run exceeded 1% convergence validation limit")
        require(all(d07(runs[str(a)]["metrics"])["captured_volume_m3"] > d07(runs[str(b)]["metrics"])["captured_volume_m3"]+100 for a,b in ((0,20),(20,40),(40,60))),"Expected controlled capture reduction absent")
        require(all(d07(runs[str(a)]["metrics"])["bypass_volume_m3"]+100 < d07(runs[str(b)]["metrics"])["bypass_volume_m3"] for a,b in ((0,20),(20,40),(40,60))),"Expected controlled bypass increase absent")
        require(all(s["mass_balance"] == scenarios["0"]["mass_balance"] for s in scenarios.values()),"Independent hydraulic hypothesis changed debris mass accounting")
        require(expect(client.get(f"/api/simulations/{baseline['run']['run_id']}")) == baseline["run"],"Native scenarios changed the retained baseline")
        extra = expect(client.post(endpoint+"/media",files={"file":("synthetic-pixel.png",PIXEL,"image/png")}),201)
        require(extra["media_id"] != media["media_id"],"Media append overwrote an existing attachment")
        latest_inspection = expect(client.get(endpoint))
        write_json(directory / "inspection-with-media.json",latest_inspection)
        write_json(directory / "bootstrap.json",expect(client.get("/api/bootstrap")))
        require(expect(client.get(f"/api/debris/scenarios/{scenarios['40']['debris_scenario_id']}")) == scenarios["40"],"Appending media altered a scenario snapshot")
    with server(directory,"restart") as restarted:
        require(expect(restarted.get(endpoint)) == latest_inspection,"Inspection/media metadata did not survive process restart")
        require(restarted.get(media["url"]).content == PIXEL,"Retained media did not survive restart")
        require(expect(restarted.get("/api/inspections?asset_id=INLET-D07"))["items"] == [latest_inspection],"Asset history changed")
        for pct,value in runs.items():
            scenario = scenarios[pct]
            require(expect(restarted.get(f"/api/debris/scenarios/{scenario['debris_scenario_id']}")) == scenario,"Debris scenario did not survive restart")
            for kind,suffix in (("run",""),("frames","/frames"),("metrics","/metrics")):
                require(expect(restarted.get(f"/api/simulations/{value['run']['run_id']}{suffix}")) == value[kind],"Run evidence changed across process restart")
        require(expect(restarted.get(f"/api/simulations/{baseline['run']['run_id']}")) == baseline["run"],"Baseline changed on restart")
    # Independently rerun the exact frozen 40% model, then halve routing step.
    original = runs["40"]
    repeated = run_model(original["run"]["input_snapshot"],directory / "repeat-40")
    repeat_metrics = read_json(directory / "repeat-40/metrics.json")
    require(repeated["input_hash"] == original["run"]["input_hash"],"Repeat input changed")
    require(repeat_metrics["inlet_volumes"] == original["metrics"]["inlet_volumes"],"Repeat native inlet volumes changed")
    original_out = directory / "runtime/runs" / original["run"]["run_id"] / "model.out"
    require(original_out.read_bytes() == (directory / "repeat-40/model.out").read_bytes(),"Repeat binary output changed")
    half = copy.deepcopy(original["run"]["input_snapshot"])
    half["hydrology"]["simulation_parameters"]["routing_step_s"] = 0.5
    run_model(half,directory / "half-step-40")
    half_metrics = read_json(directory / "half-step-40/metrics.json")
    sensitivity = {key:abs(d07(half_metrics)[key]-d07(original["metrics"])[key]) for key in ("captured_volume_m3","bypass_volume_m3")}
    require(all(delta < 0.005 * d07(original["metrics"])[key] for key,delta in sensitivity.items()),"Half-step inlet volume difference exceeded 0.5% validation tolerance")
    summary = {
        "status":"passed","transport":"actual TCP HTTP on loopback","api_version":health["api_version"],
        "engine_version":health["swmm"]["engine_version"],"is_verified_site_model":False,
        "restart_persistence_verified":True,"baseline_input_unchanged":True,
        "inspection_media_snapshot_immutable":True,"repeat_binary_exact":True,
        "half_step_absolute_difference_m3":sensitivity,
        "debris_max_abs_balance_error_kg":max(x["mass_balance"]["max_abs_balance_error_kg"] for x in scenarios.values()),
        "runs":{pct:{"run_id":value["run"]["run_id"],"input_hash":canonical_hash(value["run"]["input_snapshot"]),"d07":d07(value["metrics"]),"total_flooding_volume_m3":value["metrics"]["total_flooding_volume_m3"],"surcharge_duration_s":value["metrics"]["surcharge_duration_s"],"frame_count":len(value["frames"]["frames"])} for pct,value in runs.items()},
        "artifact_sha256":{str(path.relative_to(directory)).replace("\\","/"):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted(directory.rglob("*")) if path.is_file()},
    }
    write_json(directory / "summary.json",summary)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=ROOT / "data/runtime" / f"t3-http-{uuid.uuid4().hex[:10]}")
    args = parser.parse_args()
    result = check(args.output)
    print(f"Actual T3 HTTP, native inlet and process-restart checks passed: {args.output.resolve()}")
    for pct,run in result["runs"].items():
        print(f"D07 {pct}%: captured={run['d07']['captured_volume_m3']:.6f} m3, bypass={run['d07']['bypass_volume_m3']:.6f} m3")
