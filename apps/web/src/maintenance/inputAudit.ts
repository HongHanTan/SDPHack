import { buildScenario, type ScenarioOptions } from '@floodops/engine/scenario/index';
import type { StormId } from '@floodops/engine/scenario/storms';
import type { InterventionId } from '@floodops/engine/scenario/interventions';

const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function auditEnginePair(baseline:Record<string,unknown>,candidate:Record<string,unknown>) {
  const shared=['scenario','engine','storm','grid','options','dt','recession_s','frame_every_s'];
  const problems=shared.filter(k=>!equal(baseline[k],candidate[k])).map(k=>`Unexpected change: ${k}`);
  const actions=candidate.interventions as InterventionId[];
  if(!Array.isArray(actions)||!actions.length||actions.some(a=>!['desilt-d07','upsize-p07','storage-tank','lake-overflow'].includes(a))||new Set(actions).size!==actions.length)problems.push('Invalid candidate action list');
  if(!equal(baseline.interventions,[]))problems.push('Reference network already contains an intervention');
  if(!problems.length){
    const scenario=baseline.scenario as {storm_id:string};
    const expected=buildScenario(actions,scenario.storm_id as StormId,[],baseline.options as ScenarioOptions);
    if(!equal(candidate.network,expected.network))problems.push('Network contains changes beyond the selected actions');
    if(!equal(candidate.catchments,expected.catchments))problems.push('Catchment inputs contain changes beyond the selected actions');
  }
  return {passed:!problems.length,problems};
}
