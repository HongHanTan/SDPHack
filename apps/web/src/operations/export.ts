import type { InspectionRecord } from '../types';
import type { SelectedAsset } from '../maintenance/model';
import { problemEvidence, reportSourceLabel, type Problem, type ProblemScope } from './model';

function csvCell(value:unknown) {
  let text=String(value??'');
  // Open user-entered text as text when a spreadsheet reads the export.
  if(/^[\s]*[=+\-@]/.test(text)) text=`'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function problemsCsv(problems:Problem[]) {
  const rows:unknown[][]=[['Problem ID','Title','Location','Asset','External reference','Status','Responsible team','Next action','Due date','Total reports','Recorded reports','Synthetic reports','Other reports','Source labels','Updated at']];
  for(const p of problems) rows.push([p.problem_id,p.title,p.location,p.asset_id,p.external_reference,p.status,p.owner,p.next_action,p.due_date,p.reports.length,p.reports.filter(r=>r.source_type==='observed').length,p.reports.filter(r=>r.source_type==='synthetic').length,p.reports.filter(r=>!['observed','synthetic'].includes(r.source_type)).length,[...new Set(p.reports.map(r=>reportSourceLabel(r.source_type)))].join('; '),p.updated_at]);
  return rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
export function problemSnapshot(problem:Problem,scope:ProblemScope,inspections:InspectionRecord[],assets:SelectedAsset[],verifiedSiteModel:boolean) {
  const evidence=problemEvidence(problem,inspections,assets);
  return {format:'FloodOps problem evidence v1',exported_at:new Date().toISOString(),storage:'Browser-local problem register',scope,problem:structuredClone(problem),
    linked_asset_snapshot:evidence.asset?structuredClone(evidence.asset):null,asset_inspection_snapshot:structuredClone(evidence.related),
    model_is_marked_verified:verifiedSiteModel,
    notes:['Reports describe entered accounts and do not independently verify a cause.','Asset inspection history is not automatically proof of this particular incident.','Administrative closure does not certify flood performance.','No hydraulic result or cost saving is claimed by this problem record.']};
}
export function downloadText(filename:string,text:string,type:string) {
  const url=URL.createObjectURL(new Blob([text],{type}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
