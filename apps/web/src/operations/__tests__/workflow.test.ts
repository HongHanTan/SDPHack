import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { engineSource } from '../../engine/engineSource';
import type { InspectionRecord } from '../../types';
import type { SelectedAsset } from '../../maintenance/model';
import { problemEvidence, sortProblems, type NewProblem, type ProblemScope } from '../model';
import { addProblemReport, createProblem, loadProblems, problemStorageKey, updateProblem } from '../repository';
import { problemSnapshot, problemsCsv } from '../export';

const scope:ProblemScope={mode:'engine',township_id:'taman_kyra_demo',model_version_id:'taman_kyra_synthetic_v1',api_base_url:''};
const draft=():NewProblem=>({title:'Water reported near the cul-de-sac',location:'Example D07 street',asset_id:'INLET-D07',external_reference:'COMPLAINT-01',owner:'',next_action:'Inspect location',due_date:'2026-10-20',status:'Open',closure_note:'',report:{occurred_at:'2026-10-19T10:00:00Z',source_type:'observed',source_reference:'COMPLAINT-01',description:'Resident reported water at the end of the street',reported_impact:'Reported driveway access difficulty'}});
const asset:SelectedAsset={type:'inlet',id:'INLET-D07',data:engineSource.getTownshipAssets().inlets.find(i=>i.inlet_id==='INLET-D07')};
let storage:Map<string,string>;
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));storage=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,value:string)=>storage.set(k,value)});});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

it('starts empty, persists actual entered reports and protects revisions during assignment and closure',()=>{
  expect(loadProblems(scope)).toEqual([]);
  let problem=createProblem(scope,draft());
  expect(loadProblems(scope)).toEqual([problem]);
  const original=problem;
  problem=updateProblem(scope,problem.problem_id,problem.revision,{...problem,owner:'Estate maintenance',status:'Investigating'});
  expect(problem.reports).toEqual(original.reports);
  expect(problem.history[1].note).toContain('Responsible team');
  expect(()=>updateProblem(scope,original.problem_id,original.revision,{...original,owner:'Stale owner'})).toThrow('changed');
  expect(()=>updateProblem(scope,problem.problem_id,problem.revision,{...problem,status:'Closed'})).toThrow('Explain why');
  problem=updateProblem(scope,problem.problem_id,problem.revision,{...problem,status:'Closed',closure_note:'Inspection reviewed; monitor after rain.'});
  problem=addProblemReport(scope,problem.problem_id,problem.revision,{...draft().report,occurred_at:'2026-10-21T10:00:00Z',source_reference:'COMPLAINT-02',description:'New report after the case was closed.'});
  expect(problem.status).toBe('Open');expect(problem.reports).toHaveLength(2);
  expect(problem.closure_note).toBe('');expect(problem.history.at(-1)?.note).toContain('reopened');
  expect(loadProblems(scope)[0]).toEqual(problem);
});
it('keeps demonstration reports visible and does not treat a synthetic or earlier inspection as current observed evidence',()=>{
  let problem=createProblem(scope,draft());
  const inspection={inspection_id:'inspection-1',asset_id:'INLET-D07',timestamp:'2026-10-20T08:00:00Z',source_type:'synthetic',notes:'Demonstration inspection'} as InspectionRecord;
  expect(problemEvidence(problem,[inspection],[asset]).observedInspection).toBeUndefined();
  expect(problemEvidence(problem,[{...inspection,source_type:'observed',timestamp:'2026-10-18T08:00:00Z'}],[asset]).observedInspection).toBeUndefined();
  expect(problemEvidence(problem,[{...inspection,source_type:'observed'}],[asset]).observedInspection?.inspection_id).toBe('inspection-1');
  problem=addProblemReport(scope,problem.problem_id,problem.revision,{...draft().report,source_type:'synthetic',source_reference:'DEMO-02'});
  const e=problemEvidence(problem,[],[asset]);
  expect(e.observedReports).toBe(1);expect(e.demonstrationReports).toBe(1);
  expect(e.overdue).toBe(true);expect(e.flags).toContain('Responsible team not assigned');
  expect(problemEvidence({...problem,asset_id:null},[],[asset]).flags).toContain('Asset not linked');
});
it('orders follow-up by overdue date and oldest initial report without a fabricated hydraulic score',()=>{
  const a=createProblem(scope,{...draft(),title:'Older report',due_date:'',report:{...draft().report,occurred_at:'2026-10-17T10:00:00Z'}});
  const b=createProblem(scope,{...draft(),title:'Overdue action'});
  const c=createProblem(scope,{...draft(),title:'Closed',status:'Closed',closure_note:'Administrative decision recorded.'});
  expect(sortProblems([a,c,b]).map(p=>p.title)).toEqual(['Overdue action','Older report','Closed']);
  expect(problemEvidence(c,[],[asset]).overdue).toBe(false);
});
it('isolates datasets, modes and API destinations without a server-persistence claim',()=>{
  createProblem(scope,draft());
  expect(loadProblems({...scope,mode:'mock'})).toEqual([]);
  expect(loadProblems({...scope,model_version_id:'another-model'})).toEqual([]);
  const api={...scope,mode:'api' as const,api_base_url:'https://estate-one.example'};
  createProblem(api,draft());
  expect(loadProblems({...api,api_base_url:'https://estate-two.example'})).toEqual([]);
  expect(loadProblems({...api,api_base_url:'https://estate-one.example/'})).toHaveLength(1);
});
it('preserves corrupt or quota-limited storage and rejects future incident times',()=>{
  const key=problemStorageKey(scope);storage.set(key,'broken JSON');
  expect(()=>loadProblems(scope)).toThrow('have not been replaced');
  expect(()=>createProblem(scope,draft())).toThrow();expect(storage.get(key)).toBe('broken JSON');
  storage.clear();
  expect(()=>createProblem(scope,{...draft(),report:{...draft().report,occurred_at:'2027-01-01T00:00:00Z'}})).toThrow('at or before now');
  expect(storage.has(key)).toBe(false);
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('Quota exceeded');}});
  expect(()=>createProblem(scope,draft())).toThrow('Quota exceeded');
});
it('exports source-labelled counts and immutable evidence snapshots without modelled benefit claims',()=>{
  const p=createProblem(scope,{...draft(),title:'=HYPERLINK("bad")'});
  const csv=problemsCsv([p]);expect(csv).toContain("'=HYPERLINK");expect(csv).toContain('Recorded reports');
  const inspection={inspection_id:'i1',asset_id:'INLET-D07',notes:'Original observation'} as InspectionRecord;
  const snapshot=problemSnapshot(p,scope,[inspection],[asset],false);
  p.title='Changed later';inspection.notes='Changed later';
  expect(snapshot.problem.title).toContain('HYPERLINK');expect(snapshot.asset_inspection_snapshot[0].notes).toBe('Original observation');
  expect(snapshot.model_is_marked_verified).toBe(false);expect(snapshot.notes.join(' ')).toContain('No hydraulic result or cost saving');
});
