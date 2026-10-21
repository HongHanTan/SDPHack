import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { RunResult } from '@floodops/engine/client/runner';
import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { buildScenario, type ScenarioOptions } from '@floodops/engine/scenario/index';
import type { Frame, Metrics } from '@floodops/engine/sim/types';
import type { SimulationFramesResponse, SimulationRun } from '../../../types';
import type { SiteProject, SiteProposal } from '../../types';
import { createLocalSiteApi, MAX_RUNS_PER_PROJECT, RUN_NOT_RETAINED, type AnalysisEvent } from '../localSiteApi';
import { ANALYSIS_POOL_MAX, analysisPoolSize, type EngineRunner } from '../runs';
import { MemorySiteStore } from '../store';

/** When set, applyFix rejects fixes of this kind (as an engine guard would). */
const reject = vi.hoisted(() => ({ kind: null as string | null }));
vi.mock('@floodops/engine/scenario/fixActions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@floodops/engine/scenario/fixActions')>();
  return {
    ...actual,
    applyFix: (s: Parameters<typeof actual.applyFix>[0], fix: Parameters<typeof actual.applyFix>[1]) => {
      if (fix.kind === reject.kind) throw new Error('Relief pipe runs uphill');
      return actual.applyFix(s, fix);
    },
  };
});

const dir = join(__dirname, '../../../../public/site-examples/taman-kyra-swmm');
const read = (name: string) => ({ name, text: readFileSync(join(dir, name), 'utf8') });
const files = { inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') };
const body = { name: 'Kyra test', files };

const site = buildSiteFromFiles(files).site!;
const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site });
const cells = sc.grid.z.length;
const pipeIdx = (id: string) => sc.network.pipes.findIndex((p) => p.id === id);
const nodeIdx = (id: string) => sc.network.nodes.findIndex((n) => n.id === id);
const P07 = pipeIdx('PIPE-P07');
const J07 = nodeIdx(site.hotspotNodeId);
const J07_CELL = sc.network.nodes[J07].cell;

/** What a scripted run gives: homes flooded and hotspot peak per fix kind (from the site key suffix). */
function outcomeFor(opts: ScenarioOptions): { homes: number; peak: number } {
  const key = opts.site!.key;
  const suffix = key.includes('|') ? key.slice(key.indexOf('|') + 1) : '';
  if (!suffix) return { homes: 5, peak: 0.5 };
  if (suffix.startsWith('relief:')) return { homes: 3, peak: 0.3 };
  if (suffix.startsWith('storage:')) return { homes: 4, peak: 0.4 };
  if (suffix.startsWith('inlet:')) return { homes: 5, peak: 0.5 }; // no effect
  return { homes: 2, peak: 0.2 }; // upsize
}

/**
 * Baseline-like engine output: PIPE-P07 runs full from frame 2, J07 floods from frame 3 and its street cell reaches
 * 0.2 m from frame 2 (stored on even frames only).
 */
function scriptedResult(opts: ScenarioOptions, n = 6): RunResult {
  const { homes, peak } = outcomeFor(opts);
  const frames: Frame[] = Array.from({ length: n }, (_, i) => {
    const depth = new Float32Array(cells);
    depth[J07_CELL] = i >= 2 ? 0.2 : 0;
    const nodeFill = new Float32Array(sc.network.nodes.length).fill(0.3);
    nodeFill[J07] = i >= 3 ? 1 : 0.3;
    const pipeLoad = new Float32Array(sc.network.pipes.length).fill(0.4);
    pipeLoad[P07] = i >= 2 ? 1 : 0.5;
    return { t: i * 30, depth, nodeFill, pipeLoad };
  });
  const metrics: Metrics = { peakDepth: new Float32Array(cells), peakSagDepth: peak, floodedRoadArea: 0, homesFlooded: homes, minutesToPassable: 0, peakOutfallFlow: 0.2, sagSeries: { t: [], depth: [] }, balance: { rain: 1, error: 0 } };
  return { frames, metrics };
}

