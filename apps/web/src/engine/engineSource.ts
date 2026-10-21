import { SimRunError, SimRunner, type WorkerLike } from '@floodops/engine/client/runner';
import type { TailwaterCase } from '@floodops/engine/scenario/config';
import { buildScenario, buildTownship, effectiveBlockage, type ScenarioOptions } from '@floodops/engine/scenario/index';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import { ASSETS, toTeam } from '@floodops/engine/scenario/layout';
import { TAMAN_KYRA, type SiteSpec } from '@floodops/engine/scenario/site';
import { STORMS, type StormId } from '@floodops/engine/scenario/storms';
import type {
  AssetConduit,
  AssetInlet,
  AssetNode,
  BootstrapResponse,
  HealthResponse,
  SimulationCreateRequest,
  SimulationFrame,
  SimulationFramesResponse,
  SimulationMetricsResponse,
  SimulationRun,
  TownshipAssetsResponse,
} from '../types';
import { makeContext, toTeamFrame, toTeamMetrics, type EngineMetricsExtras } from './frameAdapter';

export const MODEL_VERSION = 'taman_kyra_synthetic_v1';
export const DEBRIS_CASES = [0, 0.2, 0.4, 0.6].map((f) => ({ id: f === 0 ? 'engine_d07_clean' : `engine_d07_${Math.round(f * 100)}pct`, fraction: f }));
const MAX_RUNS = 2;
const CAPS = { assets: true, storm_creation: false, simulations: true, inspections: true, debris: true, comparisons: true, interventions:true };

interface RunRecord {
  status: SimulationRun['status'];
  frames?: SimulationFrame[];
  metrics?: SimulationMetricsResponse & EngineMetricsExtras;
  surfaces?: Map<number, Float32Array>;
  error?: string;
  modelVersionId: string;
}

class EngineSource {
  private runner: SimRunner | null = null;
  private interventions: InterventionId[] = [];
  private runs = new Map<string, RunRecord>();
  private counter = 0;
  private site: SiteSpec = TAMAN_KYRA;

  private getRunner(): SimRunner {
    if (!this.runner) {
      this.runner = new SimRunner(
        () => new Worker(new URL('./workers/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
      );
    }
    return this.runner;
  }

  setSite(site: SiteSpec | null): void {
    this.site = site ?? TAMAN_KYRA;
    this.interventions = [];
  }

  getSite(): SiteSpec {
    return this.site;
  }

  setInterventions(ids: InterventionId[]): void {
    this.interventions = [...ids];
  }

  getInterventions(): InterventionId[] {
    return [...this.interventions];
  }

  blockageForDebris(debrisId: string | null | undefined): Record<string, number> {
    const c = DEBRIS_CASES.find((d) => d.id === debrisId) ?? DEBRIS_CASES[2];
    return this.site.focusInletId ? { [this.site.focusInletId]: c.fraction } : {};
  }

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      api_version: 'engine',
      swmm: { available: true, engine: 'FloodOps TS engine', engine_version: '1.0', execution_verified: true, message: `Local TypeScript engine (${this.site.builtIn ? 'Taman Kyra' : this.site.label})` },
      capabilities: CAPS,
    };
  }

