import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '@floodops/engine/client/runner';
import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { buildScenario, type ScenarioOptions } from '@floodops/engine/scenario/index';
import type { Frame, Metrics } from '@floodops/engine/sim/types';
import type { InspectionRecord, SimulationFramesResponse, SimulationMetricsResponse, SimulationRun } from '../../../types';
import type { ProjectSummary, SitePreview, SiteProject, SiteProposal } from '../../types';
import { createLocalSiteApi, MAX_RUNS_PER_PROJECT } from '../localSiteApi';
import { depthAt, type EngineRunner } from '../runs';
import { MemorySiteStore } from '../store';

const dir = join(__dirname, '../../../../public/site-examples/taman-kyra-swmm');
const read = (name: string) => ({ name, text: readFileSync(join(dir, name), 'utf8') });
const files = { inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') };
const body = { name: 'Kyra test', files };

const site = buildSiteFromFiles(files).site!;
const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site });
const cells = sc.grid.z.length;

/** Engine output with the right array sizes: `n` frames 30 s apart, depth = frame index. */
function fakeResult(n = 5): RunResult {
  const frames: Frame[] = Array.from({ length: n }, (_, i) => ({
    t: i * 30,
    depth: new Float32Array(cells).fill(i),
    nodeFill: new Float32Array(sc.network.nodes.length).fill(0.5),
    pipeLoad: new Float32Array(sc.network.pipes.length).fill(0.5),
  }));
  const metrics: Metrics = { peakDepth: new Float32Array(cells), peakSagDepth: 0.1, floodedRoadArea: 0, homesFlooded: 0, minutesToPassable: 0, peakOutfallFlow: 0.2, sagSeries: { t: [], depth: [] }, balance: { rain: 1, error: 0 } };
  return { frames, metrics };
}

/** A runner whose runs finish when the test says so. */
function controlledRunner() {
  const calls: { opts: ScenarioOptions; resolve: (r: RunResult) => void; reject: (e: Error) => void }[] = [];
  const runner: EngineRunner = { run: (_ids, _storm, _f, _c, opts) => new Promise<RunResult>((resolve, reject) => calls.push({ opts, resolve, reject })) };
  return { runner, calls };
}
const instantRunner = (): EngineRunner => ({ run: async () => fakeResult() });

async function withProject(runner: EngineRunner = instantRunner()) {
  const api = createLocalSiteApi(new MemorySiteStore(), runner);
  const project = await api.request<SiteProject>('/api/site-projects', body);
  return { api, project, path: `/api/site-projects/${project.project_id}` };
}

