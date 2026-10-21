import { describe, expect, it } from 'vitest';
import {
  bestFixPerProblem,
  diagnose,
  generateCandidates,
  logLines,
  NO_IMPROVING_FIX_TEXT,
  rankResults,
  type CandidateResult,
  type TeamFrameLike,
  type TeamMetricsLike,
} from '../../src/analysis/fixFinder';
import { fixId, type FixAction } from '../../src/scenario/fixActions';
import { TAMAN_KYRA as S } from '../../src/scenario/site';

const PIPES = S.assets.conduits.map((c) => c.conduit_id);
const NODES = S.assets.nodes.map((n) => n.node_id);

/** 30 one-minute frames; `load(pipe, i)` and `flood(node, i)` shape them. */
function frames(load: (pipe: string, i: number) => number, flood: (node: string, i: number) => boolean, n = 30): TeamFrameLike[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp_s: i * 60,
    pipe_states: PIPES.map((p) => ({ conduit_id: p, capacity_fraction: load(p, i), status: load(p, i) >= 0.999 ? 'surcharged' : 'normal' })),
    node_states: NODES.map((id) => ({ node_id: id, status: flood(id, i) ? 'flooding' : 'normal', depth_m: flood(id, i) ? 2.1 : 0.5 + i * 0.01 })),
  }));
}
const metrics: TeamMetricsLike = { j07_peak_depth_m: 0.42, homes_flooded: 5, total_flooding_volume_m3: 640 };

// P07 full from minute 10 to 21 (12 frames); P05 full from minute 18 to 20 (3 frames); J07 floods from minute 14.
const stormFrames = frames(
  (p, i) => (p === 'PIPE-P07' ? (i >= 10 && i <= 21 ? 1 : 0.7) : p === 'PIPE-P05' ? (i >= 18 && i <= 20 ? 1.0 : 0.95) : 0.4),
  (n, i) => n === 'NODE-J07' && i >= 14 && i <= 22,
);

describe('diagnose', () => {
  const d = diagnose(stormFrames, metrics, S);

  it('finds the bottlenecks with surcharge minutes, sorted by minutes', () => {
    expect(d.bottlenecks.map((b) => b.pipeId)).toEqual(['PIPE-P07', 'PIPE-P05']);
    expect(d.bottlenecks[0].surchargedMin).toBe(12);
    expect(d.bottlenecks[0].peakLoad).toBe(1);
    expect(d.bottlenecks[1].surchargedMin).toBe(3);
    expect(d.pipes.find((p) => p.pipeId === 'PIPE-P03')!.peakLoad).toBe(0.4);
  });

  it('records node flooding, peaks and totals', () => {
    const j07 = d.nodes.find((n) => n.nodeId === 'NODE-J07')!;
    expect(j07.floods).toBe(true);
    expect(j07.floodingFrames).toBe(9);
    expect(j07.peakDepthM).toBe(2.1);
    expect(d.nodes.find((n) => n.nodeId === 'NODE-J01')!.floods).toBe(false);
    expect(d).toMatchObject({ hotspotNodeId: 'NODE-J07', hotspotPeakM: 0.42, homesFlooded: 5, floodVolumeM3: 640, worstFloodingNodeId: 'NODE-J07' });
  });

  it('lists problems with onset and location, ordered by onset', () => {
    expect(d.problems).toEqual([
      { id: 'bottleneck:PIPE-P07', kind: 'bottleneck', assetId: 'PIPE-P07', onsetS: 600, location: { x: 40, y: -25 } },
      { id: 'ponding:NODE-J07', kind: 'ponding', assetId: 'NODE-J07', onsetS: 840, location: { x: 40, y: 0 } },
      { id: 'bottleneck:PIPE-P05', kind: 'bottleneck', assetId: 'PIPE-P05', onsetS: 1080, location: { x: 60, y: 20 } },
    ]);
  });

  it('takes the ponding onset from the hotspot street depth series when it is earlier', () => {
    const depth = stormFrames.map((_, i) => (i >= 12 ? 0.15 + i * 0.001 : 0.05));
    const p = diagnose(stormFrames, metrics, S, { hotspotStreetDepthM: depth }).problems.find((x) => x.kind === 'ponding')!;
    expect(p.onsetS).toBe(720);
  });

  it('a street depth ≥ 0.15 m at the hotspot is a ponding problem even without a flooding node', () => {
    const f = frames(() => 0.5, () => false);
    const d2 = diagnose(f, metrics, S, { hotspotStreetDepthM: f.map((_, i) => (i >= 20 ? 0.2 : 0)) });
    expect(d2.problems).toEqual([{ id: 'ponding:NODE-J07', kind: 'ponding', assetId: 'NODE-J07', onsetS: 1200, location: { x: 40, y: 0 } }]);
  });

  it('keeps at most 3 problems', () => {
    const f = frames((p) => (['PIPE-P07', 'PIPE-P05', 'PIPE-P03'].includes(p) ? 1 : 0.5), (n) => n === 'NODE-J07' || n === 'NODE-J05');
    expect(diagnose(f, metrics, S).problems).toHaveLength(3);
  });
});