  getBootstrap(): BootstrapResponse {
    const site = this.site;
    const focus = site.focusInletId ?? 'inlet';
    const focusLabel = site.builtIn ? 'D07' : focus;
    return {
      api_version: 'engine',
      township_id: site.builtIn ? 'taman_kyra_demo' : site.key,
      model_versions: [
        { model_version_id: site.builtIn ? MODEL_VERSION : 'imported_site', name: site.builtIn ? 'Illustrative Taman Kyra drainage zone (TS engine)' : `Imported site: ${site.label}`, source_type: site.builtIn ? 'synthetic' : 'imported', is_verified_site_model: false, readiness: 'execution_verified' },
      ],
      storms: (Object.keys(STORMS) as StormId[]).map((id) => {
        const s = STORMS[id];
        const peak = Math.max(...s.intensity) * 3.6e6;
        return {
          storm_id: id,
          name: s.label,
          source_type: s.returnPeriod ? 'literature_derived' : 'synthetic',
          parameters: { intensity_mmh: Math.round(peak), duration_s: s.intensity.length * s.blockS, pattern: s.returnPeriod ? 'msma_alternating_block' : 'constant' },
        };
      }),
      debris_scenarios: DEBRIS_CASES.map((d) => ({
        debris_scenario_id: d.id,
        name: d.fraction === 0 ? `${focusLabel} clean` : `${focusLabel} ${Math.round(d.fraction * 100)}% blocked`,
        source_type: 'assumed',
        parameters: { inlet_id: site.focusInletId ?? 'inlet', hydraulic_inlet_clogging_fraction: d.fraction, parameter_status: 'assumed_not_calibrated' },
        swmm_supported: true,
      })),
      tailwater_cases: (['normal', 'high'] as TailwaterCase[]).map((t) => ({
        tailwater_case: t,
        name: t === 'normal' ? 'Normal canal level' : 'High canal level',
        source_type: 'assumed',
        parameters: { depth_above_outfall_invert_m: site.tailwater[t] },
      })),
      capabilities: CAPS,
      assumptions: [
        site.builtIn
          ? 'Local TypeScript engine on the Taman Kyra synthetic network; not a surveyed site model.'
          : `Local TypeScript engine on the imported site ${site.label}; not a verified site model.`,
      ],
    };
  }

  getTownshipAssets(): TownshipAssetsResponse {
    if (!this.site.builtIn) {
      const a = this.site.assets;
      return {
        township_id: this.site.key,
        model_version_id: 'imported_site',
        source_type: 'imported',
        is_verified_site_model: false,
        coordinate_system: 'local_metres_east_north_elevation',
        // Engine asset literals are structurally wider than the web response types.
        nodes: a.nodes as unknown as AssetNode[],
        inlets: a.inlets as unknown as TownshipAssetsResponse['inlets'],
        conduits: a.conduits as unknown as AssetConduit[],
        assumptions: ['Generated from uploaded files: ' + this.site.label],
      };
    }
    const t = buildTownship(this.interventions);
    const known = new Set(ASSETS.nodes.map((n) => n.node_id));
    const knownPipes = new Set(ASSETS.conduits.map((c) => c.conduit_id));
    const extraNodes: AssetNode[] = t.network.nodes
      .filter((n) => !known.has(n.id))
      .map((n) => {
        const p = toTeam(n.x, n.y);
        const ground = t.grid.z[n.cell];
        return { node_id: n.id, node_type: 'storage', position_m: { x: p.x, y: p.y, z: n.invert }, invert_elevation_m: n.invert, ground_elevation_m: ground, max_depth_m: n.maxDepth, source_type: 'assumed' };
      });
    const extraPipes: AssetConduit[] = t.network.pipes
      .filter((p) => !knownPipes.has(p.id))
      .map((p) => ({ conduit_id: p.id, from_node_id: p.from, to_node_id: p.to, diameter_m: p.diameter, length_m: p.length, manning_n: p.n, source_type: 'assumed' }));
    const upsized = t.network.pipes.find((p) => p.id === 'PIPE-P07')!.diameter;
    return {
      township_id: 'taman_kyra_demo',
      model_version_id: MODEL_VERSION,
      source_type: 'synthetic',
      is_verified_site_model: false,
      coordinate_system: 'local_metres_east_north_elevation',
      nodes: [...(ASSETS.nodes as unknown as AssetNode[]), ...extraNodes],
      inlets: ASSETS.inlets as unknown as TownshipAssetsResponse['inlets'],
      conduits: [...(ASSETS.conduits as unknown as AssetConduit[]).map((c) => (c.conduit_id === 'PIPE-P07' ? { ...c, diameter_m: upsized } : c)), ...extraPipes],
      assumptions: ['Synthetic network by Tay Zheheng; intervention assets added by the TS engine.'],
    };
  }

