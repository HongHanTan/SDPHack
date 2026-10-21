import { apiClient } from '../api/client';
import type { SimulationRun, SimulationFramesResponse, SimulationMetricsResponse } from '../types';
import type { SiteResult } from './types';
export async function siteRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 let response:Response;
 try{response=await fetch(`${apiClient.getBaseUrl()}${path}`,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal});}catch(e){if((e as Error)?.name==='AbortError')throw e;throw new Error(`Project API unreachable at ${apiClient.getBaseUrl()}. Start the local API on port 8000 (see md/UPLOAD_FIRST_WALKTHROUGH.md).`);}
 const value=await response.json().catch(()=>null);
 if(!response.ok)throw new Error(value?.error?.message??`Site API returned ${response.status}. Check the API connection.`);
 return value as T;
}
export async function executeSite(projectId:string,body:unknown,onStatus:(status:string)=>void,signal:AbortSignal):Promise<SiteResult>{
 const accepted=await siteRequest<{run_id:string}>(`/api/site-projects/${projectId}/simulations`,body,signal);
 let run:SimulationRun;
 for(let i=0;i<300;i++){
  if(signal.aborted)throw new Error('Calculation cancelled.');
  run=await siteRequest<SimulationRun>(`/api/simulations/${accepted.run_id}`,undefined,signal);
  onStatus(`${run.status==='queued'?'Queued':'Calculating'} · ${accepted.run_id.slice(0,16)}`);
  if(run.status==='failed')throw new Error(run.error?.message??'Native SWMM calculation failed.');
  if(run.status==='succeeded'){
   const [frames,metrics]=await Promise.all([siteRequest<SimulationFramesResponse>(`/api/simulations/${accepted.run_id}/frames`,undefined,signal),siteRequest<SimulationMetricsResponse>(`/api/simulations/${accepted.run_id}/metrics`,undefined,signal)]);
   return {run,frames:frames.frames,metrics};
  }
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},700);const abort=()=>{clearTimeout(timer);reject(new Error('Calculation cancelled.'));};signal.addEventListener('abort',abort,{once:true});});
 }
 throw new Error('Calculation polling timed out. Check retained run status before submitting again.');
}
export const inferRole=(name:string)=>{
 const stem=name.toLowerCase().replace(/\.(csv|geojson|json)$/,'');
 if(name.toLowerCase().endsWith('.site.json'))return 'bundle';
 return ['project','nodes','pipes','inlets','catchments','rainfall','terrain','roads','buildings'].find(role=>stem===role)??(name.toLowerCase().endsWith('.json')?'bundle':'nodes');
};
