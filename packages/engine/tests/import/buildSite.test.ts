import { describe, expect, it } from 'vitest';
import { buildSiteFromFiles, MAX_CELLS } from '../../src/import/buildSite';
import { buildScenario } from '../../src/scenario/index';

const inp = (extra = '', coordOffset = 0) => `[JUNCTIONS]
J1 10.0 2.0 0 0 0
J2 9.5 2.0 0 0 0
[OUTFALLS]
O1 9.0 FIXED 9.2 NO
[CONDUITS]
P1 J1 J2 50 0.013 0 0 0 0
P2 J2 O1 40 0.013 0 0 0 0
[XSECTIONS]
P1 CIRCULAR 0.45 0 0 0 1
P2 CIRCULAR 0.6 0 0 0 1
[SUBCATCHMENTS]
S1 G1 J1 0.5 70 100 1 0
[COORDINATES]
J1 ${500000 + coordOffset} 300100
J2 ${500050 + coordOffset} 300100
O1 ${500090 + coordOffset} 300100
${extra}`;
const files = (text: string) => ({ inp: { name: 'site.inp', text } });

describe('buildSiteFromFiles', () => {
  it('builds a runnable site with translation, defaults and a report', () => {
    const { site, report } = buildSiteFromFiles(files(inp()));
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(site!.builtIn).toBe(false);
    expect(site!.assets.nodes.map((n) => n.node_id)).toEqual(['J1', 'J2', 'O1']);
    expect(site!.gridSpec.dx).toBe(2);
    // Grid centre lands on the built-in centre (team x 45, y 5).
    expect(site!.datum.x0 + (site!.gridSpec.nx * site!.gridSpec.dx) / 2).toBeCloseTo(45, 6);
    expect(site!.datum.y0 + (site!.gridSpec.ny * site!.gridSpec.dx) / 2).toBeCloseTo(5, 6);
    // Distances are preserved.
    const [a, b] = site!.assets.nodes;
    expect(b.position_m.x - a.position_m.x).toBeCloseTo(50, 9);
    expect(site!.assets.inlets).toHaveLength(1);
    expect(site!.hotspotNodeId).toBe('J2');
    expect(site!.tailwater.high - site!.tailwater.normal).toBeCloseTo(1.2, 9);
    expect(report.assumptions.join(' ')).toMatch(/grate/);
    expect(report.assumptions.join(' ')).toMatch(/outfall sink/);
    const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site });
    expect(sc.network.outfalls).toHaveLength(1);
  });
  it('changes the site when the file changes', () => {
    const a = buildSiteFromFiles(files(inp())).site!;
    const b = buildSiteFromFiles(files(inp().replace('P2 CIRCULAR 0.6', 'P2 CIRCULAR 0.75'))).site!;
    expect(a.key).not.toBe(b.key);
    expect(b.assets.conduits.find((c) => c.conduit_id === 'P2')!.diameter_m).toBe(0.75);
  });
  it('errors on longitude/latitude coordinates, unknown references and no route to an outfall', () => {
    const lonLat = inp().replace('J1 500000 300100', 'J1 101.60 3.10').replace('J2 500050 300100', 'J2 101.61 3.10').replace('O1 500090 300100', 'O1 101.62 3.10');
    expect(buildSiteFromFiles(files(lonLat)).report.errors.join(' ')).toMatch(/projected metric/);
    expect(buildSiteFromFiles(files(inp().replace('P1 J1 J2', 'P1 J1 JX'))).report.errors.join(' ')).toMatch(/unknown node JX/);
    // J3 has coordinates but no pipe out of it.
    const island = inp('J3 500010 300050').replace('J2 9.5 2.0 0 0 0', 'J2 9.5 2.0 0 0 0\nJ3 9.0 2.0 0 0 0');
    expect(buildSiteFromFiles(files(island)).report.errors.join(' ')).toMatch(/J3 has no route to an outfall/);
  });
  it('warns on uphill pipes, length mismatches and unsupported sections', () => {
    const w = buildSiteFromFiles(files(inp('[WEIRS]\nW1 J2 O1 TRANSVERSE 0 3\n').replace('P1 J1 J2 50', 'P1 J1 J2 80').replace('J2 9.5', 'J2 10.5'))).report.warnings.join(' ');
    expect(w).toMatch(/uphill/);
    expect(w).toMatch(/length/);
    expect(w).toMatch(/WEIRS/);
  });
  it('coarsens big sites to stay within the cell budget', () => {
    const big = inp().replace('O1 500090 300100', 'O1 501000 301000');
    const { site, report } = buildSiteFromFiles(files(big));
    expect(site!.gridSpec.nx * site!.gridSpec.ny).toBeLessThanOrEqual(MAX_CELLS);
    expect(site!.gridSpec.dx).toBeGreaterThan(2);
    expect(report.warnings.join(' ')).toMatch(/coarsened/);
  });
  it('treats malformed numbers as errors', () => {
    const r = buildSiteFromFiles(files(inp().replace('P1 J1 J2 50', 'P1 J1 J2 abc')));
    expect(r.site).toBeUndefined();
    expect(r.report.errors.join(' ')).toMatch(/conduit P1 has an invalid length/);
  });
  it('errors, without crashing, when there are no junctions', () => {
    const text = `[OUTFALLS]
O1 9.0 FIXED 9.2 NO
[CONDUITS]
[XSECTIONS]
[COORDINATES]
O1 500000 300100
`;
    const r = buildSiteFromFiles(files(text));
    expect(r.report.errors.join(' ')).toMatch(/no junctions/);
  });
  it('ignores a hotspot that is not a junction, with a warning and a fallback', () => {
    const geo = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [500000, 300100] }, properties: { kind: 'hotspot', node_id: 'O1' } }] });
    const { site, report } = buildSiteFromFiles({ ...files(inp()), geojson: { name: 'l.geojson', text: geo } });
    expect(site!.hotspotNodeId).toBe('J2');
    expect(report.warnings.join(' ')).toMatch(/Hotspot O1/);
    expect(report.assumptions.join(' ')).toMatch(/Hotspot: J2/);
  });
  it('errors on longitude/latitude layout coordinates', () => {
    const geo = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [101.6, 3.1] }, properties: { kind: 'tree' } }] });
    const r = buildSiteFromFiles({ ...files(inp()), geojson: { name: 'l.geojson', text: geo } });
    expect(r.report.errors.join(' ')).toMatch(/Layout coordinates look like longitude/);
  });
});
