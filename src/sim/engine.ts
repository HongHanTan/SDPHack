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
}

export function totalStorage(sc: Scenario, st: { surf: SurfaceState; net: NetworkState }): number {
  const area = sc.grid.dx * sc.grid.dx;
  let s = 0;
  for (const v of st.surf.h) s += v * area;
  for (const v of st.net.vol) s += v;
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
  };
  st.storage0 = totalStorage(sc, st);
  return st;
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
  for (const c of st.landCells) {
    const wet = h[c] + rain;
    const loss = Math.min(wet, grid.infil[c] * dt);
    h[c] = wet - loss;
    st.infilVol += loss * area;
  }
  st.rainVol += rain * area * st.landCells.length;

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
}
