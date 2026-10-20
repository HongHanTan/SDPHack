import { describe, expect, it } from 'vitest';
import { advanceSurface, createSurface, G, maxStableDt, stepSurface, surfaceSubsteps } from '../../src/sim/surface';
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

describe('advanceSurface (stability guard)', () => {
  const nx = 40;
  const ny = 20;
  const damBreak = () => makeGrid(nx, ny, 4, () => 0, (i) => (i < 20 ? 1.5 : 0));
  /** Largest neighbour depth difference after the first minute (the dam-break front has spread by then). */
  function worstJump(step: (g: ReturnType<typeof damBreak>, s: ReturnType<typeof createSurface>) => void, dt: number) {
    const grid = damBreak();
    const s = createSurface(grid);
    const before = sum(s.h);
    let worst = 0;
    for (let k = 0; k < Math.round(300 / dt); k++) {
      step(grid, s);
      if (k * dt < 60) continue;
      for (let j = 0; j < ny; j++) {
        for (let i = 0; i < nx; i++) {
          const c = j * nx + i;
          if (i < nx - 1) worst = Math.max(worst, Math.abs(s.h[c] - s.h[c + 1]));
          if (j < ny - 1) worst = Math.max(worst, Math.abs(s.h[c] - s.h[c + nx]));
        }
      }
    }
    return { worst, volErr: Math.abs(sum(s.h) - before) / before };
  }

  it('bounds the sub-step below the analytic limit sqrt(dx / 4g)', () => {
    expect(maxStableDt(4)).toBeLessThan(Math.sqrt(4 / (4 * G)));
    expect(surfaceSubsteps(4, 0.5)).toBe(2);
    expect(surfaceSubsteps(4, 0.1)).toBe(1);
  });

  it('a raw 0.5 s step (the coupling dt) checkerboards (the guard is needed)', () => {
    expect(worstJump((g, s) => stepSurface(g, s, 0.5), 0.5).worst).toBeGreaterThan(1);
  });

  it('flat dam-break at the 0.5 s coupling step stays smooth and conserves volume', () => {
    const { worst, volErr } = worstJump((g, s) => advanceSurface(g, s, 0.5), 0.5);
    expect(worst).toBeLessThan(0.3); // smooth waves only; the unguarded run jumps by > 1 m
    expect(volErr).toBeLessThan(1e-9);
  });

  it('is deterministic', () => {
    const run = () => {
      const grid = damBreak();
      const s = createSurface(grid);
      for (let k = 0; k < 100; k++) advanceSurface(grid, s, 0.5);
      return Array.from(s.h);
    };
    expect(run()).toEqual(run());
  });
});
