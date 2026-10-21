import { SimRunner, type WorkerLike } from '@floodops/engine/client/runner';
import { buildScenario, effectiveBlockage } from '@floodops/engine/scenario/index';
import { ASSETS } from '@floodops/engine/scenario/layout';
import { STORMS, type StormId } from '@floodops/engine/scenario/storms';
import { DEBRIS_CASES, engineSource } from '../engine/engineSource';
import { makeContext, toTeamFrame, toTeamMetrics } from '../engine/frameAdapter';
import type { ScenarioSelection } from '../maintenance/model';
import type { TownshipAssetsResponse } from '../types';
import { STORY_CASES, streetSummary, type StoryCase, type StoryRun } from './model';
import { buildRoadStudy, measureRoad, type RoadRegionId } from './roadStudy';
import { gridFingerprint } from '../engine/inputFingerprint';

/** Presentation orchestration only; all water computation stays in the existing worker engine. */
export async function runStoryCase(caseId: StoryCase, scenario: ScenarioSelection, signal: AbortSignal, onProgress: (timeS: number, totalS: number) => void): Promise<StoryRun> {
  if (scenario.mode !== 'engine') throw new Error('The guided demo uses the browser engine. Choose it explicitly to continue.');
  if (!(scenario.storm_id in STORMS) || !DEBRIS_CASES.some(d => d.id === scenario.debris_id)) throw new Error('Choose a supported storm and D07 loss hypothesis.');
  if (signal.aborted) throw new Error('Calculation cancelled.');
  const option = STORY_CASES[caseId];
  const opts = { tailwater: scenario.tailwater === 'high' ? 'high' as const : 'normal' as const, blockage: engineSource.blockageForDebris(scenario.debris_id) };
  const sc = buildScenario(option.interventions, scenario.storm_id as StormId, [], opts);
  const totalS = sc.storm.intensity.length * sc.storm.blockS + sc.recessionS;
  const inputSnapshot = { scenario: { ...scenario }, engine: 'FloodOps TS engine 1.0', interventions: [...option.interventions], options: opts,
    storm: sc.storm, network: sc.network, catchments: sc.catchments, grid: await gridFingerprint(sc.grid),
    dt: sc.dt, recession_s: sc.recessionS, frame_every_s: sc.frameEveryS };
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(inputSnapshot))))).map(b => b.toString(16).padStart(2, '0')).join('');
  if (signal.aborted) throw new Error('Calculation cancelled.');
  let worker: Worker | undefined;
  let cancel: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => { cancel = () => { worker?.terminate(); reject(new Error('Calculation cancelled.')); }; });
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const runner = new SimRunner(() => {
      worker = new Worker(new URL('../engine/workers/sim.worker.ts', import.meta.url), { type: 'module' });
      return worker as unknown as WorkerLike;
    });
    const output = await Promise.race([runner.run(option.interventions, scenario.storm_id as StormId, f => onProgress(f.t, totalS), [], opts), cancelled]);
    if (signal.aborted) throw new Error('Calculation cancelled.');
    const context = makeContext(sc.network, sc.grid, effectiveBlockage(option.interventions, opts));
    const teamFrames = output.frames.map(f => toTeamFrame(f, context));
    const runId = `browser-story-${crypto.randomUUID()}`;
    const metrics = toTeamMetrics(runId, output.metrics, teamFrames, context, sc.frameEveryS);
    const assets = structuredClone(ASSETS) as unknown as TownshipAssetsResponse;
    assets.conduits = assets.conduits.map(p => ({ ...p, diameter_m: sc.network.pipes.find(n => n.id === p.conduit_id)?.diameter ?? p.diameter_m }));
    const p07Index=sc.network.pipes.findIndex(p => p.id === 'PIPE-P07');
    const roadStudy=buildRoadStudy(sc.grid,'d07');
    return { caseId, scenario: { ...scenario }, frames: output.frames, teamFrames, assets, surfaceCell: roadStudy.point.cell,
      roadStudy,grid:sc.grid,p07Index,
      summary: measureRoad(output.frames,roadStudy,p07Index,0.15),
      sumpSummary: streetSummary(output.frames, sc.sagCell, output.metrics.peakSagDepth,p07Index),
      result: { id: crypto.randomUUID(), option_id: caseId, title: option.title, target_asset_ids: option.targets, status: 'succeeded',
        run_id: runId, input_hash: hash, input_snapshot: inputSnapshot, metrics } };
  } finally { worker?.terminate(); signal.removeEventListener('abort', cancel); }
}

export function assessRoad(run:StoryRun,region:RoadRegionId,referenceM:number):StoryRun {
  const roadStudy=buildRoadStudy(run.grid,region);const summary=measureRoad(run.frames,roadStudy,run.p07Index,referenceM);
  return {...run,roadStudy,summary,surfaceCell:roadStudy.point.cell,result:{...run.result,assessment_snapshot:{definition:roadStudy,summary,hydraulic_input_hash:run.result.input_hash}}};
}
