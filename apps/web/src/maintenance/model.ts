import type { AssetConduit, AssetInlet, AssetNode, InspectionRecord, SimulationMetricsResponse } from '../types';
import type { DataMode } from '../api/client';

export type SelectedAsset = { type: 'node' | 'inlet' | 'conduit'; id: string; data: unknown };
export type ProposalStatus = 'Draft' | 'Reviewed' | 'Scheduled' | 'Completed' | 'Verified';
export const STATUSES: ProposalStatus[] = ['Draft', 'Reviewed', 'Scheduled', 'Completed', 'Verified'];
export interface CostLine { description: string; quantity: number; unit: string; rate: number | null }
export interface Estimate { lines: CostLine[]; source: string; date: string; basis: 'illustrative' | 'quote'; exclusions: string }
export interface ScenarioSelection { mode: DataMode; storm_id: string; debris_id: string; tailwater: string; model_version_id: string }
export interface ComparisonResult {
  id: string; option_id: string; title: string; target_asset_ids: string[];
  status: 'running' | 'succeeded' | 'failed' | 'unavailable';
  run_id?: string; input_hash?: string; metrics?: SimulationMetricsResponse; error?: string;
  input_snapshot?: Record<string, unknown>;
  assessment_snapshot?: Record<string, unknown>;
}
export interface Comparison {
  comparison_id: string; created_at: string; scenario: ScenarioSelection; results: ComparisonResult[];
}
export interface MaintenanceHandoff {
  handoff_id: string; mode: DataMode; asset_id: string; option_id: string | null;
  scope: string; justification: string; comparison: Comparison | null;
  owner?: string;
}
export interface Proposal {
  proposal_id: string; revision: number; created_at: string; updated_at: string;
  asset_id: string; location: string; scope: string; owner: string; justification: string;
  status: ProposalStatus; mode: DataMode; estimate: Estimate;
  inspection_ids: string[]; inspection_snapshot: InspectionRecord[];
  comparison: Comparison | null; option_id: string | null;
  verification_inspection_id: string | null;
  history: { status: ProposalStatus; timestamp: string; note: string }[];
}
export type ProposalDraft = Omit<Proposal, 'proposal_id' | 'revision' | 'created_at' | 'updated_at' | 'history' | 'verification_inspection_id' | 'status'>;
export interface Priority extends SelectedAsset { location: string; category: 'Inspect' | 'Cleaning review' | 'Engineering review' | 'Routine monitoring'; reason: string; inspection?: InspectionRecord }

