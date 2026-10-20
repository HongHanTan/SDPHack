import { describe, expect, it } from 'vitest';
import { balanceError, createEngine, patchEngine, stepEngine, totalStorage } from '../../src/sim/engine';
import { makeScenario } from '../helpers';

const AREA = 16; // 4 m cells

describe('patchEngine', () => {
  it('keeps surface depths and carries node volumes over by id', () => {
    const sc = makeScenario();
    const st = createEngine(sc);
    for (let k = 0; k < 300; k++) stepEngine(sc, st);
    const h = Array.from(st.surf.h);
    const vol = Array.from(st.net.vol);
    const next = makeScenario({ diameter: 0.6 });
    patchEngine(sc, st, next);
    expect(Array.from(st.surf.h)).toEqual(h);
    expect(Array.from(st.net.vol)).toEqual(vol);
    expect(st.net.qFull[0]).toBeGreaterThan(0);
  });

  it('spills the water of nodes that no longer exist onto their cell', () => {
    const sc = makeScenario();
    const cellC = 15 * 20 + 3;
    sc.network.nodes.push({ id: 'C', x: 0, y: 0, cell: cellC, invert: 1, area: 1, maxDepth: 2, inletPerimeter: 0 });
    const st = createEngine(sc);
    st.net.vol[2] = 1.5;
    const before = totalStorage(sc, st);
    const hC = st.surf.h[cellC];
    const next = makeScenario();
    patchEngine(sc, st, next);
    expect(st.net.vol.length).toBe(2);
    expect(st.surf.h[cellC]).toBeCloseTo(hC + 1.5 / AREA, 12);
    expect(totalStorage(next, st)).toBeCloseTo(before, 9);
  });

  it('spills volume above a smaller new capacity', () => {
    const sc = makeScenario();
    const st = createEngine(sc);
    st.net.vol[1] = 1.2;
    const next = makeScenario();
    next.network.nodes[1].maxDepth = 0.5; // vmax 0.5 m³
    const cellB = next.network.nodes[1].cell;
    const hB = st.surf.h[cellB];
    patchEngine(sc, st, next);
    expect(st.net.vol[1]).toBeCloseTo(0.5, 12);
    expect(st.surf.h[cellB]).toBeCloseTo(hB + 0.7 / AREA, 12);
  });

  function patchedRun(): { error: number; h: number[] } {
    const sc = makeScenario({ rainMmHr: 200 });
    const st = createEngine(sc);
    for (let k = 0; k < 600; k++) stepEngine(sc, st);
    const next = makeScenario({ rainMmHr: 200, diameter: 0.6, flapGate: true });
    patchEngine(sc, st, next);
    for (let k = 0; k < 1200; k++) stepEngine(next, st);
    return { error: balanceError(next, st).error, h: Array.from(st.surf.h) };
  }

  it('keeps the water balance within 1% across a mid-storm patch', () => {
    expect(patchedRun().error).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    expect(patchedRun().h).toEqual(patchedRun().h);
  });
});
