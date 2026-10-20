import { describe, expect, it } from 'vitest';
import { balanceError, createEngine, patchEngine, runSimulation, stepEngine } from '../../src/sim/engine';
import type { Scenario } from '../../src/sim/types';
import { makeScenario } from '../helpers';

function withCatchment(sc: Scenario, lagS = 60): Scenario {
  const cells: number[] = [];
  for (let j = 14; j <= 17; j++) for (let i = 4; i <= 16; i++) cells.push(j * sc.grid.nx + i);
  return { ...sc, catchments: [{ id: 'C1', node: 'A', cells: Int32Array.from(cells), directFraction: 0.8, lagS }] };
}

const peakLoad = (sc: Scenario) => Math.max(...runSimulation(sc).frames.map((f) => f.pipeLoad[0]));

describe('catchment loading', () => {
  it('closes the water balance', () => {
    expect(runSimulation(withCatchment(makeScenario({ rainMmHr: 150 }))).metrics.balance.error).toBeLessThan(0.01);
  });
  it('delivers runoff into the outlet node', () => {
    expect(peakLoad(withCatchment(makeScenario({ rainMmHr: 150 })))).toBeGreaterThan(peakLoad(makeScenario({ rainMmHr: 150 })));
  });
  it('is deterministic', () => {
    const a = runSimulation(withCatchment(makeScenario())).metrics.peakDepth;
    const b = runSimulation(withCatchment(makeScenario())).metrics.peakDepth;
    expect(Array.from(a)).toEqual(Array.from(b));
  });
  it('keeps catchment stores across a mid-run patch', () => {
    const sc = withCatchment(makeScenario({ rainMmHr: 150 }), 600);
    const st = createEngine(sc);
    for (let k = 0; k < 400; k++) stepEngine(sc, st);
    const before = st.catchStore[0];
    expect(before).toBeGreaterThan(0);
    const next = withCatchment(makeScenario({ rainMmHr: 150, diameter: 0.6 }), 600);
    patchEngine(sc, st, next);
    expect(st.catchStore[0]).toBe(before);
    for (let k = 0; k < 400; k++) stepEngine(next, st);
    expect(balanceError(next, st).error).toBeLessThan(0.01);
  });
});
