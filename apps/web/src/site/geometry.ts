import type {ImportedSite} from './types';

// Imported model versions are immutable. Index each grid once for playback.
const boundsCache=new WeakMap<ImportedSite,{x:number;y:number;z:number;span:number}>();
const terrainCache=new WeakMap<ImportedSite,(x:number,y:number)=>number>();
export function siteBounds(site:ImportedSite){
 const cached=boundsCache.get(site);if(cached)return cached;
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity;
 const add=(x:number,y:number)=>{minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);};
 for(const p of site.nodes){add(p.x,p.y);if(p.ground_elevation_m!==null)minZ=Math.min(minZ,p.ground_elevation_m);if(p.invert_elevation_m!==null)minZ=Math.min(minZ,p.invert_elevation_m);}
 for(const p of site.terrain){add(p.x,p.y);minZ=Math.min(minZ,p.z);}
 for(const p of site.inlets)add(p.x,p.y);
 for(const f of site.roads)for(const p of f.geometry.coordinates as number[][])add(p[0],p[1]);
 for(const f of site.buildings)for(const p of (f.geometry.coordinates as number[][][])[0])add(p[0],p[1]);
 const value={x:(minX+maxX)/2,y:(minY+maxY)/2,z:(Number.isFinite(minZ)?minZ:0)-2,span:Math.max(maxX-minX,maxY-minY,30)};
 boundsCache.set(site,value);return value;
}
export function terrainHeight(site:ImportedSite,x:number,y:number){
 let sample=terrainCache.get(site);
 if(!sample){
  if(!site.terrain.length){const known=site.nodes.map(n=>n.ground_elevation_m).filter((v):v is number=>v!==null);const height=known.length?known.reduce((a,b)=>a+b,0)/known.length:0;sample=()=>height;}
  else{
   const xs=[...new Set(site.terrain.map(p=>p.x))].sort((a,b)=>a-b),ys=[...new Set(site.terrain.map(p=>p.y))].sort((a,b)=>a-b);
   const lookup=new Map(site.terrain.map(p=>[`${p.x},${p.y}`,p.z]));
   const interval=(values:number[],target:number)=>{let lo=0,hi=values.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(values[mid]<target)lo=mid+1;else hi=mid;}return Math.max(0,Math.min(values.length-2,lo-1));};
   sample=(tx,ty)=>{
    const ix=interval(xs,tx),iy=interval(ys,ty),a=Math.max(0,Math.min(1,(tx-xs[ix])/(xs[ix+1]-xs[ix]))),b=Math.max(0,Math.min(1,(ty-ys[iy])/(ys[iy+1]-ys[iy])));
    const z=(i:number,j:number)=>lookup.get(`${xs[i]},${ys[j]}`)!;
    return (1-b)*((1-a)*z(ix,iy)+a*z(ix+1,iy))+b*((1-a)*z(ix,iy+1)+a*z(ix+1,iy+1));
   };
  }
  terrainCache.set(site,sample);
 }
 return sample(x,y);
}
