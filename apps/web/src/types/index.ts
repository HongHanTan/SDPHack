// Township FloodOps — Contract Types v1.0.0
// Strictly aligned with contracts/openapi.json and md/TEAM_WORKFLOW.md Section 6

export interface Position3D {
  x: number; // East in meters
  y: number; // North in meters
  z: number; // Elevation in meters
}

export type SourceType = 'observed' | 'literature_derived' | 'assumed' | 'synthetic' | 'imported';

export type ConduitStatus = 'normal' | 'near_capacity' | 'surcharged' | 'unknown';
export type NodeStatus = 'normal' | 'surcharged' | 'flooding' | 'unknown';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type TwinViewMode = 'twin_highlight' | 'realistic' | 'underground_only';

export interface AssetNode {
  node_id: string;
  node_type: 'junction' | 'outfall' | 'storage';
  position_m: Position3D; // pipe invert position
  invert_elevation_m: number;
  ground_elevation_m: number;
  max_depth_m: number;
  source_type: SourceType;
  description?: string;
  // Aliases for UI flexibility
  type?: string;
  surface_elevation_m?: number;
}

export interface AssetInlet {
  inlet_id: string;
  node_id: string;
  position_m: Position3D; // surface grate position
  grate_area_m2: number;
  source_type: SourceType;
  inlet_type?: 'curb_opening' | 'grate' | 'combination';
  dimensions_m?: {
    width: number;
    length: number;
    height?: number;
  };
  curb_height_m?: number;
  description?: string;
}

export interface AssetConduit {
  conduit_id: string;
  from_node_id: string;
  to_node_id: string;
  diameter_m: number;
  length_m: number;
  manning_n: number;
  source_type: SourceType;
  shape?: 'circular' | 'rectangular' | 'trapezoidal';
  width_m?: number;
  height_m?: number;
  roughness?: number;
  slope_fraction?: number;
  description?: string;
  // Backward compat alias
  from_node?: string;
  to_node?: string;
}

export interface TownshipAssetsResponse {
  township_id: string;
  model_version_id: string;
  source_type: SourceType;
  is_verified_site_model: boolean;
  coordinate_system: string;
  nodes: AssetNode[];
  inlets: AssetInlet[];
  conduits: AssetConduit[];
  assumptions: string[];
}

export interface StormPreset {
  storm_id: string;
  name: string;
  source_type: SourceType;
  parameters: {
    intensity_mmh: number;
    duration_s: number;
    pattern: string;
  };
}

export interface DebrisPreset {
  debris_scenario_id: string;
  name: string;
  source_type: SourceType;
  parameters: {
    inlet_id: string;
    hydraulic_inlet_clogging_fraction: number;
    parameter_status: 'assumed_not_calibrated' | string;
  };
  swmm_supported?: boolean;
  capture_model?: 'unlimited_direct_node_inflow_T1' | 'swmm_native_custom_diversion_v1';
}

export interface TailwaterPreset {
  tailwater_case: string;
  name: string;
  source_type: SourceType;
  parameters: {
    depth_above_outfall_invert_m: number;
  };
}

export interface Capabilities {
  interventions?: boolean;
  assets: boolean;
  storm_creation: boolean;
  simulations: boolean;
  inspections: boolean;
  debris: boolean;
  comparisons: boolean;
  maintenance_proposals?: boolean;
}

export interface ModelVersionItem {
  model_version_id: string;
  name: string;
  source_type: SourceType;
  is_verified_site_model: boolean;
  readiness: string;
  parameters?: Record<string, unknown>;
  notes?: string;
}

export interface BootstrapResponse {
  api_version: string;
  township_id: string;
  model_versions: ModelVersionItem[];
  storms: StormPreset[];
  debris_scenarios: DebrisPreset[];
  tailwater_cases: TailwaterPreset[];
  capabilities: Capabilities;
  assumptions: string[];
}

export interface EngineHealth {
  available: boolean;
  engine: string;
  engine_version: string;
  execution_verified: boolean;
  message: string;
}

export interface HealthResponse {
  status: string;
  api_version: string;
  swmm: EngineHealth;
  capabilities: Capabilities;
}

