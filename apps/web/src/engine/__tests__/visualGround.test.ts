import { describe, expect, it } from 'vitest';
import { DIP, FUNNEL } from '@floodops/engine/scenario/config';
import { bowlDrop, LAWN_Z, lawnHeight, roadSurfaceAt, visualGround } from '../visualGround';

describe('visualGround', () => {
  it('uses road surface heights from the layout and the lawn elsewhere', () => {
    expect(roadSurfaceAt(45, 120)).toBe(12.15); // north street
    expect(roadSurfaceAt(-70, -130)).toBeNull();
    expect(visualGround(-70, -130)).toBeCloseTo(LAWN_Z - bowlDrop(-70, -130), 9);
  });
  it('dips at J07 by DIP + FUNNEL', () => {
    expect(bowlDrop(40, 0)).toBeCloseTo(DIP.depth + FUNNEL.depth, 9);
    expect(visualGround(40, 0)).toBeCloseTo(Math.max(roadSurfaceAt(40, 0)!, LAWN_Z) - DIP.depth - FUNNEL.depth, 9);
  });
  it('dips at a grate funnel (D01 at J01)', () => {
    expect(bowlDrop(0, 120)).toBeCloseTo(FUNNEL.depth, 9);
    expect(lawnHeight(0, 120)).toBeCloseTo(LAWN_Z - FUNNEL.depth, 9);
  });
});
