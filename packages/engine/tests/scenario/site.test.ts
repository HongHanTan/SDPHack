import { describe, expect, it } from 'vitest';
import { baseTownship, buildScenario, hotspotCell, scenarioKey } from '../../src/scenario/index';
import { cellIn, medianJunctionGround, siteToLocal, siteToTeam, TAMAN_KYRA, type SiteSpec } from '../../src/scenario/site';
import { GRID } from '../../src/scenario/config';
import { ASSETS } from '../../src/scenario/layout';

describe('site abstraction', () => {
  it('describes the built-in township', () => {
    expect(TAMAN_KYRA.builtIn).toBe(true);
    expect(TAMAN_KYRA.gridSpec).toEqual(GRID);
    expect(TAMAN_KYRA.hotspotNodeId).toBe('NODE-J07');
    expect(TAMAN_KYRA.focusInletId).toBe('INLET-D07');
    expect(TAMAN_KYRA.tailwater).toEqual({ normal: 8.2, high: 9.4 });
    expect(TAMAN_KYRA.ponds).toHaveLength(1);
    expect(TAMAN_KYRA.rivers[0]).toMatchObject({ cx: 40, cy: -90, length: 75, angleDeg: 90 });
    expect(medianJunctionGround(ASSETS)).toBeCloseTo(11.65, 6);
  });
  it('converts coordinates and cells with the site datum and grid', () => {
    expect(siteToLocal(TAMAN_KYRA, 40, 0)).toEqual({ x: 120, y: 140 });
    expect(siteToTeam(TAMAN_KYRA, 120, 140)).toEqual({ x: 40, y: 0 });
    expect(cellIn(GRID, 1, 1)).toBe(0);
    expect(cellIn(GRID, 1e9, 1e9)).toBe(GRID.nx * GRID.ny - 1);
  });
  it('defaults every builder to the built-in site', () => {
    expect(baseTownship(undefined, TAMAN_KYRA)).toBe(baseTownship());
    expect(hotspotCell(TAMAN_KYRA)).toBe(hotspotCell());
    expect(scenarioKey([], 'synthetic_80mmh_60min').startsWith('taman-kyra|')).toBe(true);
  });
  it('refuses interventions on an imported site', () => {
    const imported: SiteSpec = { ...TAMAN_KYRA, key: 'import-test', builtIn: false };
    expect(() => buildScenario(['upsize-p07'], 'synthetic_80mmh_60min', [], { site: imported })).toThrow(/built-in township/);
    expect(buildScenario([], 'synthetic_80mmh_60min', [], { site: imported }).grid.nx).toBe(GRID.nx);
    expect(scenarioKey([], 'synthetic_80mmh_60min', [], { site: imported })).not.toBe(
      scenarioKey([], 'synthetic_80mmh_60min', [], { site: imported, blockage: { 'INLET-D07': 0.4 } }),
    );
  });
});
