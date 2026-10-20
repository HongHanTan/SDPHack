import type { Network } from './types';

export const MANNING_N = 0.013;
export const MIN_SLOPE = 0.001;

/** Full-bore capacity of a circular pipe by Manning's equation (SI units), m³/s. */
export function manningFullCapacity(diameter: number, slope: number, n = MANNING_N): number {
  const A = (Math.PI * diameter * diameter) / 4;
  const R = diameter / 4;
  return (1 / n) * A * Math.pow(R, 2 / 3) * Math.sqrt(Math.max(slope, MIN_SLOPE));
}

export interface NetworkState {
  index: Map<string, number>;
  vol: Float64Array; // stored volume per node, m³
  vmax: Float64Array;
  from: Int32Array; // per pipe
  to: Int32Array;
  qFull: Float64Array;
  q: Float64Array; // flow this step, m³/s
  scratchOut: Float64Array;
  scratchIn: Float64Array;
}

export function createNetworkState(net: Network): NetworkState {
  const index = new Map(net.nodes.map((n, k) => [n.id, k] as const));
  const lookup = (id: string): number => {
    const k = index.get(id);
    if (k === undefined) throw new Error(`Unknown node ${id}`);
    return k;
  };
  return {
    index,
    vol: new Float64Array(net.nodes.length),
    vmax: Float64Array.from(net.nodes, (n) => n.area * n.maxDepth),
    from: Int32Array.from(net.pipes, (p) => lookup(p.from)),
    to: Int32Array.from(net.pipes, (p) => lookup(p.to)),
    qFull: Float64Array.from(net.pipes, (p) => manningFullCapacity(p.diameter, p.slope, p.n)),
    q: new Float64Array(net.pipes.length),
    scratchOut: new Float64Array(net.nodes.length),
    scratchIn: new Float64Array(net.nodes.length),
  };
}

/**
 * Capacity-based routing: each pipe carries min(full-bore capacity, water waiting upstream),
 * throttled when the downstream node lacks free storage. Mass-conservative.
 * A node can end above vmax only if its own outflow was throttled; coupling spills that excess.
 */
export function routePipes(st: NetworkState, dt: number): void {
  const { vol, vmax, from, to, qFull, q, scratchOut: out, scratchIn: inn } = st;
  const nP = q.length;

  out.fill(0);
  for (let p = 0; p < nP; p++) out[from[p]] += qFull[p];
  for (let p = 0; p < nP; p++) {
    const req = out[from[p]];
    const avail = vol[from[p]] / dt;
    q[p] = req > avail ? (qFull[p] * avail) / req : qFull[p];
  }

  out.fill(0);
  inn.fill(0);
  for (let p = 0; p < nP; p++) {
    out[from[p]] += q[p];
    inn[to[p]] += q[p];
  }
  for (let p = 0; p < nP; p++) {
    const d = to[p];
    const allowed = Math.max(0, (vmax[d] - vol[d]) / dt + out[d]);
    if (inn[d] > allowed) q[p] *= allowed / inn[d];
  }

  for (let p = 0; p < nP; p++) {
    vol[from[p]] -= q[p] * dt;
    vol[to[p]] += q[p] * dt;
  }
}
