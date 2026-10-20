"""Versioned wire models for catalog, evidence, scenarios and real native results."""

from typing import Annotated, Any, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

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
    storm_creation: bool = True
    simulations: bool = True
    inspections: bool = True
    debris: bool = True
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


class StormCreate(WireModel):
    name: Annotated[str, Field(min_length=1, max_length=160)]
    intensity_mmh: Annotated[float, Field(ge=0, le=300)]
    duration_s: Annotated[int, Field(strict=True, ge=300, le=21600, multiple_of=300)]
    source_type: SourceType = "assumed"
    pattern: Literal["constant"] = "constant"
    notes: Annotated[str, Field(max_length=2000)] = ""

    @model_validator(mode="after")
    def nonblank_name(self):
        if not self.name.strip():
            raise ValueError("Storm name must not be blank")
        return self


class StormRecord(StormPreset):
    created_at: AwareDatetime | None = None
    notes: str = ""


class DebrisParameters(WireModel):
    inlet_id: Identifier
    hydraulic_inlet_clogging_fraction: Fraction
    parameter_status: Literal["assumed_not_calibrated"]


class DebrisPreset(WireModel):
    debris_scenario_id: Identifier
    name: str
    source_type: SourceType
    parameters: DebrisParameters
    swmm_supported: bool
    capture_model: Literal["unlimited_direct_node_inflow_T1", "swmm_native_custom_diversion_v1"] = "unlimited_direct_node_inflow_T1"


class TailwaterParameters(WireModel):
    depth_above_outfall_invert_m: NonNegative


class TailwaterPreset(WireModel):
    tailwater_case: Identifier
    name: str
    source_type: SourceType
    parameters: TailwaterParameters
    swmm_supported: bool = Field(default=False, description="Only normal is enabled in T2; the high boundary remains an unvalidated input preset.")


class BootstrapResponse(WireModel):
    api_version: str
    township_id: Identifier
    model_versions: list[ModelVersion]
    storms: list[StormRecord]
    debris_scenarios: list[DebrisPreset]
    tailwater_cases: list[TailwaterPreset]
    capabilities: Capabilities
    assumptions: list[str]


class SimulationRequest(WireModel):
    model_version_id: Identifier
    storm_id: Identifier
    debris_scenario_id: Identifier
    tailwater_case: Identifier
    intervention: None = Field(default=None, description="Reserved for T4; only null is currently supported.")


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
    storm_id: Identifier | None = None
    debris_scenario_id: Identifier | None = None
    tailwater_case: Identifier | None = None
    created_at: AwareDatetime | None = None
    started_at: AwareDatetime | None = None
    completed_at: AwareDatetime | None = None


class RunListResponse(WireModel):
    items: list[RunResponse]


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
    capture_flow_m3s: NonNegative | None = None
    bypass_flow_m3s: NonNegative | None = None


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
    inlet_volumes: list["InletVolumes"] | None = None


class InletVolumes(WireModel):
    inlet_id: Identifier
    captured_volume_m3: NonNegative
    backflow_volume_m3: NonNegative
    bypass_volume_m3: NonNegative


class InspectionCreate(WireModel):
    asset_id: Identifier
    timestamp: AwareDatetime
    inspector: Annotated[str, Field(min_length=1,max_length=160)]
    method: Literal["visual", "cctv", "drone", "sensor"]
    source_type: SourceType
    visible_grate_coverage_fraction: Fraction | None = None
    debris_category: Literal["leaf_litter", "sediment", "plastic", "mixed", "none"]
    notes: Annotated[str, Field(max_length=4000)] = ""
    source_reference: Annotated[str, Field(max_length=1000)] = ""

    @model_validator(mode="after")
    def nonblank_inspector(self):
        if not self.inspector.strip():
            raise ValueError("Inspector must not be blank")
        return self


class MediaRecord(WireModel):
    media_id: Identifier
    inspection_id: Identifier
    filename: str
    content_type: str
    size_bytes: Annotated[int, Field(gt=0,le=10485760)]
    sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    created_at: AwareDatetime
    source_type: SourceType
    url: str


class InspectionRecord(InspectionCreate):
    inspection_id: Identifier
    created_at: AwareDatetime
    model_version_id: Identifier
    is_verified_site_model: Literal[False] = False
    media: list[MediaRecord] = Field(default_factory=list)
    media_urls: list[str] = Field(default_factory=list)


class InspectionList(WireModel):
    items: list[InspectionRecord]


class CleaningEvent(WireModel):
    timestamp_s: Annotated[int, Field(strict=True,gt=0,le=25200,multiple_of=60)]
    surface_removal_fraction: Fraction = 0
    inlet_removal_fraction: Fraction = 0


class DebrisMassParameters(WireModel):
    initial_surface_kg: Annotated[float, Field(ge=0,le=1000)] = 2
    initial_retained_kg: Annotated[float, Field(ge=0,le=1000)] = 0
    loading_kg_per_day: Annotated[float, Field(ge=0,le=100)] = 0.2
    wash_off_per_mm: Annotated[float, Field(ge=0,le=10)] = 0.03
    capture_fraction: Fraction = 0.6
    cleaning_events: Annotated[list[CleaningEvent], Field(max_length=100)] = Field(default_factory=list)


class DebrisCreate(WireModel):
    name: Annotated[str, Field(min_length=1,max_length=160)]
    inlet_id: Identifier
    storm_id: Identifier
    inspection_id: Identifier | None = None
    source_type: Literal["assumed"] = "assumed"
    hydraulic_inlet_clogging_fraction: Annotated[float, Field(ge=0,le=0.6)]
    debris_parameters: DebrisMassParameters = Field(default_factory=DebrisMassParameters)

    @model_validator(mode="after")
    def nonblank_name(self):
        if not self.name.strip():
            raise ValueError("Scenario name must not be blank")
        return self


class DebrisMassFrame(WireModel):
    timestamp_s: NonNegative
    surface_mass_kg: NonNegative
    retained_mass_kg: NonNegative
    cumulative_added_kg: NonNegative
    cumulative_washed_kg: NonNegative
    cumulative_exported_kg: NonNegative
    cumulative_removed_kg: NonNegative
    balance_error_kg: float


class DebrisMassResult(WireModel):
    model_assumptions_version: Literal["debris-mass-v1"]
    hydraulic_parameter_mode: Literal["independent_constant_hypothesis"]
    parameters: DebrisMassParameters
    max_abs_balance_error_kg: NonNegative
    time_series: list[DebrisMassFrame]
    assumptions: list[str]


class DebrisScenario(DebrisPreset):
    created_at: AwareDatetime
    storm_id: Identifier
    storm_snapshot: StormRecord
    inspection_id: Identifier | None
    inspection_snapshot: InspectionRecord | None
    mass_balance: DebrisMassResult
