import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, Download, MapPin, Plus, RefreshCw, Search } from 'lucide-react';
import type { AssetConduit, AssetInlet, AssetNode, InspectionRecord } from '../types';
import type { MaintenanceHandoff, SelectedAsset } from '../maintenance/model';
import { ProblemDetails } from './ProblemDetails';
import { ProblemForm } from './ProblemForm';
import { downloadText, problemSnapshot, problemsCsv } from './export';
import { addProblemReport, createProblem, loadProblems, problemStorageKey, updateProblem } from './repository';
import { latestReport, problemEvidence, problemReference, scopeKey, sortProblems, type NewProblem, type Problem, type ProblemFields, type ProblemScope, type ReportInput } from './model';
import './operations.css';

interface Props {
  visible:boolean;scope:ProblemScope;nodes:Pick<AssetNode,'node_id'>[];inlets:Pick<AssetInlet,'inlet_id'>[];conduits:Pick<AssetConduit,'conduit_id'>[];inspections:InspectionRecord[];datasetDescription?:string;
  modelVerified:boolean;assetsLoading:boolean;dataError:string|null;
  onDemo:()=>void;onMaintenance:()=>void;onLocate:(asset:SelectedAsset)=>void;onInspect:(id:string)=>void;onPrepare:(handoff:MaintenanceHandoff)=>void;
}
type Filter='Open problems'|'Overdue actions'|'Needs inspection'|'Unassigned'|'Repeat reports'|'Closed'|'All records';
const FILTERS:Filter[]=['Open problems','Overdue actions','Needs inspection','Unassigned','Repeat reports','Closed','All records'];

