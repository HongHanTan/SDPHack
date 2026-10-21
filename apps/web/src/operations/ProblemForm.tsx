import { useState } from 'react';
import { X } from 'lucide-react';
import type { SelectedAsset } from '../maintenance/model';
import { NEXT_ACTIONS, localDay, type NewProblem, type Problem, type ReportInput } from './model';

export function localTimestamp(value=Date.now()) {
  const date=new Date(value);
  return new Date(value-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
const blankReport = ():ReportInput=>({occurred_at:localTimestamp(),source_type:'synthetic',source_reference:'',description:'',reported_impact:''});

export function ReportFields({value,onChange}:{value:ReportInput;onChange:(value:ReportInput)=>void}) {
  return <>
    <div className="problem-form-grid"><label>Incident date and time<input required type="datetime-local" max={localTimestamp()} value={value.occurred_at} onChange={e=>onChange({...value,occurred_at:e.target.value})}/></label>
      <label>Report source<select value={value.source_type} onChange={e=>onChange({...value,source_type:e.target.value as ReportInput['source_type']})}><option value="synthetic">Synthetic demonstration</option><option value="observed">Recorded report</option><option value="assumed">Assumption</option><option value="literature_derived">Document reference</option></select></label></div>
    <p className="problem-help">A recorded report describes an account of an incident. It does not independently verify the cause. Keep practice entries labelled synthetic.</p>
    <label>Source reference<input required maxLength={1000} value={value.source_reference} onChange={e=>onChange({...value,source_reference:e.target.value})} placeholder="Complaint ID, site visit reference, document or demo case"/></label>
    <label>What was reported?<textarea required maxLength={10000} value={value.description} onChange={e=>onChange({...value,description:e.target.value})} placeholder="Describe the water, location and conditions that were reported."/></label>
    <label>Reported impact (optional)<input maxLength={2000} value={value.reported_impact} onChange={e=>onChange({...value,reported_impact:e.target.value})} placeholder="For example: resident reported difficulty accessing a driveway"/></label>
  </>;
}
export function AssetSelect({assets,value,onChange}:{assets:SelectedAsset[];value:string|null;onChange:(id:string|null)=>void}) {
  return <label>Linked asset<select value={value??''} onChange={e=>onChange(e.target.value||null)}><option value="">Not identified yet</option>{value&&!assets.some(a=>a.id===value)&&<option value={value}>{value} (unavailable in current dataset)</option>}{assets.map(a=><option key={a.id} value={a.id}>{a.id} ({a.type})</option>)}</select><small>Linking an asset records your investigation target; it does not confirm the cause.</small></label>;
}

export function ProblemForm({assets,onClose,onCreate,onReport,problem}:{assets:SelectedAsset[];onClose:()=>void;onCreate:(draft:NewProblem)=>void;onReport:(report:ReportInput)=>void;problem:Problem|null}) {
  const [report,setReport]=useState(blankReport);
  const [draft,setDraft]=useState<Omit<NewProblem,'report'>>({title:'',location:'',asset_id:null,external_reference:'',owner:'',next_action:'Inspect location',due_date:'',status:'Open',closure_note:''});
  const [error,setError]=useState('');
  return <div className="problem-modal" role="dialog" aria-modal="true" aria-label={problem?'Add incident report':'Record drainage problem'}><form className="problem-dialog" onSubmit={e=>{
    e.preventDefault();setError('');try{if(problem)onReport(report);else onCreate({...draft,report});onClose();}catch(err){setError(err instanceof Error?err.message:String(err));}
  }}><header><div><span className="problem-kicker">{problem?'Append a report':'Start an investigation'}</span><h2>{problem?'Add a report to this problem':'Record a drainage problem'}</h2><p>{problem?problem.title:'Start with what was reported. You can identify the asset and assign the work later.'}</p></div><button type="button" aria-label="Close problem form" onClick={onClose}><X size={18}/></button></header>
    <div className="problem-form-body">
      {problem&&<div className="problem-notice">Each entry adds one report. Only add an additional account or incident; duplicate entries inflate the count. A new report reopens a closed problem.</div>}
      {!problem&&<>
        <label>Problem title<input required maxLength={200} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="Water collecting at the end of the street"/></label>
        <label>Location<input required maxLength={500} value={draft.location} onChange={e=>setDraft({...draft,location:e.target.value})} placeholder="Street, landmark or description from the report"/></label>
        <AssetSelect assets={assets} value={draft.asset_id} onChange={asset_id=>setDraft({...draft,asset_id})}/>
        <label>Existing complaint / work-order reference (optional)<input maxLength={500} value={draft.external_reference} onChange={e=>setDraft({...draft,external_reference:e.target.value})} placeholder="Reference used by your existing process"/></label>
      </>}
      <fieldset><legend>{problem?'Additional report':'First report'}</legend><ReportFields value={report} onChange={setReport}/></fieldset>
      {!problem&&<fieldset><legend>Next action</legend><label>Responsible person / team (optional)<input maxLength={200} value={draft.owner} onChange={e=>setDraft({...draft,owner:e.target.value})}/></label><div className="problem-form-grid"><label>Action<select value={draft.next_action} onChange={e=>setDraft({...draft,next_action:e.target.value as NewProblem['next_action']})}>{NEXT_ACTIONS.map(a=><option key={a}>{a}</option>)}</select></label><label>Due date (optional)<input type="date" value={draft.due_date} onChange={e=>setDraft({...draft,due_date:e.target.value})}/><small>Today: {localDay()}</small></label></div></fieldset>}
      {error&&<p role="alert" className="problem-error">{error}</p>}
    </div><footer><span>Saved in this browser. Export to retain a copy.</span><button type="submit" className="problem-primary">{problem?'Add report':'Save problem'}</button></footer>
  </form></div>;
}
