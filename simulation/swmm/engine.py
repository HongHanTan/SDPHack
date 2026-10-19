"""Probe the native toolkit without claiming a model has been executed."""

import json
import hashlib
from importlib.metadata import version as package_version
from pathlib import Path

VALIDATION_DIR = Path(__file__).resolve().parents[2] / "data/validation/t1"


def verified_execution(engine_version: str) -> bool:
    """Recognize retained project validation, never infer it from an import alone."""
    try:
        from .model import canonical_hash, resolve_inputs
        from .runner import snapshot_inputs

        summary = json.loads((VALIDATION_DIR / "summary.json").read_text(encoding="utf-8"))
        if summary["status"] != "passed" or summary["engine_version"] != engine_version or summary["swmm_toolkit_version"] != package_version("swmm-toolkit"):
            return False
        for label, intensity in (("baseline",80),("stronger",120)):
            evidence = summary["runs"][label]
            if canonical_hash(snapshot_inputs(resolve_inputs(f"synthetic_{intensity}mmh_60min"))) != evidence["input_hash"]:
                return False
            for filename in ("model.inp", "model.rpt", "model.out", "native.json", "qa.json"):
                digest = hashlib.sha256((VALIDATION_DIR / label / filename).read_bytes()).hexdigest()
                if digest != evidence["artifact_sha256"][filename]:
                    return False
        return True
    except (OSError, ValueError, KeyError, TypeError, ImportError):
        return False


def probe_engine() -> dict:
    try:
        from swmm.toolkit import solver

        version = solver.swmm_version_info()
        verified = verified_execution(version)
        return {
            "available": True,
            "engine": "EPA SWMM",
            "engine_version": version,
            "execution_verified": verified,
            "message": "Native library loaded; retained T1 baseline/stronger-rain evidence matches this engine/toolkit and current model inputs. HTTP simulation execution remains unavailable until T2." if verified else "Native library loaded; matching complete project validation evidence is unavailable or stale.",
        }
    except Exception as exc:
        # Native library loading can fail independently of the package import.
        return {
            "available": False,
            "engine": "EPA SWMM",
            "engine_version": None,
            "execution_verified": False,
            "message": f"Native engine unavailable: {type(exc).__name__}: {exc}",
        }


if __name__ == "__main__":
    print(json.dumps(probe_engine(), indent=2))
