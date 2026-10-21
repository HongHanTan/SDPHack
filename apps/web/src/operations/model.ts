import type { DataMode } from '../api/client';
import type { InspectionRecord, SourceType } from '../types';
import type { SelectedAsset } from '../maintenance/model';

export const PROBLEM_STATUSES = ['Open', 'Investigating', 'Monitoring', 'Closed'] as const;
export const NEXT_ACTIONS = ['Inspect location', 'Confirm asset information', 'Obtain quote', 'Engineering review', 'Review after rain', 'Prepare proposal'] as const;
export type ProblemStatus = typeof PROBLEM_STATUSES[number];
export interface ProblemScope { mode: DataMode; township_id: string; model_version_id: string; api_base_url: string }
export interface ReportInput {
  occurred_at: string; source_type: SourceType; source_reference: string;
  description: string; reported_impact: string;
}
export interface ProblemReport extends ReportInput { report_id: string; recorded_at: string }
export interface ProblemFields {
  title: string; location: string; asset_id: string | null; external_reference: string;
  owner: string; next_action: typeof NEXT_ACTIONS[number]; due_date: string;
  status: ProblemStatus; closure_note: string;
}
export interface Problem extends ProblemFields {
  problem_id: string; revision: number; created_at: string; updated_at: string;
  reports: ProblemReport[];
  history: { timestamp: string; note: string }[];
}
export interface NewProblem extends ProblemFields { report: ReportInput }
export const scopeKey = (scope: ProblemScope) => JSON.stringify([scope.mode, scope.township_id, scope.model_version_id, scope.mode === 'api' ? scope.api_base_url.replace(/\/+$/, '') : '']);
export function localDay(now = Date.now()) {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validateReport(report: ReportInput, now = Date.now()) {
  if(!report.description.trim() || !report.source_reference.trim()) throw new Error('Enter the report description and its source reference.');
  if(!['observed','synthetic','assumed','literature_derived'].includes(report.source_type)) throw new Error('Choose a valid report source.');
  if(!report.occurred_at || !Number.isFinite(Date.parse(report.occurred_at)) || Date.parse(report.occurred_at)>now) throw new Error('The incident time must be a valid time at or before now.');
  if(report.description.length>10000 || report.source_reference.length>1000 || report.reported_impact.length>2000) throw new Error('Report text is too long. Shorten the description or reference.');
}
export function validateFields(fields: ProblemFields) {
  if(!fields.title.trim() || !fields.location.trim()) throw new Error('Enter a problem title and location.');
  if(!PROBLEM_STATUSES.includes(fields.status) || !NEXT_ACTIONS.includes(fields.next_action)) throw new Error('Choose a valid status and next action.');
  if(fields.due_date && !validDay(fields.due_date)) throw new Error('Enter a valid action due date.');
  if(fields.status==='Closed' && !fields.closure_note.trim()) throw new Error('Explain why the problem is being closed. Closure does not certify flood performance.');
  if(fields.title.length>200 || fields.location.length>500 || fields.owner.length>200 || fields.external_reference.length>500 || fields.closure_note.length>10000) throw new Error('Problem text is too long. Shorten the title, location or notes.');
}
export function latestReport(problem: Problem) {
  return [...problem.reports].sort((a,b)=>Date.parse(b.occurred_at)-Date.parse(a.occurred_at))[0];
}
export function problemEvidence(problem: Problem, inspections: InspectionRecord[], assets: SelectedAsset[], now = Date.now()) {
  const asset=assets.find(a=>a.id===problem.asset_id);
  const related=problem.asset_id ? inspections.filter(i=>i.asset_id===problem.asset_id).sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp)) : [];
  const last=latestReport(problem);
  const observedInspection=related.find(i=>i.source_type==='observed' && Date.parse(i.timestamp)>=Date.parse(last.occurred_at) && Date.parse(i.timestamp)<=now);
  const overdue=problem.status!=='Closed' && !!problem.due_date && problem.due_date<localDay(now);
  const observedReports=problem.reports.filter(r=>r.source_type==='observed').length;
  const flags:string[]=[];
  if(problem.status!=='Closed') {
    if(!asset) flags.push(problem.asset_id?'Linked asset is unavailable in this dataset':'Asset not linked');
    if(!observedInspection) flags.push('No observed asset inspection since the latest report');
    if(!problem.owner.trim()) flags.push('Responsible team not assigned');
    if(!problem.due_date) flags.push('Action date not set');
    if(overdue) flags.push('Next action overdue');
  }
  return { asset, related, observedInspection, overdue, observedReports, demonstrationReports:problem.reports.filter(r=>r.source_type==='synthetic').length, flags };
}
export function sortProblems(problems: Problem[], now = Date.now()) {
  const overdue=(p:Problem)=>p.status!=='Closed' && !!p.due_date && p.due_date<localDay(now);
  const firstReport=(p:Problem)=>Math.min(...p.reports.map(r=>Date.parse(r.occurred_at)));
  return [...problems].sort((a,b)=>Number(a.status==='Closed')-Number(b.status==='Closed') || Number(overdue(b))-Number(overdue(a)) || firstReport(a)-firstReport(b) || a.problem_id.localeCompare(b.problem_id));
}
export const reportSourceLabel = (source:SourceType) => ({observed:'Recorded report',synthetic:'Synthetic demonstration',assumed:'Assumption',literature_derived:'Document reference',imported:'Imported site file'}[source]);
export const problemReference = (problem: Problem) => `Problem reference: ${problem.problem_id}.`;
