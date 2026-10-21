"""Scenario orchestration only. All physical computation stays in simulation/."""

import hashlib
import logging
import threading
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from simulation.swmm.engine import probe_engine
from simulation.swmm.model import canonical_hash, read_json, resolve_inputs
from simulation.swmm.runner import run_model, snapshot_inputs
from simulation.swmm.inlets import CAPTURE_MODEL, configure_inlets
from simulation.swmm.interventions import apply_interventions
from simulation.debris.mass_balance import simulate_mass

from .catalog import API_VERSION, REPO_ROOT, SEED_DIR, load_bootstrap
from .runtime_lock import RuntimeLease
from .schemas import Capabilities, DebrisCreate, DebrisPreset, DebrisScenario, FramesResponse, MetricsResponse, RunResponse, SimulationRequest, StormCreate, StormRecord
from .storage import QueueFullError, Store
from .errors import ApiProblem
from .evidence import EvidenceService


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ScenarioService:
    def __init__(self, directory: Path, timeout_s: float = 120, max_pending: int = 8):
        if timeout_s <= 0 or max_pending < 1:
            raise ValueError("Timeout and pending-job capacity must be positive")
        self.directory = directory.resolve()
        self.timeout_s, self.max_pending = timeout_s, max_pending
        self.lock = threading.Lock()
        self.closed = False
        self.lease = RuntimeLease(self.directory)
        self.lease.acquire()
        try:
            self.store = Store(self.directory)
            self.store.initialize(read_json(SEED_DIR / "bootstrap.json")["storms"])
            self.evidence = EvidenceService(self.store, self.directory)
            (self.directory / "events").mkdir(exist_ok=True)
            for run in self.store.list_runs(limit=100000, pending_only=True):
                self.fail(run["run_id"], "RUN_INTERRUPTED", "The previous API process stopped before this run reached a persisted terminal state. Submit a new run to retry.")
            self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="floodops-run")
        except Exception:
            self.lease.release()
            raise

    def bootstrap(self):
        result = load_bootstrap()
        result.api_version = API_VERSION
        result.capabilities = Capabilities()
        result.storms = [StormRecord.model_validate(storm) for storm in self.store.list_storms()]
        for record in self.store.list_debris():
            result.debris_scenarios.append(DebrisPreset.model_validate({key:record[key] for key in DebrisPreset.model_fields}))
        for boundary in result.tailwater_cases:
            boundary.swmm_supported = boundary.tailwater_case == "normal"
        result.assumptions = [
            "Illustrative synthetic geography and uncalibrated hydrology; no verified site forecast or historical cause.",
            "Real SWMM executes asynchronously; query the returned run_id until succeeded or failed before fetching results.",
            "Native finite inlet capture and explicit conceptual cleaning, pipe and storage interventions are supported. Photo coverage and debris mass do not determine hydraulic loss. Input changes are retained. High tailwater remains unsupported. Neither native reference checks nor browser calculations establish a validated street-depth map.",
            "Custom storms support constant 0..300 mm/h, 300..21600 seconds in 300-second increments, followed by 3600 seconds dry drainage.",
        ]
        return result

    def create_storm(self, payload: StormCreate) -> dict:
        storm = {
            "storm_id": f"storm_{uuid.uuid4().hex}", "name": payload.name,
            "source_type": payload.source_type,
            "parameters": {"intensity_mmh":payload.intensity_mmh,"duration_s":payload.duration_s,"pattern":payload.pattern},
            "created_at":now(), "notes":payload.notes,
        }
        self.store.create_storm(storm)
        return storm

    def get_storm(self, storm_id: str) -> dict:
        storm = self.store.get_storm(storm_id)
        if storm is None:
            raise ApiProblem(404,"NOT_FOUND","Unknown storm.",{"storm_id":storm_id})
        return storm

    def create_debris(self, payload: DebrisCreate) -> dict:
        catalog_assets = self.evidence.check_asset(payload.inlet_id)
        if payload.inlet_id not in {x.inlet_id for x in catalog_assets.inlets}:
            raise ApiProblem(422,"VALIDATION_ERROR","Debris scenarios require an inlet asset.")
        storm = self.get_storm(payload.storm_id)
        inspection = self.evidence.get(payload.inspection_id) if payload.inspection_id else None
        if inspection is not None and inspection["asset_id"] != payload.inlet_id:
            raise ApiProblem(422,"VALIDATION_ERROR","The inspection must reference the same inlet as this debris scenario.")
        try:
            mass = simulate_mass(payload.debris_parameters.model_dump(mode="json"),storm)
        except ValueError as exc:
            raise ApiProblem(422,"VALIDATION_ERROR",str(exc)) from exc
        record = DebrisScenario(
            debris_scenario_id=f"debris_{uuid.uuid4().hex}",name=payload.name,source_type="assumed",
            parameters={"inlet_id":payload.inlet_id,"hydraulic_inlet_clogging_fraction":payload.hydraulic_inlet_clogging_fraction,"parameter_status":"assumed_not_calibrated"},
            swmm_supported=True,capture_model=CAPTURE_MODEL,created_at=now(),storm_id=payload.storm_id,
            storm_snapshot=storm,inspection_id=payload.inspection_id,inspection_snapshot=inspection,mass_balance=mass,
        ).model_dump(mode="json")
        self.store.create_debris(record)
        return record

    def get_debris(self, scenario_id: str) -> dict:
        record = self.store.get_debris(scenario_id)
        if record is None:
            raise ApiProblem(404,"NOT_FOUND","Unknown created debris scenario.",{"debris_scenario_id":scenario_id})
        return record

    def resolve(self, payload: SimulationRequest) -> dict:
        catalog = load_bootstrap()
        if payload.model_version_id not in {m.model_version_id for m in catalog.model_versions}:
            raise ApiProblem(404,"NOT_FOUND","Unknown model version.",{"model_version_id":payload.model_version_id})
        storm = self.get_storm(payload.storm_id)
        debris = self.store.get_debris(payload.debris_scenario_id)
        if debris is None:
            seed = next((x for x in catalog.debris_scenarios if x.debris_scenario_id == payload.debris_scenario_id),None)
            debris = seed.model_dump(mode="json") if seed else None
        if debris is None:
            raise ApiProblem(404,"NOT_FOUND","Unknown debris scenario.",{"debris_scenario_id":payload.debris_scenario_id})
        if debris.get("storm_id") and debris["storm_id"] != payload.storm_id:
            raise ApiProblem(422,"SCENARIO_STORM_MISMATCH","Create a new debris scenario for this storm; saved mass timelines are bound to their immutable storm.")
        if payload.tailwater_case not in {b.tailwater_case for b in catalog.tailwater_cases}:
            raise ApiProblem(404,"NOT_FOUND","Unknown tailwater case.",{"tailwater_case":payload.tailwater_case})
        if payload.tailwater_case != "normal":
            raise ApiProblem(422,"UNSUPPORTED_SCENARIO","High tailwater remains unavailable pending numerical checks for that preset.")
        inputs = resolve_inputs(catalog.storms[0].storm_id, payload.tailwater_case)
        inputs["storm"] = storm
        inputs["request"] = payload.model_dump(mode="json")
        if debris["capture_model"] == CAPTURE_MODEL:
            inputs["debris_scenario"] = {**debris, "hydraulic_inlet_clogging_fraction":debris["parameters"]["hydraulic_inlet_clogging_fraction"]}
            configure_inlets(inputs,debris["parameters"]["inlet_id"],debris["parameters"]["hydraulic_inlet_clogging_fraction"])
        try:
            if payload.intervention is not None:
                inputs=apply_interventions(inputs,payload.intervention.actions)
            return snapshot_inputs(inputs)
        except ValueError as exc:
            raise ApiProblem(422,"UNSUPPORTED_SCENARIO",str(exc)) from exc

    def submit(self, payload: SimulationRequest) -> dict:
        snapshot = self.resolve(payload)
        run = {
            "run_id":f"run_{uuid.uuid4().hex}", "status":"queued", "model_version_id":payload.model_version_id,
            "input_snapshot":snapshot, "input_hash":canonical_hash(snapshot),
            "engine":"EPA SWMM", "engine_version":None, "is_verified_site_model":False,
            "assumptions":snapshot["assets"]["assumptions"] + snapshot["hydrology"]["assumptions"],
            "warnings":[], "error":None, "evidence_references":[],
            "storm_id":payload.storm_id,"debris_scenario_id":payload.debris_scenario_id,"tailwater_case":payload.tailwater_case,
            "created_at":now(),"started_at":None,"completed_at":None,
        }
        RunResponse.model_validate(run)
        with self.lock:
            if self.closed:
                raise ApiProblem(503,"SERVICE_STOPPING","The API is shutting down; retry after restart.")
            try:
                self.store.create_run(run, self.max_pending)
            except QueueFullError as exc:
                raise ApiProblem(429,"QUEUE_FULL","Simulation queue is full; wait for an existing run to finish.",{"max_pending":self.max_pending}) from exc
            try:
                self.executor.submit(self.execute,run["run_id"])
            except RuntimeError as exc:
                self.fail(run["run_id"],"SCHEDULING_FAILED",str(exc))
                raise ApiProblem(503,"SCHEDULING_FAILED","Run was saved but could not be scheduled.",{"run_id":run["run_id"]}) from exc
        return {"run_id":run["run_id"],"status":"queued"}

    def event(self, run_id: str, message: str):
        with (self.directory / "events" / f"{run_id}.log").open("a",encoding="utf-8") as log:
            log.write(f"{now()} {message}\n")

    def references(self, run_id: str) -> list[str]:
        refs = [f"/api/simulations/{run_id}/artifacts/events.log"]
        path = self.directory / "runs" / run_id
        for name in ("model.inp","model.rpt","model.out","inputs.json","native.json","qa.json","worker.log","worker-error.json"):
            if (path / name).is_file():
                refs.append(f"/api/simulations/{run_id}/artifacts/{name}")
        return refs

    def fail(self, run_id: str, code: str, message: str):
        self.event(run_id,f"FAILED {code}: {message}")
        run = self.store.get_run(run_id)
        if run and run["status"] in ("queued","running"):
            self.store.transition(run_id,run["status"],{
                "status":"failed","completed_at":now(),
                "error":{"code":code,"message":message,"details":{"run_id":run_id,"events_url":f"/api/simulations/{run_id}/artifacts/events.log"}},
                "evidence_references":self.references(run_id),
            })

    def execute(self, run_id: str):
        try:
            if not self.store.transition(run_id,"queued",{"status":"running","started_at":now()}):
                return
            self.event(run_id,"RUNNING")
            run = self.get_run(run_id)
            engine = probe_engine()
            if not engine["available"]:
                self.fail(run_id,"ENGINE_UNAVAILABLE",engine["message"])
                return
            self.store.transition(run_id,"running",{"engine_version":engine["engine_version"]})
            if canonical_hash(snapshot_inputs(run["input_snapshot"])) != run["input_hash"]:
                self.fail(run_id,"INPUT_SNAPSHOT_MISMATCH","Rendered model no longer matches the saved immutable input.")
                return
            directory = self.directory / "runs" / run_id
            result = run_model(run["input_snapshot"],directory,run_id=run_id,timeout_s=self.timeout_s)
            if result["input_hash"] != run["input_hash"]:
                raise ValueError("Executed input hash differs from accepted input hash")
            frames = FramesResponse.model_validate_json((directory / "frames.json").read_text(encoding="utf-8"))
            metrics = MetricsResponse.model_validate_json((directory / "metrics.json").read_text(encoding="utf-8"))
            if frames.run_id != run_id or metrics.run_id != run_id or result["engine_version"] != engine["engine_version"]:
                raise ValueError("Executed run identity/engine differs from the accepted run")
            digests = {name:hashlib.sha256((directory / name).read_bytes()).hexdigest() for name in ("frames.json","metrics.json")}
            self.event(run_id,"SUCCEEDED")
            self.store.transition(run_id,"running",{
                "status":"succeeded","completed_at":now(),"engine_version":result["engine_version"],
                "warnings":result["warnings"],"error":None,"evidence_references":self.references(run_id),
            },artifacts=digests)
        except Exception as exc:
            logging.getLogger(__name__).exception("Run %s failed",run_id)
            self.event(run_id,traceback.format_exc())
            self.fail(run_id,getattr(exc,"code","SWMM_EXECUTION_FAILED"),str(exc))

    def get_run(self, run_id: str) -> dict:
        run = self.store.get_run(run_id)
        if run is None:
            raise ApiProblem(404,"NOT_FOUND","Unknown simulation run.",{"run_id":run_id})
        return run

    def result(self, run_id: str, kind: str) -> dict:
        run = self.get_run(run_id)
        if run["status"] in ("queued","running"):
            raise ApiProblem(409,"RESULTS_NOT_READY","Simulation results are not ready.",{"run_id":run_id,"status":run["status"]})
        if run["status"] == "failed":
            raise ApiProblem(409,"SIMULATION_FAILED","This simulation failed; inspect the run error and logs.",{"run_id":run_id,"run_error":run["error"]})
        name = f"{kind}.json"
        path = self.directory / "runs" / run_id / name
        expected_hash = self.store.artifacts(run_id).get(name)
        try:
            data = path.read_bytes()
            if not expected_hash or hashlib.sha256(data).hexdigest() != expected_hash:
                raise ValueError("Saved result hash mismatch")
            model = FramesResponse if kind == "frames" else MetricsResponse
            result = model.model_validate_json(data)
            if result.run_id != run_id or result.model_version_id != run["model_version_id"]:
                raise ValueError("Saved result identity mismatch")
            return result.model_dump(mode="json")
        except (OSError,ValueError) as exc:
            raise ApiProblem(500,"RESULT_ARTIFACT_INVALID","A successful run's saved result is missing or corrupt; inspect the retained artifacts.",{"run_id":run_id}) from exc

    def artifact(self, run_id: str, name: str) -> Path:
        self.get_run(run_id)
        if name == "events.log":
            path = self.directory / "events" / f"{run_id}.log"
        elif name in {"model.inp","model.rpt","model.out","inputs.json","native.json","qa.json","worker.log","worker-error.json"}:
            path = self.directory / "runs" / run_id / name
        else:
            raise ApiProblem(404,"NOT_FOUND","Unknown artifact.")
        if not path.is_file():
            raise ApiProblem(404,"NOT_FOUND","Artifact is not yet available.")
        return path

    def close(self):
        with self.lock:
            self.closed = True
        try:
            self.executor.shutdown(wait=True,cancel_futures=True)
            for run in self.store.list_runs(limit=self.max_pending,pending_only=True):
                self.fail(run["run_id"],"SERVER_SHUTDOWN","Queued run was cancelled during API shutdown. Submit a new run after restart.")
        finally:
            self.lease.release()
