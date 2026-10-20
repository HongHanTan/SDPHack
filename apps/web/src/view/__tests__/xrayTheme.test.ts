import { describe, expect, it } from 'vitest';
import { blendTheme, DAY, lerpHex, stepXray, XRAY, XRAY_FADE_S } from '../xrayTheme';

describe('xrayTheme', () => {
  it('returns the end themes at t = 0 and t = 1', () => {
    expect(blendTheme(0)).toEqual(DAY);
    expect(blendTheme(1)).toEqual(XRAY);
  });
  it('blends colours per channel and numbers linearly at the midpoint', () => {
    const mid = blendTheme(0.5);
    expect(mid.background).toBe(lerpHex(DAY.background, XRAY.background, 0.5));
    expect(mid.ambient).toBeCloseTo((DAY.ambient + XRAY.ambient) / 2, 6);
    expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
  it('steps the fade toward the target over XRAY_FADE_S and clamps', () => {
    expect(stepXray(0, 1, XRAY_FADE_S / 2)).toBeCloseTo(0.5, 6);
    expect(stepXray(0.9, 1, 1)).toBe(1);
    expect(stepXray(0.2, 0, 1)).toBe(0);
    expect(stepXray(1, 1, 0.1)).toBe(1);
  });
});
