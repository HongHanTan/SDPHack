import {swmmPackageToBundle} from '@floodops/engine/import/toSiteBundle';
type F={name:string;text:string};
export type SwmmConversion={bundleFile?:{name:string;text:string;role:'bundle'};originals:string[];errors:string[];warnings:string[];notes:string[];counts:Record<string,number>};
const sha=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const isLayout=(text:string)=>{try{return JSON.parse(text)?.type==='FeatureCollection';}catch{return false;}};
export async function convertSwmmPackage(files:F[]):Promise<SwmmConversion>{
 const out:SwmmConversion={originals:files.map(f=>f.name),errors:[],warnings:[],notes:[],counts:{}};
 const lower=(f:F)=>f.name.toLowerCase();
 if(files.some(f=>!/\.(inp|asc|geojson|json)$/.test(lower(f)))||files.some(f=>/\.(csv)$/.test(lower(f)))||files.some(f=>/\.json$/.test(lower(f))&&!isLayout(f.text))){
  out.errors.push(files.some(f=>/\.(csv|json)$/.test(lower(f))&&!isLayout(f.text))?'Upload either a SWMM package (.inp with optional layout .geojson and height .asc) or the site tables, not both.':'A SWMM package takes one .inp, an optional layout .geojson and an optional height .asc.');
  return out;
 }
 const inp=files.filter(f=>lower(f).endsWith('.inp')),asc=files.filter(f=>lower(f).endsWith('.asc')),geo=files.filter(f=>/\.(geojson|json)$/.test(lower(f)));
 for(const [list,label] of [[inp,'.inp'],[asc,'.asc'],[geo,'layout .geojson']] as const)if(list.length>1)out.errors.push(`Only one ${label} file can be used; found ${list.length}: ${list.map(f=>f.name).join(', ')}.`);
 if(out.errors.length)return out;
 const hashes=await Promise.all(files.map(async f=>`${f.name} SHA-256 ${await sha(f.text)}`));
 const result=swmmPackageToBundle({inp:inp[0],geojson:geo[0],asc:asc[0]},`SWMM package converted in the browser from ${hashes.join('; ')}`);
 Object.assign(out,{errors:result.errors,warnings:result.warnings,notes:result.notes,counts:result.counts});
 if(result.bundle&&!result.errors.length){const name=inp[0].name.replace(/^.*[\/]/,'').replace(/\.[^.]*$/,'')+'.site.json';out.bundleFile={name,text:JSON.stringify(result.bundle),role:'bundle'};}
 return out;
}