export interface PipeState {
  conduit_id: string;
  flow_m3s: number;
  depth_m: number;
  status: ConduitStatus;
  capacity_fraction?: number;
}

export interface NodeState {
  node_id: string;
  depth_m: number;
  flooding_rate_m3s: number;
  surcharge_flag: boolean;
  status: NodeStatus;
}

export interface InletState {
  inlet_id: string;
  hydraulic_inlet_clogging_fraction: number;
  parameter_status: string;
  capture_flow_m3s?: number | null;
  bypass_flow_m3s?: number | null;
}

export interface SimulationFrame {
  timestamp_s: number;
  pipe_states: PipeState[];
  node_states: NodeState[];
  inlet_states: InletState[];
}

export interface SimulationFramesResponse {
  run_id: string;
  model_version_id: string;
  result_type: 'simulated';
  engine: string;
  engine_version: string;
  is_verified_site_model: boolean;
  assumptions: string[];
  warnings: string[];
  status_definitions: Record<string, string>;
  frames: SimulationFrame[];
}

export interface SimulationMetricsResponse {
  run_id: string;
  model_version_id: string;
  result_type: 'simulated';
  engine: string;
  engine_version: string;
  is_verified_site_model: boolean;
  assumptions: string[];
  warnings: string[];
  status_definitions: Record<string, string>;
  total_flooding_volume_m3: number;
  flooded_node_count: number;
  surcharge_duration_s: number;
  metric_definitions: Record<string, string>;
  peak_flow_m3s?: number;
  inlet_volumes?: Record<
    string,
    {
      captured_m3: number;
      surface_bypass_m3: number;
      backflow_m3: number;
    }
  > | Array<{ inlet_id: string; captured_volume_m3: number; bypass_volume_m3: number; backflow_volume_m3: number }> | null;
}

export interface SimulationCreateRequest {
  model_version_id: string;
  storm_id: string;
  debris_scenario_id?: string | null;
  tailwater_case: string;
  intervention?: {actions:Array<'desilt-d07'|'upsize-p07'|'storage-tank'|'lake-overflow'>} | null;
}

export interface SimulationRun {
  input_snapshot?: Record<string, unknown>;
  run_id: string;
  status: RunStatus;
  model_version_id: string;
  engine: string;
  engine_version: string;
  is_verified_site_model: boolean;
  input_hash?: string;
  storm_id?: string;
  debris_scenario_id?: string | null;
  tailwater_case?: string;
  assumptions?: string[];
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
}

export interface InspectionMediaItem {
  media_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  url: string;
  created_at: string;
}

export interface InspectionRecord {
  inspection_id: string;
  asset_id: string;
  timestamp: string;
  inspector: string;
  method: 'visual' | 'cctv' | 'drone' | 'sensor';
  source_type: SourceType;
  visible_grate_coverage_fraction: number; // 0.0 to 1.0 (grate visual coverage)
  debris_category: 'leaf_litter' | 'sediment' | 'plastic' | 'mixed' | 'none';
  notes: string;
  source_reference?: string;
  media_urls?: string[];
  media?: InspectionMediaItem[];
}

export interface DebrisCreateRequest {
  name: string;
  inlet_id: string;
  storm_id: string;
  inspection_id?: string;
  hydraulic_inlet_clogging_fraction: number;
  debris_parameters?: {
    initial_surface_kg?: number;
    initial_retained_kg?: number;
    loading_kg_per_day?: number;
    wash_off_per_mm?: number;
    capture_fraction?: number;
    cleaning_events?: Array<{
      timestamp_s: number;
      surface_removal_fraction: number;
      inlet_removal_fraction: number;
    }>;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Product pillars & Workflow modes
export type AppMode = 'idle' | 'diagnose' | 'anticipate';

export interface SitePhotoData {
  assetId: string;
  title: string;
  locationName: string;
  captureDate: string;
  photographer: string;
  surfacePhotoUrl: string;
  cctvPhotoUrl?: string;
  chainageM?: number;
  observedCondition: string;
  siltDepthMm?: number;
  structuralIntegrityPct: number;
}
