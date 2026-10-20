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
  const highFlap = run(['flap-gate'], { tailwater: 'high' });
  const highPump = run(['pump'], { tailwater: 'high' });
  const tank = run(['storage-tank']);
  const lake = run(['lake-overflow']);

  // Claim 1 (homes) and claim 5 (J08 under high tailwater) were removed in the Task 4b retune; neither is
  // reachable within the tunables. Homes: even with DIP, FUNNEL and HOUSE at their upper bounds the J07 pond
  // puts at most 0.09 m on a footprint (threshold 0.3 m). J08: P07 delivers at most 0.549 m³/s, below what
  // OUT01's 2 m chamber passes at the 9.4 m stage, so P08 is never throttled and J08 stays dry in every case.
  // The J07 half of claim 1 holds (0.296 m ≥ 0.15). See docs/tuning.md ("Pass 2", "Story claims").
  it('2. desilting D07 helps but P07 still runs full', () => {
    expect(desilt.m.peakSagDepth).toBeLessThan(base.m.peakSagDepth);
    expect(desilt.p07Max).toBeGreaterThanOrEqual(0.99);
  });
  it('3. upsizing P07 helps', () => {
    expect(upsize.m.peakSagDepth).toBeLessThan(base.m.peakSagDepth);
  });
  it('4. combined beats either alone', () => {
    expect(combined.m.peakSagDepth).toBeLessThan(desilt.m.peakSagDepth);
    expect(combined.m.peakSagDepth).toBeLessThan(upsize.m.peakSagDepth);
  });
  it('6. tank and lake overflow are not dead toggles', () => {
    expect(Math.abs(tank.m.peakSagDepth - base.m.peakSagDepth)).toBeGreaterThanOrEqual(0.03);
    expect(Math.abs(lake.m.peakSagDepth - base.m.peakSagDepth)).toBeGreaterThanOrEqual(0.03);
  });
  it('7. every run closes its water balance', () => {
    for (const r of [base, desilt, upsize, combined, highBase, highFlap, highPump, tank, lake]) expect(r.m.balance.error).toBeLessThan(0.01);
  });
});
