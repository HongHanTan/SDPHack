"""Execute and preserve one isolated SWMM run. No HTTP or mock computation here."""

import copy
import json
import subprocess
import sys
import uuid
from pathlib import Path

from .model import ROOT, build_inp, canonical_hash, read_json
from .results import NumericalQAError, parse_results


class SimulationError(RuntimeError):
    def __init__(self, code: str, message: str, directory: Path):
        super().__init__(message)
        self.code = code
        self.directory = directory


def write_json(path: Path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")


def snapshot_inputs(inputs: dict) -> dict:
    return {**copy.deepcopy(inputs), "swmm_input":build_inp(inputs)}


def run_model(inputs: dict, directory: Path, run_id: str | None = None, timeout_s: float = 120) -> dict:
    directory = directory.resolve()
    # A run never overwrites existing evidence, including files from a failed run.
    directory.mkdir(parents=True, exist_ok=False)
    snapshot = snapshot_inputs(inputs)
    run = {
        "run_id":run_id or f"run_{uuid.uuid4().hex}", "status":"running",
        "model_version_id":inputs["assets"]["model_version_id"],
        "input_snapshot":snapshot,"input_hash":canonical_hash(snapshot),
        "engine":"EPA SWMM","engine_version":None,"is_verified_site_model":False,
        "assumptions":inputs["assets"]["assumptions"] + inputs["hydrology"]["assumptions"],
        "warnings":[],"error":None,"evidence_references":[],
    }
    write_json(directory / "inputs.json", snapshot)
    write_json(directory / "run.json", run)
    (directory / "model.inp").write_text(snapshot["swmm_input"], encoding="utf-8")
    try:
        with (directory / "worker.log").open("w", encoding="utf-8") as log:
            result = subprocess.run([sys.executable, "-m", "simulation.swmm.worker", str(directory)], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, timeout=timeout_s, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
        if result.returncode:
            detail = read_json(directory / "worker-error.json")["error"]["message"] if (directory / "worker-error.json").exists() else "Native worker failed; inspect worker.log"
            raise SimulationError("SWMM_EXECUTION_FAILED", detail, directory)
        frames, metrics, qa = parse_results(directory, snapshot, run["run_id"])
        write_json(directory / "frames.json", frames)
        write_json(directory / "metrics.json", metrics)
        write_json(directory / "qa.json", qa)
        run.update(status="succeeded",engine_version=metrics["engine_version"],warnings=qa["warnings"])
    except Exception as exc:
        code = "SWMM_TIMEOUT" if isinstance(exc, subprocess.TimeoutExpired) else "NUMERICAL_QA_FAILED" if isinstance(exc, NumericalQAError) else getattr(exc, "code", "SWMM_EXECUTION_FAILED")
        run.update(status="failed", error={"code":code,"message":str(exc),"details":{"artifacts_directory":str(directory)}})
        write_json(directory / "run.json", run)
        raise SimulationError(code, str(exc), directory) from exc
    run["evidence_references"] = [str(path.relative_to(ROOT)).replace("\\", "/") if path.is_relative_to(ROOT) else str(path) for path in sorted(directory.iterdir()) if path.name != "run.json"]
    write_json(directory / "run.json", run)
    return run
