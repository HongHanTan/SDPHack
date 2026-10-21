/**
 * The 3-zone demo package (data/samples/taman_kyra_demo) through the real fix-finder pipeline, as the browser runs it:
 * buildSiteFromFiles → stormFromInp → baseline → diagnose → candidates → simulate each → rankResults → best per problem.
 * Frames and metrics go through the web app's own `runSite` (apps/web/src/site/local/runs.ts, which uses its frame
 * adapter), with an in-process engine runner in place of the web worker, and the hotspot street depth is read from the
 * stored depth grids with the web's `depthAt`, exactly as the analysis does. Nothing here is hard-coded: the zones'
 * outcomes come only from engine runs. Slow (~10 min): part of `npm -w @floodops/engine run story`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { depthAt, runSite, type EngineRunner } from '../../../apps/web/src/site/local/runs';
import { diagnose, fixPerProblem, generateCandidates, isImprovement, rankResults, type CandidateResult, type Outcome } from '../src/analysis/fixFinder';
import { buildSiteFromFiles } from '../src/import/buildSite';
import { stormFromInp } from '../src/import/stormFromInp';
import { applyFix, fixCostRM, fixLabel } from '../src/scenario/fixActions';
import { buildScenario } from '../src/scenario/index';
import { runSimulation } from '../src/sim/engine';

const dir = resolve(__dirname, '../../../data/samples/taman_kyra_demo');
const read = (name: string) => ({ name, text: readFileSync(resolve(dir, name), 'utf8') });
/** The engine worker's job, run in this process. */
const runner: EngineRunner = { run: async (ids, stormId, _onFrame, custom, opts) => runSimulation(buildScenario(ids, stormId, custom, opts)) };
type TeamMetrics = { j07_peak_depth_m: number; homes_flooded: number; total_flooding_volume_m3: number };
const outcomeOf = (m: unknown): Outcome => {
  const t = m as TeamMetrics;
  return { homesFlooded: t.homes_flooded, floodVolumeM3: t.total_flooding_volume_m3, hotspotPeakM: t.j07_peak_depth_m };
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}`;

describe('3-zone demo package: the fix finder picks upsize, relief and extra inlet', () => {
  it('finds three problems in different zones whose best fixes are upsize, relief and inlet', async () => {
    const inp = read('taman_kyra_demo.inp');
    const { site, report } = buildSiteFromFiles({ inp, geojson: read('taman_kyra_demo_layout.geojson'), asc: read('taman_kyra_demo_ground.asc') });
    expect(report.errors).toEqual([]);
    const { storm, errors } = stormFromInp(inp.text);
    expect(errors).toEqual([]);

    const base = await runSite(runner, 'baseline', site!, storm!);
    const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site: site!, storm: storm!, blockage: {} });
    const cell = sc.network.nodes.find((n) => n.id === site!.hotspotNodeId)!.cell;
    const hotspotStreetDepthM = base.frames.map((f) => depthAt(base.depth, f.timestamp_s)?.[cell] ?? 0);
    const diagnosis = diagnose(base.frames, base.metrics as unknown as TeamMetrics, site!, { hotspotStreetDepthM });
    const before = outcomeOf(base.metrics);

    const results: CandidateResult[] = [];
    for (const c of generateCandidates(diagnosis, site!)) {
      const out = await runSite(runner, fixLabel(c.fix, site!), applyFix(site!, c.fix), storm!);
      results.push({ ...c, label: fixLabel(c.fix, site!), costRM: fixCostRM(c.fix, site!), outcome: outcomeOf(out.metrics) });
    }
    const { ranked } = rankResults(before, results);
    const best = fixPerProblem(diagnosis.problems, ranked, before, diagnosis.hotspotNodeId);

    const rows = diagnosis.problems.map((p) => {
      const b = best[p.id];
      const o = b?.result.outcome;
      return `${p.id}${p.pipeIds && p.pipeIds.length > 1 ? ` (${p.pipeIds.join(' + ')})` : ''} | onset ${mmss(p.onsetS)} | ${b ? b.result.label : 'none'} | homes ${before.homesFlooded} → ${o?.homesFlooded} | volume ${before.floodVolumeM3} → ${o?.floodVolumeM3} m³ | ${diagnosis.hotspotNodeId} peak ${before.hotspotPeakM.toFixed(2)} → ${o?.hotspotPeakM.toFixed(2)} m | RM ${Math.round(b?.result.costRM ?? 0).toLocaleString('en-US')}`;
    });
    console.log(['Demo zones (problem | onset | best fix | before → after | cost):', ...rows, 'All candidates:', ...results.map((r) => `  [${r.problemId}] ${r.label}: homes ${r.outcome.homesFlooded}, volume ${r.outcome.floodVolumeM3} m³, peak ${r.outcome.hotspotPeakM.toFixed(3)} m${isImprovement(before, r.outcome) ? '' : ' (no effect)'}`)].join('\n'));

    // Three problems: zone A trunk (one full pipe), zone B two full pipes in series, zone C ponding at the low street.
    expect(diagnosis.problems).toHaveLength(3);
    const byKind = (pred: (p: (typeof diagnosis.problems)[number]) => boolean) => diagnosis.problems.filter(pred);
    const [zoneA] = byKind((p) => p.kind === 'bottleneck' && p.pipeIds!.length === 1);
    const [zoneB] = byKind((p) => p.kind === 'bottleneck' && p.pipeIds!.length === 2);
    const [zoneC] = byKind((p) => p.kind === 'ponding');
    expect(zoneA?.pipeIds).toEqual(['PIPE-P02']);
    expect(zoneB?.pipeIds).toEqual(['PIPE-P04', 'PIPE-P09']);
    expect(zoneC?.assetId).toBe('NODE-J07');

    // Each zone's best fix is its own, of the expected kind.
    expect(best[zoneA.id]?.sharedFrom).toBeUndefined();
    expect(best[zoneB.id]?.sharedFrom).toBeUndefined();
    expect(best[zoneC.id]?.sharedFrom).toBeUndefined();
    expect(best[zoneA.id]?.result.fix.kind).toBe('upsize');
    expect(best[zoneB.id]?.result.fix.kind).toBe('relief');
    expect(best[zoneC.id]?.result.fix.kind).toBe('inlet');

    // Distinct zones in different parts of the map (problem pins at least 50 m apart).
    const pins = [zoneA, zoneB, zoneC].map((p) => p.location);
    for (let i = 0; i < pins.length; i++) {
      for (let j = i + 1; j < pins.length; j++) expect(Math.hypot(pins[i].x - pins[j].x, pins[i].y - pins[j].y)).toBeGreaterThan(50);
    }
  }, 1_800_000);
});
