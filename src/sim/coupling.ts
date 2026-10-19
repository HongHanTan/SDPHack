import type { Grid, Network } from './types';
import type { NetworkState } from './pipes';
import { G, type SurfaceState } from './surface';

export const WEIR_C = 1.66; // SI weir coefficient for kerb/grate inlets (assumption)
export const ORIFICE_CD = 0.6; // outfall discharge coefficient (assumption)

/** Surface water enters nodes through inlets at the weir rate, limited by water present and free storage. */
export function captureInlets(grid: Grid, surf: SurfaceState, net: Network, st: NetworkState, dt: number): void {
  const area = grid.dx * grid.dx;
  for (let k = 0; k < net.nodes.length; k++) {
    const node = net.nodes[k];
    if (node.inletPerimeter <= 0) continue;
    const h = surf.h[node.cell];
    if (h <= 0) continue;
    const weir = WEIR_C * node.inletPerimeter * Math.pow(h, 1.5);
    const q = Math.min(weir, (h * area) / dt, Math.max(0, st.vmax[k] - st.vol[k]) / dt);
    const next = h - (q * dt) / area;
    surf.h[node.cell] = next < 0 ? 0 : next;
    st.vol[k] += q * dt;
  }
}

/** Water above a node's storage comes back out onto the street at that node's cell. */
export function spillOverflow(grid: Grid, surf: SurfaceState, net: Network, st: NetworkState): number {
  const area = grid.dx * grid.dx;
  let spilled = 0;
  for (let k = 0; k < net.nodes.length; k++) {
    const excess = st.vol[k] - st.vmax[k];
    if (excess > 0) {
      st.vol[k] = st.vmax[k];
      surf.h[net.nodes[k].cell] += excess / area;
      spilled += excess;
    }
  }
  return spilled;
}

/**
 * Orifice exchange between each outfall node and its river cell.
 * Positive = discharge to river; negative = river backflow into the network (blocked by a flap gate).
 */
export function exchangeOutfalls(
  grid: Grid,
  surf: SurfaceState,
  net: Network,
  st: NetworkState,
  riverLevel: number,
  dt: number,
): number {
  const area = grid.dx * grid.dx;
  let total = 0;
  for (const o of net.outfalls) {
    const k = st.index.get(o.node)!;
    const node = net.nodes[k];
    const head = node.invert + st.vol[k] / node.area;
    const dH = head - Math.max(riverLevel, node.invert);
    let q = 0;
    if (dH > 0) {
      q = Math.min(ORIFICE_CD * o.area * Math.sqrt(2 * G * dH), st.vol[k] / dt);
    } else if (dH < 0 && !o.flapGate) {
      q = -Math.min(ORIFICE_CD * o.area * Math.sqrt(-2 * G * dH), (surf.h[o.riverCell] * area) / dt);
    }
    st.vol[k] -= q * dt;
    surf.h[o.riverCell] += (q * dt) / area;
    total += q;
  }
  return total;
}

export function runPumps(grid: Grid, surf: SurfaceState, net: Network, st: NetworkState, dt: number): void {
  const area = grid.dx * grid.dx;
  for (const p of net.pumps) {
    const k = st.index.get(p.node)!;
    const q = Math.min(p.rate, st.vol[k] / dt);
    st.vol[k] -= q * dt;
    surf.h[p.riverCell] += (q * dt) / area;
  }
}