/** A pool of engine runners that records how many runs overlap; each run waits for `release()` when gated. */
function pool(size: number, gated = false) {
  let running = 0;
  let maxRunning = 0;
  const calls: ScenarioOptions[] = [];
  const waiting: (() => void)[] = [];
  const started: (() => void)[] = [];
  const runners: EngineRunner[] = Array.from({ length: size }, () => ({
    run: async (_i, _s, _f, _c, opts) => {
      calls.push(opts);
      running++;
      maxRunning = Math.max(maxRunning, running);
      started.splice(0).forEach((r) => r());
      if (gated) await new Promise<void>((r) => waiting.push(r));
      else await new Promise((r) => setTimeout(r, 1));
      running--;
      return scriptedResult(opts);
    },
  }));
  return {
    factory: () => runners,
    calls,
    get maxRunning() { return maxRunning; },
    get running() { return running; },
    /** Resolves once at least `k` runs have started. */
    startedAtLeast: (k: number) => new Promise<void>((resolve) => {
      const check = () => (calls.length >= k ? resolve() : started.push(check));
      check();
    }),
    release: () => waiting.splice(0).forEach((r) => r()),
  };
}

async function setup(size = 3, gated = false) {
  const baselineRuns: ScenarioOptions[] = [];
  const main: EngineRunner = { run: async (_i, _s, _f, _c, opts) => (baselineRuns.push(opts), scriptedResult(opts)) };
  const engines = pool(size, gated);
  const store = new MemorySiteStore();
  const api = createLocalSiteApi(store, main, engines.factory);
  const project = await api.request<SiteProject>('/api/site-projects', body);
  const runs = async () => (await api.request<{ items: SimulationRun[] }>(`/api/site-projects/${project.project_id}/simulations`)).items;
  return { api, project, id: project.project_id, engines, baselineRuns, runs, store };
}

const collect = () => {
  const events: AnalysisEvent[] = [];
  return { events, on: (e: AnalysisEvent) => events.push(e), logs: () => events.filter((e) => e.type === 'log').map((e) => (e as { text: string }).text) };
};

