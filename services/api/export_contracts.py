"""Export the live app's schema and genuine T0 example responses.

Run from repository root: python -m services.api.export_contracts
Use --check in validation/CI to detect stale handoff artifacts.
"""

import argparse
import json
from pathlib import Path

from fastapi.testclient import TestClient

from .app.catalog import REPO_ROOT
from .app.main import app
from .app.schemas import SimulationRequest
from simulation.swmm.model import read_json
from simulation.swmm.demo import VALIDATION_DIR


def dumps(value) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n"


def artifacts() -> dict[Path, str]:
    directory = REPO_ROOT / "contracts"
    client = TestClient(app)
    request = SimulationRequest(
        model_version_id="taman_kyra_synthetic_v1",
        storm_id="synthetic_80mmh_60min",
        debris_scenario_id="demo_inlet_40pct",
        tailwater_case="normal",
    ).model_dump()
    values = {
        directory / "openapi.json": app.openapi(),
        directory / "examples" / "bootstrap.json": client.get("/api/bootstrap").json(),
        directory / "examples" / "assets.json": client.get("/api/townships/taman_kyra_demo/assets").json(),
        directory / "examples" / "simulation-request.json": request,
        directory / "examples" / "simulation-not-implemented.json": client.post("/api/simulations", json=request).json(),
        directory / "examples" / "validation-error.json": client.post("/api/simulations", json={}).json(),
    }
    for label in ("baseline", "stronger"):
        for kind in ("run", "frames", "metrics"):
            values[directory / "examples" / f"{kind}-{label}.json"] = read_json(VALIDATION_DIR / label / f"{kind}.json")
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
    print("Contract artifacts match the application." if args.check else "Exported OpenAPI and T0 examples.")


if __name__ == "__main__":
    main()
