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
  // Claim 2 (desilting D07 lowers J07) was removed in the Task 8 retune: with catchment loading the outlets J01/J02/J04/J07
  // deliver ~0.64 m³/s to J07 at steady state, above P07's 0.549 m³/s full-bore cap, so J07 is full and D07 captures
  // nothing at the peak. Desilt dSag was 0.000 at every tried CATCHMENT.lagS (60-1200 s), DIP and FUNNEL. The P07 half
  // still holds (desilt P07 max load 1.000). See docs/tuning.md ("Pass 3").
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
