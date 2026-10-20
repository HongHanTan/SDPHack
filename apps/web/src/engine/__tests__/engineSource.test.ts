import { describe, expect, it } from 'vitest';
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
