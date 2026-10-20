import { describe, expect, it } from 'vitest';
import { advancePhase, arrowSpeed, arrowsVisible } from '../../src/render/flowMath';
import { FpsGuard } from '../../src/render/fpsGuard';
import { smoothDepth } from '@floodops/engine/client/smoothDepth';
import { blendTheme, DAY, lerpHex, XRAY } from '../../src/render/theme';

describe('theme', () => {
  it('blends between day and x-ray', () => {
    expect(blendTheme(0)).toEqual(DAY);
    expect(blendTheme(1)).toEqual(XRAY);
    expect(blendTheme(-1)).toEqual(DAY);
    expect(blendTheme(2)).toEqual(XRAY);
    expect(blendTheme(0.5).terrainOpacity).toBeCloseTo((DAY.terrainOpacity + XRAY.terrainOpacity) / 2, 12);
  });
  it('interpolates hex colours per channel', () => {
    expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpHex('#102030', '#102030', 0.3)).toBe('#102030');
  });
});

describe('FpsGuard', () => {
  it('never fires at a steady 60 fps', () => {
    const g = new FpsGuard();
    for (let k = 0; k < 600; k++) expect(g.tick(1 / 60)).toBe(false);
  });
  it('fires once after a full 3 s window below 30 fps', () => {
    const g = new FpsGuard();
    const fired: boolean[] = [];
    for (let k = 0; k < 120; k++) fired.push(g.tick(1 / 20));
    expect(fired.filter(Boolean).length).toBe(1);
    expect(fired.indexOf(true)).toBe(59);
  });
  it('restarts its window after a long gap (hidden tab)', () => {
    const g = new FpsGuard();
    for (let k = 0; k < 40; k++) g.tick(1 / 20);
    expect(g.tick(5)).toBe(false);
    const fired: boolean[] = [];
    for (let k = 0; k < 60; k++) fired.push(g.tick(1 / 20));
    expect(fired.indexOf(true)).toBe(59);
  });
});

describe('flow maths', () => {
  it('maps load to arrow speed', () => {
    expect(arrowSpeed(0)).toBeCloseTo(0.2, 12);
    expect(arrowSpeed(1)).toBeCloseTo(2.0, 12);
    expect(arrowSpeed(5)).toBeCloseTo(2.0, 12);
    expect(arrowSpeed(0.5)).toBeGreaterThan(arrowSpeed(0.25));
    expect(arrowSpeed(Number.NaN)).toBeCloseTo(0.2, 12);
  });
  it('hides arrows below 2% load', () => {
    expect(arrowsVisible(0.019)).toBe(false);
    expect(arrowsVisible(0.02)).toBe(true);
  });
  it('advances and wraps the phase', () => {
    expect(advancePhase(0, 0.5, 1)).toBeCloseTo(0, 12);
    expect(advancePhase(0.9, 0.1, 0)).toBeCloseTo(0.92, 12);
    expect(advancePhase(0.3, -1, 1)).toBeCloseTo(0.3, 12);
    // scale = ribbon length / chevron spacing: a 120 m pipe at load 0 (0.2 ribbons/s) moves 2 chevrons/s.
    expect(advancePhase(0, 0.25, 0, 10)).toBeCloseTo(0.5, 12);
    expect(advancePhase(0.9, 0.1, 0, 10)).toBeCloseTo(0.1, 12);
  });
});

describe('smoothDepth', () => {
  it('leaves a uniform wet field unchanged and keeps dry cells dry', () => {
    const nx = 4;
    const ny = 3;
    const d = new Float32Array(nx * ny).fill(0.5);
    d[0] = 0;
    const out = smoothDepth(d, nx, ny, new Float32Array(nx * ny));
    expect(out[0]).toBe(0);
    expect(out[5]).toBeCloseTo(0.5, 6);
  });
  it('averages wet neighbours', () => {
    const nx = 3;
    const ny = 3;
    const d = new Float32Array([1, 0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1]);
    const out = smoothDepth(d, nx, ny, new Float32Array(9));
    expect(out[4]).toBeCloseTo(7 / 9, 6);
  });
});
