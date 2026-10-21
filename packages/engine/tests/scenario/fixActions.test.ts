import { describe, expect, it } from 'vitest';
import { CUSTOM_PIPE_RM_PER_M_PER_M_DIA } from '../../src/scenario/index';
import { applyFix, fixCostRM, fixLabel, fixLocation, GRATE_AREA_M2, STANDARD_PIPE_SIZES_M, type FixAction } from '../../src/scenario/fixActions';
import { TAMAN_KYRA as S } from '../../src/scenario/site';

const snap = JSON.stringify(S);
const j07 = S.assets.nodes.find((n) => n.node_id === 'NODE-J07')!;
const down = S.assets.nodes.filter((n) => n.invert_elevation_m < j07.invert_elevation_m)[0];
const fixes: FixAction[] = [
  { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.75 },
  { kind: 'relief', fromNode: j07.node_id, toNode: down.node_id, diameterM: 0.6 },
  { kind: 'storage', nodeId: 'NODE-J05', volumeM3: 800 },
  { kind: 'inlet', nodeId: 'NODE-J07', grates: 1 },
];

describe('fix actions', () => {
  it('never mutate the input and give unique keys', () => {
    const keys = fixes.map((f) => applyFix(S, f).key);
    expect(JSON.stringify(S)).toBe(snap);
    expect(new Set([S.key, ...keys]).size).toBe(5);
  });
  it('upsize changes only that pipe', () => {
    const s = applyFix(S, fixes[0]);
    expect(s.assets.conduits.find((c) => c.conduit_id === 'PIPE-P07')!.diameter_m).toBe(0.75);
    expect(s.assets.nodes).toEqual(S.assets.nodes);
  });
  it('relief adds one pipe at plan distance, n 0.013; uphill throws', () => {
    const s = applyFix(S, fixes[1]);
    expect(s.assets.conduits.length).toBe(S.assets.conduits.length + 1);
    const p = s.assets.conduits.at(-1)!;
    expect(p.conduit_id).toBe(`RELIEF-${j07.node_id}-${down.node_id}`);
    expect(p.length_m).toBeCloseTo(Math.hypot(j07.position_m.x - down.position_m.x, j07.position_m.y - down.position_m.y), 9);
    expect(p.manning_n).toBe(0.013);
    expect(() => applyFix(S, { kind: 'relief', fromNode: down.node_id, toNode: j07.node_id, diameterM: 0.6 })).toThrow(/uphill/);
  });
  it('storage area = volume / max depth', () => {
    const n = S.assets.nodes.find((x) => x.node_id === 'NODE-J05')!;
    const s = applyFix(S, fixes[2]);
    expect(s.assets.nodes.find((x) => x.node_id === 'NODE-J05')!.storage_area_m2).toBeCloseTo(800 / n.max_depth_m, 9);
    expect(n.storage_area_m2).toBeUndefined();
  });
  it('extra inlet adds 0.6 m2 and scales capture by (n+1)/n', () => {
    const before = S.assets.inlets.find((i) => i.node_id === 'NODE-J07')!;
    const n = Math.max(1, Math.round(before.grate_area_m2 / GRATE_AREA_M2));
    const s = applyFix(S, fixes[3]);
    expect(s.assets.inlets.find((i) => i.node_id === 'NODE-J07')!.grate_area_m2).toBeCloseTo(before.grate_area_m2 + 0.6, 9);
    for (const c of s.subcatchments) expect(c.captureScale ?? 1).toBeCloseTo(c.outletNodeId === 'NODE-J07' ? (n + 1) / n : 1, 9);
  });
  it('creates an inlet where none exists', () => {
    const nd = S.assets.nodes.find((x) => !S.assets.inlets.some((i) => i.node_id === x.node_id) && x.node_type === 'junction')!;
    const s = applyFix(S, { kind: 'inlet', nodeId: nd.node_id, grates: 2 });
    expect(s.assets.inlets.find((i) => i.node_id === nd.node_id)!.grate_area_m2).toBeCloseTo(1.2, 9);
  });
  it('throws on invalid input', () => {
    expect(() => applyFix(S, { kind: 'upsize', pipeId: 'X', diameterM: 0.5 })).toThrow();
    expect(() => applyFix(S, { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0 })).toThrow();
    expect(() => applyFix(S, { kind: 'storage', nodeId: 'NOPE', volumeM3: 10 })).toThrow();
    expect(() => applyFix(S, { kind: 'storage', nodeId: 'NODE-J05', volumeM3: -1 })).toThrow();
    expect(() => applyFix(S, { kind: 'inlet', nodeId: 'NODE-J07', grates: 0 })).toThrow();
    expect(() => applyFix(S, { kind: 'relief', fromNode: 'A', toNode: 'B', diameterM: 0.5 })).toThrow();
  });
  it('labels, costs and locations', () => {
    expect(fixLabel(fixes[0], S)).toBe('Upsize PIPE-P07 to Ø750');
    expect(fixLabel(fixes[2], S)).toBe('800 m³ storage at NODE-J05');
    expect(fixLabel(fixes[3], S)).toBe('Extra inlet grate at NODE-J07');
    expect(fixLabel(fixes[1], S)).toBe(`Relief pipe ${j07.node_id} → ${down.node_id} (Ø600)`);
    const p7 = S.assets.conduits.find((c) => c.conduit_id === 'PIPE-P07')!;
    expect(fixCostRM(fixes[0], S)).toBeCloseTo(p7.length_m * 0.75 * CUSTOM_PIPE_RM_PER_M_PER_M_DIA, 6);
    expect(fixCostRM(fixes[2], S)).toBe(1_200_000);
    expect(fixCostRM(fixes[3], S)).toBe(8_000);
    expect(fixCostRM(fixes[1], S)).toBeCloseTo(applyFix(S, fixes[1]).assets.conduits.at(-1)!.length_m * 0.6 * 5000, 6);
    expect(fixLocation(fixes[3], S)).toEqual({ x: j07.position_m.x, y: j07.position_m.y });
    const a = S.assets.nodes.find((n) => n.node_id === p7.from_node_id)!.position_m;
    const b = S.assets.nodes.find((n) => n.node_id === p7.to_node_id)!.position_m;
    expect(fixLocation(fixes[0], S)).toEqual({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    expect(STANDARD_PIPE_SIZES_M.length).toBe(13);
  });
});
