import type { Scenario, Storm } from '../sim/types';
import { BASELINE_BLOCKAGE, SIM, THRESHOLDS, type TailwaterCase } from './config';
import { applyInterventions, findNode, type InterventionId, type Township } from './interventions';
import { buildCatchments } from './catchments';
import { buildNetwork, makePipe } from './network';
import { cellIn, siteNodeLocal, TAMAN_KYRA, type SiteSpec } from './site';
import { STORMS, type StormId } from './storms';
import { buildTerrain } from './terrain';

export { TAMAN_KYRA, type SiteSpec } from './site';

export interface CustomPipe {
  from: string;
  to: string;
  diameter: number;
}

export interface ScenarioOptions {
  tailwater?: TailwaterCase;
  /** inlet_id → blocked fraction; defaults to BASELINE_BLOCKAGE (INLET-D07 40%). */
  blockage?: Record<string, number>;
  catchments?: boolean; // default true: SWMM-style catchment loading (spec section 14)
  /** Township to build; default the built-in Taman Kyra. */
  site?: SiteSpec;
  /** Rainfall to use instead of the built-in storm for `stormId` (e.g. read from an uploaded .inp). */
  storm?: Storm;
}

/** Indicative placeholder rate for user-drawn pipes, RM per metre per metre of diameter. */
export const CUSTOM_PIPE_RM_PER_M_PER_M_DIA = 5_000;

const baseCache = new Map<string, Township>();
const BASE_CACHE_MAX = 8;
const blockageKey = (b: Record<string, number>) =>
  Object.keys(b)
    .sort()
    .map((k) => `${k}=${b[k]}`)
    .join(',');

export function baseTownship(blockage: Record<string, number> = BASELINE_BLOCKAGE, site: SiteSpec = TAMAN_KYRA): Township {
  const key = `${site.key}|${blockageKey(blockage)}`;
  let t = baseCache.get(key);
  if (!t) {
    const grid = buildTerrain(site);
    t = { grid, network: buildNetwork(grid, blockage, site) };
    if (baseCache.size >= BASE_CACHE_MAX) baseCache.delete(baseCache.keys().next().value!);
    baseCache.set(key, t);
  }
  return t;
}

export function buildTownship(ids: readonly InterventionId[], custom: readonly CustomPipe[] = [], opts: ScenarioOptions = {}): Township {
  const site = opts.site ?? TAMAN_KYRA;
  if (ids.length && !site.builtIn) throw new Error('Interventions are only available for the built-in township');
  const t = applyInterventions(baseTownship(opts.blockage ?? (site.builtIn ? BASELINE_BLOCKAGE : {}), site), ids);
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

/** The site's hotspot node cell (Taman Kyra: J07): the hotspot the readouts and charts follow. */
export function hotspotCell(site: SiteSpec = TAMAN_KYRA): number {
  const p = siteNodeLocal(site, site.hotspotNodeId);
  return cellIn(site.gridSpec, p.x, p.y);
}

export function buildScenario(
  ids: readonly InterventionId[],
  stormId: StormId,
  custom: readonly CustomPipe[] = [],
  opts: ScenarioOptions = {},
): Scenario {
  const site = opts.site ?? TAMAN_KYRA;
  const { grid, network } = buildTownship(ids, custom, opts);
  return {
    grid,
    network,
    storm: opts.storm ?? STORMS[stormId],
    river: { times: [0], levels: [site.tailwater[opts.tailwater ?? 'normal']] },
    dt: SIM.dt,
    recessionS: SIM.recessionS,
    frameEveryS: SIM.frameEveryS,
    thresholds: THRESHOLDS,
    sagCell: hotspotCell(site),
    catchments: opts.catchments === false ? undefined : buildCatchments(grid, effectiveBlockage(ids, opts), site),
  };
}

/** Blocked fractions after interventions (desilting clears INLET-D07 for both the grate and its catchment). */
export function effectiveBlockage(ids: readonly InterventionId[], opts: ScenarioOptions = {}): Record<string, number> {
  const b = { ...(opts.blockage ?? ((opts.site ?? TAMAN_KYRA).builtIn ? BASELINE_BLOCKAGE : {})) };
  if (ids.includes('desilt-d07')) b['INLET-D07'] = 0;
  return b;
}

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16);
}

export function scenarioKey(
  ids: readonly InterventionId[],
  stormId: StormId,
  custom: readonly CustomPipe[] = [],
  opts: ScenarioOptions = {},
): string {
  const pipes = custom.map((c) => `${c.from}>${c.to}@${c.diameter}`).join(',');
  return `${(opts.site ?? TAMAN_KYRA).key}|${stormId}|${opts.tailwater ?? 'normal'}|${blockageKey(opts.blockage ?? ((opts.site ?? TAMAN_KYRA).builtIn ? BASELINE_BLOCKAGE : {}))}|${[...ids].sort().join(',')}|${pipes}` + '|' + (opts.catchments === false ? 'nocatch' : 'catch') + (opts.storm ? `|storm=${fnv1a(JSON.stringify(opts.storm))}` : '');
}
