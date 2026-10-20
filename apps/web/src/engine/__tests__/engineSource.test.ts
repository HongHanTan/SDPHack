import { describe, expect, it } from 'vitest';
import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { TAMAN_KYRA } from '@floodops/engine/scenario/site';
import { DEBRIS_CASES, engineSource } from '../engineSource';

describe('engineSource (pure parts)', () => {
  it('bootstraps with the four storms, D07 blockage cases and tailwater cases', () => {
    const b = engineSource.getBootstrap();
    expect(b.storms.map((s) => s.storm_id)).toEqual(['synthetic_80mmh_60min', 'synthetic_120mmh_60min', '10yr', '100yr']);
    expect(b.debris_scenarios.map((d) => d.parameters.hydraulic_inlet_clogging_fraction)).toEqual([0, 0.2, 0.4, 0.6]);
    expect(b.tailwater_cases.map((t) => t.tailwater_case)).toEqual(['normal', 'high']);
    expect(engineSource.blockageForDebris(DEBRIS_CASES[2].id)).toEqual({ 'INLET-D07': 0.4 });
  });
  it('returns Tay assets plus intervention nodes in team coordinates', () => {
    engineSource.setInterventions([]);
    expect(engineSource.getTownshipAssets().nodes.length).toBe(9);
    engineSource.setInterventions(['storage-tank', 'lake-overflow']);
    const a = engineSource.getTownshipAssets();
    expect(a.nodes.map((n) => n.node_id)).toEqual(expect.arrayContaining(['TK', 'LK']));
    expect(a.conduits.map((c) => c.conduit_id)).toEqual(expect.arrayContaining(['PIPE-TK-IN', 'PIPE-TK-OUT', 'PIPE-LK']));
    const tk = a.nodes.find((n) => n.node_id === 'TK')!;
    expect(tk.position_m.x).toBeCloseTo(60, 6); // TANK.x in team datum
    engineSource.setInterventions([]);
  });
});

const SMALL_INP = `[JUNCTIONS]
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
J1 500000 300100
J2 500050 300100
O1 500090 300100
`;

describe('engineSource site switching', () => {
  it('serves the active site assets and blocks its focus inlet', () => {
    const site = buildSiteFromFiles({ inp: { name: 'small.inp', text: SMALL_INP } }).site!;
    engineSource.setSite(site);
    expect(engineSource.getSite()).toBe(site);
    expect(engineSource.getTownshipAssets().nodes.map((n) => n.node_id)).toEqual(['J1', 'J2', 'O1']);
    expect(engineSource.blockageForDebris('engine_d07_40pct')).toEqual({ 'INLET-J1': 0.4 });
    engineSource.setSite(null);
    expect(engineSource.getSite()).toBe(TAMAN_KYRA);
    expect(engineSource.blockageForDebris('engine_d07_40pct')).toEqual({ 'INLET-D07': 0.4 });
  });
});
