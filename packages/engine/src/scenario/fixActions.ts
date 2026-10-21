import { CUSTOM_PIPE_RM_PER_M_PER_M_DIA } from './index';
import type { AssetConduit } from './layout';
import type { SiteSpec } from './site';
import { withPipeDiameter } from './siteVariants';

export { withPipeDiameter };

/** Commercial pipe sizes (m) the fix finder chooses from. */
export const STANDARD_PIPE_SIZES_M = [0.3, 0.375, 0.45, 0.525, 0.6, 0.675, 0.75, 0.825, 0.9, 1.05, 1.2, 1.35, 1.5] as const;

export const STORAGE_RM_PER_M3 = 1_500;
export const INLET_RM_PER_GRATE = 8_000;
export const GRATE_AREA_M2 = 0.6;
const RELIEF_MANNING_N = 0.013;

export type FixAction =
  | { kind: 'upsize'; pipeId: string; diameterM: number }
  | { kind: 'relief'; fromNode: string; toNode: string; diameterM: number }
  | { kind: 'storage'; nodeId: string; volumeM3: number }
  | { kind: 'inlet'; nodeId: string; grates: number };

const positive = (v: number, what: string) => {
  if (!(Number.isFinite(v) && v > 0)) throw new Error(`Invalid ${what} ${v}`);
};
const nodeOf = (site: SiteSpec, id: string) => {
  const n = site.assets.nodes.find((x) => x.node_id === id);
  if (!n) throw new Error(`Unknown node ${id}`);
  return n;
};
const reliefLength = (a: { position_m: { x: number; y: number } }, b: { position_m: { x: number; y: number } }) =>
  Math.hypot(a.position_m.x - b.position_m.x, a.position_m.y - b.position_m.y);
const pipeOf = (site: SiteSpec, id: string): AssetConduit => {
  const p = site.assets.conduits.find((c) => c.conduit_id === id);
  if (!p) throw new Error(`Unknown pipe ${id}`);
  return p;
};

export const fixId = (fix: FixAction): string => {
  switch (fix.kind) {
    case 'upsize': return `upsize:${fix.pipeId}@${fix.diameterM}`;
    case 'relief': return `relief:${fix.fromNode}>${fix.toNode}@${fix.diameterM}`;
    case 'storage': return `storage:${fix.nodeId}@${fix.volumeM3}`;
    case 'inlet': return `inlet:${fix.nodeId}+${fix.grates}`;
  }
};

/** A new site with the fix applied (the input is never mutated); throws on invalid input. */
export function applyFix(site: SiteSpec, fix: FixAction): SiteSpec {
  if (fix.kind === 'upsize') return withPipeDiameter(site, fix.pipeId, fix.diameterM);
  const copy = structuredClone(site);
  copy.key = `${site.key}|${fixId(fix)}`;
  if (fix.kind === 'relief') {
    positive(fix.diameterM, 'pipe diameter');
    const a = nodeOf(copy, fix.fromNode);
    const b = nodeOf(copy, fix.toNode);
    if (!(a.invert_elevation_m > b.invert_elevation_m)) throw new Error(`Relief pipe ${fix.fromNode} → ${fix.toNode} runs uphill`);
    copy.assets.conduits.push({
      conduit_id: `RELIEF-${fix.fromNode}-${fix.toNode}`,
      from_node_id: a.node_id,
      to_node_id: b.node_id,
      diameter_m: fix.diameterM,
      length_m: reliefLength(a, b),
      manning_n: RELIEF_MANNING_N,
    });
  } else if (fix.kind === 'storage') {
    positive(fix.volumeM3, 'storage volume');
    const n = nodeOf(copy, fix.nodeId);
    if (!(n.max_depth_m > 0)) throw new Error(`Node ${fix.nodeId} has no depth for storage`);
    n.storage_area_m2 = fix.volumeM3 / n.max_depth_m;
  } else {
    positive(fix.grates, 'grate count');
    const n = nodeOf(copy, fix.nodeId);
    const inlet = copy.assets.inlets.find((i) => i.node_id === fix.nodeId);
    const nExisting = inlet ? Math.max(1, Math.round(inlet.grate_area_m2 / GRATE_AREA_M2)) : 1;
    if (inlet) inlet.grate_area_m2 += GRATE_AREA_M2 * fix.grates;
    else copy.assets.inlets.push({ inlet_id: `INLET-${fix.nodeId}`, node_id: fix.nodeId, position_m: { ...n.position_m }, grate_area_m2: GRATE_AREA_M2 * fix.grates });
    for (const s of copy.subcatchments) if (s.outletNodeId === fix.nodeId) s.captureScale = (s.captureScale ?? 1) * ((nExisting + fix.grates) / nExisting);
  }
  return copy;
}

export function fixLabel(fix: FixAction, site: SiteSpec): string {
  void site;
  const mm = (d: number) => Math.round(d * 1000);
  switch (fix.kind) {
    case 'upsize': return `Upsize ${fix.pipeId} to Ø${mm(fix.diameterM)}`;
    case 'relief': return `Relief pipe ${fix.fromNode} → ${fix.toNode} (Ø${mm(fix.diameterM)})`;
    case 'storage': return `${Math.round(fix.volumeM3)} m³ storage at ${fix.nodeId}`;
    case 'inlet': return fix.grates === 1 ? `Extra inlet grate at ${fix.nodeId}` : `${fix.grates} extra inlet grates at ${fix.nodeId}`;
  }
}

/** Indicative placeholder cost (RM). */
export function fixCostRM(fix: FixAction, site: SiteSpec): number {
  switch (fix.kind) {
    case 'upsize': return pipeOf(site, fix.pipeId).length_m * fix.diameterM * CUSTOM_PIPE_RM_PER_M_PER_M_DIA;
    case 'relief': return reliefLength(nodeOf(site, fix.fromNode), nodeOf(site, fix.toNode)) * fix.diameterM * CUSTOM_PIPE_RM_PER_M_PER_M_DIA;
    case 'storage': return fix.volumeM3 * STORAGE_RM_PER_M3;
    case 'inlet': return fix.grates * INLET_RM_PER_GRATE;
  }
}

/** Where to show the fix, in team metres. */
export function fixLocation(fix: FixAction, site: SiteSpec): { x: number; y: number } {
  const mid = (a: string, b: string) => {
    const p = nodeOf(site, a).position_m;
    const q = nodeOf(site, b).position_m;
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  };
  switch (fix.kind) {
    case 'upsize': { const p = pipeOf(site, fix.pipeId); return mid(p.from_node_id, p.to_node_id); }
    case 'relief': return mid(fix.fromNode, fix.toNode);
    default: { const p = nodeOf(site, fix.nodeId).position_m; return { x: p.x, y: p.y }; }
  }
}
