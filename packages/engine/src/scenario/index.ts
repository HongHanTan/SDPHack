import type { Scenario } from '../sim/types';
import { BASELINE_BLOCKAGE, SIM, TAILWATER, THRESHOLDS, type TailwaterCase } from './config';
import { applyInterventions, findNode, type InterventionId, type Township } from './interventions';
import { buildNetwork, makePipe, nodeSite } from './network';
import { STORMS, type StormId } from './storms';
import { buildTerrain, cellAt } from './terrain';

export interface CustomPipe {
  from: string;
  to: string;
  diameter: number;
}

export interface ScenarioOptions {
  tailwater?: TailwaterCase;
  /** inlet_id → blocked fraction; defaults to BASELINE_BLOCKAGE (INLET-D07 40%). */
  blockage?: Record<string, number>;
}

/** Indicative placeholder rate for user-drawn pipes, RM per metre per metre of diameter. */
export const CUSTOM_PIPE_RM_PER_M_PER_M_DIA = 5_000;

const baseCache = new Map<string, Township>();
const blockageKey = (b: Record<string, number>) =>
  Object.keys(b)
    .sort()
    .map((k) => `${k}=${b[k]}`)
    .join(',');

export function baseTownship(blockage: Record<string, number> = BASELINE_BLOCKAGE): Township {
  const key = blockageKey(blockage);
  let t = baseCache.get(key);
  if (!t) {
    const grid = buildTerrain();
    t = { grid, network: buildNetwork(grid, blockage) };
    baseCache.set(key, t);
  }
  return t;
}

export function buildTownship(ids: readonly InterventionId[], custom: readonly CustomPipe[] = [], opts: ScenarioOptions = {}): Township {
  const t = applyInterventions(baseTownship(opts.blockage ?? BASELINE_BLOCKAGE), ids);
  custom.forEach((cp, k) => {
    const pipe = makePipe(findNode(t, cp.from), findNode(t, cp.to), cp.diameter);
    t.network.pipes.push({ ...pipe, id: `custom-${k}` });
  });
  return t;
}

export function customPipeCost(t: Township, cp: CustomPipe): number {
  const a = findNode(t, cp.from);
  const b = findNode(t, cp.to);
  return Math.hypot(a.x - b.x, a.y - b.y) * cp.diameter * CUSTOM_PIPE_RM_PER_M_PER_M_DIA;
}

/** The J07 junction cell: the hotspot the readouts and charts follow. */
export function hotspotCell(): number {
  const p = nodeSite('NODE-J07');
  return cellAt(p.x, p.y);
}

export function buildScenario(
  ids: readonly InterventionId[],
  stormId: StormId,
  custom: readonly CustomPipe[] = [],
  opts: ScenarioOptions = {},
): Scenario {
  const { grid, network } = buildTownship(ids, custom, opts);
  return {
    grid,
    network,
    storm: STORMS[stormId],
    river: { times: [0], levels: [TAILWATER[opts.tailwater ?? 'normal']] },
    dt: SIM.dt,
    recessionS: SIM.recessionS,
    frameEveryS: SIM.frameEveryS,
    thresholds: THRESHOLDS,
    sagCell: hotspotCell(),
  };
}

export function scenarioKey(
  ids: readonly InterventionId[],
  stormId: StormId,
  custom: readonly CustomPipe[] = [],
  opts: ScenarioOptions = {},
): string {
  const pipes = custom.map((c) => `${c.from}>${c.to}@${c.diameter}`).join(',');
  return `${stormId}|${opts.tailwater ?? 'normal'}|${blockageKey(opts.blockage ?? BASELINE_BLOCKAGE)}|${[...ids].sort().join(',')}|${pipes}`;
}
