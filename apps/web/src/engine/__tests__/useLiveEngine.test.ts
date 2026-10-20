import { describe, expect, it } from 'vitest';
import { STORMS } from '@floodops/engine/scenario/storms';
import { liveSeekMinute } from '../useLiveEngine';

describe('liveSeekMinute', () => {
  it('jumps to the start, peak rain and the moment rain stops', () => {
    expect(liveSeekMinute('100yr', 'start')).toBe(0);
    expect(liveSeekMinute('100yr', 'peak')).toBe(STORMS['100yr'].peakMinute);
    expect(liveSeekMinute('synthetic_80mmh_60min', 'peak')).toBe(30);
    expect(liveSeekMinute('synthetic_80mmh_60min', 'end')).toBeCloseTo(60, 9);
  });
});
