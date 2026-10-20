import { captureInlets, exchangeOutfalls, runPumps, spillOverflow } from './coupling';
import { createMetricsTracker } from './metrics';
import { createNetworkState, routePipes, type NetworkState } from './pipes';
import { resetRiver, stageAt } from './river';
import { createSurface, stepSurface, surfaceSubsteps, type SurfaceState } from './surface';
import { LandUse, SimError, type Frame, type Scenario, type SimResult } from './types';

export interface EngineState {
  t: number;
  step: number;
  surf: SurfaceState;
  net: NetworkState;
  rainVol: number;
  infilVol: number;
  riverIn: number;
  riverOut: number;
  storage0: number;
  riverCells: Int32Array;
  landCells: Int32Array;
  catchStore: Float64Array; // m3 per catchment
  catchOf: Int16Array; // cell -> catchment index, -1 none
}

export function totalStorage(sc: Scenario, st: { surf: SurfaceState; net: NetworkState; catchStore?: Float64Array }): number {
  const area = sc.grid.dx * sc.grid.dx;
  let s = 0;
  for (const v of st.surf.h) s += v * area;
  for (const v of st.net.vol) s += v;
  if (st.catchStore) for (const v of st.catchStore) s += v;
  return s;
}

export function createEngine(sc: Scenario): EngineState {
  const surf = createSurface(sc.grid);
  const net = createNetworkState(sc.network);
  const river: number[] = [];
  const land: number[] = [];
  sc.grid.land.forEach((l, c) => (l === LandUse.RIVER ? river : land).push(c));
  const riverCells = Int32Array.from(river);
  // Bring the river to its initial stage before measuring storage, so that isn't counted as inflow.
  resetRiver(sc.grid, surf, riverCells, stageAt(sc.river, 0));
  const catchOf = new Int16Array(sc.grid.nx * sc.grid.ny).fill(-1);
  sc.catchments?.forEach((ct, k) => {
    for (const c of ct.cells) catchOf[c] = k;
  });
  const st: EngineState = {
    t: 0,
    step: 0,
    surf,
    net,
    rainVol: 0,
    infilVol: 0,
    riverIn: 0,
    riverOut: 0,
    storage0: 0,
    riverCells,
    landCells: Int32Array.from(land),
    catchStore: new Float64Array(sc.catchments?.length ?? 0),
    catchOf,
  };
  st.storage0 = totalStorage(sc, st);
  return st;
}

