"""v1 wire models. Planned simulation shapes are contracts, not computed results."""

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Identifier = Annotated[str, Field(min_length=1, max_length=128)]
NonNegative = Annotated[float, Field(ge=0)]
Positive = Annotated[float, Field(gt=0)]
Fraction = Annotated[float, Field(ge=0, le=1)]
SourceType = Literal["observed", "literature_derived", "assumed", "synthetic"]
RunStatus = Literal["queued", "running", "succeeded", "failed"]


class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ErrorDetail(WireModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(WireModel):
    error: ErrorDetail


class EngineHealth(WireModel):
    available: bool
    engine: Literal["EPA SWMM"]
    engine_version: str | None
    execution_verified: bool
    message: str


class Capabilities(WireModel):
    assets: bool = True
    storm_creation: bool = False
    simulations: bool = False
    inspections: bool = False
    debris: bool = False
    comparisons: bool = False


class HealthResponse(WireModel):
    status: Literal["ok"] = "ok"
    api_version: str
    swmm: EngineHealth
    capabilities: Capabilities


class Position(WireModel):
    x: float = Field(description="Local east coordinate in metres.")
    y: float = Field(description="Local north coordinate in metres.")
    z: float = Field(description="Elevation in metres relative to an assumed local datum.")


class Node(WireModel):
    node_id: Identifier
    node_type: Literal["junction", "outfall", "storage"]
    position_m: Position = Field(description="Node invert position; Three.js mapping is [x,z,-y].")
    invert_elevation_m: float
    ground_elevation_m: float
    max_depth_m: Positive
    source_type: SourceType


class Inlet(WireModel):
    inlet_id: Identifier
    node_id: Identifier
    position_m: Position = Field(description="Surface grate position, not the node invert.")
    grate_area_m2: Positive
    source_type: SourceType


class Conduit(WireModel):
    conduit_id: Identifier
    from_node_id: Identifier
    to_node_id: Identifier
    diameter_m: Positive
    length_m: Positive
    manning_n: Positive
    source_type: SourceType


class AssetsResponse(WireModel):
    township_id: Identifier
    model_version_id: Identifier
    source_type: Literal["synthetic"]
    is_verified_site_model: Literal[False] = False
    coordinate_system: Literal["local_metres_east_north_elevation"]
    nodes: list[Node] = Field(min_length=1)
    inlets: list[Inlet] = Field(min_length=1)
    conduits: list[Conduit] = Field(min_length=1)
    assumptions: list[str]


class ModelVersion(WireModel):
    model_version_id: Identifier
    name: str
    source_type: Literal["synthetic"]
    is_verified_site_model: Literal[False] = False
    readiness: Literal["asset_fixture_only", "execution_verified"]
    parameters: dict[str, Any]


class StormParameters(WireModel):
    intensity_mmh: NonNegative
    duration_s: Annotated[int, Field(gt=0)]
    pattern: Literal["constant"]


class StormPreset(WireModel):
    storm_id: Identifier
    name: str
    source_type: SourceType
    parameters: StormParameters


class DebrisParameters(WireModel):
    inlet_id: Identifier
    hydraulic_inlet_clogging_fraction: Fraction
    parameter_status: Literal["assumed_not_calibrated"]


class DebrisPreset(WireModel):
    debris_scenario_id: Identifier
    name: str
    source_type: SourceType
    parameters: DebrisParameters
    swmm_supported: bool = Field(description="False until restriction integration is verified in T3.")


class TailwaterParameters(WireModel):
    depth_above_outfall_invert_m: NonNegative


class TailwaterPreset(WireModel):
    tailwater_case: Identifier
    name: str
    source_type: SourceType
    parameters: TailwaterParameters


class BootstrapResponse(WireModel):
    api_version: str
    township_id: Identifier
    model_versions: list[ModelVersion]
    storms: list[StormPreset]
    debris_scenarios: list[DebrisPreset]
    tailwater_cases: list[TailwaterPreset]
    capabilities: Capabilities
    assumptions: list[str]


class SimulationRequest(WireModel):
    model_version_id: Identifier
    storm_id: Identifier
    debris_scenario_id: Identifier
    tailwater_case: Identifier
    intervention: None = Field(default=None, description="Reserved for T4; only null is supported in v1.0.0.")


class SimulationAccepted(WireModel):
    run_id: Identifier
    status: RunStatus


class RunResponse(WireModel):
    run_id: Identifier
    status: RunStatus
    model_version_id: Identifier
    input_snapshot: dict[str, Any] = Field(description="Full resolved model, storm, boundary and scenario parameters, not IDs alone.")
    input_hash: str = Field(pattern=r"^[a-f0-9]{64}$", description="SHA-256 of canonical resolved input JSON.")
    engine: Literal["EPA SWMM"]
    engine_version: str | None
    is_verified_site_model: Literal[False] = False
    assumptions: list[str]
    warnings: list[str]
    error: ErrorDetail | None
    evidence_references: list[str]


class PipeState(WireModel):
    conduit_id: Identifier
    flow_m3s: float = Field(description="Signed flow in the conduit's from-to direction.")
    depth_m: NonNegative
    status: Literal["normal", "near_capacity", "surcharged", "unknown"]


class NodeState(WireModel):
    node_id: Identifier
    depth_m: NonNegative
    flooding_rate_m3s: NonNegative
    surcharge_flag: bool
    status: Literal["normal", "surcharged", "flooding", "unknown"]


class InletState(WireModel):
    inlet_id: Identifier
    hydraulic_inlet_clogging_fraction: Fraction
    parameter_status: Literal["assumed_not_calibrated"]


class Frame(WireModel):
    timestamp_s: NonNegative
    pipe_states: list[PipeState]
    node_states: list[NodeState]
    inlet_states: list[InletState]


class ResultProvenance(WireModel):
    run_id: Identifier
    model_version_id: Identifier
    result_type: Literal["simulated"]
    engine: Literal["EPA SWMM"]
    engine_version: Annotated[str, Field(min_length=1)]
    is_verified_site_model: Literal[False] = False
    assumptions: list[str]
    warnings: list[str]
    status_definitions: dict[str, str] = Field(description="Physical basis and thresholds used for each pipe/node status. Unestablished status is unknown.")


class FramesResponse(ResultProvenance):
    frames: list[Frame] = Field(min_length=1, description="Chronologically ordered; returned only after success.")


class MetricsResponse(ResultProvenance):
    total_flooding_volume_m3: NonNegative
    flooded_node_count: Annotated[int, Field(ge=0)]
    surcharge_duration_s: NonNegative = Field(description="Elapsed time during which at least one node is surcharged; overlapping nodes count once.")
    metric_definitions: dict[str, str]
