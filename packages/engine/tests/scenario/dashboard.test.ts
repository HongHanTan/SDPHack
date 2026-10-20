import { describe, expect, it } from 'vitest';
import data from '../../src/scenario/dashboard.json';

describe('dashboard.json', () => {
  it('has all 7 options for every storm, consistent with the tuned story', () => {
    const d = data as Record<string, Record<string, { j07PeakM: number; homesFlooded: number }>>;
    for (const storm of ['synthetic_80mmh_60min', 'synthetic_120mmh_60min', '10yr', '100yr']) {
      expect(Object.keys(d[storm]).sort()).toEqual(['baseline', 'combined', 'desilt-d07', 'lake-overflow', 'storage-tank', 'store-peak', 'upsize-p07']);
    }
    const s = d.synthetic_80mmh_60min;
    expect(s.combined.j07PeakM).toBeLessThan(s['upsize-p07'].j07PeakM);
    expect(s['upsize-p07'].j07PeakM).toBeLessThan(s.baseline.j07PeakM);
    expect(s.baseline.homesFlooded).toBeGreaterThanOrEqual(2);
  });
});
