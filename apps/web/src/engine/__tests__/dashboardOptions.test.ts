import { describe, expect, it } from 'vitest';
import { buildDashboardOptions, idsForOption } from '../dashboardOptions';

describe('dashboardOptions', () => {
  const opts = buildDashboardOptions('synthetic_80mmh_60min');
  it('has the seven engine cards in order', () => {
    expect(opts.map((o) => o.id)).toEqual(['baseline', 'desilt-d07', 'upsize-p07', 'storage-tank', 'lake-overflow', 'combined', 'store-peak']);
  });
  it('carries the honest desilt finding and recommends the combined option', () => {
    expect(opts.find((o) => o.id === 'desilt-d07')!.finding).toContain('No effect on its own while P07 runs full');
    const combined = opts.find((o) => o.id === 'combined')!;
    expect(combined.tag).toBe('Optimal Holistic Solution');
    expect(combined.recommended).toBe(true);
    expect(combined.dSagVsBaseline!).toBeLessThan(0);
    expect(combined.finding).toMatch(/^Best result/);
    expect(opts.filter((o) => o.recommended)).toHaveLength(1);
  });
  it('recommends the lowest J07 peak per storm', () => {
    const o100 = buildDashboardOptions('100yr');
    expect(o100.find((o) => o.recommended)!.id).toBe('store-peak');
    const combined = o100.find((o) => o.id === 'combined')!;
    expect(combined.recommended).toBe(false);
    expect(combined.tag).toBe('Optimal Holistic Solution');
    expect(combined.finding).toContain('Store the Peak');
  });
  it('maps option ids to intervention ids', () => {
    expect(idsForOption('combined')).toEqual(['desilt-d07', 'upsize-p07']);
    expect(idsForOption('baseline')).toEqual([]);
  });
});
