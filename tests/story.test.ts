import { describe, expect, it } from 'vitest';
import { buildScenario } from '../src/scenario/index';
import { INTERVENTIONS, totalCost, type InterventionId } from '../src/scenario/interventions';
import { runSimulation } from '../src/sim/engine';
import type { Metrics } from '../src/sim/types';

// Acceptance criteria for the demo story (docs/tuning.md). Every number below is produced by the model;
// nothing is special-cased. ~10 full 3-hour runs, so this takes a few minutes.
const run = (ids: InterventionId[]): Metrics => runSimulation(buildScenario(ids, '100yr')).metrics;

describe('demo story (100-yr storm)', () => {
  const base = run([]);
  const single = new Map(INTERVENTIONS.map((iv) => [iv.id, run([iv.id])] as const));
  const upsize = single.get('upsize-trunk')!;
  const flap = single.get('flap-gate')!;
  const combo = run(['detention-tank', 'flap-gate']);
  const drained = run(['sag-inlets', 'pump']);
  const all = [base, ...single.values(), combo, drained];

  it('baseline floods the sag to a plausible depth and floods homes', () => {
    expect(base.peakSagDepth).toBeGreaterThanOrEqual(0.4);
    expect(base.peakSagDepth).toBeLessThanOrEqual(1.2);
    expect(base.homesFlooded).toBeGreaterThanOrEqual(5);
  });

  it.each(INTERVENTIONS.map((iv) => [iv.id]))('preset %s alone changes the outcome (no dead toggles)', (id) => {
    const m = single.get(id as InterventionId)!;
    const dSag = Math.abs(m.peakSagDepth - base.peakSagDepth);
    const dHomes = Math.abs(m.homesFlooded - base.homesFlooded);
    expect(dSag >= 0.03 || dHomes >= 1).toBe(true);
  });

  it('upsizing the trunk alone only modestly helps (backflow-limited)', () => {
    expect(upsize.homesFlooded).toBeGreaterThanOrEqual(Math.ceil(base.homesFlooded * 0.7));
  });

  it('flap gate + tank beats the upsize, for less money', () => {
    expect(combo.peakSagDepth).toBeLessThan(upsize.peakSagDepth);
    expect(combo.homesFlooded).toBeLessThan(upsize.homesFlooded);
    expect(totalCost(['detention-tank', 'flap-gate'])).toBeLessThan(totalCost(['upsize-trunk']));
  });

  it('the tank contributes: tank + flap is strictly better than the flap alone', () => {
    expect(combo.peakSagDepth).toBeLessThan(flap.peakSagDepth);
  });

  it('extra inlets + pump drain the sag so roads are passable within the hour', () => {
    expect(drained.minutesToPassable).not.toBeNull();
    expect(drained.minutesToPassable!).toBeLessThanOrEqual(60);
  });

  it('every run closes its water balance', () => {
    for (const m of all) expect(m.balance.error).toBeLessThan(0.01);
  });
});
