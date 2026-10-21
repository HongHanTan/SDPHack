import { apiClient, type DataMode } from '../api/client';
import type { InspectionRecord } from '../types';
import { canTransition, type Proposal, type ProposalDraft, type ProposalStatus } from './model';

export const proposalKey = (mode: DataMode) => `floodops_proposals_v1_${mode}`;
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${apiClient.getBaseUrl()}/api/maintenance/proposals${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message ?? `Proposal request failed (${response.status})`);
  return data as T;
}
export async function listProposals(mode: DataMode): Promise<Proposal[]> {
  if (mode === 'api') return (await request<{ items: Proposal[] }>('')).items;
  const stored = localStorage.getItem(proposalKey(mode));
  const records = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(records)) throw new Error('Saved proposal data is invalid. Export or repair browser storage before continuing.');
  return records;
}
export async function createProposal(draft: ProposalDraft): Promise<Proposal> {
  if (draft.mode === 'api') return request('', draft);
  const now = new Date().toISOString();
  const proposal: Proposal = { ...structuredClone(draft), proposal_id: crypto.randomUUID(), revision: 1, status: 'Draft', created_at: now, updated_at: now, verification_inspection_id: null,
    history: [{ status: 'Draft', timestamp: now, note: 'Proposed work only; no contractor contacted.' }] };
  const raw = localStorage.getItem(proposalKey(draft.mode));
  const items: Proposal[] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(items)) throw new Error('Saved proposal data is invalid.');
  localStorage.setItem(proposalKey(draft.mode), JSON.stringify([proposal, ...items]));
  return proposal;
}
export async function transitionProposal(p: Proposal, next: ProposalStatus, note: string, inspection?: InspectionRecord): Promise<Proposal> {
  const problem = canTransition(p, next, inspection);
  if (problem || !note.trim()) throw new Error(problem ?? 'A transition note is required.');
  if (p.mode === 'api') return request(`/${encodeURIComponent(p.proposal_id)}/transition`, { revision: p.revision, status: next, note, verification_inspection_id: inspection?.inspection_id ?? null });
  const raw = localStorage.getItem(proposalKey(p.mode));
  const items: Proposal[] = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(items)) throw new Error('Saved proposal data is invalid.');
  const current = items.find(i => i.proposal_id === p.proposal_id);
  if (current?.revision !== p.revision) throw new Error('Proposal changed; reload before updating.');
  const now = new Date().toISOString();
  const updated: Proposal = { ...p, revision: p.revision + 1, status: next, updated_at: now,
    verification_inspection_id: next === 'Verified' ? inspection!.inspection_id : null,
    inspection_ids: next === 'Verified' ? [...p.inspection_ids, inspection!.inspection_id] : p.inspection_ids,
    inspection_snapshot: next === 'Verified' ? [...p.inspection_snapshot, structuredClone(inspection!)] : p.inspection_snapshot,
    history: [...p.history, { status: next, timestamp: now, note }] };
  localStorage.setItem(proposalKey(p.mode), JSON.stringify(items.map(i => i.proposal_id === p.proposal_id ? updated : i)));
  return updated;
}
export function exportProposal(p: Proposal) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `FloodOps-${p.proposal_id}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
