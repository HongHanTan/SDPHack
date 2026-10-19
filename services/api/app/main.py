"""Run from repository root: python -m uvicorn services.api.app.main:app --workers 1."""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from simulation.swmm.engine import probe_engine

from .catalog import API_VERSION, REPO_ROOT, load_assets
from .schemas import (
    AssetsResponse, BootstrapResponse, Capabilities, ErrorDetail, ErrorResponse,
    FramesResponse, HealthResponse, MetricsResponse, RunListResponse, RunResponse,
    SimulationAccepted, SimulationRequest, StormCreate, StormRecord,
)
from .service import ApiProblem, ScenarioService

ERROR_RESPONSES = {
    404:{"model":ErrorResponse,"description":"NOT_FOUND: unknown township, storm, run or artifact."},
    422:{"model":ErrorResponse,"description":"VALIDATION_ERROR or UNSUPPORTED_SCENARIO: invalid input or unsupported restriction/boundary."},
    500:{"model":ErrorResponse,"description":"INTERNAL_ERROR or RESULT_ARTIFACT_INVALID: server failure or missing/corrupt saved results."},
}
RESULT_ERRORS = {409:{"model":ErrorResponse,"description":"RESULTS_NOT_READY for queued/running, SIMULATION_FAILED for failed runs. Query run status; failed runs have persisted error/log references."}}


def error_response(status: int, code: str, message: str, details: dict | None = None, headers=None):
    body = ErrorResponse(error=ErrorDetail(code=code,message=message,details=details or {}))
    return JSONResponse(status_code=status,content=jsonable_encoder(body),headers=headers)


def create_app(data_dir: Path | None = None, *, run_timeout_s: float = 120, max_pending: int = 8) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI):
        directory = data_dir or Path(os.environ.get("FLOODOPS_DATA_DIR",str(REPO_ROOT / "data/runtime/api")))
        application.state.scenarios = ScenarioService(directory,timeout_s=run_timeout_s,max_pending=max_pending)
        try:
            yield
        finally:
            application.state.scenarios.close()

    application = FastAPI(
        title="Township FloodOps API",version=API_VERSION,lifespan=lifespan,
        description="Synthetic uncalibrated network. Storm creation and asynchronous real SWMM runs are persisted in SQLite. Poll run status before fetching results. Only clean direct-node entry and normal tailwater are supported; inspection/restriction/comparison remain T3/T4. One API worker per runtime directory.",
        responses=ERROR_RESPONSES,
    )
    application.add_middleware(CORSMiddleware,
        allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],allow_credentials=False,
        allow_methods=["GET","POST"],allow_headers=["Content-Type"],
    )

    @application.exception_handler(ApiProblem)
    async def service_error(_request: Request,exc: ApiProblem):
        return error_response(exc.status,exc.code,str(exc),exc.details)

    @application.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request,exc: StarletteHTTPException):
        if isinstance(exc.detail,dict) and "code" in exc.detail:
            detail = ErrorDetail.model_validate(exc.detail)
            return error_response(exc.status_code,detail.code,detail.message,detail.details,exc.headers)
        code = {404:"NOT_FOUND",405:"METHOD_NOT_ALLOWED"}.get(exc.status_code,"HTTP_ERROR")
        return error_response(exc.status_code,code,str(exc.detail),headers=exc.headers)

    @application.exception_handler(RequestValidationError)
    async def validation_error(_request: Request,exc: RequestValidationError):
        issues = [{"location":list(e["loc"]),"message":e["msg"],"type":e["type"]} for e in exc.errors()]
        return error_response(422,"VALIDATION_ERROR","Request validation failed.",{"issues":issues})

    @application.exception_handler(Exception)
    async def unexpected_error(_request: Request,_exc: Exception):
        import logging
        logging.getLogger(__name__).exception("Unhandled API exception")
        return error_response(500,"INTERNAL_ERROR","An unexpected server error occurred.")

    def service(request: Request) -> ScenarioService:
        return request.app.state.scenarios

    @application.get("/api/health",response_model=HealthResponse,tags=["catalog"])
    def health():
        return HealthResponse(api_version=API_VERSION,swmm=probe_engine(),capabilities=Capabilities())

    @application.get("/api/bootstrap",response_model=BootstrapResponse,tags=["catalog"])
    def bootstrap(request: Request):
        return service(request).bootstrap()

    @application.get("/api/townships/{township_id}/assets",response_model=AssetsResponse,tags=["catalog"])
    def assets(township_id: str):
        catalog = load_assets()
        if township_id != catalog.township_id:
            raise HTTPException(404,{"code":"NOT_FOUND","message":"Unknown township.","details":{"township_id":township_id}})
        return catalog

    @application.post("/api/storms",response_model=StormRecord,status_code=201,tags=["storms"])
    def create_storm(payload: StormCreate,request: Request):
        """Save a new immutable constant storm; send the new storm_id when starting a run."""
        return service(request).create_storm(payload)

    @application.get("/api/storms/{storm_id}",response_model=StormRecord,tags=["storms"])
    def get_storm(storm_id: str,request: Request):
        return service(request).get_storm(storm_id)

    @application.post("/api/simulations",response_model=SimulationAccepted,status_code=202,tags=["simulations"],responses={
        429:{"model":ErrorResponse,"description":"QUEUE_FULL: at most 8 queued/running jobs by default."},
        503:{"model":ErrorResponse,"description":"SERVICE_STOPPING or SCHEDULING_FAILED; a scheduling failure includes the saved run_id."},
    })
    def create_simulation(payload: SimulationRequest,request: Request):
        """Persist queued inputs and return immediately; native execution may later succeed or fail."""
        return service(request).submit(payload)

    @application.get("/api/simulations",response_model=RunListResponse,tags=["simulations"])
    def list_simulations(request: Request,limit: Annotated[int,Query(ge=1,le=100)] = 20):
        return {"items":service(request).store.list_runs(limit=limit)}

    @application.get("/api/simulations/{run_id}",response_model=RunResponse,tags=["simulations"])
    def get_simulation(run_id: str,request: Request):
        return service(request).get_run(run_id)

    @application.get("/api/simulations/{run_id}/frames",response_model=FramesResponse,tags=["simulations"],responses=RESULT_ERRORS)
    def get_frames(run_id: str,request: Request):
        return service(request).result(run_id,"frames")

    @application.get("/api/simulations/{run_id}/metrics",response_model=MetricsResponse,tags=["simulations"],responses=RESULT_ERRORS)
    def get_metrics(run_id: str,request: Request):
        return service(request).result(run_id,"metrics")

    @application.get("/api/simulations/{run_id}/artifacts/{artifact_name}",response_class=FileResponse,tags=["simulations"],responses={200:{"content":{"application/octet-stream":{}},"description":"Allowlisted raw SWMM artifact or API event log."}})
    def get_artifact(run_id: str,artifact_name: str,request: Request):
        path = service(request).artifact(run_id,artifact_name)
        return FileResponse(path,filename=artifact_name,media_type="application/octet-stream")

    return application


app = create_app()
