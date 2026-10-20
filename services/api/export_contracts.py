"""Export the live schema, catalog/error examples and retained real T1/T2/T3 results.

Run from repository root: python -m services.api.export_contracts
Use --check in validation/CI to detect stale handoff artifacts.
"""

import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from .app.catalog import REPO_ROOT
from .app.main import app, create_app
from .app.schemas import SimulationRequest, StormCreate
from simulation.swmm.model import read_json
from simulation.swmm.demo import VALIDATION_DIR


def dumps(value) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"


def artifacts() -> dict[Path, str]:
    directory = REPO_ROOT / "contracts"
    request = SimulationRequest(
        model_version_id="taman_kyra_synthetic_v1",
        storm_id="synthetic_80mmh_60min",
        debris_scenario_id="demo_inlet_clean",
        tailwater_case="normal",
    ).model_dump()
    # Export uses its own fresh database and never launches jobs or mutates a
    # developer's runtime. Successful T2 examples come from retained HTTP evidence.
    runtime = REPO_ROOT / "data/runtime"
    runtime.mkdir(parents=True,exist_ok=True)
    with TemporaryDirectory(prefix="contract-export-",dir=runtime) as temporary:
        with TestClient(create_app(Path(temporary))) as client:
            values = {
                directory / "openapi.json":app.openapi(),
                directory / "examples/bootstrap.json":client.get("/api/bootstrap").json(),
                directory / "examples/assets.json":client.get("/api/townships/taman_kyra_demo/assets").json(),
                directory / "examples/simulation-request.json":request,
                directory / "examples/simulation-unsupported.json":client.post("/api/simulations",json={**request,"tailwater_case":"high"}).json(),
                directory / "examples/validation-error.json":client.post("/api/simulations",json={}).json(),
                directory / "examples/storm-create-request.json":StormCreate(name="Assumed custom 120 mm/h",intensity_mmh=120,duration_s=3600).model_dump(),
            }
    for label in ("baseline", "stronger"):
        for kind in ("run", "frames", "metrics"):
            values[directory / "examples" / f"{kind}-{label}.json"] = read_json(VALIDATION_DIR / label / f"{kind}.json")
    http_evidence = REPO_ROOT / "data/validation/t2"
    if http_evidence.exists():
        for label in ("baseline","stronger"):
            for kind in ("accepted","run","frames","metrics"):
                values[directory / "examples" / f"http-{kind}-{label}.json"] = read_json(http_evidence / label / f"{kind}.json")
        values[directory / "examples/storm-created.json"] = read_json(http_evidence / "storm-created.json")
    t3 = REPO_ROOT / "data/validation/t3"
    if t3.exists():
        for name,source in (
            ("inspection-request","inspection-request"),("inspection-created","inspection-with-media"),
            ("media-created","media-created"),("debris-request","debris-40-request"),
            ("debris-created","debris-40-created"),
        ):
            values[directory / "examples" / f"{name}.json"] = read_json(t3 / f"{source}.json")
        for kind in ("accepted","run","frames","metrics"):
            values[directory / "examples" / f"native-inlet-{kind}.json"] = read_json(t3 / "native-40" / f"{kind}.json")
    # Engine health is machine-specific, so it is read from /api/health, never frozen here.
    return {path: dumps(value) for path, value in values.items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale = []
    for path, content in artifacts().items():
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                stale.append(str(path.relative_to(REPO_ROOT)))
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    if stale:
        raise SystemExit("Stale contract artifacts: " + ", ".join(stale))
    print("Contract artifacts match the application." if args.check else "Exported OpenAPI and T0/T1/T2/T3 examples.")


if __name__ == "__main__":
    main()
