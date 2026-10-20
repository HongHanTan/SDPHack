import type { Scenario } from '../sim/types';
import { RIVER_STAGE, SAG_CHART_POINT, SIM, THRESHOLDS } from './config';
import { applyInterventions, findNode, type InterventionId, type Township } from './interventions';
import { buildNetwork, makePipe } from './network';
import { STORMS, type StormId } from './storms';
import { buildTerrain, cellAt } from './terrain';

export interface CustomPipe {
  from: string;
  to: string;
  diameter: number;
}

/** Indicative placeholder rate for user-drawn pipes, RM per metre per metre of diameter. */
export const CUSTOM_PIPE_RM_PER_M_PER_M_DIA = 5_000;

let cachedBase: Township | null = null;

export function baseTownship(): Township {
  if (!cachedBase) {
    const grid = buildTerrain();
    cachedBase = { grid, network: buildNetwork(grid) };
  }
  return cachedBase;
}

export function buildTownship(ids: readonly InterventionId[], custom: readonly CustomPipe[] = []): Township {
  const t = applyInterventions(baseTownship(), ids);
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

export function buildScenario(ids: readonly InterventionId[], stormId: StormId, custom: readonly CustomPipe[] = []): Scenario {
  const { grid, network } = buildTownship(ids, custom);
  return {
    grid,
    network,
    storm: STORMS[stormId],
    river: RIVER_STAGE,
    dt: SIM.dt,
    recessionS: SIM.recessionS,
    frameEveryS: SIM.frameEveryS,
    thresholds: THRESHOLDS,
    sagCell: cellAt(SAG_CHART_POINT.x, SAG_CHART_POINT.y),
  };
}

export function scenarioKey(ids: readonly InterventionId[], stormId: StormId, custom: readonly CustomPipe[] = []): string {
  const pipes = custom.map((c) => `${c.from}>${c.to}@${c.diameter}`).join(',');
  return `${stormId}|${[...ids].sort().join(',')}|${pipes}`;
}
