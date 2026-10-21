import { buildScenario } from '../packages/engine/src/scenario/index';
import { runSimulation } from '../packages/engine/src/sim/engine';
import { buildRoadStudy, measureRoad, ROAD_REGIONS } from '../apps/web/src/story/roadStudy';
import type { InterventionId } from '../packages/engine/src/scenario/interventions';
for(const actions of [[],['desilt-d07'],['upsize-p07']] as InterventionId[][]) {
  const start=Date.now();const scenario=buildScenario(actions,'synthetic_80mmh_60min',[],{blockage:{'INLET-D07':.4},tailwater:'normal'});
  const result=runSimulation(scenario,frame=>{if(frame.t%1800===0)console.log(JSON.stringify({actions,model_s:frame.t,elapsed_s:(Date.now()-start)/1000}));});
  for(const region of ROAD_REGIONS){const study=buildRoadStudy(scenario.grid,region.id);const m=measureRoad(result.frames,study,scenario.network.pipes.findIndex(p=>p.id==='PIPE-P07'),.15);console.log(JSON.stringify({actions,region:region.id,point:study.point,cells:study.cells.length,area_m2:study.areaM2,point_peak_m:m.peakM,max_simultaneous_road_area_m2:m.maxAreaM2,duration_s:m.aboveReferenceS,balance_error:result.metrics.balance.error}));}
}
