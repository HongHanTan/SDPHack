import { SimRunner, type WorkerLike } from '@floodops/engine/client/runner';
import { buildScenario, effectiveBlockage } from '@floodops/engine/scenario/index';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import { STORMS, type StormId } from '@floodops/engine/scenario/storms';
import { apiClient } from '../api/client';
import { makeContext, toTeamFrame, toTeamMetrics } from '../engine/frameAdapter';
import { engineSource } from '../engine/engineSource';
import { gridFingerprint } from '../engine/inputFingerprint';
import { auditEnginePair } from './inputAudit';
import type { Comparison, ComparisonResult, ScenarioSelection } from './model';

export const OPTIONS: { id: string; title: string; assets: string[]; interventions: InterventionId[]; constraint: string }[] = [
  { id: 'baseline', title: 'Current assumptions', assets: [], interventions: [], constraint: 'Reference condition; no work proposed.' },
  { id: 'desilt-d07', title: 'Clean inlet D07', assets: ['INLET-D07'], interventions: ['desilt-d07'], constraint: 'Confirm access, debris quantity, disposal and condition after cleaning.' },
  { id: 'upsize-p07', title: 'Review P07 upsizing', assets: ['PIPE-P07'], interventions: ['upsize-p07'], constraint: 'Engineer review: survey, utility conflicts, downstream capacity, access and reinstatement.' },
  { id: 'combined', title: 'Clean D07 + review P07 upsizing', assets: ['INLET-D07', 'PIPE-P07'], interventions: ['desilt-d07', 'upsize-p07'], constraint: 'Separate maintenance scope from capital approval; verify downstream constraints.' },
  { id: 'storage-tank', title: 'Review off-line storage', assets: ['NODE-J05'], interventions: ['storage-tank'], constraint: 'Engineer review: land, groundwater, structural design, access and operating responsibility.' },
  { id: 'lake-overflow', title: 'Review pond relief', assets: ['NODE-J04'], interventions: ['lake-overflow'], constraint: 'Engineer review: pond capacity, overflow route, ownership and receiving water conditions.' },
];
export async function runComparison(scenario: ScenarioSelection, onUpdate: (value: Comparison) => void, signal: AbortSignal, inspectionId?: string): Promise<Comparison> {
  const c: Comparison = { comparison_id: crypto.randomUUID(), created_at: new Date().toISOString(), scenario: { ...scenario }, results: [] };
  const update = () => { if (!signal.aborted) onUpdate(structuredClone(c)); };
  if (scenario.mode === 'mock') {
    c.results = OPTIONS.map(o => ({ id: crypto.randomUUID(), option_id: o.id, title: o.title, target_asset_ids: o.assets, status: 'unavailable', error: 'Switch to the browser engine or SWMM API to calculate a comparison. Offline replay is not a new intervention run.' })); update(); return c;
  }
  let nativeBaselineId:string|undefined;
  for (const option of OPTIONS) {
    if (signal.aborted) throw new Error('Comparison cancelled.');
    const result: ComparisonResult = { id: crypto.randomUUID(), option_id: option.id, title: option.title, target_asset_ids: option.assets, status: 'running' };
    c.results.push(result); update();
    let worker: Worker | undefined;
    const abort = () => worker?.terminate();
    signal.addEventListener('abort', abort, { once: true });
    try {
      if (scenario.mode === 'engine') {
        if (!(scenario.storm_id in STORMS)) throw new Error('Select a supported engine storm.');
        const opts = { tailwater: scenario.tailwater === 'high' ? 'high' as const : 'normal' as const, blockage: engineSource.blockageForDebris(scenario.debris_id) };
        const sc = buildScenario(option.interventions, scenario.storm_id as StormId, [], opts);
        result.input_snapshot = { scenario: { ...scenario }, engine: 'FloodOps TS engine 1.0', interventions: [...option.interventions], options: opts,
          storm: sc.storm, network: sc.network, catchments: sc.catchments,
          grid: await gridFingerprint(sc.grid), dt: sc.dt, recession_s: sc.recessionS, frame_every_s: sc.frameEveryS };
        result.input_hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(result.input_snapshot))))).map(b => b.toString(16).padStart(2, '0')).join('');
        if (signal.aborted) throw new Error('Comparison cancelled.');
        const context = makeContext(sc.network, sc.grid, effectiveBlockage(option.interventions, opts));
        const runner = new SimRunner(() => {
          worker = new Worker(new URL('../engine/workers/sim.worker.ts', import.meta.url), { type: 'module' });
          return worker as unknown as WorkerLike;
        });
        let cancel: () => void = () => {};
        const cancelled = new Promise<never>((_, reject) => { cancel = () => reject(new Error('Comparison cancelled.')); signal.addEventListener('abort', cancel, { once: true }); });
        try {
          const output = await Promise.race([runner.run(option.interventions, scenario.storm_id as StormId, undefined, [], opts), cancelled]);
          const frames = output.frames.map(f => toTeamFrame(f, context));
          result.run_id = `browser-${crypto.randomUUID()}`;
          result.metrics = toTeamMetrics(result.run_id, output.metrics, frames, context, sc.frameEveryS);
          if(option.id!=='baseline'){
            const audit=auditEnginePair(c.results[0].input_snapshot!,result.input_snapshot!);
            if(!audit.passed)throw new Error(audit.problems.join('; '));
          }
        } finally { signal.removeEventListener('abort', cancel); }
      } else {
        const bootstrap=await apiClient.getBootstrap();
        const preset = bootstrap.debris_scenarios.find(d => d.debris_scenario_id === scenario.debris_id);
        if (!preset || preset.parameters.inlet_id !== 'INLET-D07' || preset.capture_model !== 'swmm_native_custom_diversion_v1') {
          result.status = 'unavailable'; result.error = 'Select a native finite D07 inlet preset. Direct-node entry and finite inlet capture cannot be compared as a cleaning intervention.'; update(); continue;
        }
        if(option.interventions.length && !bootstrap.capabilities.interventions){result.status='unavailable';result.error='Restart or update the API to v1.4 for explicit intervention calculations.';update();continue;}
        if(!nativeBaselineId) {
          const debris=await apiClient.createDebrisScenario({name:'Shared baseline for matching intervention tests',inlet_id:'INLET-D07',storm_id:scenario.storm_id,inspection_id:inspectionId,hydraulic_inlet_clogging_fraction:preset.parameters.hydraulic_inlet_clogging_fraction});
          nativeBaselineId=debris.debris_scenario_id;
        }
        if (signal.aborted) throw new Error('Comparison cancelled.');
        const accepted = await apiClient.createSimulation({ model_version_id: scenario.model_version_id, storm_id: scenario.storm_id, debris_scenario_id: nativeBaselineId, tailwater_case: scenario.tailwater, intervention: option.interventions.length?{actions:option.interventions}:null });
        result.run_id = accepted.run_id;
        const deadline = Date.now() + 240000;
        while (true) {
          if (signal.aborted) throw new Error('Comparison cancelled. Submitted API runs remain in server history.');
          const run = await apiClient.getSimulation(accepted.run_id);
          if (run.status === 'failed') throw new Error(run.error?.message ?? 'SWMM run failed.');
          if (run.status === 'succeeded') { result.metrics = await apiClient.getSimulationMetrics(run.run_id); result.input_hash = run.input_hash; result.input_snapshot=run.input_snapshot; break; }
          if (Date.now() > deadline) throw new Error('Timed out waiting for SWMM; inspect server run history.');
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      result.status = 'succeeded';
    } catch (error) {
      delete result.metrics;
      result.status = 'failed'; result.error = error instanceof Error ? error.message : String(error);
      if (signal.aborted) { onUpdate(structuredClone(c)); throw error; }
    } finally { worker?.terminate(); signal.removeEventListener('abort', abort); }
    update();
  }
  return c;
}