// Named zones are UI metadata for the illustrative scene, not surveyed road addresses.
const ZONES: Record<string, string> = {
  'INLET-D07': 'D07 junction / low point', 'NODE-J07': 'D07 junction / low point',
  'PIPE-P07': 'Lower trunk / J07–J08', 'NODE-J08': 'Lower trunk / J07–J08',
  'NODE-OUT01': 'Outfall / receiving canal', 'PIPE-P08': 'Outfall approach',
  'NODE-J06': 'Western branch', 'INLET-D01': 'Northwestern branch', 'NODE-J01': 'Northwestern branch',
  'INLET-D02': 'Northeastern branch', 'NODE-J02': 'Northeastern branch',
  'INLET-D04': 'Eastern branch', 'NODE-J04': 'Eastern branch',
};
export const assetLocation = (id: string) => ZONES[id] ?? 'Drainage network';
export function assetInspections(id: string, records: InspectionRecord[]): InspectionRecord[] {
  return records.filter(i => i.asset_id === id).sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
export function buildPriorities(nodes: AssetNode[], inlets: AssetInlet[], conduits: AssetConduit[], inspections: InspectionRecord[], now = Date.now()): Priority[] {
  const assets: SelectedAsset[] = [
    ...inlets.map(data => ({ type: 'inlet' as const, id: data.inlet_id, data })),
    ...conduits.map(data => ({ type: 'conduit' as const, id: data.conduit_id, data })),
    ...nodes.map(data => ({ type: 'node' as const, id: data.node_id, data })),
  ];
  return assets.map(asset => {
    const inspection = assetInspections(asset.id, inspections)[0];
    const age = inspection ? (now - Date.parse(inspection.timestamp)) / 86400000 : Infinity;
    const usable = inspection?.source_type === 'observed' && age >= 0 && age <= 90;
    const category: Priority['category'] = !usable ? 'Inspect'
      : asset.type === 'inlet' && inspection.visible_grate_coverage_fraction >= 0.2 ? 'Cleaning review'
      : inspection.debris_category !== 'none' && asset.type !== 'inlet' ? 'Engineering review' : 'Routine monitoring';
    const reason = !inspection ? 'No inspection recorded; establish condition before specifying work.'
      : !usable ? `${inspection.source_type} or older evidence; obtain a current field inspection (90-day review policy).`
      : category === 'Cleaning review' ? 'Observed visible debris; assess cleaning. Hydraulic restriction remains a separate assumption.'
      : category === 'Engineering review' ? 'Recorded debris finding in a network asset; review condition and scenario results before specifying work.'
      : 'No maintenance trigger in the structured inspection fields; retain routine monitoring and review any notes.';
    return { ...asset, location: assetLocation(asset.id), category, reason, inspection };
  }).sort((a, b) => ({ 'Cleaning review': 0, Inspect: 1, 'Engineering review': 2, 'Routine monitoring': 3 }[a.category] - { 'Cleaning review': 0, Inspect: 1, 'Engineering review': 2, 'Routine monitoring': 3 }[b.category]) || a.id.localeCompare(b.id));
}
export function emptyEstimate(): Estimate {
  return { lines: [
    { description: 'Work', quantity: 1, unit: 'item', rate: null },
    { description: 'Mobilisation', quantity: 1, unit: 'trip', rate: null },
    { description: 'Disposal / reinstatement', quantity: 1, unit: 'item', rate: null },
  ], source: '', date: '', basis: 'illustrative', exclusions: '' };
}
export function estimateTotal(estimate: Estimate): number | null {
  if (!estimate.lines.length || estimate.lines.some(l => !l.description.trim() || !l.unit.trim() || !Number.isFinite(l.quantity) || l.quantity <= 0 || l.rate === null || !Number.isFinite(l.rate) || l.rate < 0)) return null;
  return Math.round(estimate.lines.reduce((n, l) => n + l.quantity * l.rate!, 0) * 100) / 100;
}
export function quoteReady(e: Estimate) { return e.basis === 'quote' && !!e.source.trim() && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && Number.isFinite(Date.parse(e.date)) && new Date(e.date).toISOString().slice(0, 10) === e.date && estimateTotal(e) !== null; }
export function inletVolumes(metrics: SimulationMetricsResponse) {
  const v = metrics.inlet_volumes;
  if (Array.isArray(v)) { const d = v.find(i => i.inlet_id === 'INLET-D07'); return d ? { captured_m3: d.captured_volume_m3, surface_bypass_m3: d.bypass_volume_m3 } : null; }
  return v?.['INLET-D07'] ?? null;
}
export const scenarioKey = (s: ScenarioSelection) => JSON.stringify([s.mode, s.model_version_id, s.storm_id, s.debris_id, s.tailwater]);
export function comparisonCurrent(comparison: Comparison | null, scenario: ScenarioSelection) { return !!comparison && scenarioKey(comparison.scenario) === scenarioKey(scenario); }
export function canTransition(p: Proposal, next: ProposalStatus, inspection?: InspectionRecord): string | null {
  if (STATUSES.indexOf(next) !== STATUSES.indexOf(p.status) + 1) return 'Advance one status at a time.';
  if (!p.scope.trim() || !p.owner.trim() || !p.justification.trim()) return 'Scope, responsible person and justification are required.';
  if (next === 'Reviewed' && !quoteReady(p.estimate)) return 'A complete sourced quote with date is required for review.';
  if (next === 'Verified') {
    const completed = p.history.find(h => h.status === 'Completed');
    if (!inspection || inspection.asset_id !== p.asset_id || !completed || Date.parse(inspection.timestamp) <= Date.parse(completed.timestamp)) return 'Verification requires a new inspection of this asset after completion.';
  }
  return null;
}
export const money = (n: number | null) => n === null ? 'Estimate required' : new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(n);
