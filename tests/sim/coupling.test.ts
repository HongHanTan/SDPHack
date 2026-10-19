import { describe, expect, it } from 'vitest';
import { captureInlets, exchangeOutfalls, runPumps, spillOverflow, WEIR_C } from '../../src/sim/coupling';
import { createNetworkState } from '../../src/sim/pipes';
import { resetRiver, stageAt } from '../../src/sim/river';
import { createSurface } from '../../src/sim/surface';
import type { Network } from '../../src/sim/types';
import { makeGrid, makeNode } from '../helpers';

const grid = makeGrid(4, 1, 4, () => 0); // cells 0..3, area 16 m²
const AREA = 16;

function setup(extra: Partial<Network> = {}) {
  const net: Network = { nodes: [makeNode('A', 1, 1, 1.5, 2)], pipes: [], outfalls: [], pumps: [], ...extra };
  return { net, st: createNetworkState(net), surf: createSurface(grid) };
}

describe('river', () => {
  it('interpolates stage and clamps at the ends', () => {
    const r = { times: [0, 100], levels: [1, 3] };
    expect(stageAt(r, -5)).toBe(1);
    expect(stageAt(r, 50)).toBe(2);
    expect(stageAt(r, 500)).toBe(3);
  });

  it('forces river cells to stage and reports volumes', () => {
    const surf = createSurface(grid);
    surf.h[0] = 1;
    const r = resetRiver(grid, surf, Int32Array.from([0, 3]), 2);
    expect(surf.h[0]).toBe(2);
    expect(surf.h[3]).toBe(2);
    expect(r.added).toBeCloseTo(3 * AREA, 9);
    expect(r.removed).toBe(0);
  });
});

describe('captureInlets', () => {
  it('captures at the weir rate', () => {
    const { net, st, surf } = setup();
    surf.h[1] = 0.1;
    captureInlets(grid, surf, net, st, 1);
    const q = WEIR_C * 2 * Math.pow(0.1, 1.5);
    expect(st.vol[0]).toBeCloseTo(q, 9);
    expect(surf.h[1]).toBeCloseTo(0.1 - q / AREA, 9);
  });

  it('is limited by free storage', () => {
    const { net, st, surf } = setup();
    surf.h[1] = 1;
    st.vol[0] = st.vmax[0] - 0.01;
    captureInlets(grid, surf, net, st, 1);
    expect(st.vol[0]).toBeCloseTo(st.vmax[0], 9);
  });
});

describe('spillOverflow', () => {
  it('returns excess node volume to the surface', () => {
    const { net, st, surf } = setup();
    st.vol[0] = 3;
    const spilled = spillOverflow(grid, surf, net, st);
    expect(spilled).toBeCloseTo(1.5, 9);
    expect(st.vol[0]).toBeCloseTo(1.5, 9);
    expect(surf.h[1]).toBeCloseTo(1.5 / AREA, 9);
  });
});

describe('exchangeOutfalls', () => {
  const outfall = (flapGate: boolean) => ({ outfalls: [{ node: 'A', riverCell: 3, area: 0.28, flapGate }] });

  it('discharges to a low river', () => {
    const { net, st, surf } = setup(outfall(false));
    st.vol[0] = 1;
    const q = exchangeOutfalls(grid, surf, net, st, 0, 0.5);
    expect(q).toBeGreaterThan(0);
    expect(surf.h[3]).toBeCloseTo((q * 0.5) / AREA, 9);
  });

  it('backflows when the river is above the node head', () => {
    const { net, st, surf } = setup(outfall(false));
    surf.h[3] = 3;
    const q = exchangeOutfalls(grid, surf, net, st, 3, 0.5);
    expect(q).toBeLessThan(0);
    expect(st.vol[0]).toBeGreaterThan(0);
  });

  it('flap gate blocks backflow', () => {
    const { net, st, surf } = setup(outfall(true));
    surf.h[3] = 3;
    const q = exchangeOutfalls(grid, surf, net, st, 3, 0.5);
    expect(q).toBe(0);
    expect(st.vol[0]).toBe(0);
  });

  it('does nothing when node is empty and river is below invert', () => {
    const { net, st, surf } = setup(outfall(false));
    expect(exchangeOutfalls(grid, surf, net, st, 0, 0.5)).toBe(0);
  });
});

describe('runPumps', () => {
  it('pumps at most the rate and at most what is stored', () => {
    const { net, st, surf } = setup({ pumps: [{ node: 'A', rate: 1, riverCell: 3 }] });
    st.vol[0] = 0.2;
    runPumps(grid, surf, net, st, 0.5);
    expect(st.vol[0]).toBeCloseTo(0, 9);
    expect(surf.h[3]).toBeCloseTo(0.2 / AREA, 9);
    st.vol[0] = 1.5;
    runPumps(grid, surf, net, st, 0.5);
    expect(st.vol[0]).toBeCloseTo(1.0, 9);
  });
});
