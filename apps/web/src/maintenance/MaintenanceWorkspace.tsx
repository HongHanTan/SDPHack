import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, MapPin, Plus, X } from 'lucide-react';
import type { AssetConduit, AssetInlet, AssetNode, BootstrapResponse, InspectionRecord } from '../types';
import { OPTIONS, runComparison } from './comparison';
import { assetInspections, assetLocation, buildPriorities, comparisonCurrent, emptyEstimate, estimateTotal, inletVolumes, money, quoteReady, STATUSES, type Comparison, type Estimate, type Proposal, type ScenarioSelection, type SelectedAsset } from './model';
import { createProposal, exportProposal, listProposals, transitionProposal } from './repository';
import type { MaintenanceHandoff } from './model';
import { InputAuditView } from './InputAuditView';
import './maintenance.css';

export type WorkspaceView = 'priorities' | 'compare' | 'proposals';
interface Props {
  view: WorkspaceView | null; onView: (view: WorkspaceView | null) => void;
  nodes: AssetNode[]; inlets: AssetInlet[]; conduits: AssetConduit[]; inspections: InspectionRecord[];
  selectedAsset: SelectedAsset | null; onSelectAsset: (asset: SelectedAsset) => void;
  onInspect: (id: string) => void; scenario: ScenarioSelection;
  bootstrap?: BootstrapResponse | null;
  onScenarioChange?: (field: 'storm_id' | 'debris_id' | 'tailwater', value: string) => void;
  onPreview?: (optionId: string, runId?: string) => Promise<void>;
  previewBusy?: boolean;
  handoff?: MaintenanceHandoff | null;
  onOpenStory?: () => void;
}
export function MaintenanceWorkspace({view, onView, nodes, inlets, conduits, inspections, selectedAsset, onSelectAsset, onInspect, scenario, bootstrap, onScenarioChange, onPreview, previewBusy, handoff, onOpenStory}: Props) {
  const priorities = useMemo(() => buildPriorities(nodes, inlets, conduits, inspections), [nodes, inlets, conduits, inspections]);
  const [filter, setFilter] = useState('All');
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [estimates, setEstimates] = useState<Record<string, Estimate>>({});
  const [scope, setScope] = useState('');
  const [owner, setOwner] = useState('');
  const [justification, setJustification] = useState('');
  const [budget, setBudget] = useState<number | null>(null);
  const [transitionNote, setTransitionNote] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const abort = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const preparedFor = useRef<string | null>(null);
  const consumedHandoff = useRef<string | null>(null);
  const currentMode = useRef(scenario.mode);
  currentMode.current = scenario.mode;
  const target = selectedAsset ?? priorities.find(p => p.id === 'INLET-D07') ?? priorities[0];
  const estimateKey = `${target?.id ?? ''}:${optionId ?? 'inspection'}`;
  const estimate = estimates[estimateKey] ?? emptyEstimate();
  const setEstimate = (value: Estimate) => setEstimates(prev => ({...prev, [estimateKey]: value}));
  const total = estimateTotal(estimate);
  const current = comparisonCurrent(comparison, scenario);
  const selectedProposal = proposals.find(p => p.proposal_id === selectedProposalId);
  const relevantInspections = target ? assetInspections(target.id, inspections) : [];
  const selectedResult = comparison?.results.find(r => r.option_id === optionId);

  useEffect(() => { let active = true; setError(''); setProposals([]); setSelectedProposalId(null); setOptionId(null); setComparison(null); epoch.current++; abort.current?.abort(); setBusy(false);
    listProposals(scenario.mode).then(items => {if(active) setProposals(items);}).catch(e=>{if(active) setError(`Could not load proposals: ${String(e)}`);});
    return () => { active = false; abort.current?.abort(); };
  }, [scenario.mode]);
  useEffect(() => {
    if(preparedFor.current === target?.id) {preparedFor.current=null; return;}
    preparedFor.current=null; setScope(''); setJustification(''); setOptionId(null); setSelectedProposalId(null);
  }, [target?.id]);
  useEffect(() => () => {epoch.current++; abort.current?.abort();}, []);

  const select = (asset: SelectedAsset) => {onSelectAsset(asset);};
  const refresh = async () => {const items = await listProposals(scenario.mode); if(currentMode.current === scenario.mode) setProposals(items);};
  const calculate = async () => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const myEpoch = ++epoch.current; setBusy(true); setError(''); setNotice(''); setOptionId(null);
    try { await runComparison(scenario, c => { if (epoch.current === myEpoch) setComparison(c); }, controller.signal,
      assetInspections('INLET-D07', inspections)[0]?.inspection_id); }
    catch(e) {if(epoch.current === myEpoch) setError(String(e));}
    finally {if(epoch.current === myEpoch) setBusy(false);}
  };
  const beginDraft = (asset: SelectedAsset, id: string | null, work: string, reason: string, cost?: Estimate) => {
    preparedFor.current=asset.id; select(asset); setOptionId(id); setScope(work); setJustification(reason);
    if(cost) setEstimates(prev=>({...prev,[`${asset.id}:${id ?? 'inspection'}`]:cost}));
    setSelectedProposalId(null); onView('proposals'); setNotice('');
  };
  useEffect(() => {
    if(!handoff || handoff.mode!==scenario.mode || consumedHandoff.current===handoff.handoff_id) return;
    const asset=priorities.find(p=>p.id===handoff.asset_id);
    if(!asset) return;
    consumedHandoff.current=handoff.handoff_id;
    setComparison(handoff.comparison);
    if(handoff.owner!==undefined) setOwner(handoff.owner);
    beginDraft(asset,handoff.option_id,handoff.scope,handoff.justification);
  }, [handoff, priorities, scenario.mode]);
  const prepare = (id: string) => {
    const option=OPTIONS.find(o=>o.id===id);
    const asset=option ? priorities.find(p=>p.id===option.assets[0]) : undefined;
    if(option && asset) beginDraft(asset,id,option.title,option.constraint);
  };
  const save = async () => {
    setError(''); setNotice('');
    if(!target || !scope.trim() || !owner.trim() || !justification.trim()) {setError('Select an asset and enter scope, responsible person and justification.'); return;}
    if (!estimate.lines.length || estimate.lines.some(l => !l.description.trim() || !l.unit.trim() || !Number.isFinite(l.quantity) || l.quantity <= 0 || l.rate !== null && (!Number.isFinite(l.rate) || l.rate < 0))) {setError('Each cost item needs a description, unit and positive quantity. Rates must be blank or non-negative.'); return;}
    if(optionId && (!current || selectedResult?.status !== 'succeeded' || !selectedResult.target_asset_ids.includes(target.id))) {setError('Run a current comparison for this action and asset before saving its modelled benefit.'); return;}
    if(estimate.basis === 'quote' && !quoteReady(estimate)) {setError('A quote requires a source, valid date and all line-item rates.'); return;}
    if(mutating) return;
    setMutating(true);
    try {
      const saved = await createProposal({ asset_id: target.id, location: assetLocation(target.id), scope, owner, justification, mode: scenario.mode,
        estimate, inspection_ids: relevantInspections.map(i=>i.inspection_id), inspection_snapshot: relevantInspections,
        comparison: optionId ? comparison : null, option_id: optionId });
      if (currentMode.current !== scenario.mode) return;
      await refresh(); setSelectedProposalId(saved.proposal_id); setNotice('Draft saved. No contractor has been contacted.');
    } catch(e) {setError(`Proposal was not saved: ${String(e)}`);} finally {setMutating(false);}
  };
  const advance = async () => {
    if(!selectedProposal || mutating) return;
    const next = STATUSES[STATUSES.indexOf(selectedProposal.status)+1]; if(!next) return;
    setMutating(true);
    try { const p = await transitionProposal(selectedProposal, next, transitionNote, inspections.find(i=>i.inspection_id === verificationId)); if(currentMode.current !== scenario.mode) return; await refresh(); setSelectedProposalId(p.proposal_id); setTransitionNote(''); setNotice(`Recorded ${next}. This is a status record, not a dispatch notification.`); setError(''); }
    catch(e) {setError(String(e));} finally {setMutating(false);}
  };
  if(!view) return null;
  const successful = comparison?.results.filter(r=>r.option_id !== 'baseline' && r.status === 'succeeded' && r.metrics) ?? [];
  const best = successful.reduce<typeof successful[number] | undefined>((best, r) => !best || r.metrics!.total_flooding_volume_m3 < best.metrics!.total_flooding_volume_m3 ? r : best, undefined);
  const bestCount = successful.filter(r=>best && Math.abs(r.metrics!.total_flooding_volume_m3-best.metrics!.total_flooding_volume_m3)<0.005).length;
  const baseline = comparison?.results.find(r=>r.option_id === 'baseline' && r.status === 'succeeded');
  const quoted = successful.filter(r=>quoteReady(estimates[`${r.target_asset_ids[0]}:${r.option_id}`] ?? emptyEstimate()));
  const cheapest = quoted.reduce<typeof successful[number] | undefined>((best,r) => !best || estimateTotal(estimates[`${r.target_asset_ids[0]}:${r.option_id}`])! < estimateTotal(estimates[`${best.target_asset_ids[0]}:${best.option_id}`])! ? r : best, quoted[0]);
  return <section className={`ops maintenance-workspace ${view === 'priorities' ? '' : 'expanded'}`} aria-label="Maintenance workspace">
    <div className="ops-head"><div><span className="ops-eyebrow">Township operations / maintenance</span><h2>{view === 'priorities' ? 'What needs attention?' : view === 'compare' ? 'Compare before committing' : 'Plan and verify work'}</h2><p>Locate the asset. Check the evidence. Justify the expenditure.</p></div><button aria-label="Close maintenance workspace" onClick={()=>onView(null)}><X size={18}/></button></div>
    <div className="ops-tabs">{onOpenStory && <button onClick={onOpenStory}>Guided browser demo</button>}{(['priorities','compare','proposals'] as const).map(t=><button key={t} aria-pressed={view === t} className={view === t ? 'active' : ''} onClick={()=>{onView(t); setError('');}}>{t === 'priorities' ? 'Priorities' : t === 'compare' ? 'Compare actions' : `Work proposals (${proposals.length})`}</button>)}</div>
    <div className="ops-body">
      {error && <div role="alert" className="ops-error">{error}<button onClick={()=>{void refresh().then(()=>setError('')).catch(e=>setError(String(e)));}}>Reload saved proposals</button></div>}
      {notice && <div role="status" className="ops-notice">{notice}</div>}
      {view === 'priorities' && <>
        <div className="ops-summary">{['Inspect','Cleaning review','Engineering review'].map(category=><div key={category}><strong>{priorities.filter(p=>p.category===category).length}</strong><span>{category}</span></div>)}</div>
        <div className="ops-notice">Illustrative locations and uncalibrated model. Priorities follow evidence rules, not a flood-risk score. Current observed evidence means within 90 days; this policy needs local agreement.</div>
        <div className="ops-inline"><label>Show<select value={filter} onChange={e=>setFilter(e.target.value)}>{['All','Inspect','Cleaning review','Engineering review','Routine monitoring'].map(x=><option key={x}>{x}</option>)}</select></label><div><small>Quoted proposed expenditure · excludes unknown estimates</small><b>{money(proposals.filter(p=>quoteReady(p.estimate)).reduce((s,p)=>s+estimateTotal(p.estimate)!,0))}</b><small>{proposals.filter(p=>!quoteReady(p.estimate)).length} proposals need a sourced estimate · drafts may overlap</small></div></div>
        {!priorities.length && <p>Load the township assets to build the maintenance list.</p>}
        {priorities.filter(p=>filter==='All'||p.category===filter).map(p=><article className="ops-priority" key={p.id}><div className="ops-priority-top"><div><b>{p.location}</b><small>{p.id} · illustrative location</small></div><span className="ops-badge warn">{p.category}</span></div><p>{p.reason}</p><small>Evidence: {p.inspection ? `${p.inspection.source_type} · ${new Date(p.inspection.timestamp).toLocaleDateString()}` : 'Missing'} · {proposals.filter(x=>x.asset_id === p.id).length} saved proposals</small><p>Latest proposal estimate: <b>{money(proposals.find(x=>x.asset_id===p.id) ? estimateTotal(proposals.find(x=>x.asset_id===p.id)!.estimate) : null)}</b></p><div className="ops-priority-actions"><button onClick={()=>{select(p); onView(null);}}><MapPin size={13}/> Locate / investigate</button><button onClick={()=>onInspect(p.id)}>Record inspection</button><button onClick={()=>{beginDraft(p,null,`Inspect ${p.id} and document condition`,'Establish current condition and collect missing evidence before specifying maintenance.');}}>Plan inspection</button></div></article>)}
      </>}
      {view === 'compare' && <>
        {bootstrap && <div className="ops-inline"><label>Storm<select value={scenario.storm_id} onChange={e=>onScenarioChange?.('storm_id',e.target.value)}>{bootstrap.storms.map(s=><option key={s.storm_id} value={s.storm_id}>{s.name}</option>)}</select></label><label>Inlet loss assumption<select value={scenario.debris_id} onChange={e=>onScenarioChange?.('debris_id',e.target.value)}>{bootstrap.debris_scenarios.map(d=><option key={d.debris_scenario_id} value={d.debris_scenario_id}>{d.name}</option>)}</select></label><label>Downstream condition<select value={scenario.tailwater} onChange={e=>onScenarioChange?.('tailwater',e.target.value)}>{bootstrap.tailwater_cases.map(t=><option key={t.tailwater_case} value={t.tailwater_case}>{t.name}</option>)}</select></label></div>}
        <div className="ops-notice"><b>{scenario.mode === 'engine' ? 'FloodOps browser engine · not EPA SWMM' : scenario.mode === 'api' ? 'EPA SWMM API' : 'Offline demo replay'}</b><br/>{scenario.storm_id} · {scenario.debris_id} · {scenario.tailwater} tailwater · model {scenario.model_version_id}<br/>All candidates start from the original network with the selected conditions. Only each option's stated changes differ.</div>
        <div className="ops-inline"><button className="ops-primary" disabled={busy} onClick={()=>void calculate()}>{busy ? 'Calculating candidates…' : 'Run matching comparisons'}</button>{busy && <button onClick={()=>{abort.current?.abort();}}>Cancel</button>}<label>Planning budget (RM)<input type="number" min="0" value={budget??''} placeholder="Optional" onChange={e=>setBudget(e.target.value===''?null:Number(e.target.value))}/></label></div>
        {comparison && !current && <div role="status" className="ops-error">Outdated comparison: scenario settings changed. Rerun before saving modelled benefits.</div>}
        {comparison && <p><code>{comparison.comparison_id}</code> · {new Date(comparison.created_at).toLocaleString()}<small>Result inputs: {comparison.scenario.storm_id} · {comparison.scenario.debris_id} · {comparison.scenario.tailwater} tailwater</small></p>}
        <div className="ops-table-wrap"><table><thead><tr><th>Option / feasibility</th><th>Modelled outcome</th><th>Estimate / decision</th></tr></thead><tbody>{OPTIONS.map(option=>{
          const r = comparison?.results.find(r=>r.option_id===option.id); const m = r?.metrics; const volumes = m ? inletVolumes(m) : null;
          const e = estimates[`${option.assets[0]}:${option.id}`]; const cost = e ? estimateTotal(e) : null;
          return <tr key={option.id}><td><b>{option.title}</b><small>{option.assets.join(' + ') || 'Original network'}</small><p>{option.constraint}</p>{current && baseline?.metrics && best && m && Math.abs(m.total_flooding_volume_m3-best.metrics!.total_flooding_volume_m3)<0.005 && m.total_flooding_volume_m3 < baseline.metrics.total_flooding_volume_m3 && <span className="ops-badge good">{bestCount>1?'Tied lowest displayed volume':'Lowest displayed volume'}</span>}</td><td>{m ? <><b>{m.total_flooding_volume_m3.toFixed(2)} m³</b><small>{m.metric_definitions.total_flooding_volume_m3 || 'Network node flooding volume'}</small>{baseline?.metrics && option.id!=='baseline' && <small>Change vs baseline: {(m.total_flooding_volume_m3-baseline.metrics.total_flooding_volume_m3).toFixed(2)} m³</small>}<small>{scenario.mode==='engine'?'Time at trunk capacity':'Surcharge'}: {(m.surcharge_duration_s/60).toFixed(1)} min</small>{volumes && <small>D07 capture / bypass: {volumes.captured_m3.toFixed(1)} / {volumes.surface_bypass_m3.toFixed(1)} m³</small>}<code>{r?.run_id} {r?.input_hash ? `· ${r.input_hash}` : ''}</code>{m.warnings.map(w=><p className="ops-error" key={w}>{w}</p>)}<InputAuditView baseline={baseline} candidate={r} mode={scenario.mode}/></> : <><b>{r?.status ?? 'Not run'}</b><small>{r?.error}</small></>}</td><td>{onPreview && <button disabled={!current||r?.status!=='succeeded'||busy||previewBusy} onClick={()=>{setError('');void onPreview(option.id,r?.run_id).catch(e=>setError(String(e)));}}>View on map{scenario.mode==='engine'?' (rerun)':''}</button>}{option.id==='baseline' ? 'Reference only' : <><b>{money(cost)}</b><small>{e?.basis==='quote' ? `Quote: ${e.source || 'Source missing'}` : 'No sourced estimate'}</small>{current && cheapest === r && e && quoteReady(e) && <span className="ops-badge good">Lowest among entered quotes</span>}{cost!==null&&budget!==null&&<span className={`ops-badge ${cost<=budget?'good':'warn'}`}>{cost<=budget?'Within entered budget':'Over entered budget'}</span>}<button disabled={!current||r?.status!=='succeeded'||busy} onClick={()=>prepare(option.id)}>Estimate / draft <ArrowRight size={13}/></button></>}</td></tr>;
        })}</tbody></table></div><p>Benefits are conditional on the selected synthetic model. Lower network flooding alone can coincide with increased inlet bypass. Review all available metrics before selecting work. No avoided-damage or monetary savings claim is calculated.</p>
      </>}
      {view === 'proposals' && <div className="ops-two-col">
        <div><h3>{selectedProposal ? 'Saved proposal' : 'Prepare a draft'}</h3><label>Saved proposals<select value={selectedProposalId??''} onChange={e=>{setSelectedProposalId(e.target.value||null); setTransitionNote(''); setVerificationId('');}}><option value="">New draft</option>{proposals.map(p=><option key={p.proposal_id} value={p.proposal_id}>{p.asset_id} · {p.status} · {p.scope}</option>)}</select></label>
        {selectedProposal ? <div className="ops-card"><span className="ops-badge">{selectedProposal.status} · revision {selectedProposal.revision}</span><h3>{selectedProposal.scope}</h3><p>{selectedProposal.asset_id} · {selectedProposal.location}</p><p>Responsible: {selectedProposal.owner}</p><p>{selectedProposal.justification}</p><p><b>{money(estimateTotal(selectedProposal.estimate))}</b> · {selectedProposal.estimate.basis}</p><small>Source: {selectedProposal.estimate.source || 'Not provided'} · {selectedProposal.estimate.date || 'Undated'}</small><p>{selectedProposal.estimate.exclusions}</p><p>Inspection references: {selectedProposal.inspection_ids.join(', ') || 'No evidence linked'}</p><code>{selectedProposal.comparison?.comparison_id ?? 'No hydraulic benefit claimed'} · {selectedProposal.option_id}</code><div className="ops-history">{selectedProposal.history.map((h,i)=><div key={i}><b>{h.status}</b><small>{new Date(h.timestamp).toLocaleString()}</small><p>{h.note}</p></div>)}</div><button onClick={()=>exportProposal(selectedProposal)}><Download size={14}/> Export full evidence snapshot</button><button onClick={()=>{
          const asset=priorities.find(p=>p.id===selectedProposal.asset_id);
          if(asset) beginDraft(asset,null,selectedProposal.scope,`Revision of ${selectedProposal.proposal_id}: ${selectedProposal.justification}`,selectedProposal.estimate);
        }}>Revise as new draft</button></div> : <div className="ops-form">
          <label>Target asset<select value={target?.id??''} onChange={e=>{const p=priorities.find(p=>p.id===e.target.value);if(p)select(p);}}>{priorities.map(p=><option key={p.id} value={p.id}>{p.id} · {p.location}</option>)}</select></label>
          <div className="ops-notice">{optionId ? `Action: ${OPTIONS.find(o=>o.id===optionId)?.title}. ${current?'Current comparison attached.':'Comparison outdated — rerun before saving.'}` : 'Inspection / evidence collection proposal. No modelled improvement is claimed.'}<br/>{relevantInspections.length} inspection records will be attached. {scenario.mode==='api'?'Saved on the API.':'Saved in this browser only; export to retain a copy.'}</div>
          <label>Scope<textarea value={scope} onChange={e=>setScope(e.target.value)} placeholder="Location, work quantity, method and verification required"/></label>
          <label>Responsible person / team<input value={owner} onChange={e=>setOwner(e.target.value)}/></label>
          <label>Reason and unresolved constraints<textarea value={justification} onChange={e=>setJustification(e.target.value)}/></label>
          <button className="ops-primary" disabled={mutating} onClick={()=>void save()}>Save draft proposal</button>
        </div>}</div>
        <div>{selectedProposal ? <><h3>Review and verification</h3><div className="ops-notice">A status change records an internal decision. It does not contact a contractor, approve engineering design or prove hydraulic performance.</div>{selectedProposal.status!=='Verified' && <div className="ops-form"><label>Transition note<textarea value={transitionNote} onChange={e=>setTransitionNote(e.target.value)} placeholder="Reviewer, approval or completion details"/></label>{selectedProposal.status==='Completed' && <><button onClick={()=>onInspect(selectedProposal.asset_id)}>Record post-work inspection</button><label>Verification inspection<select value={verificationId} onChange={e=>setVerificationId(e.target.value)}><option value="">Select new inspection</option>{assetInspections(selectedProposal.asset_id,inspections).filter(i=>Date.parse(i.timestamp)>Date.parse(selectedProposal.history.find(h=>h.status==='Completed')!.timestamp)).map(i=><option key={i.inspection_id} value={i.inspection_id}>{i.source_type} · {i.timestamp} · {i.inspection_id}</option>)}</select></label></>}<button className="ops-primary" disabled={mutating} onClick={()=>void advance()}>Record {STATUSES[STATUSES.indexOf(selectedProposal.status)+1]}</button></div>}<h3>Saved estimate</h3>{selectedProposal.estimate.lines.map((l,i)=><p key={i}>{l.description}: {l.quantity} {l.unit} × {money(l.rate)}</p>)}</> : <><h3>Cost estimate</h3><div className="ops-notice">Enter quantities and rates. Blank rates remain unknown. Only a sourced, dated quote can progress to Reviewed.</div><div className="ops-grid"><label>Basis<select value={estimate.basis} onChange={e=>setEstimate({...estimate,basis:e.target.value as Estimate['basis']})}><option value="illustrative">Illustrative estimate</option><option value="quote">Sourced quote</option></select></label><label>Quote / rate date<input type="date" value={estimate.date} onChange={e=>setEstimate({...estimate,date:e.target.value})}/></label></div>
          <label>Rate / quote source<input value={estimate.source} placeholder="Contractor, quotation ID or demo assumption" onChange={e=>setEstimate({...estimate,source:e.target.value})}/></label>
          {estimate.lines.map((line,i)=><div className="ops-cost-row" key={i}><label>Item<input value={line.description} onChange={e=>setEstimate({...estimate,lines:estimate.lines.map((l,k)=>k===i?{...l,description:e.target.value}:l)})}/></label><label>Qty<input type="number" min="0.001" step="any" value={line.quantity} onChange={e=>setEstimate({...estimate,lines:estimate.lines.map((l,k)=>k===i?{...l,quantity:Number(e.target.value)}:l)})}/></label><label>Unit<input value={line.unit} onChange={e=>setEstimate({...estimate,lines:estimate.lines.map((l,k)=>k===i?{...l,unit:e.target.value}:l)})}/></label><label>RM / unit<input type="number" min="0" step="any" placeholder="Unknown" value={line.rate??''} onChange={e=>setEstimate({...estimate,lines:estimate.lines.map((l,k)=>k===i?{...l,rate:e.target.value===''?null:Number(e.target.value)}:l)})}/></label><button aria-label={`Remove cost item ${i+1}`} onClick={()=>setEstimate({...estimate,lines:estimate.lines.filter((_,k)=>k!==i)})}><X size={13}/></button></div>)}
          <button onClick={()=>setEstimate({...estimate,lines:[...estimate.lines,{description:'',quantity:1,unit:'item',rate:null}]})}><Plus size={13}/> Add item</button><label>Assumptions / exclusions<textarea value={estimate.exclusions} onChange={e=>setEstimate({...estimate,exclusions:e.target.value})} placeholder="Taxes, traffic management, access, reinstatement, contingency…"/></label><h2>{money(total)}</h2><small>{quoteReady(estimate)?'Complete sourced quote entered; subject to review.':'Illustrative or incomplete; not an approved expenditure.'}</small>
        </>}</div>
      </div>}
    </div>
  </section>;
}