describe('local site API — inspect and projects', () => {
  it('inspects the three sample files as map- and simulation-ready', async () => {
    const api = createLocalSiteApi(new MemorySiteStore(), instantRunner());
    const p = await api.request<SitePreview>('/api/site-projects/inspect', body);
    expect(p.issues.filter((i) => i.level !== 'warning')).toEqual([]);
    expect(p.map_ready).toBe(true);
    expect(p.simulation_ready).toBe(true);
    expect(p.counts).toEqual({ nodes: 9, pipes: 8, inlets: 4, catchments: 4, rainfall: 25, terrain: expect.any(Number), roads: expect.any(Number), buildings: expect.any(Number) });
    expect(p.counts.terrain).toBeGreaterThan(0);
    expect(p.site.project.name).toBe('Kyra test');
    expect(p.site.nodes).toHaveLength(9);
    expect(p.manifest.map((f) => [f.name, f.role, f.headers])).toEqual([
      ['taman_kyra.inp', 'swmm', []],
      ['taman_kyra_layout.geojson', 'layout', []],
      ['taman_kyra_ground.asc', 'height', []],
    ]);
    expect(p.manifest[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(p.manifest[0].bytes).toBe(Buffer.byteLength(files.inp.text));
    expect(p.fields).toEqual({});
    expect(p.assumptions.join(' ')).not.toMatch(/storm selector/);
  });

  it('flags missing rainfall as a simulation issue, and bad files as map issues', async () => {
    const api = createLocalSiteApi(new MemorySiteStore(), instantRunner());
    const noSubs = files.inp.text.replace(/\[SUBCATCHMENTS\][\s\S]*?(?=\n\[)/, '[SUBCATCHMENTS]\n');
    const dry = await api.request<SitePreview>('/api/site-projects/inspect', { name: '', files: { inp: { name: 'dry.inp', text: noSubs } } });
    expect(dry.map_ready).toBe(true);
    expect(dry.simulation_ready).toBe(false);
    expect(dry.issues.filter((i) => i.level === 'simulation').length).toBeGreaterThan(0);
    const bad = await api.request<SitePreview>('/api/site-projects/inspect', { name: '', files: { inp: { name: 'bad.inp', text: '[TITLE]\nnothing' } } });
    expect(bad.map_ready).toBe(false);
    expect(bad.issues.some((i) => i.level === 'map' && i.location === 'bad.inp')).toBe(true);
    expect(bad.site.project.name).toBe('bad');
    await expect(api.request('/api/site-projects/inspect', { name: '', files: [] })).rejects.toThrow(/SWMM model \(\.inp\)/);
  });

  it('creates, lists and gets a project; keeps the original files', async () => {
    const { api, project, path } = await withProject();
    expect(project.project_id).toMatch(/^site_[0-9a-f]{32}$/);
    expect(project.model_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(project.is_verified_site_model).toBe(false);
    expect(project.name).toBe('Kyra test');
    expect('sources' in project).toBe(false);
    const list = await api.request<{ items: ProjectSummary[] }>('/api/site-projects');
    expect(list.items).toEqual([{ project_id: project.project_id, name: 'Kyra test', created_at: project.created_at, model_version_id: project.model_version_id, model_hash: project.model_hash, counts: project.counts, simulation_ready: true }]);
    expect(await api.request<SiteProject>(path)).toEqual(project);
    const sources = await api.request<{ files: { name: string; text: string; role: string }[] }>(path + '/sources');
    expect(sources.files.map((f) => [f.name, f.role])).toEqual([['taman_kyra.inp', 'swmm'], ['taman_kyra_layout.geojson', 'layout'], ['taman_kyra_ground.asc', 'height']]);
    expect(sources.files[0].text).toBe(files.inp.text);
    await expect(api.request('/api/site-projects/site_' + '0'.repeat(32))).rejects.toThrow('Unknown site project.');
  });

  it('refuses to build when the map is not ready', async () => {
    const api = createLocalSiteApi(new MemorySiteStore(), instantRunner());
    await expect(api.request('/api/site-projects', { name: '', files: { inp: { name: 'bad.inp', text: '[TITLE]' } } })).rejects.toThrow(/map-blocking/);
  });

  it('throws on an unknown path', async () => {
    const api = createLocalSiteApi(new MemorySiteStore(), instantRunner());
    await expect(api.request('/api/elsewhere')).rejects.toThrow('Unknown local site request: /api/elsewhere');
    await expect(api.request('/api/site-projects/a/b/c')).rejects.toThrow('Unknown local site request');
  });
});

describe('local site API — inspections and proposals', () => {
  const inspection = { asset_id: 'INLET-D07', timestamp: new Date(Date.now() - 60_000).toISOString(), inspector: 'A. Tester', method: 'visual', source_type: 'observed', visible_grate_coverage_fraction: 0.4, debris_category: 'leaf_litter', notes: 'Leaves on grate', source_reference: 'Site visit 1' };

  it('records inspections and attachments', async () => {
    const { api, project, path } = await withProject();
    const saved = await api.request<InspectionRecord>(path + '/inspections', inspection);
    expect(saved.inspection_id).toMatch(/^inspection_/);
    expect(saved.media).toEqual([]);
    await expect(api.request(path + '/inspections', { ...inspection, asset_id: 'NOPE' })).rejects.toThrow(/Choose an asset/);
    await expect(api.request(path + '/inspections', { ...inspection, asset_id: 'NODE-J07' })).rejects.toThrow(/only to an inlet/);
    await expect(api.request(path + '/inspections', { ...inspection, notes: ' ' })).rejects.toThrow(/condition notes/);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const media = await api.uploadMedia(project.project_id, saved.inspection_id, Object.assign(new Blob([png], { type: 'image/png' }), { name: 'C:\\photos\\grate.png' }));
    expect(media).toMatchObject({ filename: 'grate.png', content_type: 'image/png', size_bytes: 11 });
    await expect(api.uploadMedia(project.project_id, saved.inspection_id, new Blob(['hello']))).rejects.toThrow(/PNG, JPEG/);
    const list = await api.request<{ items: InspectionRecord[] }>(path + '/inspections');
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toEqual({ ...saved, media: [media], media_urls: [media.url] });
    expect('id' in list.items[0]).toBe(false);
  });

  it('saves proposals newest first, with the target inspections', async () => {
    const { api, path } = await withProject();
    await api.request(path + '/inspections', inspection);
    const draft = { asset_id: 'INLET-D07', scope: 'Clean', owner: 'Ops', justification: 'Leaves', estimate_myr: null, estimate_source: '', baseline_run_id: null, candidate_run_id: null };
    const a = await api.request<SiteProposal>(path + '/proposals', draft);
    const b = await api.request<SiteProposal>(path + '/proposals', { ...draft, asset_id: 'PIPE-P07', estimate_myr: 1200 });
    expect(a).toMatchObject({ status: 'Draft', comparison: null, estimate_myr: null });
    expect(a.inspection_snapshot).toHaveLength(1);
    expect(b.inspection_snapshot).toHaveLength(0);
    const list = await api.request<{ items: SiteProposal[] }>(path + '/proposals');
    expect(list.items.map((p) => p.proposal_id)).toEqual([b.proposal_id, a.proposal_id]);
    await expect(api.request(path + '/proposals', { ...draft, owner: '' })).rejects.toThrow(/scope, owner and reason/);
    await expect(api.request(path + '/proposals', { ...draft, baseline_run_id: 'run_x' })).rejects.toThrow(/both baseline and candidate/);
  });
});

describe('local site API — engine runs', () => {
  it('stores a run as running, then succeeded, with team frames, metrics and depth grids', async () => {
    const { runner, calls } = controlledRunner();
    const { api, path } = await withProject(runner);
    const { run_id } = await api.request<{ run_id: string; status: string }>(path + '/simulations', { acknowledge_assumptions: true });
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    expect((await api.request<SimulationRun>(`/api/simulations/${run_id}`)).status).toBe('running');
    await expect(api.request(`/api/simulations/${run_id}/metrics`)).rejects.toThrow(/not ready/);
    expect(calls[0].opts.storm?.id).toBe('uploaded_rainfall');
    expect(calls[0].opts.storm?.intensity).toHaveLength(25);
    expect(calls[0].opts.blockage).toEqual({});
    calls[0].resolve(fakeResult(5));
    await vi.waitFor(async () => expect((await api.request<SimulationRun>(`/api/simulations/${run_id}`)).status).toBe('succeeded'));
    const run = await api.request<SimulationRun>(`/api/simulations/${run_id}`);
    expect(run).toMatchObject({ engine: 'FloodOps TS engine', is_verified_site_model: false, error: null, input_snapshot: { intervention: null } });
    expect(run.input_hash).toMatch(/^[0-9a-f]{64}$/);
    const frames = await api.request<SimulationFramesResponse>(`/api/simulations/${run_id}/frames`);
    expect(frames.frames).toHaveLength(5);
    expect(frames.frames[0].node_states).toHaveLength(sc.network.nodes.length);
    const metrics = await api.request<SimulationMetricsResponse>(`/api/simulations/${run_id}/metrics`);
    expect(metrics.run_id).toBe(run_id);
    expect(metrics.total_flooding_volume_m3).toBe(0);
    const depth = await api.runDepth(run_id);
    expect(depth?.times).toEqual([0, 60, 120]);
    expect(depth?.cells).toBe(cells);
    expect(depthAt(depth, 90)?.[0]).toBe(2);
    expect(depthAt(depth, 125)?.[0]).toBe(4);
    expect((await api.request<{ items: SimulationRun[] }>(path + '/simulations')).items.map((r) => r.run_id)).toEqual([run_id]);
  });

  it('records a failed run with its message', async () => {
    const { runner, calls } = controlledRunner();
    const { api, project } = await withProject(runner);
    const status = vi.fn();
    const pending = api.execute(project.project_id, { acknowledge_assumptions: true }, status, new AbortController().signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    calls[0].reject(new Error('boom'));
    await expect(pending).rejects.toThrow('boom');
    expect(status).toHaveBeenCalledWith(expect.stringMatching(/^Calculating in this browser · run_[0-9a-f]{32}$/));
    const runs = await api.request<{ items: SimulationRun[] }>(`/api/site-projects/${project.project_id}/simulations`);
    expect(runs.items[0]).toMatchObject({ status: 'failed', error: { message: 'boom' } });
  });

  it('requires acknowledged assumptions and a complete pipe change', async () => {
    const { api, path } = await withProject();
    await expect(api.request(path + '/simulations', { acknowledge_assumptions: false })).rejects.toThrow(/acknowledge the disclosed modelling assumptions/);
    await expect(api.request(path + '/simulations', { acknowledge_assumptions: true, pipe_id: 'PIPE-P07' })).rejects.toThrow(/both pipe ID and diameter/);
    await expect(api.request(path + '/simulations', { acknowledge_assumptions: true, pipe_id: 'NOPE', diameter_m: 1 })).rejects.toThrow(/Unknown pipe/);
  });

  it('runs a candidate pipe and attaches a checked comparison to a proposal', async () => {
    const seen: ScenarioOptions[] = [];
    const runner: EngineRunner = { run: async (_i, _s, _f, _c, opts) => (seen.push(opts), fakeResult()) };
    const { api, project, path } = await withProject(runner);
    const base = await api.execute(project.project_id, { acknowledge_assumptions: true }, () => {}, new AbortController().signal);
    const cand = await api.execute(project.project_id, { acknowledge_assumptions: true, pipe_id: 'PIPE-P07', diameter_m: 0.9 }, () => {}, new AbortController().signal);
    expect(cand.run.input_snapshot).toMatchObject({ intervention: { changes: [{ asset_id: 'PIPE-P07', after: 0.9 }] } });
    expect(seen[1].site!.assets.conduits.find((c) => c.conduit_id === 'PIPE-P07')!.diameter_m).toBe(0.9);
    expect(seen[1].site!.key).not.toBe(seen[0].site!.key);
    const draft = { asset_id: 'PIPE-P07', scope: 'Upsize', owner: 'Eng', justification: 'Model', estimate_myr: null, estimate_source: '' };
    const proposal = await api.request<SiteProposal>(path + '/proposals', { ...draft, baseline_run_id: base.run.run_id, candidate_run_id: cand.run.run_id });
    expect(proposal.comparison).toMatchObject({ baseline: { run_id: base.run.run_id }, candidate: { run_id: cand.run.run_id }, changes: [{ asset_id: 'PIPE-P07' }] });
    await expect(api.request(path + '/proposals', { ...draft, asset_id: 'PIPE-P05', baseline_run_id: base.run.run_id, candidate_run_id: cand.run.run_id })).rejects.toThrow(/must match the candidate pipe/);
    await expect(api.request(path + '/proposals', { ...draft, baseline_run_id: cand.run.run_id, candidate_run_id: base.run.run_id })).rejects.toThrow(/baseline and intervention/);
  });

  it('keeps the newest runs per project', async () => {
    const { api, project, path } = await withProject();
    const ids: string[] = [];
    for (let i = 0; i < MAX_RUNS_PER_PROJECT + 1; i++) ids.push((await api.execute(project.project_id, { acknowledge_assumptions: true }, () => {}, new AbortController().signal)).run.run_id);
    await vi.waitFor(async () => expect((await api.request<{ items: SimulationRun[] }>(path + '/simulations')).items).toHaveLength(MAX_RUNS_PER_PROJECT));
    const kept = (await api.request<{ items: SimulationRun[] }>(path + '/simulations')).items.map((r) => r.run_id);
    expect(kept).toEqual(ids.slice(1).reverse());
    await expect(api.request(`/api/simulations/${ids[0]}`)).rejects.toThrow(/Unknown run/);
  });

  it('stops waiting when cancelled; the run continues and is kept', async () => {
    const { runner, calls } = controlledRunner();
    const { api, project, path } = await withProject(runner);
    const controller = new AbortController();
    const pending = api.execute(project.project_id, { acknowledge_assumptions: true }, () => {}, controller.signal);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);
    calls[0].resolve(fakeResult());
    await vi.waitFor(async () => expect((await api.request<{ items: SimulationRun[] }>(path + '/simulations')).items[0].status).toBe('succeeded'));
  });

  it('marks a run left running by a closed page as interrupted', async () => {
    const store = new MemorySiteStore();
    const { runner } = controlledRunner();
    const first = createLocalSiteApi(store, runner);
    const project = await first.request<SiteProject>('/api/site-projects', body);
    const { run_id } = await first.startRun(project.project_id, { acknowledge_assumptions: true });
    const reopened = createLocalSiteApi(store, runner);
    expect(await reopened.request<SimulationRun>(`/api/simulations/${run_id}`)).toMatchObject({ status: 'failed', error: { code: 'INTERRUPTED' } });
  });
});
