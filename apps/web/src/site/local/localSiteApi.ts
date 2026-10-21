import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { stormFromInp } from '@floodops/engine/import/stormFromInp';
import { withPipeDiameter } from '@floodops/engine/scenario/siteVariants';
import type { InspectionMediaItem, InspectionRecord, SimulationFramesResponse, SimulationRun } from '../../types';
import type { ProjectSummary, SiteProject, SiteProposal, SiteResult } from '../types';
import { canonicalJson, inspectFiles, randomHex, readSources, sha256Hex } from './preview';
import { browserRunner, runErrorMessage, runSite, type EngineRunner } from './runs';
import { IndexedDbSiteStore, type DepthGrids, type SiteStore, type StoredProject, type StoredRun } from './store';

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

export interface LocalSiteApi {
  request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T>;
  execute(projectId: string, body: unknown, onStatus: (status: string) => void, signal: AbortSignal): Promise<SiteResult>;
  /** Starts a run; `finished` resolves once its record is final (succeeded or failed) and runs are pruned. */
  startRun(projectId: string, body: unknown): Promise<{ run_id: string; finished: Promise<void> }>;
  uploadMedia(projectId: string, inspectionId: string, file: Blob & { name?: string }): Promise<InspectionMediaItem>;
  /** An object URL for a stored attachment (revoke it when done). */
  mediaUrl(mediaId: string): Promise<string>;
  /** The street-water depth grids of a finished run (every 2nd frame), or null. */
  runDepth(runId: string): Promise<DepthGrids | null>;
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
function snapshotFor(project: SiteProject, change: Change | null) {
  return {
    project_id: project.project_id,
    model_version_id: project.model_version_id,
    model_hash: project.model_hash,
    sources: project.manifest.map((f) => ({ name: f.name, role: f.role, sha256: f.sha256 })),
    engine: ENGINE,
    engine_version: ENGINE_VERSION,
    rainfall: project.site.rainfall,
    blockage: {},
    intervention: change ? { changes: [change] } : null,
  };
}

export function createLocalSiteApi(store: SiteStore, runner: EngineRunner = browserRunner()): LocalSiteApi {
  const active = new Set<string>();

  const project = async (id: string): Promise<StoredProject> => {
    if (!/^site_[0-9a-f]{32}$/.test(id)) fail('Unknown site project.');
    return (await store.getProject(id)) ?? fail('Unknown site project.');
  };

  /** A run still marked running but not running in this page was interrupted (the page closed). */
  const settle = async (r: StoredRun): Promise<StoredRun> => {
    if (r.run.status !== 'running' || active.has(r.run.run_id)) return r;
    const next: StoredRun = { ...r, run: { ...r.run, status: 'failed', error: { code: 'INTERRUPTED', message: 'The page was closed or reloaded before this calculation finished. Run it again.' } } };
    await store.putRun(next);
    return next;
  };
  const getRun = async (id: string) => settle((await store.getRun(id)) ?? fail(`Unknown run ${id}.`));
  const listRuns = async (projectId: string) => newestFirst((await Promise.all((await store.listRuns(projectId)).map(settle))).map((r) => r.run));

  const prune = async (projectId: string) => {
    const runs = newestFirst((await store.listRuns(projectId)).map((r) => r.run));
    for (const r of runs.slice(MAX_RUNS_PER_PROJECT)) if (!active.has(r.run_id)) await store.deleteRun(r.run_id);
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
      if (!base || !cand || base.projectId !== p.project_id || cand.projectId !== p.project_id) fail(invalid);
      const a = base!.run.input_snapshot as { intervention?: unknown };
      const c = cand!.run.input_snapshot as { intervention?: { changes: Change[] } | null };
      if (a.intervention !== null || !c.intervention) fail(invalid);
      const changes = c.intervention!.changes;
      if (changes.length !== 1 || changes[0].asset_id !== str('asset_id')) fail('Proposal target must match the candidate pipe.');
      if (base!.run.status !== 'succeeded' || cand!.run.status !== 'succeeded' || !base!.metrics || !cand!.metrics) fail('Both attached runs must have finished successfully.');
      const [expected, reference] = await Promise.all([sha256Hex(canonicalJson(snapshotFor(p, changes[0]))), sha256Hex(canonicalJson(snapshotFor(p, null)))]);
      if (expected !== cand!.run.input_hash || reference !== base!.run.input_hash) fail('Candidate inputs do not match the declared change and project.');
      comparison = {
        baseline: { run_id: base!.run.run_id, input_hash: base!.run.input_hash, metrics: base!.metrics },
        candidate: { run_id: cand!.run.run_id, input_hash: cand!.run.input_hash, metrics: cand!.metrics },
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

  const startRun: LocalSiteApi['startRun'] = async (projectId, body) => {
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
    const snapshot = snapshotFor(p, change);
    const started = now();
    const run: Run = {
      run_id: 'run_' + randomHex(), status: 'running', model_version_id: p.model_version_id, input_snapshot: snapshot, input_hash: await sha256Hex(canonicalJson(snapshot)),
      engine: ENGINE, engine_version: ENGINE_VERSION, is_verified_site_model: false, assumptions: p.assumptions, warnings: [], error: null,
      storm_id: 'uploaded_rainfall', debris_scenario_id: null, tailwater_case: 'normal', created_at: started,
    };
    await store.putRun({ run, projectId: p.project_id, frames: [], metrics: null, depth: null });
    active.add(run.run_id);
    const finished = (async () => {
      let final: StoredRun;
      try {
        const out = await runSite(runner, run.run_id, site, rain.storm!);
        const metrics = { ...out.metrics, model_version_id: p.model_version_id };
        final = { run: { ...run, status: 'succeeded', warnings: metrics.warnings }, projectId: p.project_id, frames: out.frames, metrics, depth: out.depth };
      } catch (e) {
        final = { run: { ...run, status: 'failed', error: { code: 'ENGINE_ERROR', message: runErrorMessage(e) } }, projectId: p.project_id, frames: [], metrics: null, depth: null };
      }
      try {
        await store.putRun(final);
      } finally {
        active.delete(run.run_id);
      }
      await prune(p.project_id);
    })();
    return { run_id: run.run_id, finished };
  };

  const results = async (runId: string) => {
    const r = await getRun(runId);
    if (r.run.status !== 'succeeded' || !r.metrics) fail(`Results are not ready for run ${runId} (${r.run.status}).`);
    return r;
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
        else if (sub === 'simulations') value = post ? { run_id: (await startRun(p.project_id, body)).run_id, status: 'running' } : { items: await listRuns(p.project_id) };
        else unknown();
      }
    } else if (seg[0] === 'api' && seg[1] === 'simulations' && seg[2] && !post && seg.length <= 4) {
      const runId = seg[2];
      if (seg[3] === undefined) value = (await getRun(runId)).run;
      else if (seg[3] === 'frames') {
        const r = await results(runId);
        const m = r.metrics!;
        value = { run_id: runId, model_version_id: r.run.model_version_id, result_type: 'simulated', engine: ENGINE, engine_version: ENGINE_VERSION, is_verified_site_model: false, assumptions: m.assumptions, warnings: m.warnings, status_definitions: m.status_definitions, frames: r.frames } satisfies SimulationFramesResponse;
      } else if (seg[3] === 'metrics') value = (await results(runId)).metrics;
      else unknown();
    } else unknown();
    if (signal?.aborted) throw aborted();
    return value as T;
  };

  const execute: LocalSiteApi['execute'] = async (projectId, body, onStatus, signal) => {
    if (signal.aborted) throw new Error('Calculation cancelled.');
    const { run_id, finished } = await startRun(projectId, body);
    onStatus(`Calculating in this browser · ${run_id}`);
    await new Promise<void>((resolve, reject) => {
      const abort = () => reject(new Error('Calculation cancelled. It keeps running in this browser and will appear in Retained runs.'));
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, { once: true });
      finished.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
    const r = (await store.getRun(run_id)) ?? fail(`Run ${run_id} is no longer stored.`);
    if (r.run.status !== 'succeeded' || !r.metrics) fail(r.run.error?.message ?? 'Engine calculation failed.');
    return { run: r.run as SimulationRun, frames: r.frames, metrics: r.metrics! };
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

  return {
    request,
    execute,
    startRun,
    uploadMedia,
    mediaUrl: async (mediaId) => URL.createObjectURL((await store.getMedia(mediaId)) ?? fail('This attachment is not stored in this browser.')),
    runDepth: async (runId) => (await store.getRun(runId))?.depth ?? null,
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
