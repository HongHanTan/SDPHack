import { describe, expect, it } from 'vitest';
import { THRESHOLDS } from '../src/scenario/config';
import { buildScenario } from '../src/scenario/index';
import { totalCost, type InterventionId } from '../src/scenario/interventions';
import { runSimulation } from '../src/sim/engine';

const run = (ids: InterventionId[]) => runSimulation(buildScenario(ids, '100yr')).metrics;

describe('demo story (100-yr storm)', () => {
  const base = run([]);
  const upsize = run(['upsize-trunk']);
  const combo = run(['detention-tank', 'flap-gate']);

  it('baseline floods the sag', () => {
    expect(base.peakSagDepth).toBeGreaterThanOrEqual(THRESHOLDS.home);
    expect(base.homesFlooded).toBeGreaterThanOrEqual(5);
  });

  it('upsizing the trunk alone only modestly helps', () => {
    expect(upsize.homesFlooded).toBeGreaterThanOrEqual(Math.ceil(base.homesFlooded * 0.7));
  });

  it('flap gate + tank beats the upsize, for less money', () => {
    expect(combo.peakSagDepth).toBeLessThan(upsize.peakSagDepth);
    expect(combo.homesFlooded).toBeLessThan(upsize.homesFlooded);
    expect(totalCost(['detention-tank', 'flap-gate'])).toBeLessThan(totalCost(['upsize-trunk']));
  });

  it('every run closes its water balance', () => {
    for (const m of [base, upsize, combo]) expect(m.balance.error).toBeLessThan(0.01);
  });
});
