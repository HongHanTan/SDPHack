import { useState } from 'react';
import { X, Camera, ClipboardList } from 'lucide-react';
import type { InspectionRecord, SimulationFrame, AssetNode, AssetConduit, AssetInlet } from '../types';
import { apiClient } from '../api/client';
import { assetInspections, assetLocation, type SelectedAsset } from '../maintenance/model';

interface Props {
  selectedAsset: SelectedAsset | null; onClose: () => void; inspections: InspectionRecord[];
  onOpenInspect: (id: string) => void; onOpenInterventions: () => void;
  currentFrame?: SimulationFrame | null; blockageFraction: number;
  onUpdateBlockage?: (id: string, fraction: number) => void; hideBlockageTuning?: boolean;
}
export const AssetDetailModal = ({ selectedAsset, onClose, inspections, onOpenInspect, onOpenInterventions, currentFrame, blockageFraction, onUpdateBlockage, hideBlockageTuning }: Props) => {
  const [tab, setTab] = useState('Condition');
  if (!selectedAsset) return null;
  const { id, type } = selectedAsset;
  const records = assetInspections(id, inspections);
  const node = currentFrame?.node_states.find(n => n.node_id === id);
  const pipe = currentFrame?.pipe_states.find(p => p.conduit_id === id);
  const inlet = currentFrame?.inlet_states.find(i => i.inlet_id === id);
  const data = selectedAsset.data as AssetNode & AssetConduit & AssetInlet;
  const fmt = (value: number | undefined | null, unit: string) => value == null ? 'No result available' : `${value.toFixed(3)} ${unit}`;
  const mediaUrl = (url: string) => url.startsWith('/api/') ? `${apiClient.getBaseUrl()}${url}` : url;
  return <aside className="ops asset-evidence" aria-label="Asset evidence">
    <div className="ops-head"><div><span className="ops-eyebrow">Investigate asset</span><h2>{id}</h2><p>{assetLocation(id)} | illustrative location</p></div><button aria-label="Close asset evidence" onClick={onClose}><X size={18}/></button></div>
    <div className="ops-tabs">{['Condition', 'Evidence', 'Scenario', 'Action'].map(t => <button key={t} aria-pressed={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
    <div className="ops-body">
      {tab === 'Condition' && <><div className="ops-notice">Illustrative network. Dimensions and locations require site verification.</div><dl className="ops-readings"><dt>Asset type</dt><dd>{type}</dd><dt>Input source</dt><dd>{data.source_type ?? 'Unknown'}</dd>{type === 'conduit' && <><dt>Diameter</dt><dd>{fmt(data.diameter_m, 'm')}</dd><dt>Length</dt><dd>{fmt(data.length_m, 'm')}</dd></>}{type === 'node' && <><dt>Invert elevation</dt><dd>{fmt(data.invert_elevation_m, 'm')}</dd><dt>Ground elevation</dt><dd>{fmt(data.ground_elevation_m, 'm')}</dd></>}<dt>Latest inspection</dt><dd>{records[0] ? new Date(records[0].timestamp).toLocaleString() : 'No inspection recorded'}</dd></dl><p>Record field condition before specifying work. Sample scene imagery is not inspection evidence.</p></>}
      {tab === 'Evidence' && <>{!records.length && <p>No inspection evidence is available for this asset.</p>}{records.map(i => <article className="ops-card" key={i.inspection_id}><b>{i.method} | {i.source_type}</b><p>{new Date(i.timestamp).toLocaleString()} | {i.inspector}</p><code>{i.inspection_id}</code><p>{i.notes}</p><p>Source: {i.source_reference || 'Not supplied'}</p>{id.startsWith('INLET') && <p>Visible coverage: {Math.round(i.visible_grate_coverage_fraction * 100)}% - observation only.</p>}<div className="ops-media">{i.media?.map(m => <a key={m.media_id} href={mediaUrl(m.url)} target="_blank" rel="noreferrer">{m.content_type.startsWith('image/') ? <img src={mediaUrl(m.url)} alt={m.filename}/> : m.filename}<small>{m.filename}</small></a>)}</div>{!i.media?.length && <small>No uploaded attachment.</small>}</article>)}</>}
      {tab === 'Scenario' && <><div className="ops-notice">Calculated scenario output; uncalibrated site model. A paused frame is not a current field reading.</div><dl className="ops-readings"><dt>Frame time</dt><dd>{currentFrame ? `${currentFrame.timestamp_s}s` : 'No result available'}</dd><dt>Status</dt><dd>{node?.status ?? pipe?.status ?? 'No result available'}</dd><dt>Depth</dt><dd>{fmt(node?.depth_m ?? pipe?.depth_m, 'm')}</dd><dt>Pipe flow</dt><dd>{fmt(pipe?.flow_m3s, 'm3/s')}</dd><dt>Inlet capture</dt><dd>{fmt(inlet?.capture_flow_m3s, 'm3/s')}</dd><dt>Surface bypass</dt><dd>{fmt(inlet?.bypass_flow_m3s, 'm3/s')}</dd><dt>Hydraulic loss assumption</dt><dd>{inlet ? `${Math.round(inlet.hydraulic_inlet_clogging_fraction * 100)}%` : 'Not provided'}</dd></dl>{!hideBlockageTuning && id === 'INLET-D07' && <label>Change inlet loss hypothesis <input type="range" min="0" max="0.6" step="0.2" value={blockageFraction} onChange={e => onUpdateBlockage?.(id, Number(e.target.value))}/><small>Changes inputs only. Run again to calculate new results.</small></label>}<p>Visible grate coverage does not determine hydraulic loss automatically.</p></>}
      {tab === 'Action' && <><p>Create a proposal with scope, inspection evidence, scenario references and a sourced estimate. Structural work requires engineering review.</p><button className="ops-primary" onClick={onOpenInterventions}><ClipboardList size={15}/> Compare actions / plan work</button></>}
    </div><div className="ops-footer"><button className="ops-primary" onClick={() => onOpenInspect(id)}><Camera size={15}/> Record inspection</button><button onClick={onOpenInterventions}>Plan work</button></div>
  </aside>;
};
