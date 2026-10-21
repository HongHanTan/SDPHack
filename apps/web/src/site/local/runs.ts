import { SimRunError, SimRunner, type RunResult, type WorkerLike } from '@floodops/engine/client/runner';
import { buildScenario, effectiveBlockage, type ScenarioOptions } from '@floodops/engine/scenario/index';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import type { Storm } from '@floodops/engine/sim/types';
import type { AssetInlet, SimulationFrame, SimulationMetricsResponse } from '../../types';
import { makeContext, toTeamFrame, toTeamMetrics } from '../../engine/frameAdapter';
import type { DepthGrids } from './store';

/** The part of the engine `SimRunner` the local site API uses (injectable for tests). */
export interface EngineRunner {
  run(ids: [], stormId: 'synthetic_80mmh_60min', onFrame: undefined, custom: [], opts: ScenarioOptions): Promise<RunResult>;
}

/** Every 2nd engine frame (60 s) keeps its street-water depth grid. */
export const DEPTH_EVERY = 2;

const createWorker = () => new Worker(new URL('../../engine/workers/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;

let shared: SimRunner | null = null;
/** The engine web worker, created on first use. */
export function browserRunner(): EngineRunner {
  return {
    run: (...args) => {
      shared ??= new SimRunner(createWorker, 1);
      return shared.run(...args);
    },
  };
}

/** The fix analysis never uses more than this many engine workers at once. */
export const ANALYSIS_POOL_MAX = 3;
/** Engine workers for the fix analysis: min(3, max(1, hardwareConcurrency − 1)). */
export function analysisPoolSize(hardwareConcurrency: number | undefined): number {
  const hc = hardwareConcurrency && hardwareConcurrency > 0 ? hardwareConcurrency : 2;
  return Math.min(ANALYSIS_POOL_MAX, Math.max(1, Math.floor(hc) - 1));
}

let pool: EngineRunner[] | null = null;
/** The fix-analysis worker pool (each `SimRunner` caches 1 result), created on first use and then reused. */
export function browserRunnerPool(): EngineRunner[] {
  pool ??= Array.from({ length: analysisPoolSize(typeof navigator === 'undefined' ? undefined : navigator.hardwareConcurrency) }, () => {
    let r: SimRunner | null = null;
    return { run: (...args) => (r ??= new SimRunner(createWorker, 1)).run(...args) } satisfies EngineRunner;
  });
  return pool;
}

/**
 * Runs `work` on each item with at most `min(runners.length, ANALYSIS_POOL_MAX)` running at once, each on its own
 * runner. No new item starts once `stopped()` is true. `work` must not reject.
 */
export async function runPooled<T>(items: readonly T[], runners: readonly EngineRunner[], work: (runner: EngineRunner, item: T, index: number) => Promise<void>, stopped: () => boolean): Promise<void> {
  if (!runners.length) throw new Error('No engine workers are available for the analysis.');
  let next = 0;
  const lane = async (runner: EngineRunner) => {
    while (!stopped() && next < items.length) {
      const i = next++;
      await work(runner, items[i], i);
    }
  };
  await Promise.all(runners.slice(0, ANALYSIS_POOL_MAX).map(lane));
}

export interface EngineRunOutput {
  frames: SimulationFrame[];
  metrics: SimulationMetricsResponse;
  depth: DepthGrids;
}

/** Runs the site with the uploaded storm (the storm override makes the storm id irrelevant). */
export async function runSite(runner: EngineRunner, runId: string, site: SiteSpec, storm: Storm): Promise<EngineRunOutput> {
  const opts: ScenarioOptions = { site, storm, blockage: {} };
  const sc = buildScenario([], 'synthetic_80mmh_60min', [], opts);
  const ctx = makeContext(sc.network, sc.grid, effectiveBlockage([], opts), site.assets.inlets as unknown as AssetInlet[]);
  const r = await runner.run([], 'synthetic_80mmh_60min', undefined, [], opts);
  const frames = r.frames.map((f) => toTeamFrame(f, ctx));
  const metrics = toTeamMetrics(runId, r.metrics, frames, ctx, sc.frameEveryS, site);
  const kept = r.frames.filter((_, i) => i % DEPTH_EVERY === 0);
  const cells = sc.grid.z.length;
  const data = new Float32Array(kept.length * cells);
  kept.forEach((f, i) => data.set(f.depth.subarray(0, cells), i * cells));
  return { frames, metrics, depth: { times: kept.map((f) => f.t), cells, data: data.buffer } };
}

export function runErrorMessage(e: unknown): string {
  return e instanceof SimRunError && e.step >= 0 ? `Engine stopped at step ${e.step}: ${e.message}` : e instanceof Error ? e.message : String(e);
}

/** The stored depth grid for a frame time (nearest earlier stored frame), or null. */
export function depthAt(depth: DepthGrids | null | undefined, timestampS: number): Float32Array | null {
  if (!depth || !depth.times.length) return null;
  let k = -1;
  depth.times.forEach((t, i) => {
    if (t <= timestampS + 1e-6) k = i;
  });
  return k < 0 ? null : new Float32Array(depth.data, k * depth.cells * 4, depth.cells);
}
