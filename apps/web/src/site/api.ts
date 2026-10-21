import type { SiteResult } from './types';
import { getLocalSiteApi, localExecute, localRequest } from './local/localSiteApi';
/** Site requests are answered in this browser (IndexedDB + the FloodOps engine); there is no server. */
export function siteRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 return localRequest<T>(path,body,signal);
}
export function executeSite(projectId:string,body:unknown,onStatus:(status:string)=>void,signal:AbortSignal):Promise<SiteResult>{
 return localExecute(projectId,body,onStatus,signal);
}
/** A run's stored street-water depth grids, or null. */
export const siteRunDepth=(runId:string)=>getLocalSiteApi().runDepth(runId);
/** The engine site of a project, for drawing street water. */
export const siteEngineSpec=(projectId:string)=>getLocalSiteApi().siteSpec(projectId);