  async createSimulation(req: SimulationCreateRequest): Promise<{ run_id: string; status: string }> {
    if (!(req.storm_id in STORMS)) throw new Error(`[ENGINE] Unknown storm ${req.storm_id}`);
    const stormId = req.storm_id as StormId;
    const opts: ScenarioOptions = { tailwater: (req.tailwater_case === 'high' ? 'high' : 'normal') as TailwaterCase, blockage: this.blockageForDebris(req.debris_scenario_id), site: this.site };
    const ids = this.getInterventions();
    const runId = `engine-${++this.counter}`;
    const rec: RunRecord = { status: 'running', modelVersionId: this.site.builtIn ? MODEL_VERSION : 'imported_site' };
    const site = this.site;
    this.runs.set(runId, rec);
    // Keep only the newest runs: each holds every frame's depth grid.
    while (this.runs.size > MAX_RUNS) this.runs.delete(this.runs.keys().next().value as string);
    const sc = buildScenario(ids, stormId, [], opts);
    const ctx = makeContext(sc.network, sc.grid, effectiveBlockage(ids, opts), this.site.assets.inlets as unknown as AssetInlet[]) // engine inlet literals are wider than the web type;
    this.getRunner()
      .run(ids, stormId, undefined, [], opts)
      .then((r) => {
        const frames = r.frames.map((f) => toTeamFrame(f, ctx));
        rec.frames = frames;
        rec.metrics = toTeamMetrics(runId, r.metrics, frames, ctx, sc.frameEveryS, site);
        rec.surfaces = new Map(r.frames.map((f) => [f.t, f.depth]));
        rec.status = 'succeeded';
      })
      .catch((e: unknown) => {
        rec.status = 'failed';
        rec.error = e instanceof SimRunError && e.step >= 0 ? `Engine stopped at step ${e.step}: ${e.message}` : e instanceof Error ? e.message : String(e);
      });
    return { run_id: runId, status: 'running' };
  }

  async getSimulation(runId: string): Promise<SimulationRun> {
    const rec = this.runs.get(runId);
    if (!rec) throw new Error(`[ENGINE] Unknown run ${runId}`);
    return {
      run_id: runId,
      status: rec.status,
      model_version_id: rec.modelVersionId,
      engine: 'FloodOps TS engine',
      engine_version: '1.0',
      is_verified_site_model: false,
      error: rec.error ? { code: 'ENGINE_ERROR', message: rec.error } : null,
    };
  }

  async getSimulationFrames(runId: string): Promise<SimulationFramesResponse> {
    const rec = this.runs.get(runId);
    if (!rec?.frames) throw new Error(`[ENGINE] RESULTS_NOT_READY ${runId}`);
    return {
      run_id: runId,
      model_version_id: rec.modelVersionId,
      result_type: 'simulated',
      engine: 'FloodOps TS engine',
      engine_version: '1.0',
      is_verified_site_model: false,
      assumptions: rec.metrics?.assumptions ?? [],
      warnings: rec.metrics?.warnings ?? [],
      status_definitions: rec.metrics?.status_definitions ?? {},
      frames: rec.frames,
    };
  }

  async getSimulationMetrics(runId: string): Promise<SimulationMetricsResponse> {
    const rec = this.runs.get(runId);
    if (!rec?.metrics) throw new Error(`[ENGINE] RESULTS_NOT_READY ${runId}`);
    return rec.metrics;
  }

  /** Depth grid of a finished run at a frame time (nearest earlier frame), for the water surface. */
  surfaceAt(runId: string | null, timestampS: number): Float32Array | null {
    const surfaces = runId ? this.runs.get(runId)?.surfaces : undefined;
    if (!surfaces) return null;
    let best: Float32Array | null = null;
    let bestT = -Infinity;
    for (const [t, d] of surfaces) {
      if (t <= timestampS + 1e-6 && t > bestT) {
        best = d;
        bestT = t;
      }
    }
    return best;
  }
}

export const engineSource = new EngineSource();
