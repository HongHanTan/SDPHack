import { useState } from 'react';
import { X } from 'lucide-react';
import type { InspectionRecord, SourceType } from '../types';
import { apiClient } from '../api/client';
interface Props { assetId: string; onClose: () => void; onSubmit: (record: Partial<InspectionRecord>, file?: File) => Promise<void>; isInlet?:boolean; storageText?:string }
export const InspectionModal = ({assetId, onClose, onSubmit, isInlet, storageText}: Props) => {
  const [inspector, setInspector] = useState('');
  const [source, setSource] = useState<SourceType>('synthetic');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState<InspectionRecord['method']>('visual');
  const [coverage, setCoverage] = useState(0);
  const [category, setCategory] = useState<InspectionRecord['debris_category']>('none');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [timestamp, setTimestamp] = useState(() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,23); });
  return <div className="ops-modal ops" role="dialog" aria-modal="true" aria-label="Record inspection"><form className="ops-dialog" onSubmit={async e => {e.preventDefault(); setBusy(true); setError(''); try { await onSubmit({asset_id:assetId, inspector, timestamp:new Date(timestamp).toISOString(), method, source_type:source, source_reference:reference, visible_grate_coverage_fraction:coverage/100, debris_category:category, notes},file); onClose(); } catch(err) {setError(String(err));} finally {setBusy(false);} }}>
    <div className="ops-head"><div><span className="ops-eyebrow">Condition evidence</span><h2>Record inspection | {assetId}</h2></div><button type="button" aria-label="Close inspection" disabled={busy} onClick={onClose}><X size={18}/></button></div>
    <div className="ops-body ops-form"><div className="ops-notice">{storageText ?? (apiClient.getDataMode() === 'api' ? 'Evidence will be saved on the connected API.' : 'Evidence and attachments are saved in this browser only. Export proposals to retain a copy.')} Synthetic is the default for demonstrations.</div>
    <label>Inspector<input required value={inspector} onChange={e=>setInspector(e.target.value)}/></label>
    <div className="ops-grid"><label>Captured at<input required type="datetime-local" step="0.001" max={new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,23)} value={timestamp} onChange={e=>setTimestamp(e.target.value)}/></label><label>Evidence source<select value={source} onChange={e=>setSource(e.target.value as SourceType)}><option value="synthetic">Synthetic demonstration</option><option value="observed">Observed field inspection</option><option value="assumed">Assumed condition</option><option value="literature_derived">Literature derived</option></select></label></div>
    <label>Source reference<input required placeholder="Site visit reference, document or demo case" value={reference} onChange={e=>setReference(e.target.value)}/></label>
    <div className="ops-grid"><label>Method<select value={method} onChange={e=>setMethod(e.target.value as InspectionRecord['method'])}>{['visual','cctv','drone','sensor'].map(x=><option key={x}>{x}</option>)}</select></label><label>Debris<select value={category} onChange={e=>setCategory(e.target.value as InspectionRecord['debris_category'])}>{['none','leaf_litter','sediment','plastic','mixed'].map(x=><option key={x}>{x}</option>)}</select></label></div>
    {(isInlet ?? assetId.startsWith('INLET')) && <label>Visible grate coverage (%)<input type="number" min="0" max="100" value={coverage} onChange={e=>setCoverage(Number(e.target.value))}/><small>This observation does not set hydraulic restriction.</small></label>}
    <label>Condition / notes<textarea required value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <label>Attachment - PNG, JPEG, WebP or PDF (up to 10 MiB)<input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={e=>setFile(e.target.files?.[0])}/></label>
    {error && <p role="alert" className="ops-error">{error}</p>}</div><div className="ops-footer"><button className="ops-primary" disabled={busy}>{busy ? 'Saving...' : 'Save inspection'}</button></div>
  </form></div>;
};
