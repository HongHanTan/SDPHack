import { describe, expect, it } from 'vitest';
import { createSurface, stepSurface } from '../../src/sim/surface';
import { makeGrid, sum } from '../helpers';

describe('stepSurface', () => {
  it('keeps a lake at rest still', () => {
    const grid = makeGrid(10, 10, 4, () => 0, () => 1);
    const s = createSurface(grid);
    for (let k = 0; k < 100; k++) stepSurface(grid, s, 0.5);
    for (const h of s.h) expect(Math.abs(h - 1)).toBeLessThan(1e-9);
  });

  it('conserves volume', () => {
    const grid = makeGrid(20, 20, 4, (i, j) => 0.05 * i + 0.02 * j, (i, j) => (i === 10 && j === 10 ? 2 : 0));
    const s = createSurface(grid);
    const before = sum(s.h);
    for (let k = 0; k < 500; k++) stepSurface(grid, s, 0.5);
    expect(Math.abs(sum(s.h) - before) / before).toBeLessThan(1e-9);
  });

  it('moves water downhill', () => {
    const grid = makeGrid(11, 3, 4, (i) => 0.1 * i, (i, j) => (i === 5 && j === 1 ? 1 : 0));
    const s = createSurface(grid);
    for (let k = 0; k < 200; k++) stepSurface(grid, s, 0.5);
    let west = 0;
    let east = 0;
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 11; i++) {
        if (i < 5) west += s.h[j * 11 + i];
        if (i > 5) east += s.h[j * 11 + i];
      }
    }
    expect(west).toBeGreaterThan(east);
  });

  it('never produces negative depth', () => {
    const grid = makeGrid(15, 15, 4, (i, j) => Math.sin(i) + Math.cos(j), (i, j) => ((i + j) % 4 === 0 ? 0.5 : 0));
    const s = createSurface(grid);
    for (let k = 0; k < 300; k++) {
      stepSurface(grid, s, 0.5);
      for (const h of s.h) expect(h).toBeGreaterThanOrEqual(0);
    }
  });
});
