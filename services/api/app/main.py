"""Run from repository root: python -m uvicorn services.api.app.main:app."""

from typing import NoReturn

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from simulation.swmm.engine import probe_engine

from .catalog import API_VERSION, load_assets, load_bootstrap
from .schemas import (
    AssetsResponse, BootstrapResponse, Capabilities, ErrorDetail, ErrorResponse,
    FramesResponse, HealthResponse, MetricsResponse, RunResponse,
    SimulationAccepted, SimulationRequest,
)

ERROR_RESPONSES = {
    404: {"model": ErrorResponse, "description": "NOT_FOUND: unknown township or resource."},
    422: {"model": ErrorResponse, "description": "VALIDATION_ERROR: request does not match the contract."},
    500: {"model": ErrorResponse, "description": "INTERNAL_ERROR: unexpected server failure."},
}

app = FastAPI(
    title="Township FloodOps API",
    version=API_VERSION,
    description="Synthetic demonstration network. Health/bootstrap/assets are implemented. Real offline SWMM validation results are retained under data/validation/t1. HTTP simulation routes remain planned contracts and return 501 NOT_IMPLEMENTED until T2.",
    responses=ERROR_RESPONSES,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def error_response(status: int, code: str, message: str, details: dict | None = None, headers=None):
    body = ErrorResponse(error=ErrorDetail(code=code, message=message, details=details or {}))
    return JSONResponse(status_code=status, content=jsonable_encoder(body), headers=headers)


@app.exception_handler(StarletteHTTPException)
async def http_error(_request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        detail = ErrorDetail.model_validate(exc.detail)
        return error_response(exc.status_code, detail.code, detail.message, detail.details, exc.headers)
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
    return error_response(exc.status_code, code, str(exc.detail), headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    # Avoid reflecting raw inputs (including unsupported non-finite numbers).
    issues = [{"location": list(e["loc"]), "message": e["msg"], "type": e["type"]} for e in exc.errors()]
    return error_response(422, "VALIDATION_ERROR", "Request validation failed.", {"issues": issues})


@app.exception_handler(Exception)
async def unexpected_error(_request: Request, _exc: Exception):
    import logging

    logging.getLogger(__name__).exception("Unhandled API exception")
    return error_response(500, "INTERNAL_ERROR", "An unexpected server error occurred.")


@app.get("/api/health", response_model=HealthResponse, tags=["catalog"])
def health():
    return HealthResponse(api_version=API_VERSION, swmm=probe_engine(), capabilities=Capabilities())


@app.get("/api/bootstrap", response_model=BootstrapResponse, tags=["catalog"])
def bootstrap():
    return load_bootstrap()


@app.get("/api/townships/{township_id}/assets", response_model=AssetsResponse, tags=["catalog"])
def assets(township_id: str):
    catalog = load_assets()
    if township_id != catalog.township_id:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Unknown township.", "details": {"township_id": township_id}})
    return catalog


PLANNED = {
    "responses": {501: {"model": ErrorResponse, "description": "NOT_IMPLEMENTED: HTTP simulation execution and persistence arrive in T2; offline T1 validation exists."}},
    "tags": ["simulations (planned)"],
    "openapi_extra": {"x-implementation-status": "planned"},
}


def not_implemented() -> NoReturn:
    raise HTTPException(501, {"code": "NOT_IMPLEMENTED", "message": "HTTP simulation execution and persistence are not implemented (T2). Offline T1 validation is available.", "details": {"available": False}})


@app.post("/api/simulations", response_model=SimulationAccepted, status_code=202, **PLANNED)
def create_simulation(payload: SimulationRequest):
    """Planned shape only. Never returns a fabricated run ID or success."""
    not_implemented()


@app.get("/api/simulations/{run_id}", response_model=RunResponse, **PLANNED)
def get_simulation(run_id: str):
    not_implemented()


@app.get("/api/simulations/{run_id}/frames", response_model=FramesResponse, **PLANNED)
def get_frames(run_id: str):
    not_implemented()


@app.get("/api/simulations/{run_id}/metrics", response_model=MetricsResponse, **PLANNED)
def get_metrics(run_id: str):
    not_implemented()
