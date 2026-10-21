import type { InspectionRecord, SimulationFrame, SimulationMetricsResponse, SimulationRun } from '../types';
export interface SourceFile {name:string;text:string;role:string}
export interface SiteNode {node_id:string;node_type:'junction'|'outfall';x:number;y:number;ground_elevation_m:number|null;invert_elevation_m:number|null;outfall_type?:string;water_level_m?:number|null}
export interface SitePipe {conduit_id:string;from_node_id:string;to_node_id:string;diameter_m:number|null;length_m:number|null;manning_n:number|null}
export interface SiteInlet {inlet_id:string;node_id:string;x:number;y:number;ground_elevation_m:number|null;grate_area_m2:number|null}
export interface Feature {type:'Feature';properties:{name?:string;width_m?:number;height_m?:number};geometry:{type:string;coordinates:number[][]|number[][][]}}
export interface ImportedSite {
 project:{name:string;coordinate_system:string;coordinate_units:string;vertical_datum?:string;source_type?:string;source_reference?:string};
 nodes:SiteNode[];pipes:SitePipe[];inlets:SiteInlet[];terrain:{x:number;y:number;z:number}[];roads:Feature[];buildings:Feature[];
 catchments:{subcatchment_id:string;outlet_node_id:string;area_ha:number;impervious_percent:number;width_m:number;slope_percent:number}[];
 rainfall:{time_s:number;intensity_mmh:number}[];
}
export interface SitePreview {site:ImportedSite;manifest:{name:string;sha256:string;bytes:number;role:string;headers:string[]}[];issues:{level:'map'|'simulation'|'warning';location:string;message:string}[];assumptions:string[];map_ready:boolean;simulation_ready:boolean;counts:Record<string,number>;fields:Record<string,string[]>}
export interface SiteProject extends SitePreview {project_id:string;model_version_id:string;model_hash:string;name:string;created_at:string;is_verified_site_model:false}
export type ProjectSummary=Pick<SiteProject,'project_id'|'model_version_id'|'model_hash'|'name'|'created_at'|'counts'|'simulation_ready'>;
export interface SiteResult {run:SimulationRun;frames:SimulationFrame[];metrics:SimulationMetricsResponse}
export interface SiteProposal {proposal_id:string;asset_id:string;scope:string;owner:string;justification:string;status:'Draft';estimate_myr:number|null;estimate_source:string;created_at:string;comparison:unknown;inspection_snapshot:InspectionRecord[]}
