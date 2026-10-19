import { describe, expect, it } from 'vitest';
import { createEngine, runSimulation, stepEngine } from '../../src/sim/engine';
import { SimError } from '../../src/sim/types';
import { makeScenario } from '../helpers';

describe('runSimulation', () => {
  it('closes the water balance within 1%', () => {
    const { metrics } = runSimulation(makeScenario());
    expect(metrics.balance.rain).toBeGreaterThan(0);
    expect(metrics.balance.error).toBeLessThan(0.01);
  });

  it('emits a frame every 30 s plus metrics', () => {
    const frames: number[] = [];
    const { metrics } = runSimulation(makeScenario(), (f) => frames.push(f.t));
    expect(frames.length).toBe(30); // (600 s storm + 300 s recession) / 30 s
    expect(frames[0]).toBe(30);
    expect(metrics.sagSeries.t.length).toBe(30);
    expect(metrics.sagSeries.t[0]).toBe(0.5); // minutes
  });

  it('is deterministic', () => {
    const a = runSimulation(makeScenario()).metrics;
    const b = runSimulation(makeScenario()).metrics;
    expect(Array.from(a.peakDepth)).toEqual(Array.from(b.peakDepth));
    expect(a.sagSeries.depth).toEqual(b.sagSeries.depth);
  });

  it('a bigger pipe never raises peak depth at its upstream node', () => {
    const small = makeScenario({ diameter: 0.1, rainMmHr: 300 });
    const big = makeScenario({ diameter: 0.6, rainMmHr: 300 });
    const cell = small.network.nodes[0].cell;
    const pSmall = runSimulation(small).metrics.peakDepth[cell];
    const pBig = runSimulation(big).metrics.peakDepth[cell];
    expect(pBig).toBeLessThanOrEqual(pSmall + 1e-9);
  });
});

describe('stepEngine', () => {
  function minOutfallFlow(flapGate: boolean): number {
    const sc = makeScenario({ flapGate, riverLevels: [3, 3] });
    const st = createEngine(sc);
    let min = Infinity;
    for (let k = 0; k < 200; k++) min = Math.min(min, stepEngine(sc, st));
    return min;
  }

  it('river above the outfall causes backflow without a flap gate', () => {
    expect(minOutfallFlow(false)).toBeLessThan(0);
  });

  it('flap gate allows zero reverse flow', () => {
    expect(minOutfallFlow(true)).toBeGreaterThanOrEqual(0);
  });

  it('halts with SimError on invalid state', () => {
    const sc = makeScenario();
    const st = createEngine(sc);
    st.surf.h[205] = Number.NaN;
    expect(() => stepEngine(sc, st)).toThrow(SimError);
  });
});
