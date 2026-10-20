import { describe, expect, it } from 'vitest';
import { RAIN_FULL_MMHR, visibleStreaks } from '../../src/render/rain';

describe('visibleStreaks', () => {
  it('scales linearly with intensity and saturates at full rain', () => {
    expect(visibleStreaks(0, 6000)).toBe(0);
    expect(visibleStreaks(RAIN_FULL_MMHR / 2, 6000)).toBe(3000);
    expect(visibleStreaks(RAIN_FULL_MMHR, 6000)).toBe(6000);
    expect(visibleStreaks(400, 6000)).toBe(6000);
    expect(visibleStreaks(-5, 6000)).toBe(0);
  });
});
