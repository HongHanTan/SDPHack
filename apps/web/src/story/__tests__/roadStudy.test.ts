import { expect, it } from 'vitest';
import { buildScenario } from '@floodops/engine/scenario/index';
import { ASSETS, toLocal } from '@floodops/engine/scenario/layout';
import { cellAt } from '@floodops/engine/scenario/terrain';
import { LandUse, type Frame } from '@floodops/engine/sim/types';
import { buildRoadStudy, measureRoad, type RoadStudy } from '../roadStudy';
import { browserReferenceChecks } from '../referenceChecks';
import { gridFingerprint } from '../../engine/inputFingerprint';

it('defines only road cells and excludes the actual inlet sump and manhole footprints',()=>{
  const sc=buildScenario([],'synthetic_80mmh_60min');const study=buildRoadStudy(sc.grid,'d07');
  expect(study.areaM2).toBe(study.cells.length*4);expect(study.cells.length).toBeGreaterThan(0);
  expect(study.cells.every(c=>sc.grid.land[c]===LandUse.ROAD)).toBe(true);
  for(const inlet of ASSETS.inlets){const p=toLocal(inlet.position_m.x,inlet.position_m.y);expect(study.cells).not.toContain(cellAt(p.x,p.y));}
  expect(study.cells).toContain(study.point.cell);expect(study.point.cell).not.toBe(sc.sagCell);
  expect(buildRoadStudy(sc.grid,'downstream').cells).not.toEqual(study.cells);
});
it('counts simultaneous area, a fixed-point depth and sampled intervals independently',()=>{
  const study={cells:[0,1],point:{cell:0,x:0,y:0,groundM:0},cellAreaM2:4,areaM2:8} as RoadStudy;
  const f=(t:number,a:number,b:number):Frame=>({t,depth:new Float32Array([a,b]),pipeLoad:new Float32Array([1]),nodeFill:new Float32Array()});
  const frames=[f(30,.2,0),f(60,0,.3),f(90,.1,.1)];const result=measureRoad(frames,study,0,.15);
  expect(result.maxAreaM2).toBe(4); // Individual-cell maxima would wrongly report 8 m2.
  expect(result.aboveReferenceS).toBe(30);expect(result.areaAboveReferenceS).toBe(60);
  expect(result.peakM).toBeCloseTo(.2);expect(result.peakSampleTimeS).toBe(30);
  expect(result.stillAboveAtEnd).toBe(false);
  expect(measureRoad(frames,study,0,.25).aboveReferenceS).toBe(0);
  expect(()=>measureRoad([f(30,NaN,0)],study,0,.15)).toThrow('missing');
  expect(()=>measureRoad([frames[1],frames[0]],study,0,.15)).toThrow('increasing');
});
it('executes numerical reference cases and reports their actual differences from analytic references',()=>{
  const checks=browserReferenceChecks();expect(checks).toHaveLength(3);
  expect(checks.every(c=>Number.isFinite(c.calculated)&&c.absolute_error<=c.tolerance&&c.passed)).toBe(true);
  expect(checks.find(c=>c.id==='rain')!.calculated).toBeCloseTo(.002,8);
});
it('grid fingerprints detect changed pavement elevations and initial water even with identical dimensions',async()=>{
  const sc=buildScenario([],'synthetic_80mmh_60min');const original=await gridFingerprint(sc.grid);
  sc.grid.z[0]+=.01;const changed=await gridFingerprint(sc.grid);
  expect(changed.ground_sha256).not.toBe(original.ground_sha256);expect(changed.land_sha256).toBe(original.land_sha256);
  sc.grid.h0[0]+=.1;expect((await gridFingerprint(sc.grid)).initial_water_sha256).not.toBe(changed.initial_water_sha256);
});
