import { afterEach, expect, it, vi } from 'vitest';
import { buildScenario } from '@floodops/engine/scenario/index';
import { runSimulation } from '@floodops/engine/sim/engine';
import type { RunRequest, WorkerMessage } from '@floodops/engine/worker/protocol';
import { engineSource } from '../../engine/engineSource';
import { OPTIONS, runComparison } from '../comparison';
import type { Comparison, ScenarioSelection } from '../model';
import { apiClient } from '../../api/client';
import { MOCK_METRICS_BASELINE } from '../../mocks/fixtures';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); engineSource.setInterventions([]); });
it('runs every candidate with matching selected inputs, numerical results and independent interventions', async () => {
  const requests: RunRequest[] = [];
  let terminated=0;
  // Exercise the worker protocol with the real numerical engine on a shortened storm.
  // UI transport is emulated; this is not a browser/WebGL test.
  class NumericalWorker {
    onmessage: ((e: {data:WorkerMessage})=>void) | null=null;
    onerror=null;
    postMessage(req: RunRequest) {
      requests.push(structuredClone(req));
      queueMicrotask(()=>{
        const sc=buildScenario(req.interventions,req.stormId,req.custom,req.opts);
        sc.storm={...sc.storm,intensity:sc.storm.intensity.slice(0,1),blockS:10};
        sc.recessionS=10;sc.frameEveryS=5;
        const result=runSimulation(sc,frame=>this.onmessage?.({data:{type:'frame',key:req.key,frame}}));
        this.onmessage?.({data:{type:'done',key:req.key,metrics:result.metrics}});
      });
    }
    terminate() {terminated++;}
  }
  vi.stubGlobal('Worker',NumericalWorker);
  engineSource.setInterventions(['upsize-p07']);
  const scenario: ScenarioSelection={mode:'engine',storm_id:'synthetic_80mmh_60min',debris_id:'engine_d07_60pct',tailwater:'high',model_version_id:'taman_kyra_synthetic_v1'};
  const snapshots: Comparison[]=[];
  const c=await runComparison(scenario,v=>snapshots.push(v),new AbortController().signal);
  expect(requests).toHaveLength(OPTIONS.length);
  expect(requests[0].interventions).toEqual([]);
  expect(requests[1].interventions).toEqual(['desilt-d07']);
  expect(requests.every(r=>r.stormId===scenario.storm_id && r.opts?.tailwater==='high' && r.opts.blockage?.['INLET-D07']===0.6)).toBe(true);
  expect(c.results.every(r=>r.status==='succeeded' && r.metrics?.engine==='FloodOps TS engine' && Number.isFinite(r.metrics.total_flooding_volume_m3))).toBe(true);
  expect(new Set(c.results.map(r=>r.run_id)).size).toBe(OPTIONS.length);
  expect(snapshots[0].results[0].status).toBe('running');
  expect(terminated).toBe(OPTIONS.length);
  expect(engineSource.getInterventions()).toEqual(['upsize-p07']);
},30000);

it('keeps offline replay explicitly unavailable for intervention calculations', async () => {
  const c=await runComparison({mode:'mock',storm_id:'s',debris_id:'b',tailwater:'normal',model_version_id:'v'},()=>{},new AbortController().signal);
  expect(c.results.every(r=>r.status==='unavailable' && !r.metrics)).toBe(true);
});

it('compares native API scenarios using one shared inlet hypothesis and explicit intervention actions', async () => {
  const b=engineSource.getBootstrap();
  const preset={...b.debris_scenarios[2],debris_scenario_id:'debris_created_uuid',capture_model:'swmm_native_custom_diversion_v1' as const};
  vi.spyOn(apiClient,'getBootstrap').mockResolvedValue({...b,debris_scenarios:[preset]});
  const debris=vi.spyOn(apiClient,'createDebrisScenario').mockImplementation(async req=>({...preset,debris_scenario_id:`loss-${'hydraulic_inlet_clogging_fraction' in req ? req.hydraulic_inlet_clogging_fraction : 0}`}));
  const submit=vi.spyOn(apiClient,'createSimulation').mockImplementation(async req=>({run_id:`run-${req.debris_scenario_id}`,status:'running'}));
  vi.spyOn(apiClient,'getSimulation').mockImplementation(async id=>({run_id:id,status:'succeeded',model_version_id:'taman_kyra_synthetic_v1',engine:'EPA SWMM',engine_version:'5.2.4',is_verified_site_model:false,input_hash:'retained-hash'}));
  vi.spyOn(apiClient,'getSimulationMetrics').mockResolvedValue(MOCK_METRICS_BASELINE);
  const c=await runComparison({mode:'api',storm_id:'synthetic_120mmh_60min',debris_id:preset.debris_scenario_id,tailwater:'normal',model_version_id:'taman_kyra_synthetic_v1'},()=>{},new AbortController().signal,'inspection-id');
  expect(debris).toHaveBeenCalledTimes(1);
  expect(debris.mock.calls.map(args=>(args[0] as {hydraulic_inlet_clogging_fraction:number}).hydraulic_inlet_clogging_fraction)).toEqual([0.4]);
  expect(submit.mock.calls.map(args=>args[0].intervention?.actions??[])).toEqual(OPTIONS.map(o=>o.interventions));
  expect(new Set(submit.mock.calls.map(args=>args[0].debris_scenario_id)).size).toBe(1);
  expect(submit.mock.calls.every(args=>args[0].storm_id==='synthetic_120mmh_60min' && args[0].tailwater_case==='normal')).toBe(true);
  expect(c.results.every(r=>r.status==='succeeded'&&r.input_hash==='retained-hash')).toBe(true);
});
