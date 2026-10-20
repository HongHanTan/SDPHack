import type { TailwaterCase } from '../src/scenario/config';
import { buildScenario } from '../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../src/scenario/interventions';
import { STORMS, type StormId } from '../src/scenario/storms';
import { runSimulation } from '../src/sim/engine';

type Cell = { dSag: number; dHomes: number };
export type Effects = Record<TailwaterCase, Partial<Record<StormId, Partial<Record<InterventionId, Cell>>>>>;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Which (tailwater, storm, interventions) cells get a badge. */
export const EFFECT_MATRIX: Array<{ tailwater: TailwaterCase; storms: StormId[]; ids: InterventionId[] }> = [
  { tailwater: 'normal', storms: Object.keys(STORMS) as StormId[], ids: INTERVENTIONS.map((i) => i.id) },
  { tailwater: 'high', storms: ['synthetic_80mmh_60min', 'synthetic_120mmh_60min'], ids: ['flap-gate', 'pump'] },
];

/** Baseline + single-intervention runs for every matrix cell; returns the change vs that cell's baseline. */
export function computeEffects(log: (line: string) => void = () => {}): Effects {
  const out: Effects = { normal: {}, high: {} };
  for (const block of EFFECT_MATRIX) {
    for (const storm of block.storms) {
      const base = runSimulation(buildScenario([], storm, [], { tailwater: block.tailwater })).metrics;
      log(`${block.tailwater} ${storm} baseline: J07 ${base.peakSagDepth.toFixed(3)} m, homes ${base.homesFlooded}`);
      const row: Partial<Record<InterventionId, Cell>> = {};
      for (const id of block.ids) {
        const m = runSimulation(buildScenario([id], storm, [], { tailwater: block.tailwater })).metrics;
        row[id] = { dSag: round3(m.peakSagDepth - base.peakSagDepth), dHomes: m.homesFlooded - base.homesFlooded };
        log(`${block.tailwater} ${storm} ${id}: dSag ${row[id]!.dSag}, dHomes ${row[id]!.dHomes}`);
      }
      out[block.tailwater][storm] = row;
    }
  }
  return out;
}
