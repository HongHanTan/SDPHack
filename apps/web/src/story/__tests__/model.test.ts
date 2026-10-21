import { expect, it } from 'vitest';
import type { Frame } from '@floodops/engine/sim/types';
import { changeDescription, cleaningFinding, frameIndexAt, streetSummary } from '../model';

const frame = (t:number,depth:number,load=0):Frame => ({t,depth:new Float32Array([depth]),pipeLoad:new Float32Array([load]),nodeFill:new Float32Array([0])});
it('derives the street duration and capacity intervals from output times, preserving the exact-step peak',()=>{
  const frames=[frame(30,0.1),frame(60,0.2,1),frame(90,0.3,0.999),frame(120,0.05)];
  const result=streetSummary(frames,0,0.325,0);
  expect(result.peakM).toBe(0.325);
  expect(result.peakSampleTimeS).toBe(90);
  expect(result.aboveReferenceS).toBe(60);
  expect(result.p07AtCapacityS).toBe(60);
  expect(result.stillAboveAtEnd).toBe(false);
  expect(streetSummary([frame(30,0.2)],0,0.2,0).stillAboveAtEnd).toBe(true);
  expect(()=>streetSummary([],0,0,0)).toThrow('no street results');
  expect(()=>streetSummary([frame(30,NaN)],0,1,0)).toThrow('unavailable');
});
it('seeks the latest available sample without showing future results',()=>{
  const frames=[frame(30,0.1),frame(60,0.2)];
  expect(frameIndexAt(frames,0)).toBe(-1);
  expect(frameIndexAt(frames,30)).toBe(0);
  expect(frameIndexAt(frames,59.9)).toBe(0);
  expect(frameIndexAt(frames,100)).toBe(1);
});
it('explains improvement, no change and worsening from actual computed depths',()=>{
  const summary=(peak:number)=>streetSummary([frame(30,peak)],0,peak,0);
  expect(changeDescription(summary(0.4),summary(0.2))).toContain('20.0 cm lower');
  expect(changeDescription(summary(0.4),summary(0.5))).toContain('10.0 cm higher');
  expect(changeDescription(summary(0.4),summary(0.40001))).toContain('unchanged');
  expect(cleaningFinding(summary(0.4),summary(0.399))).toContain('changes little');
  expect(cleaningFinding(summary(0.4),summary(0.2))).toContain('reduces');
  expect(cleaningFinding(summary(0.4),summary(0.5))).toContain('increases');
});
