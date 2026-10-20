import { describe, expect, it } from 'vitest';
import { fitRect, polygonCentroidArea } from '../../src/import/geometry';

describe('geometry', () => {
  it('fits an axis-aligned rectangle', () => {
    const r = fitRect([[0, 0], [10, 0], [10, 4], [0, 4], [0, 0]]);
    expect(r.cx).toBeCloseTo(5);
    expect(r.cy).toBeCloseTo(2);
    expect(r.width).toBeCloseTo(10);
    expect(r.depth).toBeCloseTo(4);
    expect(r.rotationDeg).toBeCloseTo(0);
  });
  it('fits a rotated rectangle along its longest edge, or a given rotation', () => {
    const c = Math.SQRT1_2;
    const ring: Array<[number, number]> = [[0, 0], [10 * c, 10 * c], [10 * c - 4 * c, 10 * c + 4 * c], [-4 * c, 4 * c]];
    const r = fitRect(ring);
    expect(r.width).toBeCloseTo(10);
    expect(r.depth).toBeCloseTo(4);
    expect(r.rotationDeg).toBeCloseTo(45);
    expect(fitRect(ring, 135).width).toBeCloseTo(4);
  });
  it('computes centroid and area', () => {
    const { cx, cy, area } = polygonCentroidArea([[0, 0], [4, 0], [4, 2], [0, 2]]);
    expect([cx, cy, area]).toEqual([2, 1, 8]);
  });
});