describe('generateCandidates', () => {
  const p07Only = frames((p, i) => (p === 'PIPE-P07' && i >= 10 ? 1 : 0.6), (n, i) => n === 'NODE-J07' && i >= 15);
  const d = diagnose(p07Only, metrics, S);
  const c = generateCandidates(d, S);

  it('produces the standard fixes for the sample topology, in order', () => {
    const expected: FixAction[] = [
      { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.675 },
      { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.75 },
      { kind: 'relief', fromNode: 'NODE-J07', toNode: 'NODE-OUT01', diameterM: 0.6 },
      { kind: 'storage', nodeId: 'NODE-J05', volumeM3: 800 },
      { kind: 'inlet', nodeId: 'NODE-J07', grates: 1 },
    ];
    expect(c.map((x) => x.fix)).toEqual(expected);
  });

  it('ties each fix to a problem', () => {
    expect(c.map((x) => x.problemId)).toEqual([
      'bottleneck:PIPE-P07', 'bottleneck:PIPE-P07', 'bottleneck:PIPE-P07', 'bottleneck:PIPE-P07', 'ponding:NODE-J07',
    ]);
    for (const x of c) expect(d.problems.map((p) => p.id)).toContain(x.problemId);
  });

  it('storage is at least 200 m³', () => {
    const small = generateCandidates(diagnose(p07Only, { ...metrics, total_flooding_volume_m3: 10 }, S), S);
    expect(small.find((x) => x.fix.kind === 'storage')!.fix).toEqual({ kind: 'storage', nodeId: 'NODE-J05', volumeM3: 200 });
  });

  it('keeps at most 6 and has no duplicates', () => {
    const big = generateCandidates(diagnose(stormFrames, metrics, S), S);
    expect(big.length).toBeLessThanOrEqual(6);
    expect(new Set(big.map((x) => fixId(x.fix))).size).toBe(big.length);
    expect(big.slice(0, 4).map((x) => x.fix)).toEqual([
      { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.675 },
      { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.75 },
      { kind: 'upsize', pipeId: 'PIPE-P05', diameterM: 0.675 },
      { kind: 'upsize', pipeId: 'PIPE-P05', diameterM: 0.75 },
    ]);
    expect(big[4].problemId).toBe('bottleneck:PIPE-P07');
  });

  it('drops duplicates when two bottlenecks would give the same fix', () => {
    // P05 and P07 both full: relief from J07 and storage upstream are generated once.
    const big = generateCandidates(diagnose(stormFrames, metrics, S), S);
    expect(big.filter((x) => x.fix.kind === 'relief')).toHaveLength(1);
  });

  it('no flooding and no bottleneck gives no candidates', () => {
    const calm = diagnose(frames(() => 0.5, () => false), { j07_peak_depth_m: 0, homes_flooded: 0, total_flooding_volume_m3: 0 }, S);
    expect(calm.problems).toEqual([]);
    expect(generateCandidates(calm, S)).toEqual([]);
  });

  it('ponding without a bottleneck gives a relief from the hotspot and an inlet', () => {
    const pond = diagnose(frames(() => 0.6, (n, i) => n === 'NODE-J07' && i > 5), metrics, S);
    expect(generateCandidates(pond, S)).toEqual([
      { fix: { kind: 'relief', fromNode: 'NODE-J07', toNode: 'NODE-OUT01', diameterM: 0.6 }, problemId: 'ponding:NODE-J07' },
      { fix: { kind: 'inlet', nodeId: 'NODE-J07', grates: 1 }, problemId: 'ponding:NODE-J07' },
    ]);
  });
});

