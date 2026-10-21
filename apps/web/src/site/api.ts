import type { SiteResult } from './types';
import { localExecute, localRequest } from './local/localSiteApi';
/** Site requests are answered in this browser (IndexedDB + the FloodOps engine); there is no server. */
export function siteRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 return localRequest<T>(path,body,signal);
}
export function executeSite(projectId:string,body:unknown,onStatus:(status:string)=>void,signal:AbortSignal):Promise<SiteResult>{
 return localExecute(projectId,body,onStatus,signal);
}
