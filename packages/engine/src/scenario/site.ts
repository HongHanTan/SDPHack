import hydrology from '../../../../models/illustrative_taman_kyra/hydrology.json';
import capture from '../../../../models/illustrative_taman_kyra/inlet_capture.json';
import { CANAL, DATUM, DIP, GRID, LAKE, TAILWATER } from './config';
import { ASSETS, LAYOUT, type Assets, type LayoutHouse, type RoadCircle, type RoadStraight } from './layout';

/** A house footprint; width/depth (m) override HOUSE × scale when given (imported buildings). */
export type SiteHouse = LayoutHouse & { width?: number; depth?: number } & Record<string, unknown>;
export interface SiteLayout {
  roads: Array<RoadStraight | RoadCircle>;
  houses: SiteHouse[];
  trees: Array<{ x: number; y: number; scale: number }>;
}
export interface SitePond { id: string; x: number; y: number; radius: number; bedZ: number; waterLevel: number }
/** A straight river/canal reach: rectangle centred at (cx, cy), `length` along angleDeg (from east). */
export interface SiteRiver { id: string; cx: number; cy: number; length: number; width: number; angleDeg: number; bedZ: number }
export interface SiteSubcatchment { id: string; outletNodeId: string; areaHa: number; imperviousPercent: number; polygon?: Array<[number, number]>; /** Multiplier on the captured flow of the capture curve (default 1). */ captureScale?: number }

/** Everything the engine needs to build a township. Plain data (structured-cloneable) so it can be posted to workers. */
export interface SiteSpec {
  /** Cache key; changes whenever any source content changes. */
  key: string;
  label: string;
  /** Built-in Taman Kyra: interventions and the precomputed dashboard are available. */
  builtIn: boolean;
  /** Team metres → grid-local metres: local = team − datum. */
  datum: { x0: number; y0: number };
  gridSpec: { nx: number; ny: number; dx: number };
  /** Drainage assets in team metres (Tay's asset format). */
  assets: Assets;
  layout: SiteLayout;
  ponds: SitePond[];
  rivers: SiteRiver[];
  subcatchments: SiteSubcatchment[];
  captureCurve: Array<[number, number]>;
  /** Surveyed ground per grid cell (row-major, j = north index); when present the terrain uses it as-is. */
  ground?: Float32Array;
  /** Optional shallow bowl at a node (built-in J07 dip). */
  dip?: { nodeId: string; radius: number; depth: number };
  hotspotNodeId: string;
  /** Inlet the debris selector blocks. */
  focusInletId: string | null;
  tailwater: { normal: number; high: number };
  /** File coordinates − team coordinates (display only). */
  shift: { dx: number; dy: number; dz: number };
}

interface HydroSub { subcatchment_id: string; outlet_node_id: string; area_ha: number; impervious_percent: number }

export function medianJunctionGround(assets: Assets): number {
  const g = assets.nodes.filter((n) => n.node_type === 'junction').map((n) => n.ground_elevation_m).sort((a, b) => a - b);
  const m = g.length >> 1;
  return g.length % 2 ? g[m] : (g[m - 1] + g[m]) / 2;
}

export const TAMAN_KYRA: SiteSpec = {
  key: 'taman-kyra',
  label: 'Taman Kyra (built-in)',
  builtIn: true,
  datum: { ...DATUM },
  gridSpec: { ...GRID },
  assets: ASSETS,
  layout: { roads: LAYOUT.roads, houses: LAYOUT.houses as SiteHouse[], trees: LAYOUT.trees },
  ponds: [{ id: LAYOUT.lake.id, x: LAYOUT.lake.x, y: LAYOUT.lake.y, radius: LAYOUT.lake.radius, bedZ: LAKE.bedZ, waterLevel: LAKE.waterLevel }],
  rivers: [
    {
      id: LAYOUT.canal.id,
      cx: LAYOUT.canal.x,
      cy: (LAYOUT.canal.yFrom + LAYOUT.canal.yTo) / 2,
      length: Math.abs(LAYOUT.canal.yTo - LAYOUT.canal.yFrom),
      width: LAYOUT.canal.width,
      angleDeg: 90,
      bedZ: CANAL.bedZ,
    },
  ],
  subcatchments: (hydrology as unknown as { subcatchments: HydroSub[] }).subcatchments.map((s) => ({
    id: s.subcatchment_id,
    outletNodeId: s.outlet_node_id,
    areaHa: s.area_ha,
    imperviousPercent: s.impervious_percent,
  })),
  captureCurve: (capture as unknown as { capture_curve_m3s: Array<[number, number]> }).capture_curve_m3s,
  dip: { nodeId: 'NODE-J07', radius: DIP.radius, depth: DIP.depth },
  hotspotNodeId: 'NODE-J07',
  focusInletId: 'INLET-D07',
  tailwater: { normal: TAILWATER.normal, high: TAILWATER.high },
  shift: { dx: 0, dy: 0, dz: 0 },
};

export const siteToLocal = (site: SiteSpec, x: number, y: number) => ({ x: x - site.datum.x0, y: y - site.datum.y0 });
export const siteToTeam = (site: SiteSpec, x: number, y: number) => ({ x: x + site.datum.x0, y: y + site.datum.y0 });

/** Cell index for grid-local metres, clamped to the grid. */
export function cellIn(g: { nx: number; ny: number; dx: number }, x: number, y: number): number {
  const i = Math.min(g.nx - 1, Math.max(0, Math.floor(x / g.dx)));
  const j = Math.min(g.ny - 1, Math.max(0, Math.floor(y / g.dx)));
  return j * g.nx + i;
}

/** Local position of a site asset node. */
export function siteNodeLocal(site: SiteSpec, id: string): { x: number; y: number } {
  const nd = site.assets.nodes.find((n) => n.node_id === id);
  if (!nd) throw new Error(`Unknown node ${id}`);
  return siteToLocal(site, nd.position_m.x, nd.position_m.y);
}
