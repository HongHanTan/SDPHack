import { buildScenario } from '../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../src/scenario/interventions';
import { STORMS, type StormId } from '../src/scenario/storms';
import { runSimulation } from '../src/sim/engine';

export type Effects = Record<StormId, Record<InterventionId, { dSag: number; dHomes: number }>>;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Runs the baseline and each single intervention for every storm (16 runs) and returns the change vs baseline. */
export function computeEffects(log: (line: string) => void = () => {}): Effects {
  const out = {} as Effects;
  for (const storm of Object.keys(STORMS) as StormId[]) {
    const base = runSimulation(buildScenario([], storm)).metrics;
    log(`${storm} baseline: sag ${base.peakSagDepth.toFixed(3)} m, homes ${base.homesFlooded}`);
    const row = {} as Effects[StormId];
    for (const iv of INTERVENTIONS) {
      const m = runSimulation(buildScenario([iv.id], storm)).metrics;
      row[iv.id] = { dSag: round3(m.peakSagDepth - base.peakSagDepth), dHomes: m.homesFlooded - base.homesFlooded };
      log(`${storm} ${iv.id}: dSag ${row[iv.id].dSag}, dHomes ${row[iv.id].dHomes}`);
    }
    out[storm] = row;
  }
  return out;
}
