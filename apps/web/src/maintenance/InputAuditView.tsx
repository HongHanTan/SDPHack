import type { ComparisonResult } from './model';
import { auditEnginePair } from './inputAudit';

export function InputAuditView({baseline,candidate,mode}:{baseline?:ComparisonResult;candidate?:ComparisonResult;mode:'engine'|'api'|'mock'}) {
  if(!baseline?.input_snapshot||!candidate?.input_snapshot||candidate.option_id==='baseline')return null;
  const before=baseline.input_snapshot,after=candidate.input_snapshot;
  const checks=mode==='engine'?auditEnginePair(before,after):{passed:['storm','tailwater','hydrology'].every(key=>before[key]!==undefined&&JSON.stringify(before[key])===JSON.stringify(after[key])),problems:[]};
  const intervention=after.intervention as {changes?:{path:string;before:unknown;after:unknown}[]}|null;
  return <details className="input-audit"><summary>{checks.passed?'Shared input checks passed':'Input mismatch - do not use this comparison'}</summary><p>{mode==='engine'?'Storm, grid fingerprints, initial-water fingerprints, boundary, base loss and timing match. Candidate network and catchments match only its selected actions.':'Storm, boundary and hydrology match. Saving a modelled proposal also reconstructs the allowed changes server-side from retained native inputs.'}</p>{checks.problems.map(p=><p key={p}>{p}</p>)}{intervention?.changes?.map(change=><p key={change.path}><b>{change.path}</b>: {change.before===null?'Absent':typeof change.before==='object'?'Original definition':String(change.before)} → {typeof change.after==='object'?'Conceptual node/link added':String(change.after)}</p>)}{mode==='engine'&&<p>Actions: {(after.interventions as string[]).join(', ')}</p>}</details>;
}