describe('local site API — automated fix analysis', () => {
  it('sizes the pool as min(3, max(1, cores − 1))', () => {
    expect([1, 2, 3, 4, 8, 64].map(analysisPoolSize)).toEqual([1, 1, 2, 3, 3, 3]);
    expect(analysisPoolSize(undefined)).toBe(1);
    expect(ANALYSIS_POOL_MAX).toBe(3);
  });

  it('runs a baseline first when none is stored, then streams the log in spec order and ranks the fixes', async () => {
    const { api, id, engines, baselineRuns, runs } = await setup();
    const { events, on, logs } = collect();
    const result = await api.analyse(id, on, new AbortController().signal);

    // The baseline was run once on the main runner and stored like "Run uploaded baseline".
    expect(baselineRuns).toHaveLength(1);
    const stored = await runs();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ run_id: result.baselineRunId, status: 'succeeded', input_snapshot: { intervention: null } });

    // Diagnosis: P07 full from 60 s; J07 ponds from 60 s via the 0.15 m street-depth rule (flooding status only at 90 s).
    expect(result.diagnosis.bottlenecks.map((b) => b.pipeId)).toEqual(['PIPE-P07']);
    expect(result.diagnosis.problems.map((p) => [p.id, p.onsetS])).toEqual([['bottleneck:PIPE-P07', 60], [`ponding:${site.hotspotNodeId}`, 60]]);

    const labels = engines.calls.length;
    expect(labels).toBeGreaterThanOrEqual(3);
    const lines = logs();
    expect(lines[0]).toBe('No baseline run stored; running the baseline first…');
    expect(lines[1]).toMatch(/^Reading baseline results… PIPE-P07 full for \d+ min; NODE-J07 peaks at 0\.50 m; 5 homes flooded; street flood volume 0 m³$/);
    expect(lines[2]).toMatch(/^Bottleneck found: PIPE-P07 \(Ø\d+\) at 100% capacity$/);
    expect(lines[3]).toMatch(new RegExp(`^Generating ${labels} candidate fixes: Upsize PIPE-P07 to Ø\\d+; `));
    expect(lines.filter((l) => l.startsWith('Simulating '))).toHaveLength(labels);
    expect(lines.filter((l) => / ✓$|: no effect$/.test(l))).toHaveLength(labels);
    expect(lines.at(-2)).toBe('Ranking by homes flooded, flood volume, peak depth, then cost…');
    expect(lines.at(-1)).toMatch(/^✔ Recommended: Upsize PIPE-P07 to Ø\d+: homes 5 → 2, flood volume 0 → 0 m³, NODE-J07 peak 0\.50 → 0\.20 m, about RM [\d,]+ \(indicative\)$/);
    expect(lines.some((l) => /^Extra inlet grate at NODE-J07: NODE-J07 peak 0\.50 m, homes 5, flood volume 0 m³: no effect$/.test(l))).toBe(true);

    // Event order: progress 0/n after "Generating", each candidate event before its progress tick, last progress n/n.
    const types = events.map((e) => e.type);
    const firstProgress = types.indexOf('progress');
    expect(firstProgress).toBe(4);
    expect(events[firstProgress]).toEqual({ type: 'progress', done: 0, total: labels });
    const progress = events.filter((e) => e.type === 'progress').map((e) => (e as { done: number }).done);
    expect(progress).toEqual(Array.from({ length: labels + 1 }, (_, i) => i));
    const candidates = events.filter((e): e is Extract<AnalysisEvent, { type: 'candidate' }> => e.type === 'candidate');
    expect(candidates).toHaveLength(labels);
    expect(candidates.find((c) => c.fix.kind === 'inlet')).toMatchObject({ improved: false, label: 'Extra inlet grate at NODE-J07', costRM: 8000 });
    expect(candidates.find((c) => c.fix.kind === 'upsize')).toMatchObject({ improved: true, metrics: { homes_flooded: 2 } });

    // Ranking: upsizes (2 homes), relief (3), storage (4); inlet is "no effect".
    expect(result.ranked.map((r) => r.fix.kind)).toEqual(['upsize', 'upsize', 'relief', 'storage']);
    expect(result.ranked[0]).toMatchObject({ fix: { kind: 'upsize', pipeId: 'PIPE-P07' }, problemId: 'bottleneck:PIPE-P07', outcome: { homesFlooded: 2 } });
    expect(result.ranked[0].location).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    expect(result.noEffect).toEqual(['Extra inlet grate at NODE-J07']);
    // Every candidate used the uploaded storm and its own fixed site.
    for (const o of engines.calls) {
      expect(o.storm?.id).toBe('uploaded_rainfall');
      expect(o.blockage).toEqual({});
      expect(o.site!.key).toContain('|');
    }
    // Nothing but the baseline is stored until a fix is accepted.
    expect(await runs()).toHaveLength(1);
  });

  it('reuses the stored baseline instead of running a new one', async () => {
    const { api, id, baselineRuns, runs } = await setup();
    const base = await api.execute(id, { acknowledge_assumptions: true }, () => {}, new AbortController().signal);
    const { on, logs } = collect();
    const result = await api.analyse(id, on, new AbortController().signal);
    expect(result.baselineRunId).toBe(base.run.run_id);
    expect(baselineRuns).toHaveLength(1);
    expect(logs()[0]).toMatch(/^Reading baseline results/);
    expect(await runs()).toHaveLength(1);
    // An explicit baseline id is used as given; a non-baseline run is refused.
    const again = await api.analyse(id, () => {}, new AbortController().signal, base.run.run_id);
    expect(again.baselineRunId).toBe(base.run.run_id);
    const cand = await api.execute(id, { acknowledge_assumptions: true, pipe_id: 'PIPE-P07', diameter_m: 0.9 }, () => {}, new AbortController().signal);
    await expect(api.analyse(id, () => {}, new AbortController().signal, cand.run.run_id)).rejects.toThrow(/baseline run of this project/);
  });

  it('acceptFix stores exactly one run with the fix snapshot and results; nothing runs again', async () => {
    const { api, id, engines, baselineRuns, runs } = await setup();
    const result = await api.analyse(id, () => {}, new AbortController().signal);
    const before = engines.calls.length;
    const best = result.ranked[0];
    const run = await api.acceptFix(id, best.resultKey);
    expect(engines.calls.length).toBe(before);
    expect(baselineRuns).toHaveLength(1);
    expect(run).toMatchObject({ run_id: best.resultKey, status: 'succeeded', error: null, storm_id: 'uploaded_rainfall' });
    expect(run.input_hash).toMatch(/^[0-9a-f]{64}$/);
    const fix = best.fix as { kind: 'upsize'; pipeId: string; diameterM: number };
    const original = site.assets.conduits.find((c) => c.conduit_id === 'PIPE-P07')!.diameter_m;
    expect(run.input_snapshot!.intervention).toEqual({ kind: 'upsize', label: best.label, asset_id: 'PIPE-P07', changes: [{ asset_id: 'PIPE-P07', before: original, after: fix.diameterM }] });
    const stored = await runs();
    expect(stored.map((r) => r.run_id)).toEqual([run.run_id, result.baselineRunId]);
    const frames = await api.request<SimulationFramesResponse>(`/api/simulations/${run.run_id}/frames`);
    expect(frames.frames).toHaveLength(6);
    expect((await api.request<{ homes_flooded: number }>(`/api/simulations/${run.run_id}/metrics`)).homes_flooded).toBe(2);
    expect(await api.runDepth(run.run_id)).not.toBeNull();
    // Accepting again returns the same run without storing another.
    expect(await api.acceptFix(id, best.resultKey)).toEqual(run);
    expect(await runs()).toHaveLength(2);

    // Storage and inlet fixes store an empty change list; relief records the new pipe.
    const storage = result.ranked.find((r) => r.fix.kind === 'storage')!;
    const s = await api.acceptFix(id, storage.resultKey);
    expect(s.input_snapshot!.intervention).toEqual({ kind: 'storage', label: storage.label, asset_id: 'NODE-J05', changes: [] });
    const relief = result.ranked.find((r) => r.fix.kind === 'relief');
    if (relief) {
      const r = await api.acceptFix(id, relief.resultKey);
      const f = relief.fix as { fromNode: string; toNode: string; diameterM: number };
      expect(r.input_snapshot!.intervention).toEqual({ kind: 'relief', label: relief.label, asset_id: f.fromNode, changes: [{ asset_id: `RELIEF-${f.fromNode}-${f.toNode}`, before: null, after: f.diameterM }] });
    }

    // A proposal can still attach a manual pipe candidate (hashing unchanged).
    const cand = await api.execute(id, { acknowledge_assumptions: true, pipe_id: 'PIPE-P07', diameter_m: 0.9 }, () => {}, new AbortController().signal);
    const draft = { asset_id: 'PIPE-P07', scope: 'Upsize', owner: 'Eng', justification: 'Model', estimate_myr: null, estimate_source: '' };
    const proposal = await api.request<SiteProposal>(`/api/site-projects/${id}/proposals`, { ...draft, baseline_run_id: result.baselineRunId, candidate_run_id: cand.run.run_id });
    expect(proposal.comparison).toMatchObject({ candidate: { run_id: cand.run.run_id } });
  });

  describe('proposals with accepted fixes', () => {
    const draft = { scope: 'Fix', owner: 'Eng', justification: 'Automated analysis', estimate_myr: null, estimate_source: '' };
    const analysed = async () => {
      const ctx = await setup();
      const result = await ctx.api.analyse(ctx.id, () => {}, new AbortController().signal);
      const propose = (extra: Record<string, unknown>) => ctx.api.request<SiteProposal>(`/api/site-projects/${ctx.id}/proposals`, { ...draft, baseline_run_id: result.baselineRunId, ...extra });
      return { ...ctx, result, propose };
    };

    it('attaches a baseline and an accepted upsize fix', async () => {
      const { api, id, result, propose } = await analysed();
      const best = result.ranked.find((r) => r.fix.kind === 'upsize')!;
      const run = await api.acceptFix(id, best.resultKey);
      const proposal = await propose({ asset_id: 'PIPE-P07', candidate_run_id: run.run_id });
      const fix = best.fix as { diameterM: number };
      expect(proposal.comparison).toMatchObject({
        baseline: { run_id: result.baselineRunId },
        candidate: { run_id: run.run_id, input_hash: run.input_hash, metrics: { homes_flooded: 2 } },
        changes: [{ asset_id: 'PIPE-P07', after: fix.diameterM }],
        intervention: { kind: 'upsize', label: best.label, asset_id: 'PIPE-P07' },
      });
      await expect(propose({ asset_id: 'PIPE-P05', candidate_run_id: run.run_id })).rejects.toThrow(/must match the fix asset \(PIPE-P07\)/);
      // Two baselines, or the fix as the baseline, are refused.
      await expect(propose({ asset_id: 'PIPE-P07', candidate_run_id: result.baselineRunId })).rejects.toThrow(/baseline and intervention/);
      await expect(propose({ asset_id: 'PIPE-P07', baseline_run_id: run.run_id, candidate_run_id: run.run_id })).rejects.toThrow(/baseline and intervention/);
    });

    it('attaches an accepted storage fix (no pipe changes), targeting its node', async () => {
      const { api, id, result, propose } = await analysed();
      const storage = result.ranked.find((r) => r.fix.kind === 'storage')!;
      const run = await api.acceptFix(id, storage.resultKey);
      const proposal = await propose({ asset_id: 'NODE-J05', candidate_run_id: run.run_id });
      expect(proposal.asset_id).toBe('NODE-J05');
      expect(proposal.comparison).toMatchObject({ candidate: { run_id: run.run_id }, changes: [], intervention: { kind: 'storage', label: storage.label, asset_id: 'NODE-J05' } });
      await expect(propose({ asset_id: 'NODE-J07', candidate_run_id: run.run_id })).rejects.toThrow(/must match the fix asset \(NODE-J05\)/);
    });

    it('rejects a tampered fix snapshot, a run from another project and a pruned run', async () => {
      const { api, id, result, propose, store } = await analysed();
      const best = result.ranked[0];
      const run = await api.acceptFix(id, best.resultKey);
      const stored = (await store.getRun(run.run_id))!;
      const intervention = stored.run.input_snapshot!.intervention as { kind: string; label: string; changes: { after: number }[] };
      for (const tamper of [
        (i: typeof intervention) => (i.label = 'Something else'),
        (i: typeof intervention) => (i.changes[0].after = 1.5),
        (i: typeof intervention) => (i.kind = 'storage'),
        (i: typeof intervention) => (i.changes = []),
      ]) {
        const copy = structuredClone(stored);
        tamper(copy.run.input_snapshot!.intervention as typeof intervention);
        await store.putRun(copy);
        await expect(propose({ asset_id: 'PIPE-P07', candidate_run_id: run.run_id })).rejects.toThrow(/do not match the declared change/);
      }
      await store.putRun(stored);
      expect((await propose({ asset_id: 'PIPE-P07', candidate_run_id: run.run_id })).comparison).not.toBeNull();

      // A run from another project.
      const other = await api.request<SiteProject>('/api/site-projects', body);
      await expect(api.request(`/api/site-projects/${other.project_id}/proposals`, { ...draft, asset_id: 'PIPE-P07', baseline_run_id: result.baselineRunId, candidate_run_id: run.run_id })).rejects.toThrow(/from this project/);

      // A pruned run.
      await store.deleteRun(run.run_id);
      await expect(propose({ asset_id: 'PIPE-P07', candidate_run_id: run.run_id })).rejects.toThrow(RUN_NOT_RETAINED);
    });
  });

  it('prunes after accepting, and forgets results on discard', async () => {
    const { api, id, runs } = await setup();
    for (let i = 0; i < MAX_RUNS_PER_PROJECT; i++) await api.execute(id, { acknowledge_assumptions: true }, () => {}, new AbortController().signal);
    const result = await api.analyse(id, () => {}, new AbortController().signal);
    const run = await api.acceptFix(id, result.ranked[0].resultKey);
    const kept = await runs();
    expect(kept).toHaveLength(MAX_RUNS_PER_PROJECT);
    expect(kept[0].run_id).toBe(run.run_id);
    api.discardAnalysis(id);
    await expect(api.acceptFix(id, result.ranked[1].resultKey)).rejects.toThrow(/no longer kept/);
  });

  it('a new analysis replaces the previous results', async () => {
    const { api, id } = await setup();
    const first = await api.analyse(id, () => {}, new AbortController().signal);
    await api.analyse(id, () => {}, new AbortController().signal);
    await expect(api.acceptFix(id, first.ranked[0].resultKey)).rejects.toThrow(/no longer kept/);
  });

  it('never runs more candidates at once than the pool cap, even with more runners', async () => {
    const big = await setup(5);
    await big.api.analyse(big.id, () => {}, new AbortController().signal);
    expect(big.engines.calls.length).toBeGreaterThan(ANALYSIS_POOL_MAX);
    expect(big.engines.maxRunning).toBe(ANALYSIS_POOL_MAX);
    const one = await setup(1);
    await one.api.analyse(one.id, () => {}, new AbortController().signal);
    expect(one.engines.maxRunning).toBe(1);
  });

  it('cancel stops the analysis between candidates: no new candidate starts and nothing is stored', async () => {
    const { api, id, engines, runs } = await setup(1, true);
    const controller = new AbortController();
    const { events, on } = collect();
    const pending = api.analyse(id, on, controller.signal);
    await engines.startedAtLeast(1);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const seen = events.length;
    engines.release();
    await new Promise((r) => setTimeout(r, 10));
    engines.release();
    await new Promise((r) => setTimeout(r, 10));
    expect(engines.calls).toHaveLength(1);
    expect(events).toHaveLength(seen); // no events after cancel
    expect((await runs()).map((r) => r.input_snapshot?.intervention)).toEqual([null]);
    await expect(api.acceptFix(id, 'run_x')).rejects.toThrow(/no longer kept/);
  });

  it('rejects at once when already cancelled', async () => {
    const { api, id, baselineRuns } = await setup();
    const controller = new AbortController();
    controller.abort();
    await expect(api.analyse(id, () => {}, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(baselineRuns).toHaveLength(0);
  });

  it('logs a failed candidate and continues; fails when no candidate could be simulated', async () => {
    const store = new MemorySiteStore();
    let n = 0;
    const flaky: EngineRunner = { run: async (_i, _s, _f, _c, opts) => {
      if (n++ === 0) throw new Error('worker crashed');
      return scriptedResult(opts);
    } };
    const api2 = createLocalSiteApi(store, { run: async (_i, _s, _f, _c, opts) => scriptedResult(opts) }, () => [flaky]);
    const p2 = await api2.request<SiteProject>('/api/site-projects', body);
    const { on, logs } = collect();
    const result = await api2.analyse(p2.project_id, on, new AbortController().signal);
    expect(logs().some((l) => /^Upsize PIPE-P07 to Ø\d+: failed: worker crashed$/.test(l))).toBe(true);
    expect(result.ranked.length).toBeGreaterThan(0);

    const dead: EngineRunner = { run: async () => { throw new Error('no engine'); } };
    const api3 = createLocalSiteApi(new MemorySiteStore(), { run: async (_i, _s, _f, _c, opts) => scriptedResult(opts) }, () => [dead]);
    const p3 = await api3.request<SiteProject>('/api/site-projects', body);
    await expect(api3.analyse(p3.project_id, () => {}, new AbortController().signal)).rejects.toThrow(/No candidate fix could be simulated/);
  });

  it('logs and skips a candidate the engine cannot apply', async () => {
    reject.kind = 'relief';
    try {
      const { api, id, engines } = await setup();
      const { on, logs } = collect();
      const result = await api.analyse(id, on, new AbortController().signal);
      const lines = logs();
      const skip = lines.findIndex((l) => l === 'Relief pipe NODE-J07 → NODE-OUT01 (Ø600): skipped: Relief pipe runs uphill');
      expect(skip).toBeGreaterThan(0);
      expect(lines[skip + 1]).toMatch(/^Generating 4 candidate fixes: /);
      expect(lines[skip + 1]).not.toMatch(/Relief/);
      expect(engines.calls).toHaveLength(4);
      expect(result.ranked.map((r) => r.fix.kind)).toEqual(['upsize', 'upsize', 'storage']);
    } finally {
      reject.kind = null;
    }
  });

  it('reports "nothing to fix" when the baseline has no bottleneck or flooding', async () => {
    const calm = (): RunResult => {
      const r = scriptedResult({ site });
      for (const f of r.frames) {
        f.pipeLoad.fill(0.4);
        f.nodeFill.fill(0.3);
        f.depth.fill(0);
      }
      return r;
    };
    const engines = pool(3);
    const api = createLocalSiteApi(new MemorySiteStore(), { run: async () => calm() }, engines.factory);
    const p = await api.request<SiteProject>('/api/site-projects', body);
    const { on, logs } = collect();
    const result = await api.analyse(p.project_id, on, new AbortController().signal);
    expect(logs().at(-1)).toBe('No flooding found; nothing to fix');
    expect(result).toMatchObject({ ranked: [], noEffect: [] });
    expect(engines.calls).toHaveLength(0);
  });
});
