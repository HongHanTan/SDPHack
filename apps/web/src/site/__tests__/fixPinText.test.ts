import { describe, expect, it } from 'vitest';
import { NO_IMPROVING_FIX_TEXT, type CandidateResult, type Diagnosis, type Problem } from '@floodops/engine/analysis/fixFinder';
import { hotspotCell } from '@floodops/engine/scenario/index';
import { TAMAN_KYRA } from '@floodops/engine/scenario/site';
import type { SimulationFrame, SimulationMetricsResponse, SimulationRun } from '../../types';
import { groundAt, indicativeCost, outcomeRows, pinView, previewDiagnosis, visibleProblems } from '../fixPinText';
import type { SiteResult } from '../types';

const pipe: Problem = { id: 'bottleneck:PIPE-P07', kind: 'bottleneck', assetId: 'PIPE-P07', onsetS: 750, location: { x: 10, y: 20 } };
const pond: Problem = { id: 'ponding:NODE-J07', kind: 'ponding', assetId: 'NODE-J07', onsetS: 1500, location: { x: 30, y: 40 } };
const diagnosis = { hotspotNodeId: 'NODE-J07', hotspotPeakM: 0.52, homesFlooded: 4, floodVolumeM3: 1234.4, problems: [pipe, pond] } as unknown as Diagnosis;
const fix = (problemId: string, label: string, homes: number, key: string): CandidateResult & { resultKey: string } => ({
  fix: { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.75 }, problemId, label, costRM: 112499.6, resultKey: key,
  outcome: { homesFlooded: homes, floodVolumeM3: 410.2, hotspotPeakM: 0.31 },
});

describe('visibleProblems', () => {
  it('shows a pin once playback reaches its onset and hides it again when seeking back', () => {
    expect(visibleProblems([pipe, pond], 0)).toEqual([]);
    expect(visibleProblems([pipe, pond], 750).map((p) => p.id)).toEqual([pipe.id]);
    expect(visibleProblems([pipe, pond], 2000).map((p) => p.id)).toEqual([pipe.id, pond.id]);
    expect(visibleProblems([pipe, pond], 1000).map((p) => p.id)).toEqual([pipe.id]);
  });
  it('leaves out dismissed pins and shows nothing without a playback time', () => {
    expect(visibleProblems([pipe, pond], 2000, new Set([pipe.id])).map((p) => p.id)).toEqual([pond.id]);
    expect(visibleProblems([pipe, pond], undefined)).toEqual([]);
  });
});

describe('pinView', () => {
  it('is pending with the progress while candidates are still running', () => {
    expect(pinView(pipe, { phase: 'running', progress: { done: 2, total: 6 } })).toEqual({ heading: '⚠ Bottleneck detected — testing fixes… (2/6)', pending: true });
    expect(pinView(pond, { phase: 'running', progress: null }).heading).toBe('⚠ Ponding detected — testing fixes…');
  });
  it('shows the best fix for its problem with before → after values and an indicative cost', () => {
    const ranked = [fix(pond.id, 'Add 1 grate at NODE-J07', 1, 'k0'), fix(pipe.id, 'Upsize PIPE-P07 to Ø750 mm', 2, 'k1'), fix(pipe.id, 'Upsize PIPE-P07 to Ø825 mm', 3, 'k2')];
    const v = pinView(pipe, { phase: 'done', progress: { done: 6, total: 6 }, diagnosis, ranked });
    expect(v.heading).toBe('⚠ Bottleneck: PIPE-P07 full at 12:30');
    expect(v.pending).toBe(false);
    expect(v.fix).toEqual({
      label: 'Upsize PIPE-P07 to Ø750 mm', resultKey: 'k1', cost: 'about RM 112,500 (indicative)',
      rows: [
        { label: 'Homes flooded', before: '4', after: '2' },
        { label: 'Street flood volume', before: '1,234 m³', after: '410 m³' },
        { label: 'NODE-J07 peak', before: '0.52 m', after: '0.31 m' },
      ],
    });
    expect(pinView(pond, { phase: 'done', progress: null, diagnosis, ranked }).heading).toBe('⚠ Ponding: NODE-J07 water 0.15 m at 25:00');
  });
  it('says no tested fix helped, or that the analysis stopped or failed', () => {
    expect(pinView(pond, { phase: 'done', progress: null, diagnosis, ranked: [] }).note).toBe(NO_IMPROVING_FIX_TEXT);
    expect(pinView(pond, { phase: 'stopped', progress: null }).note).toMatch(/stopped/);
    expect(pinView(pond, { phase: 'failed', progress: null }).note).toMatch(/failed/);
    expect(pinView(pond, { phase: 'failed', progress: null }).fix).toBeUndefined();
  });
});

describe('formatting', () => {
  it('labels costs as indicative and lists the three outcomes', () => {
    expect(indicativeCost(8000)).toBe('about RM 8,000 (indicative)');
    expect(outcomeRows({ homesFlooded: 1, floodVolumeM3: 0, hotspotPeakM: 0 }, { homesFlooded: 0, floodVolumeM3: 0, hotspotPeakM: 0 }, 'J1').map((r) => r.label)).toEqual(['Homes flooded', 'Street flood volume', 'J1 peak']);
  });
});

describe('groundAt', () => {
  it("uses the nearest node's ground level", () => {
    const j07 = TAMAN_KYRA.assets.nodes.find((n) => n.node_id === 'NODE-J07')!;
    expect(groundAt(TAMAN_KYRA, j07.position_m.x + 0.5, j07.position_m.y)).toBe(j07.ground_elevation_m);
  });
});

describe('previewDiagnosis', () => {
  it('finds the same problems from the baseline frames and the hotspot street depth', () => {
    const site = TAMAN_KYRA;
    const p07 = site.assets.conduits.find((c) => c.conduit_id === 'PIPE-P07')!;
    const frame = (t: number, load: number): SimulationFrame => ({
      timestamp_s: t,
      pipe_states: [{ conduit_id: p07.conduit_id, flow_m3s: 0, depth_m: 0, capacity_fraction: load, status: load >= 0.999 ? 'surcharged' : 'normal' }],
      node_states: [{ node_id: 'NODE-J07', depth_m: 0.5, flooding_rate_m3s: 0, surcharge_flag: false, status: 'normal' }],
      inlet_states: [],
    } as unknown as SimulationFrame);
    const frames = [0, 60, 120, 180].map((t, i) => frame(t, i >= 1 ? 1 : 0.5));
    const cells = site.gridSpec.nx * site.gridSpec.ny;
    const grids = new Float32Array(cells * 4);
    grids[3 * cells + hotspotCell(site)] = 0.2; // street water ≥ 0.15 m at 180 s
    const baseline: SiteResult = {
      run: { run_id: 'b' } as SimulationRun, frames,
      metrics: { total_flooding_volume_m3: 10, j07_peak_depth_m: 0.5, homes_flooded: 1 } as unknown as SimulationMetricsResponse,
      depth: { times: [0, 60, 120, 180], cells, data: grids.buffer },
    };
    const d = previewDiagnosis(baseline, site);
    expect(d.problems.map((p) => [p.id, p.onsetS])).toEqual([['bottleneck:PIPE-P07', 60], ['ponding:NODE-J07', 180]]);
  });
});
