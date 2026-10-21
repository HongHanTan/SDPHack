import { DATUM } from '@floodops/engine/scenario/config';
import { ASSETS } from '@floodops/engine/scenario/layout';
import { LandUse, type Frame, type Grid } from '@floodops/engine/sim/types';

export const ROAD_REGIONS = [
  {id:'d07',name:'D07 street junction',bounds:[25,-20,55,20],probe:[40,-8]},
  {id:'downstream',name:'Downstream street / J08 approach',bounds:[25,-68,55,-22],probe:[40,-36]},
  {id:'western',name:'Western branch approach',bounds:[-18,-12,22,12],probe:[12,0]},
] as const;
export type RoadRegionId=typeof ROAD_REGIONS[number]['id'];
export interface RoadStudy {
  version:'road-cells-v1';id:RoadRegionId;name:string;bounds:readonly number[];
  cells:number[];excludedCells:number[];cellAreaM2:number;areaM2:number;cellSizeM:number;
  point:{cell:number;x:number;y:number;groundM:number};
  source:'synthetic terrain; not surveyed pavement';
}
export interface RoadSummary {
  peakM:number;peakSampleTimeS:number;aboveReferenceS:number;stillAboveAtEnd:boolean;p07AtCapacityS:number;
  maxAreaM2:number;maxAreaTimeS:number;areaAboveReferenceS:number;referenceM:number;
  series:{timeS:number;depthM:number;areaM2:number}[];
}
/** Cell centres inside a fixed study rectangle, on ROAD land, outside asset/sump footprints. */
export function buildRoadStudy(grid:Grid,id:RoadRegionId):RoadStudy {
  const region=ROAD_REGIONS.find(r=>r.id===id);if(!region)throw new Error('Unknown road study area.');
  const [xmin,ymin,xmax,ymax]=region.bounds;const cells:number[]=[];const excludedCells:number[]=[];
  const structures=[...ASSETS.inlets.map(a=>a.position_m),...ASSETS.nodes.map(a=>a.position_m)];
  let point:RoadStudy['point']|null=null;let nearest=Infinity;
  for(let cell=0;cell<grid.z.length;cell++) {
    const x=DATUM.x0+(cell%grid.nx+0.5)*grid.dx;
    const y=DATUM.y0+(Math.floor(cell/grid.nx)+0.5)*grid.dx;
    if(x<xmin||x>xmax||y<ymin||y>ymax||grid.land[cell]!==LandUse.ROAD)continue;
    // A 2.5 m footprint excludes grate cells (including the synthetic sump) and manholes.
    if(structures.some(p=>Math.hypot(x-p.x,y-p.y)<=2.5)){excludedCells.push(cell);continue;}
    cells.push(cell);const distance=Math.hypot(x-region.probe[0],y-region.probe[1]);
    if(distance<nearest){nearest=distance;point={cell,x,y,groundM:grid.z[cell]};}
  }
  if(!point||!cells.length)throw new Error('The selected area contains no eligible road cells.');
  return {version:'road-cells-v1',id,name:region.name,bounds:region.bounds,cells,excludedCells,cellAreaM2:grid.dx**2,areaM2:cells.length*grid.dx**2,cellSizeM:grid.dx,point,source:'synthetic terrain; not surveyed pavement'};
}
/** Sampled maxima and right-endpoint durations; simultaneous area, never a sum of cell maxima. */
export function measureRoad(frames:Frame[],study:RoadStudy,p07Index:number,referenceM:number):RoadSummary {
  if(!frames.length||!(referenceM>0)||!Number.isFinite(referenceM))throw new Error('Valid frames and a positive comparison reference are required.');
  let peakM=0,peakSampleTimeS=frames[0].t,aboveReferenceS=0,p07AtCapacityS=0,maxAreaM2=0,maxAreaTimeS=frames[0].t,areaAboveReferenceS=0,previous=0;
  const series=frames.map(frame=>{
    if(!Number.isFinite(frame.t)||frame.t<=previous)throw new Error('Road output samples must have increasing positive times.');
    const depthM=frame.depth[study.point.cell];let wet=0;
    for(const cell of study.cells){const depth=frame.depth[cell];if(!Number.isFinite(depth)||depth<0)throw new Error('Road depth is missing or invalid.');if(depth>=referenceM)wet++;}
    const areaM2=wet*study.cellAreaM2;const interval=frame.t-previous;
    if(depthM>peakM){peakM=depthM;peakSampleTimeS=frame.t;}
    if(areaM2>maxAreaM2){maxAreaM2=areaM2;maxAreaTimeS=frame.t;}
    if(depthM>=referenceM)aboveReferenceS+=interval;
    if(areaM2>0)areaAboveReferenceS+=interval;
    if(p07Index>=0&&frame.pipeLoad[p07Index]>=0.999)p07AtCapacityS+=interval;
    previous=frame.t;return {timeS:frame.t,depthM,areaM2};
  });
  return {peakM,peakSampleTimeS,aboveReferenceS,p07AtCapacityS,maxAreaM2,maxAreaTimeS,areaAboveReferenceS,referenceM,stillAboveAtEnd:series.at(-1)!.depthM>=referenceM,series};
}
export function changedRoadArea(before:Frame,after:Frame,study:RoadStudy,referenceM:number) {
  let reduced=0,increased=0;
  for(const cell of study.cells){const b=before.depth[cell]>=referenceM,a=after.depth[cell]>=referenceM;if(b&&!a)reduced+=study.cellAreaM2;if(a&&!b)increased+=study.cellAreaM2;}
  return {reducedM2:reduced,increasedM2:increased};
}
