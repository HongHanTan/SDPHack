import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { OperationsDashboard } from '../OperationsDashboard';
import { ProblemDetails } from '../ProblemDetails';
import { App, LegacyApp } from '../../App';
import type { Problem } from '../model';

it('renders the operations entry point without invented reports, costs or live flood claims',()=>{
  const html=renderToStaticMarkup(createElement(OperationsDashboard,{visible:true,scope:{mode:'engine',township_id:'taman_kyra_demo',model_version_id:'taman_kyra_synthetic_v1',api_base_url:''},nodes:[],inlets:[],conduits:[],inspections:[],modelVerified:false,assetsLoading:false,dataError:null,onDemo:()=>{},onMaintenance:()=>{},onLocate:()=>{},onInspect:()=>{},onPrepare:()=>{}}));
  expect(html).toContain('What needs follow-up?');expect(html).toContain('Problems list');
  expect(html).toContain('this browser only');expect(html).toContain('Open browser demo');
  expect(html).toContain('not a flood-risk ranking');expect(html).not.toContain('CRITICAL');expect(html).not.toContain('RM ');
});
it('starts with customer uploads and keeps the previous demonstration explicit',()=>{
  const html=renderToStaticMarkup(createElement(App));
  expect(html).toContain('Build around your township.');expect(html).toContain('Upload site files');expect(html).toContain('Open illustrative demo');
  expect(html).not.toContain('Drainage operations dashboard');
  expect(html).not.toContain('Will cleaning this drain be enough?');
  const demo=renderToStaticMarkup(createElement(LegacyApp));
  expect(demo).toContain('Drainage operations dashboard');expect(demo).toContain('Open browser demo');
});
it('keeps source, missing-asset and closure limitations visible in a case record',()=>{
  const problem:Problem={problem_id:'p1',revision:1,title:'Demo ponding',location:'Example street',asset_id:null,external_reference:'DEMO-01',owner:'',next_action:'Inspect location',due_date:'',status:'Open',closure_note:'',created_at:'2026-10-20T10:00:00Z',updated_at:'2026-10-20T10:00:00Z',reports:[{report_id:'r1',recorded_at:'2026-10-20T10:00:00Z',occurred_at:'2026-10-20T09:00:00Z',source_type:'synthetic',source_reference:'DEMO-01',description:'Example report',reported_impact:''}],history:[{timestamp:'2026-10-20T10:00:00Z',note:'Created'}]};
  const props={problem,assets:[],inspections:[],modelVerified:false,readOnly:false,onSave:()=>{},onReport:()=>{},onInspect:()=>{},onLocate:()=>{},onPrepare:()=>{},onExport:()=>{}};
  const html=renderToStaticMarkup(createElement(ProblemDetails,props));
  expect(html).toContain('Synthetic demonstration');expect(html).toContain('Asset not linked');expect(html).toContain('no claimed modelled benefit or cost saving');
  const closed=renderToStaticMarkup(createElement(ProblemDetails,{...props,problem:{...problem,status:'Closed',closure_note:'Review decision recorded.'}}));
  expect(closed).toContain('Administratively closed');expect(closed).toContain('does not certify flood performance');
});
