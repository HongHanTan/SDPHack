import { describe, it, expect } from 'vitest';
import { assetInspections, buildPriorities, canTransition, comparisonCurrent, emptyEstimate, estimateTotal, quoteReady, type Proposal, type ScenarioSelection } from '../model';
import { engineSource } from '../../engine/engineSource';
import type { InspectionRecord } from '../../types';

const now = Date.parse('2026-10-21T10:00:00Z');
const inspection: InspectionRecord = { inspection_id:'i1', asset_id:'INLET-D07', timestamp:'2026-10-21T09:00:00Z', inspector:'Test', method:'visual', source_type:'observed', visible_grate_coverage_fraction:0.65, debris_category:'mixed', notes:'Field observation' };
const quote = { ...emptyEstimate(), basis:'quote' as const, source:'Test contractor / Q-01', date:'2026-10-21', lines:[{description:'Clean',quantity:2,unit:'inlet',rate:200}] };
describe('maintenance evidence and decision rules', () => {
  it('does not turn synthetic, missing, stale or future evidence into an observed cleaning priority', () => {
    const a=engineSource.getTownshipAssets();
    for (const patch of [{source_type:'synthetic'}, {timestamp:'2025-01-01T00:00:00Z'}, {timestamp:'2027-01-01T00:00:00Z'}]) {
      const rows=buildPriorities(a.nodes,a.inlets,a.conduits,[{...inspection,...patch} as InspectionRecord],now);
      expect(rows.find(r=>r.id==='INLET-D07')?.category).toBe('Inspect');
    }
    const rows=buildPriorities(a.nodes,a.inlets,a.conduits,[inspection],now);
    expect(rows.find(r=>r.id==='INLET-D07')?.category).toBe('Cleaning review');
    expect(rows.find(r=>r.id==='INLET-D01')?.category).toBe('Inspect');
  });
  it('uses the latest inspection of the exact asset, without mutating inspection history', () => {
    const records=[inspection,{...inspection,inspection_id:'other',asset_id:'NODE-J07',timestamp:'2026-10-22T00:00:00Z'}, {...inspection,inspection_id:'old',timestamp:'2026-10-20T00:00:00Z'}];
    expect(assetInspections('INLET-D07',records).map(i=>i.inspection_id)).toEqual(['i1','old']);
    expect(records[1].inspection_id).toBe('other');
  });
  it('never prices unknown rates as zero or accepts malformed quote dates', () => {
    expect(estimateTotal(emptyEstimate())).toBeNull();
    expect(estimateTotal(quote)).toBe(400);
    expect(quoteReady(quote)).toBe(true);
    expect(quoteReady({...quote,date:'2026-02-31'})).toBe(false);
    expect(quoteReady({...quote,source:' '})).toBe(false);
    expect(estimateTotal({...quote,lines:[{...quote.lines[0],rate:-1}]})).toBeNull();
  });
  it('invalidates comparisons for changes in engine, model, storm, restriction or tailwater', () => {
    const scenario: ScenarioSelection={mode:'engine',storm_id:'s',debris_id:'b',tailwater:'normal',model_version_id:'v1'};
    const c={comparison_id:'c',created_at:'2026-10-21',scenario,results:[]};
    expect(comparisonCurrent(c,{...scenario})).toBe(true);
    for (const patch of [{mode:'api' as const},{storm_id:'s2'},{debris_id:'clean'},{tailwater:'high'},{model_version_id:'v2'}]) expect(comparisonCurrent(c,{...scenario,...patch})).toBe(false);
  });
  it('requires a sourced quote, sequential states and new same-asset post-work evidence', () => {
    const p={status:'Draft',scope:'Clean',owner:'O&M',justification:'Observed debris',estimate:quote,asset_id:'INLET-D07',history:[]} as unknown as Proposal;
    expect(canTransition(p,'Reviewed')).toBeNull();
    expect(canTransition({...p,estimate:emptyEstimate()},'Reviewed')).toMatch(/quote/);
    expect(canTransition(p,'Completed')).toMatch(/one status/);
    const complete={...p,status:'Completed' as const,history:[{status:'Completed' as const,timestamp:'2026-10-21T08:00:00Z',note:'Done'}]};
    expect(canTransition(complete,'Verified',inspection)).toBeNull();
    expect(canTransition(complete,'Verified',{...inspection,asset_id:'INLET-D01'})).toMatch(/new inspection/);
    expect(canTransition(complete,'Verified',{...inspection,timestamp:'2026-10-21T07:00:00Z'})).toMatch(/new inspection/);
  });
});
