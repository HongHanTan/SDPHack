import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { stormFromInp } from '@floodops/engine/import/stormFromInp';
import { diagnose, generateCandidates, isImprovement, logLines, rankResults, type CandidateResult, type Diagnosis, type Outcome } from '@floodops/engine/analysis/fixFinder';
import { buildScenario } from '@floodops/engine/scenario/index';
import { applyFix, fixCostRM, fixLabel, fixLocation, type FixAction } from '@floodops/engine/scenario/fixActions';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { withPipeDiameter } from '@floodops/engine/scenario/siteVariants';
import type { InspectionMediaItem, InspectionRecord, SimulationFramesResponse, SimulationMetricsResponse, SimulationRun } from '../../types';
import type { ProjectSummary, SiteProject, SiteProposal, SiteResult } from '../types';
import { canonicalJson, inspectFiles, randomHex, readSources, sha256Hex } from './preview';
import { browserRunner, browserRunnerPool, depthAt, runErrorMessage, runPooled, runSite, type EngineRunner } from './runs';
import { IndexedDbSiteStore, type DepthGrids, type RunResults, type SiteStore, type StoredProject, type StoredRun } from './store';

/** Runs kept per project; older ones are deleted. */
export const MAX_RUNS_PER_PROJECT = 6;
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const ENGINE = 'FloodOps TS engine';
const ENGINE_VERSION = '1.0';
const INSPECTION_FIELDS = ['asset_id', 'timestamp', 'inspector', 'method', 'source_type', 'visible_grate_coverage_fraction', 'debris_category', 'notes', 'source_reference'] as const;
const METHODS = ['visual', 'cctv', 'drone', 'sensor'];
const SOURCE_TYPES = ['observed', 'synthetic', 'assumed', 'literature_derived'];
const DEBRIS = ['leaf_litter', 'sediment', 'plastic', 'mixed', 'none'];

type Run = StoredRun['run'];
type Change = { asset_id: string; before: number | null; after: number };
/** What a run changed relative to the baseline (`kind` and `label` only for fixes from the automated analysis). */
type Intervention = { kind?: FixAction['kind']; label?: string; changes: Change[] };

/** Streamed while the automated fix analysis runs (spec §6, §9). */
export type AnalysisEvent =
  | { type: 'log'; text: string }
  | { type: 'progress'; done: number; total: number }
  | { type: 'candidate'; index: number; fix: FixAction; label: string; costRM: number; metrics: SimulationMetricsResponse; improved: boolean };
/** An improving fix; its simulated run is kept in memory under `resultKey` until accepted or discarded. */
export interface RankedFix extends CandidateResult {
  location: { x: number; y: number };
  metrics: SimulationMetricsResponse;
  resultKey: string;
}
export interface AnalysisResult {
  baselineRunId: string;
  diagnosis: Diagnosis;
  /** Every improving fix, best first (the UI shows the top 3; `bestFixPerProblem` picks one per problem). */
  ranked: RankedFix[];
  /** Labels of the simulated fixes that did not improve on the baseline. */
  noEffect: string[];
}

export interface LocalSiteApi {
  request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T>;
  execute(projectId: string, body: unknown, onStatus: (status: string) => void, signal: AbortSignal): Promise<SiteResult>;
  /** Starts a run; `finished` resolves (never rejects) once its record is final (succeeded or failed) and runs are pruned. */
  startRun(projectId: string, body: unknown): Promise<{ run_id: string; finished: Promise<void> }>;
  /** Resolves when every run started by this page has finished. */
  whenIdle(): Promise<void>;
  uploadMedia(projectId: string, inspectionId: string, file: Blob & { name?: string }): Promise<InspectionMediaItem>;
  /** An object URL for a stored attachment (revoke it when done). */
  mediaUrl(mediaId: string): Promise<string>;
  /** The street-water depth grids of a finished run (every 2nd frame), or null. */
  runDepth(runId: string): Promise<DepthGrids | null>;
  /** The engine site built from a project's stored files (projects are immutable, so built once per project). */
  siteSpec(projectId: string): Promise<SiteSpec>;
  /**
   * Automated fix analysis: diagnoses the baseline (`baselineRunId`, else the newest stored baseline, else a new
   * baseline run saved like any other), then simulates candidate fixes on the worker pool and ranks them. Results stay
   * in memory until `acceptFix` or `discardAnalysis`; a new analysis of the project replaces them. Rejects with an
   * AbortError when `signal` aborts (no new candidate starts after that).
   */
  analyse(projectId: string, onEvent: (e: AnalysisEvent) => void, signal: AbortSignal, baselineRunId?: string): Promise<AnalysisResult>;
  /** Saves an analysed fix's run (already simulated; nothing runs again) and returns it; accepting it again returns the same run. */
  acceptFix(projectId: string, resultKey: string): Promise<SimulationRun>;
  /** Drops the project's in-memory analysis results. */
  discardAnalysis(projectId: string): void;
}

