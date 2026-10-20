import { DIP, FUNNEL } from '@floodops/engine/scenario/config';
import { ASSETS, LAYOUT } from '@floodops/engine/scenario/layout';

/** Jiajie's lawn plane height (scene y). */
export const LAWN_Z = 10.8;

type Road = { kind: 'straight'; x: number; y: number; width: number; length: number; angleDeg: number; surfaceZ: number } | { kind: 'circle'; x: number; y: number; radius: number; surfaceZ: number };
const ROADS = LAYOUT.roads as unknown as Road[];
const j07 = ASSETS.nodes.find((n) => n.node_id === 'NODE-J07')!.position_m;
const funnels = ASSETS.inlets.map((i) => i.position_m);

const bowl = (x: number, y: number, cx: number, cy: number, r: number, d: number) => {
  const dd = Math.hypot(x - cx, y - cy);
  return dd < r ? d * (1 - (dd / r) ** 2) : 0;
};

/** The engine's J07 dip plus grate funnels, in team-datum metres (same shapes the physics uses). */
export function bowlDrop(tx: number, ty: number): number {
  let d = bowl(tx, ty, j07.x, j07.y, DIP.radius, DIP.depth);
  for (const f of funnels) d += bowl(tx, ty, f.x, f.y, FUNNEL.radius, FUNNEL.depth);
  return d;
}

function onRoad(r: Road, x: number, y: number): boolean {
  if (r.kind === 'circle') return Math.hypot(x - r.x, y - r.y) <= r.radius;
  const a = (r.angleDeg * Math.PI) / 180;
  const dx = x - r.x;
  const dy = y - r.y;
  return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= r.length / 2 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= r.width / 2;
}

export function roadSurfaceAt(tx: number, ty: number): number | null {
  let z: number | null = null;
  for (const r of ROADS) if (onRoad(r, tx, ty)) z = z === null ? r.surfaceZ : Math.max(z, r.surfaceZ);
  return z;
}

export const lawnHeight = (tx: number, ty: number) => LAWN_Z - bowlDrop(tx, ty);

/** Height of Jiajie's visible ground at a team-datum point, with the engine's dips applied. */
export function visualGround(tx: number, ty: number): number {
  const road = roadSurfaceAt(tx, ty);
  return Math.max(road ?? -Infinity, LAWN_Z) - bowlDrop(tx, ty);
}
