// Township FloodOps — Contract Types v1
// Based on md/TEAM_WORKFLOW.md Section 6

export interface Position3D {
  x: number; // East in meters
  y: number; // North in meters
  z: number; // Elevation in meters
}

export type SourceType = 'observed' | 'literature_derived' | 'assumed' | 'synthetic';

export type ConduitStatus = 'normal' | 'near_capacity' | 'surcharged' | 'unknown';
export type NodeStatus = 'normal' | 'surcharged' | 'flooding' | 'unknown';
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface AssetNode {
  node_id: string;
  type: 'junction' | 'outfall' | 'intake';
  position_m: Position3D;
  invert_elevation_m: number;
  max_depth_m: number;
  surface_elevation_m?: number;
  description?: string;
}

export interface AssetInlet {
  inlet_id: string;
  node_id: string;
  inlet_type: 'curb_opening' | 'grate' | 'combination';
  position_m: Position3D;
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
  from_node: string;
  to_node: string;
  length_m: number;
  roughness: number;
  shape: 'circular' | 'rectangular' | 'trapezoidal';
  diameter_m?: number;
  width_m?: number;
  height_m?: number;
  slope_fraction?: number;
  description?: string;
}

export interface TownshipAssetsResponse {
  township_id: string;
  model_version_id: string;
  nodes: AssetNode[];
  inlets: AssetInlet[];
  conduits: AssetConduit[];
  assumptions: string[];
}

export interface StormItem {
  storm_id: string;
  name: string;
  intensity_mmh: number;
  duration_s: number;
  source_type: SourceType;
  return_period_years?: number;
  description?: string;
}

export interface DebrisScenarioItem {
  debris_scenario_id: string;
  name: string;
  inlet_id: string;
  hydraulic_inlet_clogging_fraction: number; // 0.0 to 1.0
  parameter_status: 'assumed_not_calibrated' | 'calibrated' | 'literature_derived';
  source_type: SourceType;
  notes?: string;
}

export interface TailwaterCaseItem {
  case_id: string;
  name: string;
  outfall_stage_m: number;
  description?: string;
}

export interface ModelVersionItem {
  model_version_id: string;
  name: string;
  is_synthetic: boolean;
  notes?: string;
}

export interface BootstrapResponse {
  township_id: string;
  model_versions: ModelVersionItem[];
  storms: StormItem[];
  debris_scenarios: DebrisScenarioItem[];
  tailwater_cases: TailwaterCaseItem[];
}

export interface HealthResponse {
  status: string;
  engine_available: boolean;
  engine_version?: string;
  is_verified_site_model: boolean;
}

export interface ConduitState {
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
  inflow_m3s?: number;
}

export interface SimulationFrame {
  timestamp_s: number;
  pipe_states: ConduitState[];
  node_states: NodeState[];
  inlet_states: InletState[];
}

export interface SimulationFramesResponse {
  run_id: string;
  model_version_id: string;
  frames: SimulationFrame[];
}

export interface SimulationMetricsResponse {
  run_id: string;
  model_version_id: string;
  result_type: 'simulated';
  total_flooding_volume_m3: number;
  flooded_node_count: number;
  surcharge_duration_s: number;
  peak_flow_m3s?: number;
  definitions?: Record<string, string>;
  warnings?: string[];
}

export interface InterventionInput {
  type: 'clean_inlet' | 'upsize_conduit' | 'add_storage';
  target_asset_id: string;
  changes: Record<string, unknown>;
}

export interface SimulationCreateRequest {
  model_version_id: string;
  storm_id: string;
  debris_scenario_id?: string | null;
  tailwater_case: string;
  intervention?: InterventionInput | null;
}

export interface SimulationRun {
  run_id: string;
  status: RunStatus;
  model_version_id: string;
  storm_id: string;
  debris_scenario_id?: string | null;
  tailwater_case: string;
  created_at: string;
  completed_at?: string;
  engine?: string;
  engine_version?: string;
  is_verified_site_model: boolean;
  input_hash?: string;
  assumptions?: string[];
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
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
  media_urls?: string[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
