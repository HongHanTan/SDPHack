"""Read versioned synthetic inputs from disk, independent of working directory."""

from pathlib import Path

from .schemas import AssetsResponse, BootstrapResponse

REPO_ROOT = Path(__file__).resolve().parents[3]
SEED_DIR = REPO_ROOT / "data" / "synthetic"
API_VERSION = "1.5.0"


def load_assets() -> AssetsResponse:
    return AssetsResponse.model_validate_json((SEED_DIR / "taman_kyra_assets.json").read_text(encoding="utf-8"))


def load_bootstrap() -> BootstrapResponse:
    return BootstrapResponse.model_validate_json((SEED_DIR / "bootstrap.json").read_text(encoding="utf-8"))
