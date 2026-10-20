import { describe, expect, it } from 'vitest';
import { buildScenario, type ScenarioOptions } from '../src/scenario/index';
import type { InterventionId } from '../src/scenario/interventions';
import { nodeSite } from '../src/scenario/network';
import { cellAt } from '../src/scenario/terrain';
import { runSimulation } from '../src/sim/engine';

const STORM = 'synthetic_80mmh_60min';
const j08 = nodeSite('NODE-J08');
const j08Cell = cellAt(j08.x, j08.y);

function run(ids: InterventionId[], opts: ScenarioOptions = {}) {
  const sc = buildScenario(ids, STORM, [], opts);
  const { frames, metrics } = runSimulation(sc);
  const p07 = sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07');
  const p07Max = Math.max(...frames.map((f) => f.pipeLoad[p07]));
  return { m: metrics, p07Max, j08Peak: metrics.peakDepth[j08Cell] };
}

describe('Taman Kyra demo story (80 mm/h, team storm)', () => {
  const base = run([]);
  const desilt = run(['desilt-d07']);
  const upsize = run(['upsize-p07']);
  const combined = run(['desilt-d07', 'upsize-p07']);
  const highBase = run([], { tailwater: 'high' });
  const tank = run(['storage-tank']);
  const lake = run(['lake-overflow']);

  it('1. baseline floods the J07 junction and homes', () => {
    expect(base.m.peakSagDepth).toBeGreaterThanOrEqual(0.15);
    expect(base.m.homesFlooded).toBeGreaterThanOrEqual(2);
  });
  // Claim 2 (desilting D07 lowers J07) stays removed after the Task 10 retune (grate capture, spec §15). P07 runs at its
  // 0.549 m³/s full-bore cap in every baseline tried within the bounds, so the J07 pond is set by P07, not the D07 grate:
  // the bypass desilting saves lands on the same J07 cell as the node overflow it causes. Desilt dSag was −0.001 to
  // +0.006 m across the pass 4 sweeps, and the only (1 mm) reductions came at lagS 300–600 s, where claim 1 fails. The P07
  // half still holds (desilt P07 max load 1.000). See docs/tuning.md ("Pass 4").
  it('3. upsizing P07 helps', () => {
    expect(upsize.m.peakSagDepth).toBeLessThan(base.m.peakSagDepth);
  });
  it('4. combined beats either alone', () => {
    expect(combined.m.peakSagDepth).toBeLessThan(desilt.m.peakSagDepth);
    expect(combined.m.peakSagDepth).toBeLessThan(upsize.m.peakSagDepth);
  });
  // Claim 5 (J08 under high tailwater) was removed again in the Task 8 retune: P07 still delivers at most 0.549 m³/s, which
  // OUT01's 2 m chamber passes below its crown at the 9.4 m stage, so P08 is never throttled and the J08 street stays dry
  // (≤ 1 mm) in the normal and high runs. See docs/tuning.md ("Pass 3").
  it('6. tank and lake overflow are not dead toggles', () => {
    expect(Math.abs(tank.m.peakSagDepth - base.m.peakSagDepth)).toBeGreaterThanOrEqual(0.03);
    expect(Math.abs(lake.m.peakSagDepth - base.m.peakSagDepth)).toBeGreaterThanOrEqual(0.03);
  });
  it('7. every run closes its water balance', () => {
    for (const r of [base, desilt, upsize, combined, highBase, tank, lake]) expect(r.m.balance.error).toBeLessThan(0.01);
  });
});