function interpCurve(curve: Array<[number, number]>, x: number): number {
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (x <= curve[i][0]) {
      const [x0, y0] = curve[i - 1];
      const [x1, y1] = curve[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return curve[curve.length - 1][1];
}

function rainRate(sc: Scenario, t: number): number {
  const k = Math.floor(t / sc.storm.blockS);
  return k < sc.storm.intensity.length ? sc.storm.intensity[k] : 0;
}

/** Advances one timestep. Returns total outfall flow (m³/s, negative = backflow). */
export function stepEngine(sc: Scenario, st: EngineState): number {
  const { grid, dt } = sc;
  const area = grid.dx * grid.dx;
  const h = st.surf.h;
  const level = stageAt(sc.river, st.t);

  const rain = rainRate(sc, st.t) * dt;
  const cats = sc.catchments;
  for (const c of st.landCells) {
    let r = rain;
    const k = st.catchOf[c];
    if (k >= 0 && cats) {
      const d = r * cats[k].directFraction;
      st.catchStore[k] += d * area;
      r -= d;
    }
    const wet = h[c] + r;
    const loss = Math.min(wet, grid.infil[c] * dt);
    h[c] = wet - loss;
    st.infilVol += loss * area;
  }
  st.rainVol += rain * area * st.landCells.length;
  if (cats) {
    for (let k = 0; k < cats.length; k++) {
      const ct = cats[k];
      const q = st.catchStore[k] * (1 - Math.exp(-dt / ct.lagS)); // m3 released this step
      if (!(q > 0)) continue;
      st.catchStore[k] -= q;
      const j = st.net.index.get(ct.node);
      const rate = q / dt;
      const capturedRate = ct.captureCurve ? Math.min(rate, interpCurve(ct.captureCurve, rate)) * (1 - (ct.captureLoss ?? 0)) : rate;
      const captured = j === undefined ? 0 : capturedRate * dt;
      const bypass = q - captured;
      if (j !== undefined) st.net.vol[j] += captured;
      if (bypass > 0) st.surf.h[j === undefined ? ct.cells[0] : sc.network.nodes[j].cell] += bypass / area;
    }
  }

  // Surface flow is sub-stepped so any coupling dt is stable (see maxStableDt). The river stage is a
  // boundary condition of the surface solver, so it is re-imposed every sub-step: forcing it only once
  // per coupling step pumps a near-resonant checkerboard into water bodies connected to the river.
  const n = surfaceSubsteps(grid.dx, dt);
  const sub = dt / n;
  for (let k = 0; k < n; k++) {
    const r = resetRiver(grid, st.surf, st.riverCells, stageAt(sc.river, st.t + k * sub));
    st.riverIn += r.added;
    st.riverOut += r.removed;
    stepSurface(grid, st.surf, sub);
  }
  captureInlets(grid, st.surf, sc.network, st.net, dt);
  routePipes(st.net, dt);
  const outfallQ = exchangeOutfalls(grid, st.surf, sc.network, st.net, level, dt);
  runPumps(grid, st.surf, sc.network, st.net, dt);
  spillOverflow(grid, st.surf, sc.network, st.net);

  st.t += dt;
  st.step++;
  validate(st);
  return outfallQ;
}

function validate(st: EngineState): void {
  const h = st.surf.h;
  for (let c = 0; c < h.length; c++) {
    const v = h[c];
    if (!Number.isFinite(v) || v < 0) throw new SimError(`Invalid water depth ${v} at cell ${c}`, st.step);
  }
  const vol = st.net.vol;
  for (let k = 0; k < vol.length; k++) {
    if (!Number.isFinite(vol[k]) || vol[k] < -1e-9) throw new SimError(`Invalid node volume ${vol[k]} at node ${k}`, st.step);
  }
  for (let k = 0; k < st.catchStore.length; k++) {
    const v = st.catchStore[k];
    if (!Number.isFinite(v) || v < -1e-9) throw new SimError(`Invalid catchment store ${v} at ${k}`, st.step);
  }
}

export function balanceError(sc: Scenario, st: EngineState): { rain: number; error: number } {
  const expected = st.storage0 + st.rainVol + st.riverIn - st.riverOut - st.infilVol;
  const error = Math.abs(totalStorage(sc, st) - expected) / Math.max(st.rainVol, 1e-9);
  return { rain: st.rainVol, error };
}

export function makeFrame(st: EngineState): Frame {
  const { vol, vmax, q, qFull } = st.net;
  return {
    t: st.t,
    depth: Float32Array.from(st.surf.h),
    nodeFill: Float32Array.from(vol, (v, k) => (vmax[k] > 0 ? v / vmax[k] : 0)),
    pipeLoad: Float32Array.from(q, (v, p) => (qFull[p] > 0 ? v / qFull[p] : 0)),
  };
}

export function runSimulation(sc: Scenario, onFrame?: (f: Frame) => void): SimResult {
  const st = createEngine(sc);
  const stormEnd = sc.storm.intensity.length * sc.storm.blockS;
  const nSteps = Math.round((stormEnd + sc.recessionS) / sc.dt);
  const frameEvery = Math.max(1, Math.round(sc.frameEveryS / sc.dt));
  const tracker = createMetricsTracker(sc);
  const frames: Frame[] = [];
  for (let s = 0; s < nSteps; s++) {
    const q = stepEngine(sc, st);
    tracker.afterStep(st.surf.h, q);
    if ((s + 1) % frameEvery === 0 || s === nSteps - 1) {
      const f = makeFrame(st);
      frames.push(f);
      tracker.onFrame(f);
      onFrame?.(f);
    }
  }
  return { frames, metrics: tracker.finish(stormEnd, balanceError(sc, st)) };
}

/**
 * Swaps in a new scenario mid-run (interventions or custom pipes changed) without creating or losing water.
 * Surface depths and fluxes are kept as they are. Node volumes carry over by node id; volume above a node's
 * new capacity, and the whole volume of nodes that no longer exist, spills onto the surface at that node's
 * cell. Pipe flows restart from 0. Use `newSc` for every later step.
 */
export function patchEngine(oldSc: Scenario, st: EngineState, newSc: Scenario): void {
  if (oldSc.grid.nx !== newSc.grid.nx || oldSc.grid.ny !== newSc.grid.ny) throw new Error('patchEngine: grid size changed');
  const area = newSc.grid.dx * newSc.grid.dx;
  const next = createNetworkState(newSc.network);
  oldSc.network.nodes.forEach((node, k) => {
    const v = st.net.vol[k];
    if (v <= 0) return;
    const j = next.index.get(node.id);
    if (j === undefined) {
      st.surf.h[node.cell] += v / area;
      return;
    }
    const keep = Math.min(v, next.vmax[j]);
    next.vol[j] = keep;
    if (v > keep) st.surf.h[newSc.network.nodes[j].cell] += (v - keep) / area;
  });
  st.net = next;
  const nNew = newSc.catchments?.length ?? 0;
  if (nNew !== st.catchStore.length) {
    oldSc.catchments?.forEach((ct, k) => {
      if (st.catchStore[k] > 0) st.surf.h[ct.cells[0]] += st.catchStore[k] / area;
    });
    st.catchStore = new Float64Array(nNew);
  }
  st.catchOf.fill(-1);
  newSc.catchments?.forEach((ct, k) => {
    for (const c of ct.cells) st.catchOf[c] = k;
  });
}