export function OperationsDashboard({visible,scope,nodes,inlets,conduits,inspections,modelVerified,assetsLoading,dataError,onDemo,onMaintenance,onLocate,onInspect,onPrepare,datasetDescription}:Props) {
  const [problems,setProblems]=useState<Problem[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [loaded,setLoaded]=useState(false);
  const [loadError,setLoadError]=useState('');
  const [actionError,setActionError]=useState('');
  const [notice,setNotice]=useState('');
  const [filter,setFilter]=useState<Filter>('Open problems');
  const [sourceFilter,setSourceFilter]=useState('all');
  const [query,setQuery]=useState('');
  const [editor,setEditor]=useState<'new'|'report'|null>(null);
  const key=scopeKey(scope);
  const assets=useMemo<SelectedAsset[]>(()=>[...inlets.map(data=>({id:data.inlet_id,type:'inlet' as const,data})),...conduits.map(data=>({id:data.conduit_id,type:'conduit' as const,data})),...nodes.map(data=>({id:data.node_id,type:'node' as const,data}))],[nodes,inlets,conduits]);
  const reload=useCallback(()=>{
    try {const items=loadProblems(scope);setProblems(items);setLoadError('');setSelectedId(id=>items.some(p=>p.problem_id===id)?id:null);}
    catch(err){setLoadError(err instanceof Error?err.message:String(err));}
    finally {setLoaded(true);}
  },[key]);
  useEffect(()=>{if(visible)reload();},[visible,reload]);
  useEffect(()=>{
    const changed=(event:StorageEvent)=>{if(event.key===problemStorageKey(scope)||event.key===null){setLoadError('Problem records changed in another tab. Reload before editing so you can review the latest version.');}};
    window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);
  },[key]);
  const selected=problems.find(p=>p.problem_id===selectedId)??null;
  const evidence=new Map(problems.map(p=>[p.problem_id,problemEvidence(p,inspections,assets)]));
  const active=problems.filter(p=>p.status!=='Closed');
  const matching=sortProblems(problems).filter(p=>{
    const e=evidence.get(p.problem_id)!;
    if(filter==='Open problems'&&p.status==='Closed' || filter==='Closed'&&p.status!=='Closed' || filter==='Overdue actions'&&!e.overdue || filter==='Needs inspection'&&(p.status==='Closed'||!!e.observedInspection) || filter==='Unassigned'&&(p.status==='Closed'||!!p.owner.trim()) || filter==='Repeat reports'&&p.reports.length<2) return false;
    if(sourceFilter!=='all'&&!p.reports.some(r=>r.source_type===sourceFilter)) return false;
    const text=[p.title,p.location,p.asset_id,p.external_reference,p.owner].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const remember=(problem:Problem,message:string)=>{setProblems(items=>[problem,...items.filter(p=>p.problem_id!==problem.problem_id)]);setSelectedId(problem.problem_id);setActionError('');setNotice(message);};
  const add=(draft:NewProblem)=>{if(loadError||!loaded||assetsLoading)throw new Error('Wait for the dataset selection to load, then reload the problem records before editing.');const problem=createProblem(scope,draft);setFilter('Open problems');setSourceFilter('all');setQuery('');remember(problem,'Problem saved in this browser. Assign a next action or record an inspection.');};
  const update=(fields:ProblemFields)=>{if(!selected||loadError)throw new Error('Reload and select the problem before editing.');remember(updateProblem(scope,selected.problem_id,selected.revision,fields),'Next action saved. No person or contractor has been contacted.');};
  const report=(input:ReportInput)=>{if(!selected||loadError)throw new Error('Reload and select the problem before editing.');remember(addProblemReport(scope,selected.problem_id,selected.revision,input),'Additional report saved. Source labels are retained.');setFilter('Open problems');};
  const prepare=()=>{
    if(!selected?.asset_id)return;
    const recent=latestReport(selected);
    onPrepare({handoff_id:crypto.randomUUID(),mode:scope.mode,asset_id:selected.asset_id,option_id:null,owner:selected.owner,
      scope:`${selected.next_action}: ${selected.title} at ${selected.location}. Confirm the reported condition and document the findings.`,
      justification:`${problemReference(selected)} Existing reference: ${selected.external_reference||'not supplied'}. ${selected.reports.length} entered report(s), including ${evidence.get(selected.problem_id)!.observedReports} recorded report(s). Latest entered account (${recent.source_type}, ${recent.occurred_at}): ${recent.description}. Next action: ${selected.next_action}. Source records are attached to the problem export. No hydraulic improvement or cost saving is claimed.`,comparison:null});
  };
  const exportSelected=()=>{if(!selected)return;try{downloadText(`FloodOps-problem-${selected.problem_id}.json`,JSON.stringify(problemSnapshot(selected,scope,inspections,assets,modelVerified),null,2),'application/json');setActionError('');}catch(err){setActionError(String(err));}};
  if(!visible)return null;
  return <main className="operations-dashboard" aria-label="Drainage operations dashboard">
    <header className="operations-heading"><div><span className="problem-kicker">Township operations</span><h1>What needs follow-up?</h1><p>Start with a reported problem. Check the evidence. Give the next action an owner.</p></div><div className="problem-actions"><button onClick={onDemo}>Open browser demo <ArrowRight size={14}/></button><button onClick={onMaintenance}>Asset maintenance</button><button className="problem-primary" disabled={!loaded||!!loadError||assetsLoading} onClick={()=>setEditor('new')}><Plus size={15}/> Record a problem</button></div></header>
    <div className="operations-context"><span>Problem register: <b>this browser only</b></span><span>Dataset: {scope.model_version_id}</span><span>{scope.mode==='api'?'Asset / inspection source: connected API':scope.mode==='engine'?'Asset / inspection source: browser engine':'Asset / inspection source: offline replay'}</span><span>{datasetDescription ?? (modelVerified?'Dataset marked as a verified site model':'Illustrative assets / uncalibrated site model')}</span></div>
    <div className="operations-metrics" aria-label="Counts from entered problem records">{[
      ['Open problems',active.length,'Active investigation records'],['Overdue actions',active.filter(p=>evidence.get(p.problem_id)?.overdue).length,'Due date earlier than today'],['Needs inspection',assetsLoading||dataError?'--':active.filter(p=>!evidence.get(p.problem_id)?.observedInspection).length,'No later observed asset inspection'],['Unassigned',active.filter(p=>!p.owner.trim()).length,'No responsible person / team'],
    ].map(([label,count,help])=><button key={label} aria-pressed={filter===label} onClick={()=>{setFilter(label as Filter);setQuery('');}}><span>{label}</span><strong>{loaded&&!loadError?count:'--'}</strong><small>{help}</small></button>)}</div>
    {dataError&&<div role="alert" className="problem-error">Asset / inspection data could not be refreshed: {dataError}. Problem reports are separate browser records; inspection availability may be incomplete.</div>}
    {loadError&&<div role="alert" className="problem-error">{loadError}<div className="problem-actions"><button onClick={reload}><RefreshCw size={13}/> Reload records</button><button onClick={()=>{try{const raw=localStorage.getItem(problemStorageKey(scope));downloadText('FloodOps-problem-storage-recovery.json',raw??'null','application/json');}catch(err){setActionError(String(err));}}}>Export stored data for recovery</button></div></div>}
    {actionError&&<div role="alert" className="problem-error">{actionError}</div>}{notice&&<div role="status" className="problem-notice operations-notice">{notice}</div>}
    <div className="operations-layout"><section className="problem-register" aria-label="Problems list">
      <div className="problem-register-heading"><div><h2>Problems list</h2><small>{loaded?`${matching.length} of ${problems.length} records`:'Loading browser records...'}</small></div><div className="problem-actions"><button aria-label="Reload problems" onClick={reload}><RefreshCw size={14}/></button><button disabled={!loaded||!!loadError||!problems.length} onClick={()=>{try{downloadText('FloodOps-problems.csv',problemsCsv(problems),'text/csv;charset=utf-8');setActionError('');}catch(err){setActionError(String(err));}}}><Download size={14}/> CSV</button></div></div>
      <label className="problem-search"><Search size={15}/><input aria-label="Search problems" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search location, asset, reference or team"/></label>
      <div className="problem-filter-row"><label>Show<select aria-label="Filter problems" value={filter} onChange={e=>setFilter(e.target.value as Filter)}>{FILTERS.map(f=><option key={f}>{f}</option>)}</select></label><label>Report source<select value={sourceFilter} onChange={e=>setSourceFilter(e.target.value)}><option value="all">All sources</option><option value="observed">Includes recorded report</option><option value="synthetic">Includes synthetic demo</option><option value="assumed">Includes assumption</option><option value="literature_derived">Includes document reference</option></select></label></div>
      <p className="problem-sort-note">Overdue actions first, then oldest initial report. This is a follow-up list, not a flood-risk ranking.</p>
      {!loaded?<div className="problem-empty">Loading saved records...</div>:loadError?<div className="problem-empty">Reload to review the current records. Editing is paused.</div>:!problems.length?<div className="problem-empty"><MapPin size={29}/><h3>No drainage problems recorded</h3><p>Record a complaint or inspection finding to start an investigation. The dashboard does not invent incidents.</p><button className="problem-primary" disabled={assetsLoading} onClick={()=>setEditor('new')}>Record the first problem</button><button onClick={onDemo}>Explore the guided D07 demo</button></div>:!matching.length?<div className="problem-empty"><h3>No matching records</h3><p>Change the filters or search to see other problems.</p><button onClick={()=>{setFilter('All records');setSourceFilter('all');setQuery('');}}>Show all records</button></div>:<ul className="problem-list">{matching.map(p=>{
        const e=evidence.get(p.problem_id)!;
        return <li key={p.problem_id}><button aria-pressed={selectedId===p.problem_id} className={selectedId===p.problem_id?'selected':''} onClick={()=>{setSelectedId(p.problem_id);setNotice('');}}><div className="problem-row-top"><span className={`problem-status ${p.status.toLowerCase()}`}>{p.status}</span>{e.overdue&&<span className="problem-overdue"><CalendarClock size={12}/> Overdue</span>}</div><h3>{p.title}</h3><p>{p.location}</p><small>{p.asset_id??'Asset not identified'}{p.external_reference?` | ${p.external_reference}`:''}</small><div className="problem-row-counts"><span>{p.reports.length} entered report{p.reports.length===1?'':'s'}</span>{e.observedReports>0&&<span>{e.observedReports} recorded</span>}{e.demonstrationReports>0&&<span className="problem-demo-count">{e.demonstrationReports} synthetic</span>}</div><div className="problem-row-next"><b>{p.next_action}</b><small>{p.owner||'Unassigned'} | {p.due_date||'No due date'}</small></div>{e.flags.length>0&&<span className="problem-row-flag">{e.flags[0]}{e.flags.length>1?` + ${e.flags.length-1} more`:''}</span>}</button></li>;
      })}</ul>}
    </section>
      {selected?<ProblemDetails key={`${selected.problem_id}:${selected.revision}`} problem={selected} assets={assets} inspections={inspections} modelVerified={modelVerified} datasetDescription={datasetDescription} readOnly={!!loadError} dataUnavailable={assetsLoading||!!dataError} onSave={update} onReport={()=>setEditor('report')} onInspect={onInspect} onLocate={onLocate} onPrepare={prepare} onExport={exportSelected}/>:<aside className="problem-start"><span className="problem-kicker">An investigation with a clear next step</span><h2>Choose a problem to work through.</h2><ol><li><b>Understand the report</b><span>Locate it and retain its source.</span></li><li><b>Check what is missing</b><span>Identify the asset and inspect its condition.</span></li><li><b>Assign the next action</b><span>Record who will follow up and when.</span></li><li><b>Prepare a reviewable proposal</b><span>Carry the findings into scope and cost review.</span></li></ol><div className="problem-notice">This register tracks entered reports and follow-up work. It does not automatically detect flooding, assign a risk score or establish a hydraulic cause.</div></aside>}
    </div>
    {editor&&<ProblemForm assets={assets} problem={editor==='report'?selected:null} onClose={()=>setEditor(null)} onCreate={add} onReport={report}/>}
  </main>;
}
