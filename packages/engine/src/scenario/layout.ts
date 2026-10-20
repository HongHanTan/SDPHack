import assetsJson from '../../../../data/synthetic/taman_kyra_assets.json';
import layoutJson from '../../../../data/synthetic/taman_kyra_layout.json';
import { DATUM } from './config';

export interface RoadStraight { id: string; kind: 'straight'; x: number; y: number; width: number; length: number; angleDeg: number }
export interface RoadCircle { id: string; kind: 'circle'; x: number; y: number; radius: number }
export interface LayoutHouse { id: string; x: number; y: number; rotationDeg: number; scale: number }
export interface Layout {
  source: string;
  datum: string;
  roads: Array<RoadStraight | RoadCircle>;
  houses: LayoutHouse[];
  lake: { id: string; x: number; y: number; radius: number };
  canal: { id: string; x: number; yFrom: number; yTo: number; width: number; wallHeight: number };
  trees: Array<{ x: number; y: number; scale: number }>;
}
export interface AssetNode {
  node_id: string;
  node_type: 'junction' | 'outfall';
  position_m: { x: number; y: number; z: number };
  invert_elevation_m: number;
  ground_elevation_m: number;
  max_depth_m: number;
}
export interface AssetInlet { inlet_id: string; node_id: string; position_m: { x: number; y: number; z: number }; grate_area_m2: number }
export interface AssetConduit { conduit_id: string; from_node_id: string; to_node_id: string; diameter_m: number; length_m: number; manning_n: number }
export interface Assets { nodes: AssetNode[]; inlets: AssetInlet[]; conduits: AssetConduit[] }

/** Jiajie's scene layout (team datum). */
export const LAYOUT = layoutJson as Layout;
/** Tay's synthetic Taman Kyra drainage assets (team datum). */
export const ASSETS = assetsJson as unknown as Assets;

/** Team datum → grid-local metres. */
export const toLocal = (x: number, y: number) => ({ x: x - DATUM.x0, y: y - DATUM.y0 });
/** Grid-local metres → team datum. */
export const toTeam = (x: number, y: number) => ({ x: x + DATUM.x0, y: y + DATUM.y0 });