let last = 0;
/** ISO time, strictly increasing within this page so that newest-first order is exact. */
function now(): string {
  last = Math.max(Date.now(), last + 1);
  return new Date(last).toISOString();
}
const newestFirst = <T extends { created_at: string }>(items: T[]) => [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
const fail = (message: string): never => {
  throw new Error(message);
};
export const RUN_NOT_RETAINED = 'This run is no longer retained in this browser (only the newest 6 runs per project are kept). Run it again before attaching it.';
const INTERRUPTED_MESSAGE = 'The page was closed or reloaded before this calculation finished. Run it again.';
const aborted = () => new DOMException('The request was cancelled.', 'AbortError');
const summary = (p: StoredProject): ProjectSummary => ({ project_id: p.project_id, name: p.name, created_at: p.created_at, model_version_id: p.model_version_id, model_hash: p.model_hash, counts: p.counts, simulation_ready: p.simulation_ready });
const publicProject = (p: StoredProject): SiteProject => {
  const { sources: _sources, ...project } = p;
  void _sources;
  return project;
};
const assetIds = (p: SiteProject) => new Set([...p.site.nodes.map((n) => n.node_id), ...p.site.pipes.map((x) => x.conduit_id), ...p.site.inlets.map((i) => i.inlet_id)]);
const withoutId = (rec: unknown) => {
  const { id: _id, ...rest } = rec as { id: string } & Record<string, unknown>;
  void _id;
  return rest;
};

/** The inputs a run depends on; its canonical SHA-256 is the run's `input_hash`. */
function snapshotFor(project: SiteProject, intervention: Intervention | null) {
  return {
    project_id: project.project_id,
    model_version_id: project.model_version_id,
    model_hash: project.model_hash,
    sources: project.manifest.map((f) => ({ name: f.name, role: f.role, sha256: f.sha256 })),
    engine: ENGINE,
    engine_version: ENGINE_VERSION,
    rainfall: project.site.rainfall,
    blockage: {},
    intervention,
  };
}

/** The asset changes a fix makes, where a before/after value is meaningful (none for storage and inlets). */
function changesOf(fix: FixAction, site: SiteSpec): Change[] {
  if (fix.kind === 'upsize') return [{ asset_id: fix.pipeId, before: site.assets.conduits.find((c) => c.conduit_id === fix.pipeId)?.diameter_m ?? null, after: fix.diameterM }];
  if (fix.kind === 'relief') return [{ asset_id: `RELIEF-${fix.fromNode}-${fix.toNode}`, before: null, after: fix.diameterM }];
  return [];
}

export function createLocalSiteApi(store: SiteStore, runner: EngineRunner = browserRunner(), analysisPool: () => EngineRunner[] = browserRunnerPool): LocalSiteApi {
  /** Runs still executing in this page (protected from pruning). */
  const active = new Set<string>();
  /** Every run this page started; never cleared, so a run finishing here is never taken for an interrupted one. */
  const startedHere = new Set<string>();
  const outcomes = new Set<Promise<unknown>>();

  const project = async (id: string): Promise<StoredProject> => {
    if (!/^site_[0-9a-f]{32}$/.test(id)) fail('Unknown site project.');
    return (await store.getProject(id)) ?? fail('Unknown site project.');
  };

  /**
   * A run marked running that this page did not start was interrupted (its page closed). The record is
   * re-read just before writing, so a run that has finished meanwhile is returned as it is.
   */
  const settle = async (r: StoredRun): Promise<StoredRun> => {
    if (r.run.status !== 'running' || startedHere.has(r.run.run_id)) return r;
    const fresh = await store.getRun(r.run.run_id);
    if (!fresh || fresh.run.status !== 'running' || startedHere.has(r.run.run_id)) return fresh ?? r;
    const next: StoredRun = { ...fresh, run: { ...fresh.run, status: 'failed', error: { code: 'INTERRUPTED', message: INTERRUPTED_MESSAGE } } };
    await store.putRun(next);
    return next;
  };
  const getRun = async (id: string) => settle((await store.getRun(id)) ?? fail(`Unknown run ${id}.`));
  const listRuns = async (projectId: string) => newestFirst((await Promise.all((await store.listRuns(projectId)).map(settle))).map((r) => r.run));

  /** Keeps the newest runs; a failure here never changes the outcome of the run that triggered it. */
  const prune = async (projectId: string) => {
    try {
      const runs = newestFirst((await store.listRuns(projectId)).map((r) => r.run));
      for (const r of runs.slice(MAX_RUNS_PER_PROJECT)) if (!active.has(r.run_id)) await store.deleteRun(r.run_id);
    } catch (e) {
      console.warn('Could not prune old local runs:', e);
    }
  };

  const records = async <T>(kind: 'inspections' | 'proposals', projectId: string) => newestFirst((await store.listRecords(kind, projectId)).map(withoutId) as unknown as (T & { created_at: string })[]);

  const createProject = async (body: unknown): Promise<SiteProject> => {
    const { name, files } = readSources(body);
    const preview = await inspectFiles(name, files);
    if (!preview.map_ready) fail('Resolve map-blocking input issues before building.');
    const stored: StoredProject = {
      ...preview,
      project_id: 'site_' + randomHex(),
      model_version_id: 'uploaded_' + randomHex(),
      name: preview.site.project.name,
      model_hash: await sha256Hex(canonicalJson(preview.site)),
      created_at: now(),
      is_verified_site_model: false,
      sources: files,
    };
    await store.putProject(stored);
    return publicProject(stored);
  };

  const addInspection = async (p: StoredProject, body: unknown): Promise<InspectionRecord> => {
    const b = (body ?? {}) as Record<string, unknown>;
    const rec = Object.fromEntries(INSPECTION_FIELDS.filter((k) => b[k] !== undefined).map((k) => [k, b[k]])) as Record<string, unknown>;
    if (typeof rec.asset_id !== 'string' || !assetIds(p).has(rec.asset_id)) fail('Choose an asset from this uploaded site.');
    const at = Date.parse(String(rec.timestamp));
    const text = (k: string) => (typeof rec[k] === 'string' ? (rec[k] as string).trim() : '');
    if (!Number.isFinite(at) || at > Date.now() + 60_000 || !text('source_reference') || !text('notes')) fail('Use a non-future timestamp, source reference and condition notes.');
    if (!text('inspector')) fail('Inspector must not be blank.');
    if (!METHODS.includes(String(rec.method)) || !SOURCE_TYPES.includes(String(rec.source_type)) || !DEBRIS.includes(String(rec.debris_category))) fail('Choose the inspection method, evidence source and debris category.');
    const coverage = rec.visible_grate_coverage_fraction;
    if (coverage !== undefined && coverage !== null) {
      if (!p.site.inlets.some((i) => i.inlet_id === rec.asset_id)) fail('Grate coverage applies only to an inlet.');
      if (typeof coverage !== 'number' || !(coverage >= 0 && coverage <= 1)) fail('Grate coverage must be between 0 and 1.');
    }
    const value = { ...rec, timestamp: new Date(at).toISOString(), visible_grate_coverage_fraction: coverage ?? null, inspection_id: 'inspection_' + randomHex(), created_at: now(), model_version_id: p.model_version_id, is_verified_site_model: false, media: [], media_urls: [] };
    await store.putRecord('inspections', p.project_id, { id: value.inspection_id, ...value });
    return value as unknown as InspectionRecord;
  };

  const addProposal = async (p: StoredProject, body: unknown): Promise<SiteProposal> => {
    const b = (body ?? {}) as Record<string, unknown>;
    const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : '');
    if (!assetIds(p).has(str('asset_id')) || !str('scope').trim() || !str('owner').trim() || !str('justification').trim()) fail('Choose an uploaded asset and enter scope, owner and reason.');
    const estimate = b.estimate_myr ?? null;
    if (estimate !== null && !(typeof estimate === 'number' && Number.isFinite(estimate) && estimate >= 0)) fail('The estimate must be a number of 0 or more, or blank.');
    const baselineId = str('baseline_run_id') || null;
    const candidateId = str('candidate_run_id') || null;
    if (!!baselineId !== !!candidateId) fail('Attach both baseline and candidate, or neither.');
    let comparison: unknown = null;
    if (baselineId && candidateId) {
      const [base, cand] = await Promise.all([store.getRun(baselineId), store.getRun(candidateId)]);
      const invalid = 'Runs must be a baseline and intervention from this project.';
      if (!base || !cand) fail(RUN_NOT_RETAINED);
      if (base!.projectId !== p.project_id || cand!.projectId !== p.project_id) fail(invalid);
      const a = base!.run.input_snapshot as { intervention?: unknown };
      const c = cand!.run.input_snapshot as { intervention?: { changes: Change[] } | null };
      if (a.intervention !== null || !c.intervention) fail(invalid);
      const changes = c.intervention!.changes;
      if (changes.length !== 1 || changes[0].asset_id !== str('asset_id')) fail('Proposal target must match the candidate pipe.');
      if (base!.run.status !== 'succeeded' || cand!.run.status !== 'succeeded') fail('Both attached runs must have finished successfully.');
      const [baseResults, candResults] = await Promise.all([store.getRunResults(baselineId), store.getRunResults(candidateId)]);
      if (!baseResults || !candResults) fail(RUN_NOT_RETAINED);
      const [expected, reference] = await Promise.all([sha256Hex(canonicalJson(snapshotFor(p, { changes: [changes[0]] }))), sha256Hex(canonicalJson(snapshotFor(p, null)))]);
      if (expected !== cand!.run.input_hash || reference !== base!.run.input_hash) fail('Candidate inputs do not match the declared change and project.');
      comparison = {
        baseline: { run_id: base!.run.run_id, input_hash: base!.run.input_hash, metrics: baseResults!.metrics },
        candidate: { run_id: cand!.run.run_id, input_hash: cand!.run.input_hash, metrics: candResults!.metrics },
        changes,
      };
    }
    const inspections = await records<InspectionRecord>('inspections', p.project_id);
    const value = {
      asset_id: str('asset_id'), scope: str('scope'), owner: str('owner'), justification: str('justification'),
      baseline_run_id: baselineId, candidate_run_id: candidateId, estimate_myr: estimate as number | null, estimate_source: str('estimate_source'),
      proposal_id: 'proposal_' + randomHex(), project_id: p.project_id, model_version_id: p.model_version_id, created_at: now(), status: 'Draft' as const,
      estimate_basis: estimate !== null ? 'illustrative' : 'unknown', comparison,
      inspection_snapshot: inspections.filter((i) => i.asset_id === str('asset_id')),
      manifest: p.manifest, model_hash: p.model_hash, limitations: p.assumptions,
    };
    await store.putRecord('proposals', p.project_id, { id: value.proposal_id, ...value });
    return value;
  };

  /** Starts a run; `outcome` never rejects and resolves with the final record (and results when they were stored). */
  const begin = async (projectId: string, body: unknown): Promise<{ run_id: string; outcome: Promise<{ run: Run; results: RunResults | null }> }> => {
    const p = await project(projectId);
    const b = (body ?? {}) as { acknowledge_assumptions?: unknown; pipe_id?: unknown; diameter_m?: unknown };
    if (b.acknowledge_assumptions !== true) fail('Review and acknowledge the disclosed modelling assumptions first.');
    const pipeId = typeof b.pipe_id === 'string' && b.pipe_id ? b.pipe_id : null;
    const diameter = b.diameter_m ?? null;
    if (!!pipeId !== (diameter !== null)) fail('Supply both pipe ID and diameter, or neither for the baseline.');
    if (diameter !== null && !(typeof diameter === 'number' && Number.isFinite(diameter) && diameter > 0 && diameter <= 5)) fail('The pipe diameter must be more than 0 m and at most 5 m.');
    if (!p.simulation_ready) fail('This project is missing hydraulic inputs. Review Evidence & inputs.');
    const built = buildSiteFromFiles(p.sources);
    if (!built.site) fail(`The saved files no longer build a site: ${built.report.errors.join(' ')}`);
    const rain = stormFromInp(p.sources.inp.text);
    if (!rain.storm) fail(rain.errors.join(' ') || 'The SWMM file has no rainfall the subcatchments use.');
    let site = built.site!;
    let change: Change | null = null;
    if (pipeId) {
      const before = p.site.pipes.find((x) => x.conduit_id === pipeId);
      if (!before) fail(`Unknown pipe ${pipeId}.`);
      site = withPipeDiameter(site, pipeId, diameter as number);
      change = { asset_id: pipeId, before: before!.diameter_m, after: diameter as number };
    }
    const snapshot = snapshotFor(p, change ? { changes: [change] } : null);
    const started = now();
    const run: Run = {
      run_id: 'run_' + randomHex(), status: 'running', model_version_id: p.model_version_id, input_snapshot: snapshot, input_hash: await sha256Hex(canonicalJson(snapshot)),
      engine: ENGINE, engine_version: ENGINE_VERSION, is_verified_site_model: false, assumptions: p.assumptions, warnings: [], error: null,
      storm_id: 'uploaded_rainfall', debris_scenario_id: null, tailwater_case: 'normal', created_at: started,
    };
    startedHere.add(run.run_id);
    active.add(run.run_id);
    await store.putRun({ run, projectId: p.project_id });
    const failedRun = (code: string, message: string): Run => ({ ...run, status: 'failed', error: { code, message } });
    const outcome = (async () => {
      let final: { run: Run; results: RunResults | null };
      try {
        const out = await runSite(runner, run.run_id, site, rain.storm!);
        const results: RunResults = { frames: out.frames, metrics: { ...out.metrics, model_version_id: p.model_version_id }, depth: out.depth };
        final = { run: { ...run, status: 'succeeded', warnings: results.metrics.warnings }, results };
      } catch (e) {
        final = { run: failedRun('ENGINE_ERROR', runErrorMessage(e)), results: null };
      }
      try {
        if (final.results) await store.putRunResults(run.run_id, final.results);
        await store.putRun({ run: final.run, projectId: p.project_id });
      } catch (e) {
        // Record a small failed run so it does not stay "running". Only a quota error means the storage is full.
        const detail = e instanceof Error ? e.message : String(e);
        final = {
          run:
            e instanceof DOMException && e.name === 'QuotaExceededError'
              ? failedRun('STORAGE_FULL', `The results could not be saved: this browser's storage for the site is full (${detail}). Delete old projects or free disk space, then run again.`)
              : failedRun('STORAGE_ERROR', `The results could not be saved in this browser (${detail}). Reload the page and run again.`),
          results: null,
        };
        try {
          await store.putRun({ run: final.run, projectId: p.project_id });
        } catch (again) {
          console.warn('Could not record the failed local run:', again);
        }
      } finally {
        active.delete(run.run_id);
      }
      await prune(p.project_id);
      return final;
    })();
    outcomes.add(outcome);
    void outcome.finally(() => outcomes.delete(outcome));
    return { run_id: run.run_id, outcome };
  };

  const startRun: LocalSiteApi['startRun'] = async (projectId, body) => {
    const { run_id, outcome } = await begin(projectId, body);
    return { run_id, finished: outcome.then(() => undefined) };
  };

  const results = async (runId: string): Promise<{ run: Run; results: RunResults }> => {
    const r = await getRun(runId);
    if (r.run.status !== 'succeeded') fail(`Results are not ready for run ${runId} (${r.run.status}).`);
    const stored = (await store.getRunResults(runId)) ?? fail(RUN_NOT_RETAINED);
    return { run: r.run, results: stored };
  };

  const request = async <T>(rawPath: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    if (signal?.aborted) throw aborted();
    const path = rawPath.split('?')[0].replace(/\/+$/, '');
    const post = body !== undefined;
    const seg = path.split('/').slice(1);
    const unknown = () => fail(`Unknown local site request: ${rawPath}`);
    let value: unknown;
    if (seg[0] === 'api' && seg[1] === 'site-projects') {
      const [id, sub, ...rest] = seg.slice(2);
      if (rest.length) unknown();
      if (id === undefined) value = post ? await createProject(body) : { items: newestFirst((await store.listProjects()).map(summary)) };
      else if (id === 'inspect' && post && sub === undefined) {
        const { name, files } = readSources(body);
        value = await inspectFiles(name, files);
      } else if (sub === undefined && !post) value = publicProject(await project(id));
      else {
        const p = await project(id);
        if (sub === 'sources' && !post) value = { name: p.name, files: (['inp', 'geojson', 'asc'] as const).flatMap((k) => (p.sources[k] ? [{ ...p.sources[k]!, role: { inp: 'swmm', geojson: 'layout', asc: 'height' }[k] }] : [])) };
        else if (sub === 'inspections') value = post ? await addInspection(p, body) : { items: await records('inspections', p.project_id) };
        else if (sub === 'proposals') value = post ? await addProposal(p, body) : { items: await records('proposals', p.project_id) };
        else if (sub === 'simulations') {
          if (post) {
            const started = await startRun(p.project_id, body);
            started.finished.catch(() => {});
            value = { run_id: started.run_id, status: 'running' };
          } else value = { items: await listRuns(p.project_id) };
        }
        else unknown();
      }
    } else if (seg[0] === 'api' && seg[1] === 'simulations' && seg[2] && !post && seg.length <= 4) {
      const runId = seg[2];
      if (seg[3] === undefined) value = (await getRun(runId)).run;
      else if (seg[3] === 'frames') {
        const r = await results(runId);
        const m = r.results.metrics;
        value = { run_id: runId, model_version_id: r.run.model_version_id, result_type: 'simulated', engine: ENGINE, engine_version: ENGINE_VERSION, is_verified_site_model: false, assumptions: m.assumptions, warnings: m.warnings, status_definitions: m.status_definitions, frames: r.results.frames } satisfies SimulationFramesResponse;
      } else if (seg[3] === 'results') {
        const r = await results(runId);
        value = { frames: r.results.frames, metrics: r.results.metrics, depth: r.results.depth ?? null };
      } else if (seg[3] === 'metrics') value = (await results(runId)).results.metrics;
      else unknown();
    } else unknown();
    if (signal?.aborted) throw aborted();
    return value as T;
  };

  const execute: LocalSiteApi['execute'] = async (projectId, body, onStatus, signal) => {
    if (signal.aborted) throw new Error('Calculation cancelled.');
    const { run_id, outcome } = await begin(projectId, body);
    const t0 = Date.now();
    const say = () => onStatus(`Calculating in this browser · ${run_id} · ${Math.round((Date.now() - t0) / 1000)} s (a run takes about 20–30 s)`);
    say();
    const tick = setInterval(say, 1000);
    const final = await new Promise<{ run: Run; results: RunResults | null }>((resolve, reject) => {
      const abort = () => reject(new Error('Calculation cancelled. It keeps running in this browser and will appear in Retained runs.'));
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      void outcome.then(resolve).finally(() => signal.removeEventListener('abort', abort));
    }).finally(() => clearInterval(tick));
    if (final.run.status !== 'succeeded' || !final.results) fail(final.run.error?.message ?? 'Engine calculation failed.');
    return { run: final.run as SimulationRun, frames: final.results!.frames, metrics: final.results!.metrics, depth: final.results!.depth };
  };

  const uploadMedia: LocalSiteApi['uploadMedia'] = async (projectId, inspectionId, file) => {
    const p = await project(projectId);
    const all = (await store.listRecords('inspections', p.project_id)) as ({ id: string } & InspectionRecord)[];
    const rec = all.find((x) => x.inspection_id === inspectionId) ?? fail('Unknown site inspection.');
    if (!file.size || file.size > MAX_MEDIA_BYTES) fail('Use a nonempty attachment up to 10 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const head = (sig: number[], at = 0) => sig.every((v, i) => bytes[at + i] === v);
    const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
    const mime = head([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? 'image/png'
      : head([0xff, 0xd8, 0xff]) ? 'image/jpeg'
      : head(ascii('%PDF-')) ? 'application/pdf'
      : head(ascii('RIFF')) && head(ascii('WEBP'), 8) ? 'image/webp'
      : null;
    if (!mime || (file.type && file.type !== mime && file.type !== 'application/octet-stream')) fail('Use PNG, JPEG, WebP or PDF with a matching file signature.');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const mediaId = 'media_' + randomHex();
    const item: InspectionMediaItem & { inspection_id: string; source_type: string } = {
      media_id: mediaId, inspection_id: inspectionId, filename: (file.name || 'evidence').replace(/\\/g, '/').split('/').pop()!.slice(0, 180), content_type: mime!, size_bytes: bytes.length,
      sha256: [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join(''), created_at: now(), source_type: rec.source_type,
      url: `/api/site-projects/${p.project_id}/inspections/${inspectionId}/media/${mediaId}`,
    };
    await store.putMedia(mediaId, new Blob([bytes], { type: mime! }));
    await store.putRecord('inspections', p.project_id, { ...rec, media: [...(rec.media ?? []), item], media_urls: [...(rec.media_urls ?? []), item.url] });
    return item;
  };

  const sites = new Map<string, Promise<SiteSpec>>();
  const siteSpec: LocalSiteApi['siteSpec'] = (projectId) => {
    let s = sites.get(projectId);
    if (!s) {
      s = project(projectId).then((p) => {
        const built = buildSiteFromFiles(p.sources);
        return built.site ?? fail(`The saved files no longer build a site: ${built.report.errors.join(' ')}`);
      });
      s.catch(() => sites.delete(projectId));
      sites.set(projectId, s);
    }
    return s;
  };

  /** A simulated fix kept in memory until accepted or discarded. */
  interface KeptFix { runId: string; intervention: Intervention; results: RunResults; accepted: Run | null }
  /** The current analysis per project; a new analysis or `discardAnalysis` replaces it. */
  const analyses = new Map<string, { results: Map<string, KeptFix> }>();

  /** Rejects with an AbortError as soon as `signal` aborts. */
  const untilAbort = <T>(work: Promise<T>, signal: AbortSignal) =>
    new Promise<T>((resolve, reject) => {
      const abort = () => reject(aborted());
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });

  /** The baseline to analyse: the given run, the newest stored baseline, or a new baseline run (saved). */
  const baselineFor = async (p: StoredProject, runId: string | undefined, log: (t: string) => void, signal: AbortSignal): Promise<{ run: Run; results: RunResults }> => {
    const isBaseline = (r: Run) => (r.input_snapshot as { intervention?: unknown } | undefined)?.intervention === null;
    if (runId) {
      const r = await results(runId);
      if (!isBaseline(r.run) || (await store.getRun(runId))?.projectId !== p.project_id) fail('Choose a baseline run of this project to analyse.');
      return r;
    }
    for (const r of await listRuns(p.project_id)) {
      if (r.status !== 'succeeded' || !isBaseline(r)) continue;
      const stored = await store.getRunResults(r.run_id);
      if (stored) return { run: r, results: stored };
    }
    log('No baseline run stored; running the baseline first…');
    const { outcome } = await begin(p.project_id, { acknowledge_assumptions: true });
    const final = await untilAbort(outcome, signal);
    if (final.run.status !== 'succeeded' || !final.results) fail(final.run.error?.message ?? 'Baseline calculation failed.');
    return { run: final.run, results: final.results! };
  };

  const analyse: LocalSiteApi['analyse'] = async (projectId, onEvent, signal, baselineRunId) => {
    if (signal.aborted) throw aborted();
    const p = await project(projectId);
    const session = { results: new Map<string, KeptFix>() };
    analyses.set(p.project_id, session);
    const emit = (e: AnalysisEvent) => {
      if (!signal.aborted) onEvent(e);
    };
    const log = (text: string) => emit({ type: 'log', text });
    try {
      const site = await siteSpec(p.project_id);
      const rain = stormFromInp(p.sources.inp.text);
      if (!rain.storm) fail(rain.errors.join(' ') || 'The SWMM file has no rainfall the subcatchments use.');
      const baseline = await baselineFor(p, baselineRunId, log, signal);
      if (signal.aborted) throw aborted();

      // Hotspot street depth per frame (stored grids every 2nd frame, nearest earlier) for the 0.15 m ponding rule.
      const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site, storm: rain.storm!, blockage: {} });
      const cell = sc.network.nodes.find((n) => n.id === site.hotspotNodeId)?.cell;
      const { frames, metrics, depth } = baseline.results;
      const hotspotStreetDepthM = cell === undefined ? undefined : frames.map((f) => depthAt(depth, f.timestamp_s)?.[cell] ?? 0);
      const diagnosis = diagnose(frames, metrics as SimulationMetricsResponse & { j07_peak_depth_m: number; homes_flooded: number }, site, { hotspotStreetDepthM });
      const before: Outcome = { homesFlooded: diagnosis.homesFlooded, floodVolumeM3: diagnosis.floodVolumeM3, hotspotPeakM: diagnosis.hotspotPeakM };
      log(logLines.readingBaseline(diagnosis));
      for (const line of logLines.bottlenecks(diagnosis, site)) log(line);

      // Candidates the engine can apply; one it rejects is logged and skipped.
      type Prepared = { fix: FixAction; problemId: string; label: string; costRM: number; location: { x: number; y: number }; site: SiteSpec; intervention: Intervention };
      const prepared: Prepared[] = [];
      for (const c of generateCandidates(diagnosis, site)) {
        const label = fixLabel(c.fix, site);
        try {
          prepared.push({ ...c, label, costRM: fixCostRM(c.fix, site), location: fixLocation(c.fix, site), site: applyFix(site, c.fix), intervention: { kind: c.fix.kind, label, changes: changesOf(c.fix, site) } });
        } catch (e) {
          log(`${label}: skipped: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      if (!prepared.length) {
        log(logLines.noFlooding());
        return { baselineRunId: baseline.run.run_id, diagnosis, ranked: [], noEffect: [] };
      }
      const n = prepared.length;
      log(logLines.generating(prepared.map((c) => c.label)));
      emit({ type: 'progress', done: 0, total: n });

      const simulated: (RankedFix | undefined)[] = new Array(n);
      const failures: string[] = [];
      let done = 0;
      const pool = runPooled(prepared, analysisPool(), async (engine, c, i) => {
        log(logLines.simulating(i + 1, n, c.label));
        const runId = 'run_' + randomHex();
        try {
          const out = await runSite(engine, runId, c.site, rain.storm!);
          const kept: RunResults = { frames: out.frames, metrics: { ...out.metrics, model_version_id: p.model_version_id }, depth: out.depth };
          session.results.set(runId, { runId, intervention: c.intervention, results: kept, accepted: null });
          const m = kept.metrics as SimulationMetricsResponse & { j07_peak_depth_m: number; homes_flooded: number };
          const outcome: Outcome = { homesFlooded: m.homes_flooded, floodVolumeM3: m.total_flooding_volume_m3, hotspotPeakM: m.j07_peak_depth_m };
          const improved = isImprovement(before, outcome);
          simulated[i] = { fix: c.fix, problemId: c.problemId, label: c.label, costRM: c.costRM, outcome, location: c.location, metrics: kept.metrics, resultKey: runId };
          log(logLines.result(c.label, diagnosis.hotspotNodeId, outcome, improved));
          emit({ type: 'candidate', index: i, fix: c.fix, label: c.label, costRM: c.costRM, metrics: kept.metrics, improved });
        } catch (e) {
          failures.push(`${c.label}: ${runErrorMessage(e)}`);
          log(`${c.label}: failed: ${runErrorMessage(e)}`);
        }
        emit({ type: 'progress', done: ++done, total: n });
      }, () => signal.aborted);
      pool.catch(() => {});
      await untilAbort(pool, signal);
      if (signal.aborted) throw aborted();
      const tested = simulated.filter((r): r is RankedFix => !!r);
      if (!tested.length) fail(`No candidate fix could be simulated. ${failures.join(' ')}`);

      log(logLines.ranking());
      const { ranked, noEffect } = rankResults(before, tested);
      log(ranked.length ? logLines.recommended(ranked[0], before, diagnosis.hotspotNodeId) : logLines.noImprovingFix());
      return { baselineRunId: baseline.run.run_id, diagnosis, ranked, noEffect: noEffect.map((r) => r.label) };
    } catch (e) {
      if (analyses.get(p.project_id) === session) analyses.delete(p.project_id);
      throw signal.aborted ? aborted() : e;
    }
  };

  const acceptFix: LocalSiteApi['acceptFix'] = async (projectId, resultKey) => {
    const p = await project(projectId);
    const kept = analyses.get(p.project_id)?.results.get(resultKey) ?? fail('This fix result is no longer kept in this page. Run the analysis again.');
    if (kept.accepted) return kept.accepted as SimulationRun;
    const snapshot = snapshotFor(p, kept.intervention);
    const run: Run = {
      run_id: kept.runId, status: 'succeeded', model_version_id: p.model_version_id, input_snapshot: snapshot, input_hash: await sha256Hex(canonicalJson(snapshot)),
      engine: ENGINE, engine_version: ENGINE_VERSION, is_verified_site_model: false, assumptions: p.assumptions, warnings: kept.results.metrics.warnings, error: null,
      storm_id: 'uploaded_rainfall', debris_scenario_id: null, tailwater_case: 'normal', created_at: now(),
    };
    try {
      await store.putRunResults(run.run_id, kept.results);
      await store.putRun({ run, projectId: p.project_id });
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      try {
        await store.deleteRun(run.run_id);
      } catch {
        // Nothing more to undo; the run was not recorded.
      }
      fail(e instanceof DOMException && e.name === 'QuotaExceededError'
        ? `The fix run could not be saved: this browser's storage for the site is full (${detail}). Delete old projects or free disk space.`
        : `The fix run could not be saved in this browser (${detail}).`);
    }
    kept.accepted = run;
    await prune(p.project_id);
    return run as SimulationRun;
  };

  return {
    request,
    execute,
    siteSpec,
    analyse,
    acceptFix,
    discardAnalysis: (projectId) => void analyses.delete(projectId),
    startRun,
    uploadMedia,
    mediaUrl: async (mediaId) => URL.createObjectURL((await store.getMedia(mediaId)) ?? fail('This attachment is not stored in this browser.')),
    runDepth: async (runId) => (await store.getRunResults(runId))?.depth ?? null,
    whenIdle: async () => {
      while (outcomes.size) await Promise.all([...outcomes]);
    },
  };
}

let instance: LocalSiteApi | null = null;
/** The browser's local site API, backed by IndexedDB. */
export function getLocalSiteApi(): LocalSiteApi {
  instance ??= createLocalSiteApi(new IndexedDbSiteStore());
  return instance;
}

export const localRequest = <T>(path: string, body?: unknown, signal?: AbortSignal) => getLocalSiteApi().request<T>(path, body, signal);
export const localExecute = (projectId: string, body: unknown, onStatus: (status: string) => void, signal: AbortSignal) => getLocalSiteApi().execute(projectId, body, onStatus, signal);
export const localUploadMedia = (projectId: string, inspectionId: string, file: Blob & { name?: string }) => getLocalSiteApi().uploadMedia(projectId, inspectionId, file);
/** Opens a stored attachment in a new tab. */
export async function openLocalMedia(mediaId: string): Promise<void> {
  const url = await getLocalSiteApi().mediaUrl(mediaId);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
