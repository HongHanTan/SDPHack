import { afterEach, expect, it, vi } from 'vitest';
import { buildScenario } from '@floodops/engine/scenario/index';
import { runSimulation } from '@floodops/engine/sim/engine';
import type { RunRequest, WorkerMessage } from '@floodops/engine/worker/protocol';
import { engineSource } from '../../engine/engineSource';
import type { ScenarioSelection } from '../../maintenance/model';
import { assessRoad, runStoryCase } from '../run';

const scenario:ScenarioSelection={mode:'engine',storm_id:'synthetic_80mmh_60min',debris_id:'engine_d07_40pct',tailwater:'normal',model_version_id:'taman_kyra_synthetic_v1'};
afterEach(()=>{vi.unstubAllGlobals();engineSource.setInterventions([]);});
it('calculates independent story options through the real numerical engine and preserves the chosen inputs',async()=>{
  const requests:RunRequest[]=[];let terminated=0;
  // A shortened numerical run verifies the worker transport; it is not a WebGL test.
  class NumericalWorker {
    onmessage:((event:{data:WorkerMessage})=>void)|null=null;onerror=null;
    postMessage(req:RunRequest){requests.push(structuredClone(req));queueMicrotask(()=>{
      const sc=buildScenario(req.interventions,req.stormId,req.custom,req.opts);
      sc.storm={...sc.storm,intensity:sc.storm.intensity.slice(0,1),blockS:10};sc.recessionS=10;sc.frameEveryS=5;
      const output=runSimulation(sc,frame=>this.onmessage?.({data:{type:'frame',key:req.key,frame}}));
      this.onmessage?.({data:{type:'done',key:req.key,metrics:output.metrics}});
    });}
    terminate(){terminated++;}
  }
  vi.stubGlobal('Worker',NumericalWorker);engineSource.setInterventions(['storage-tank']);
  const progress=vi.fn();
  const before=await runStoryCase('baseline',scenario,new AbortController().signal,progress);
  const clean=await runStoryCase('desilt-d07',scenario,new AbortController().signal,progress);
  const larger=await runStoryCase('upsize-p07',scenario,new AbortController().signal,progress);
  expect(requests.map(r=>r.interventions)).toEqual([[],['desilt-d07'],['upsize-p07']]);
  expect(requests.every(r=>r.opts?.blockage?.['INLET-D07']===0.4 && r.stormId===scenario.storm_id)).toBe(true);
  expect(before.assets.conduits.find(p=>p.conduit_id==='PIPE-P07')?.diameter_m).toBe(0.6);
  expect(larger.assets.conduits.find(p=>p.conduit_id==='PIPE-P07')?.diameter_m).toBe(0.75);
  expect([before,clean,larger].every(r=>r.frames.length>0 && Number.isFinite(r.summary.peakM) && r.result.input_hash?.length===64 && r.result.metrics?.engine==='FloodOps TS engine')).toBe(true);
  expect(new Set([before.result.input_hash,clean.result.input_hash,larger.result.input_hash]).size).toBe(3);
  expect(progress).toHaveBeenCalled();expect(terminated).toBe(3);
  expect(engineSource.getInterventions()).toEqual(['storage-tank']);
  const changed=assessRoad(before,'downstream',.1);
  expect(changed.result.input_hash).toBe(before.result.input_hash);
  expect(changed.result.input_snapshot).toEqual(before.result.input_snapshot);
  expect(changed.surfaceCell).not.toBe(before.surfaceCell);
  expect(changed.result.assessment_snapshot?.hydraulic_input_hash).toBe(before.result.input_hash);
},30000);
it('rejects unsupported sources and cancelled runs instead of returning invented results',async()=>{
  const signal=new AbortController();signal.abort();const worker=vi.fn();vi.stubGlobal('Worker',worker);
  await expect(runStoryCase('baseline',{...scenario,mode:'api'},new AbortController().signal,()=>{})).rejects.toThrow('browser engine');
  await expect(runStoryCase('baseline',scenario,signal.signal,()=>{})).rejects.toThrow('cancelled');
  expect(worker).not.toHaveBeenCalled();
});
it('surfaces worker calculation failures without fabricated fallback data',async()=>{
  class FailedWorker {
    onmessage:((event:{data:WorkerMessage})=>void)|null=null;onerror=null;
    postMessage(req:RunRequest){queueMicrotask(()=>this.onmessage?.({data:{type:'error',key:req.key,message:'Numerical solver rejected the scenario',step:1}}));}
    terminate(){}
  }
  vi.stubGlobal('Worker',FailedWorker);
  await expect(runStoryCase('baseline',scenario,new AbortController().signal,()=>{})).rejects.toThrow('Numerical solver rejected');
});