const baseline = { homesFlooded: 5, floodVolumeM3: 640, hotspotPeakM: 0.42 };
const r = (fix: FixAction, problemId: string, homesFlooded: number, floodVolumeM3: number, hotspotPeakM: number, costRM: number): CandidateResult => ({
  fix, problemId, label: fixId(fix), costRM, outcome: { homesFlooded, floodVolumeM3, hotspotPeakM },
});
const up675 = r({ kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.675 }, 'bottleneck:PIPE-P07', 3, 300, 0.3, 20_000);
const up750 = r({ kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.75 }, 'bottleneck:PIPE-P07', 3, 300, 0.3, 18_000);
const relief = r({ kind: 'relief', fromNode: 'NODE-J07', toNode: 'NODE-OUT01', diameterM: 0.6 }, 'bottleneck:PIPE-P07', 1, 500, 0.35, 30_000);
const storage = r({ kind: 'storage', nodeId: 'NODE-J05', volumeM3: 800 }, 'bottleneck:PIPE-P07', 5, 636, 0.415, 1_200_000);
const inletA = r({ kind: 'inlet', nodeId: 'NODE-J07', grates: 1 }, 'ponding:NODE-J07', 5, 640, 0.41, 8_000);

describe('rankResults', () => {
  it('sorts improvers by homes, volume, peak, cost and lists the rest as no effect', () => {
    const { ranked, noEffect } = rankResults(baseline, [storage, up675, inletA, relief, up750]);
    expect(ranked).toEqual([relief, up750, up675, inletA]);
    expect(noEffect).toEqual([storage]);
  });

  it('applies the improvement thresholds', () => {
    const vol = (v: number, b = baseline) => rankResults(b, [r({ kind: 'inlet', nodeId: 'X', grates: 1 }, 'p', 5, v, 0.42, 0)]).ranked.length;
    expect(vol(633.6)).toBe(1); // exactly 1 %
    expect(vol(634)).toBe(0); // under 1 %
    expect(vol(49.5, { ...baseline, floodVolumeM3: 50 })).toBe(0); // 1 % but under 1 m³
    expect(vol(49, { ...baseline, floodVolumeM3: 50 })).toBe(1);
    const peak = (p: number) => rankResults(baseline, [r({ kind: 'inlet', nodeId: 'X', grates: 1 }, 'p', 5, 640, p, 0)]).ranked.length;
    expect(peak(0.41)).toBe(1);
    expect(peak(0.415)).toBe(0);
    expect(rankResults(baseline, [r({ kind: 'inlet', nodeId: 'X', grates: 1 }, 'p', 4, 700, 0.5, 0)]).ranked).toHaveLength(1);
  });
});

describe('bestFixPerProblem', () => {
  it('picks the best-ranked improving fix for each problem', () => {
    const { ranked } = rankResults(baseline, [storage, up675, inletA, relief, up750]);
    expect(bestFixPerProblem(ranked)).toEqual({ 'bottleneck:PIPE-P07': relief, 'ponding:NODE-J07': inletA });
  });

  it('has no entry for a problem with no improving fix', () => {
    const { ranked } = rankResults(baseline, [storage]);
    expect(bestFixPerProblem(ranked)).toEqual({});
    expect(NO_IMPROVING_FIX_TEXT).toBe('No tested fix reduced flooding here');
  });
});

