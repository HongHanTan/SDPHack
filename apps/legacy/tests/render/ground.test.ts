import { describe, expect, it } from 'vitest';
import { GROUND, isBioswale, landColor } from '../../src/render/groundTexture';
import { NODE_CLEARANCE_M, placeTrees, TREE_COUNT, treeCellAllowed } from '../../src/render/trees';
import { buildTownship } from '@floodops/engine/scenario/index';
import { LandUse } from '@floodops/engine/sim/types';

describe('ground colours', () => {
  it('uses the spec day palette', () => {
    expect(landColor(LandUse.LAWN, 'day')).toBe('#dfe6d3');
    expect(landColor(LandUse.ROAD, 'day')).toBe('#f4f1ea');
    expect(landColor(LandUse.ROOF, 'day')).toBe('#fbfaf7');
    expect(landColor(LandUse.PARK, 'day')).toBe('#cfdcc0');
    expect(landColor(LandUse.POND, 'day')).toBe('#cfe0e0');
    expect(landColor(LandUse.RIVER, 'day')).toBe('#9fd0e0');
    expect(landColor(LandUse.PARK, 'day', true)).toBe('#c7d9b5');
    expect(GROUND.day.roadEdge).toBe('#e2ddd2');
  });
  it('uses the spec x-ray palette', () => {
    expect(landColor(LandUse.LAWN, 'xray')).toBe('#142033');
    expect(GROUND.xray.roadEdge).toBe('#2e4a6e');
    expect(GROUND.xray.lotEdge).toBe('#22344f');
  });
  it('has no bioswale cells', () => {
    const base = buildTownship([]).grid;
    const count = (g: typeof base) => Array.from(g.land).filter((_l, c) => isBioswale(g, c)).length;
    expect(count(base)).toBe(0);
  });
});

describe('trees vs bioswales', () => {
  it('never lands on or beside a bioswale cell', () => {
    const t = buildTownship([]);
    const { nx, dx } = t.grid;
    for (const s of placeTrees(t.grid, t.network.nodes)) {
      const c = Math.floor(s.y / dx) * nx + Math.floor(s.x / dx);
      expect(isBioswale(t.grid, c)).toBe(false);
    }
  });
});

describe('placeTrees', () => {
  const t = buildTownship([]);
  const a = placeTrees(t.grid, t.network.nodes);

  it('is deterministic and places trees up to TREE_COUNT', () => {
    expect(placeTrees(t.grid, t.network.nodes)).toEqual(a);
    expect(a.length).toBeGreaterThan(100);
    expect(a.length).toBeLessThanOrEqual(TREE_COUNT);
  });

  it('only uses allowed cells, away from drain nodes, scale 0.8–1.2', () => {
    const { nx, dx } = t.grid;
    for (const s of a) {
      const c = Math.floor(s.y / dx) * nx + Math.floor(s.x / dx);
      expect(treeCellAllowed(t.grid, c)).toBe(true);
      for (const n of t.network.nodes) expect(Math.hypot(n.x - s.x, n.y - s.y)).toBeGreaterThanOrEqual(NODE_CLEARANCE_M);
      expect(s.scale).toBeGreaterThanOrEqual(0.8);
      expect(s.scale).toBeLessThanOrEqual(1.2);
    }
  });
});
