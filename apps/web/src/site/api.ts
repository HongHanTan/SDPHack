import type { SiteResult } from './types';
import { localExecute, localRequest } from './local/localSiteApi';
/** Site requests are answered in this browser (IndexedDB + the FloodOps engine); there is no server. */
export function siteRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 return localRequest<T>(path,body,signal);
}
export function executeSite(projectId:string,body:unknown,onStatus:(status:string)=>void,signal:AbortSignal):Promise<SiteResult>{
 return localExecute(projectId,body,onStatus,signal);
}
export const inferRole=(name:string)=>{
 const stem=name.toLowerCase().replace(/\.(csv|geojson|json)$/,'');
 if(name.toLowerCase().endsWith('.site.json'))return 'bundle';
 return ['project','nodes','pipes','inlets','catchments','rainfall','terrain','roads','buildings'].find(role=>stem===role)??(name.toLowerCase().endsWith('.json')?'bundle':'nodes');
};
