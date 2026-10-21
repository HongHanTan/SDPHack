import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createProposal, listProposals, transitionProposal } from '../repository';
import { emptyEstimate, type ProposalDraft } from '../model';
import type { InspectionRecord } from '../../types';
import { ApiClient } from '../../api/client';

beforeEach(()=>{
  const data=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)});
});
afterEach(()=>vi.unstubAllGlobals());
const draft=():ProposalDraft=>({asset_id:'INLET-D07',location:'Illustrative cul-de-sac',scope:'Inspect inlet',owner:'Test O&M',justification:'Missing field condition',mode:'engine',
  estimate:{...emptyEstimate(),basis:'quote',source:'Test Q-01',date:'2026-10-21',lines:[{description:'Inspection',quantity:1,unit:'visit',rate:100}]},
  inspection_ids:[],inspection_snapshot:[],comparison:null,option_id:null});

it('persists mode-isolated proposals and checks revisions before status changes',async()=>{
  let p=await createProposal(draft());
  expect((await listProposals('engine'))[0].proposal_id).toBe(p.proposal_id);
  expect(await listProposals('mock')).toEqual([]);
  const original=p;
  p=await transitionProposal(p,'Reviewed','Quote and scope checked');
  await expect(transitionProposal(original,'Reviewed','Stale reviewer')).rejects.toThrow(/changed/);
  p=await transitionProposal(p,'Scheduled','Scheduled internally');
  p=await transitionProposal(p,'Completed','Work completed');
  const inspection={inspection_id:'post-work',asset_id:p.asset_id,timestamp:new Date(Date.parse(p.updated_at)+1000).toISOString(),source_type:'synthetic',notes:'Post-work condition'} as InspectionRecord;
  p=await transitionProposal(p,'Verified','Post-work inspection reviewed',inspection);
  expect(p.inspection_snapshot[0].notes).toBe('Post-work condition');
  expect(p.history.map(h=>h.status)).toEqual(['Draft','Reviewed','Scheduled','Completed','Verified']);
  expect((await listProposals('engine'))[0]).toEqual(p);
});

it('surfaces storage and API failures without claiming saved data or falling back to local proposals',async()=>{
  vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('Storage full');}});
  await expect(createProposal(draft())).rejects.toThrow('Storage full');
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('API offline')));
  await expect(listProposals('api')).rejects.toThrow('API offline');
});

it('never substitutes retained offline runs for API requests, even for old fixture IDs',async()=>{
  const fetch=vi.fn().mockRejectedValue(new Error('Network unavailable'));
  vi.stubGlobal('fetch',fetch);
  const client=new ApiClient();client.setDataMode('api');
  await expect(client.getSimulation('t1_baseline')).rejects.toThrow(/Network/);
  await expect(client.getSimulationFrames('t1_baseline')).rejects.toThrow(/Network/);
  await expect(client.getSimulationMetrics('t1_baseline')).rejects.toThrow(/Network/);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(()=>client.getOfflineMetrics('unknown-storm')).toThrow(/No retained/);
});
