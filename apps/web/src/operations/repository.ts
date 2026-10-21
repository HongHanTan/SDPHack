import { NEXT_ACTIONS, PROBLEM_STATUSES, scopeKey, validateFields, validateReport, type NewProblem, type Problem, type ProblemFields, type ProblemScope, type ReportInput } from './model';

export const problemStorageKey = (scope:ProblemScope) => `floodops_problems_v1_${encodeURIComponent(scopeKey(scope))}`;
const strings = (value:Record<string,unknown>, keys:string[]) => keys.every(k=>typeof value[k]==='string');
function isProblem(value:unknown):value is Problem {
  if(!value || typeof value!=='object') return false;
  const p=value as Record<string,unknown>;
  if(!strings(p,['problem_id','created_at','updated_at','title','location','external_reference','owner','next_action','due_date','status','closure_note']) || !Number.isInteger(p.revision) || (p.revision as number)<1 || !(p.asset_id===null || typeof p.asset_id==='string')) return false;
  if(!Array.isArray(p.reports) || !p.reports.length || !Array.isArray(p.history) || !p.history.length) return false;
  if(!p.reports.every(r=>r && typeof r==='object' && strings(r,['report_id','recorded_at','occurred_at','source_type','source_reference','description','reported_impact']) && Number.isFinite(Date.parse(r.occurred_at)) && Number.isFinite(Date.parse(r.recorded_at)) && ['observed','synthetic','assumed','literature_derived'].includes(r.source_type))) return false;
  if(!p.history.every(h=>h && typeof h==='object' && strings(h,['timestamp','note']) && Number.isFinite(Date.parse(h.timestamp)))) return false;
  try { validateFields(value as Problem); } catch { return false; }
  return !!p.problem_id && Number.isFinite(Date.parse(p.created_at as string)) && Number.isFinite(Date.parse(p.updated_at as string)) && PROBLEM_STATUSES.includes(p.status as Problem['status']) && NEXT_ACTIONS.includes(p.next_action as Problem['next_action']);
}
export function loadProblems(scope:ProblemScope):Problem[] {
  const raw=localStorage.getItem(problemStorageKey(scope));
  if(raw===null) return [];
  let data:unknown;
  try {data=JSON.parse(raw);} catch {throw new Error('Saved problem records cannot be read. They have not been replaced. Restore a valid browser backup before editing.');}
  if(!data || typeof data!=='object' || (data as {version?:unknown}).version!==1 || (data as {scope_key?:unknown}).scope_key!==scopeKey(scope) || !Array.isArray((data as {items?:unknown}).items)) throw new Error('Saved problem data has an unsupported format. Existing records have not been replaced.');
  const items=(data as {items:unknown[]}).items;
  if(!items.every(isProblem) || new Set(items.map(p=>p.problem_id)).size!==items.length) throw new Error('Saved problem records are invalid. Existing records have not been replaced.');
  return structuredClone(items);
}
function write(scope:ProblemScope, items:Problem[]) {
  localStorage.setItem(problemStorageKey(scope),JSON.stringify({version:1,scope_key:scopeKey(scope),items}));
}
function cleanFields(fields:ProblemFields):ProblemFields {
  return {title:fields.title.trim(),location:fields.location.trim(),asset_id:fields.asset_id?.trim() || null,external_reference:fields.external_reference.trim(),owner:fields.owner.trim(),next_action:fields.next_action,due_date:fields.due_date,status:fields.status,closure_note:fields.closure_note.trim()};
}
function makeReport(input:ReportInput):Problem['reports'][number] {
  return {...input,description:input.description.trim(),source_reference:input.source_reference.trim(),reported_impact:input.reported_impact.trim(),occurred_at:new Date(input.occurred_at).toISOString(),report_id:crypto.randomUUID(),recorded_at:new Date().toISOString()};
}
export function createProblem(scope:ProblemScope, draft:NewProblem):Problem {
  validateFields(draft);validateReport(draft.report);
  const items=loadProblems(scope);const now=new Date().toISOString();
  const problem:Problem={...cleanFields(draft),problem_id:crypto.randomUUID(),revision:1,created_at:now,updated_at:now,reports:[makeReport(draft.report)],history:[{timestamp:now,note:'Problem recorded. Reported conditions are not independently verified.'}]};
  write(scope,[problem,...items]);return problem;
}
function currentProblem(items:Problem[], id:string, revision:number) {
  const problem=items.find(p=>p.problem_id===id);
  if(!problem || problem.revision!==revision) throw new Error('This problem changed in another view. Reload the problems list before saving.');
  return problem;
}
export function updateProblem(scope:ProblemScope, id:string, revision:number, fields:ProblemFields):Problem {
  validateFields(fields);const items=loadProblems(scope);const current=currentProblem(items,id,revision);
  const cleaned=cleanFields(fields);const now=new Date().toISOString();
  const labels:Record<keyof ProblemFields,string>={title:'Title',location:'Location',asset_id:'Linked asset',external_reference:'External reference',owner:'Responsible team',next_action:'Next action',due_date:'Due date',status:'Status',closure_note:'Closure reason'};
  const changes=(Object.keys(labels) as (keyof ProblemFields)[]).filter(k=>current[k]!==cleaned[k]).map(k=>`${labels[k]}: ${current[k] || '(blank)'} -> ${cleaned[k] || '(blank)'}`);
  if(!changes.length) return current;
  const problem:Problem={...current,...cleaned,revision:revision+1,updated_at:now,history:[...current.history,{timestamp:now,note:changes.join('\n')}]};
  write(scope,items.map(p=>p.problem_id===id?problem:p));return problem;
}
export function addProblemReport(scope:ProblemScope,id:string,revision:number,input:ReportInput):Problem {
  validateReport(input);const items=loadProblems(scope);const current=currentProblem(items,id,revision);const now=new Date().toISOString();
  const reopened=current.status==='Closed';
  const problem:Problem={...current,revision:revision+1,updated_at:now,reports:[...current.reports,makeReport(input)],status:reopened?'Open':current.status,closure_note:reopened?'':current.closure_note,
    history:[...current.history,{timestamp:now,note:`Additional report recorded.${reopened?' Closed problem reopened for follow-up.':''}`}]};
  write(scope,items.map(p=>p.problem_id===id?problem:p));return problem;
}
