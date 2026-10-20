import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSiteFromFiles } from '../src/import/buildSite';
import { buildScenario } from '../src/scenario/index';
import { TAMAN_KYRA } from '../src/scenario/site';
import { runSimulation } from '../src/sim/engine';

const dir = resolve(__dirname, '../../../data/samples/taman_kyra_site');
const read = (name: string) => ({ name, text: readFileSync(resolve(dir, name), 'utf8') });

describe('importing the sample package gives the built-in township back', () => {
  const { site, report } = buildSiteFromFiles({ inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') });
  it('imports without errors and lands on the built-in grid', () => {
    expect(report.errors).toEqual([]);
    expect(site!.gridSpec).toEqual(TAMAN_KYRA.gridSpec);
    expect(site!.datum.x0).toBeCloseTo(TAMAN_KYRA.datum.x0, 6);
    expect(site!.datum.y0).toBeCloseTo(TAMAN_KYRA.datum.y0, 6);
    expect(site!.shift.dz).toBe(0);
    expect(site!.hotspotNodeId).toBe('NODE-J07');
    expect(site!.focusInletId).toBe('INLET-D07');
    expect(site!.tailwater).toEqual(TAMAN_KYRA.tailwater);
  });
  it('builds the same terrain and network', () => {
    const a = buildScenario([], 'synthetic_80mmh_60min');
    const b = buildScenario([], 'synthetic_80mmh_60min', [], { site, blockage: { 'INLET-D07': 0.4 } });
    let maxDz = 0;
    let landDiff = 0;
    for (let c = 0; c < a.grid.z.length; c++) {
      maxDz = Math.max(maxDz, Math.abs(a.grid.z[c] - b.grid.z[c]));
      if (a.grid.land[c] !== b.grid.land[c]) landDiff++;
    }
    expect(maxDz).toBeLessThanOrEqual(0.001);
    expect(landDiff / a.grid.z.length).toBeLessThanOrEqual(0.005);
    expect(b.network.nodes.map((n) => [n.id, n.cell, n.invert])).toEqual(a.network.nodes.map((n) => [n.id, n.cell, n.invert]));
    expect(b.network.pipes.map((p) => [p.id, p.diameter])).toEqual(a.network.pipes.map((p) => [p.id, p.diameter]));
    expect(b.sagCell).toBe(a.sagCell);
  });
  it('floods the same way on the 80 mm/h storm', () => {
    const a = runSimulation(buildScenario([], 'synthetic_80mmh_60min')).metrics;
    const b = runSimulation(buildScenario([], 'synthetic_80mmh_60min', [], { site, blockage: { 'INLET-D07': 0.4 } })).metrics;
    expect(Math.abs(b.peakSagDepth - a.peakSagDepth) / a.peakSagDepth).toBeLessThanOrEqual(0.02);
    expect(b.homesFlooded).toBe(a.homesFlooded);
  }, 300_000);
});
