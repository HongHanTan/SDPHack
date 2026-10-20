import { describe, expect, it } from 'vitest';
import { TAMAN_KYRA } from '@floodops/engine/scenario/site';
import { siteFrame } from '../siteFrame';

describe('siteFrame', () => {
  it('frames the built-in grid in scene coordinates', () => {
    const f = siteFrame(TAMAN_KYRA);
    expect(f.cx).toBeCloseTo(45);
    expect(f.cz).toBeCloseTo(-5);
    expect(f.w).toBe(250);
    expect(f.h).toBe(290);
    expect(f.groundY).toBeCloseTo(11.65, 6);
  });
});
