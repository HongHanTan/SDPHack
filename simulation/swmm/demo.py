"""Run the real T1 validation suite and retain all evidence in a fresh directory."""

import argparse
import hashlib
import sys
import uuid
from importlib.metadata import version
from pathlib import Path

from .model import ROOT, read_json, resolve_inputs
from .runner import run_model, write_json

VALIDATION_DIR = ROOT / "data/validation/t1"


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def comparable_metrics(path: Path):
    value = read_json(path / "metrics.json")
    value.pop("run_id")
    return value


def validate_suite(directory: Path) -> dict:
    directory = directory.resolve()
    directory.mkdir(parents=True, exist_ok=False)
    runs = {}
    for label, intensity, step in (
        ("baseline",80,1), ("stronger",120,1),
        ("baseline_repeat",80,1), ("stronger_repeat",120,1),
        ("baseline_half_step",80,0.5), ("stronger_half_step",120,0.5),
    ):
        inputs = resolve_inputs(f"synthetic_{intensity}mmh_60min")
        inputs["hydrology"]["simulation_parameters"]["routing_step_s"] = step
        run = run_model(inputs, directory / label, run_id=f"t1_{label}")
        metrics = read_json(directory / label / "metrics.json")
        qa = read_json(directory / label / "qa.json")
        runs[label] = {
            "run_id":run["run_id"],"input_hash":run["input_hash"],"engine_version":run["engine_version"],
            "total_flooding_volume_m3":metrics["total_flooding_volume_m3"],"flooded_node_count":metrics["flooded_node_count"],
            "surcharge_duration_s":metrics["surcharge_duration_s"],"continuity_error_percent":qa["continuity_error_percent"],
            "nonconverging_steps_percent":qa["nonconverging_steps_percent"],"warnings":qa["warnings"],
            "artifact_sha256":{p.name:file_hash(p) for p in sorted((directory / label).iterdir())},
        }
    repeats = {}
    refinements = {}
    for label in ("baseline", "stronger"):
        base, repeat = directory / label, directory / (label + "_repeat")
        a, b = runs[label], runs[label + "_half_step"]
        repeat_ok = (
            runs[label]["input_hash"] == runs[label + "_repeat"]["input_hash"]
            and read_json(base / "frames.json")["frames"] == read_json(repeat / "frames.json")["frames"]
            and comparable_metrics(base) == comparable_metrics(repeat)
        )
        repeats[label] = {"parsed_results_exactly_equal":repeat_ok,"binary_output_exactly_equal":file_hash(base / "model.out") == file_hash(repeat / "model.out")}
        if not repeat_ok:
            raise RuntimeError(f"Reproducibility failed for {label}")
        difference = abs(a["total_flooding_volume_m3"] - b["total_flooding_volume_m3"])
        # Trace baseline flooding is checked with an absolute tolerance; using a
        # relative percentage of near-zero volume would be misleading.
        tolerance = max(0.1, a["total_flooding_volume_m3"] * 0.01)
        if difference > tolerance:
            raise RuntimeError(f"Routing-step refinement failed for {label}")
        refinements[label] = {"flood_volume_absolute_difference_m3":difference,"acceptance_tolerance_m3":tolerance,"flooded_node_count_equal":a["flooded_node_count"] == b["flooded_node_count"],"surcharge_duration_absolute_difference_s":abs(a["surcharge_duration_s"] - b["surcharge_duration_s"])}
    baseline, stronger = runs["baseline"], runs["stronger"]
    if stronger["total_flooding_volume_m3"] <= baseline["total_flooding_volume_m3"] + 100:
        raise RuntimeError("Stronger rainfall did not produce the expected flood-volume increase in this controlled test")
    base_run = read_json(directory / "baseline/run.json")
    stronger_run = read_json(directory / "stronger/run.json")
    for key in ("assets", "hydrology", "tailwater", "debris_scenario", "intervention"):
        if base_run["input_snapshot"][key] != stronger_run["input_snapshot"][key]:
            raise RuntimeError(f"Rainfall comparison changed unrelated input: {key}")
    summary = {
        "status":"passed","model_version_id":base_run["model_version_id"],"engine":"EPA SWMM",
        "engine_version":baseline["engine_version"],"swmm_toolkit_version":version("swmm-toolkit"),
        "python_version":sys.version.split()[0],"is_verified_site_model":False,
        "runs":runs,"reproducibility":repeats,"routing_step_refinement":refinements,
        "rainfall_comparison":{"only_storm_changed":True,"baseline_intensity_mmh":80,"stronger_intensity_mmh":120,"rainfall_duration_s":3600,"simulation_duration_s":7200,"flood_volume_increase_m3":stronger["total_flooding_volume_m3"] - baseline["total_flooding_volume_m3"]},
        "warnings":["Tiny native flooding events are retained; flooded-node count changes under routing-step refinement near zero volume. Do not interpret trace events as robust site predictions.","Synthetic geometry and uncalibrated hydrology; this validation proves execution/reproducibility, not site accuracy or inlet restriction support."],
    }
    write_json(directory / "summary.json", summary)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/runtime" / f"t1-{uuid.uuid4().hex[:10]}")
    args = parser.parse_args()
    summary = validate_suite(args.output)
    print(f"T1 validation passed; evidence: {args.output.resolve()}")
    for label in ("baseline", "stronger"):
        run = summary["runs"][label]
        print(f"{label}: flooding={run['total_flooding_volume_m3']:.6f} m3, flooded_nodes={run['flooded_node_count']}, surcharge={run['surcharge_duration_s']:.3f} s, continuity={run['continuity_error_percent']}")


if __name__ == "__main__":
    main()