describe('logLines', () => {
  const d = diagnose(stormFrames, metrics, S);

  it('formats the baseline and bottleneck lines', () => {
    expect(logLines.readingBaseline(d)).toBe('Reading baseline results… PIPE-P07 full for 12 min; NODE-J07 peaks at 0.42 m; 5 homes flooded; street flood volume 640 m³');
    expect(logLines.bottlenecks(d, S)).toEqual(['Bottleneck found: PIPE-P07 (Ø600) at 100% capacity', 'Bottleneck found: PIPE-P05 (Ø600) at 100% capacity']);
    expect(logLines.noFlooding()).toBe('No flooding found; nothing to fix');
  });

  it('formats the candidate, simulation, ranking and recommendation lines', () => {
    expect(logLines.generating(['Upsize PIPE-P07 to Ø675', 'Extra inlet grate at NODE-J07'])).toBe('Generating 2 candidate fixes: Upsize PIPE-P07 to Ø675; Extra inlet grate at NODE-J07');
    expect(logLines.simulating(2, 5, 'Upsize PIPE-P07 to Ø675')).toBe('Simulating 2/5: Upsize PIPE-P07 to Ø675…');
    expect(logLines.result('Upsize PIPE-P07 to Ø675', 'NODE-J07', { homesFlooded: 3, floodVolumeM3: 300.4, hotspotPeakM: 0.3 }, true)).toBe(
      'Upsize PIPE-P07 to Ø675: NODE-J07 peak 0.30 m, homes 3, flood volume 300 m³ ✓',
    );
    expect(logLines.result('X', 'NODE-J07', baseline, false)).toBe('X: NODE-J07 peak 0.42 m, homes 5, flood volume 640 m³: no effect');
    expect(logLines.ranking()).toBe('Ranking by homes flooded, flood volume, peak depth, then cost…');
    expect(logLines.recommended({ ...relief, label: 'Relief pipe NODE-J07 → NODE-OUT01 (Ø600)' }, baseline, 'NODE-J07')).toBe(
      '✔ Recommended: Relief pipe NODE-J07 → NODE-OUT01 (Ø600): homes 5 → 1, flood volume 640 → 500 m³, NODE-J07 peak 0.42 → 0.35 m, about RM 30,000 (indicative)',
    );
    expect(logLines.noImprovingFix()).toBe('No tested fix reduced flooding');
  });

  it('formats the problem pin lines', () => {
    expect(logLines.problem(d.problems[0])).toBe('⚠ Bottleneck: PIPE-P07 full at 10:00');
    expect(logLines.problem(d.problems[1])).toBe('⚠ Ponding: NODE-J07 water 0.15 m at 14:00');
    expect(logLines.problemPending(d.problems[0], 2, 5)).toBe('⚠ Bottleneck detected — testing fixes… (2/5)');
  });
});

describe('on the uploaded sample package', () => {
  it('gives the same candidates', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { buildSiteFromFiles } = await import('../../src/import/buildSite');
    const dir = resolve(__dirname, '../../../../data/samples/taman_kyra_site');
    const read = (name: string) => ({ name, text: readFileSync(resolve(dir, name), 'utf8') });
    const { site } = buildSiteFromFiles({ inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') });
    const f = frames((p, i) => (p === 'PIPE-P07' && i >= 10 ? 1 : 0.6), (n, i) => n === site!.hotspotNodeId && i >= 15);
    const c = generateCandidates(diagnose(f, metrics, site!), site!);
    expect(c.map((x) => fixId(x.fix))).toEqual([
      'upsize:PIPE-P07@0.675', 'upsize:PIPE-P07@0.75', 'relief:NODE-J07>NODE-OUT01@0.6', 'storage:NODE-J05@800', 'inlet:NODE-J07+1',
    ]);
  });
});
