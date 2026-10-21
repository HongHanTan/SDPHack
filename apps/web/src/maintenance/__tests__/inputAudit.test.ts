import { expect, it } from 'vitest';
import { buildScenario } from '@floodops/engine/scenario/index';
import { auditEnginePair } from '../inputAudit';

it('accepts intended pipe changes and rejects unrelated physical changes',()=>{
  const options={tailwater:'normal' as const,blockage:{'INLET-D07':.4}};
  const snapshot=(actions:('upsize-p07'|'desilt-d07')[])=>{
    const sc=buildScenario(actions,'synthetic_80mmh_60min',[],options);
    return {scenario:{storm_id:'synthetic_80mmh_60min'},engine:'engine',storm:sc.storm,grid:{ground_sha256:'same-ground',initial_water_sha256:'same-water'},options,dt:sc.dt,recession_s:sc.recessionS,frame_every_s:sc.frameEveryS,interventions:actions,network:sc.network,catchments:sc.catchments};
  };
  const baseline=snapshot([]),candidate=snapshot(['upsize-p07']);
  expect(auditEnginePair(baseline,candidate).passed).toBe(true);
  expect(auditEnginePair(baseline,snapshot(['desilt-d07'])).passed).toBe(true);
  candidate.network.pipes[0].n=.04;
  expect(auditEnginePair(baseline,candidate).passed).toBe(false);
  const altered=snapshot(['upsize-p07']);altered.grid.initial_water_sha256='different-water';
  expect(auditEnginePair(baseline,altered).problems).toContain('Unexpected change: grid');
});
