import { describe, expect, it } from 'vitest';
import type { Storm } from '@floodops/engine/sim/types';
import { cityCamera, fogScale, rainPlacement, rainingAt } from '../siteCity';
import type { SiteFrame } from '../siteFrame';

const frame: SiteFrame = { cx: 500, cz: -300, w: 800, h: 400, groundY: 20 };
const storm: Storm = { id: 's', label: 's', returnPeriod: 0, blockS: 300, intensity: [0, 1e-5, 0], provisional: false, peakMinute: 5 };

describe('cityCamera', () => {
  it('frames the site centre from the south-east, above the ground', () => {
    const c = cityCamera(frame);
    expect(c.target).toEqual([500, 20, -300]);
    expect(c.position).toEqual([515, 20 + 800 * 0.45, -300 + 800 * 0.55]);
    expect(c.maxDistance).toBeGreaterThanOrEqual(2 * 800);
    expect(c.far).toBeGreaterThan(c.maxDistance);
  });
});

describe('fogScale', () => {
  it('keeps the shared fog for small sites and widens it for large ones', () => {
    expect(fogScale({ ...frame, w: 100, h: 100 })).toBe(1);
    expect(fogScale(frame)).toBeCloseTo(800 / 250);
  });
});

describe('rainPlacement', () => {
  it('moves the rain box centre onto the site and the drop floor onto its ground', () => {
    const r = rainPlacement(frame);
    // RainEffect's box centre (45, 11, −10) lands on the site centre.
    expect(r.position[0] + 45 * r.scale[0]).toBeCloseTo(frame.cx);
    expect(r.position[1] + 11).toBeCloseTo(frame.groundY);
    expect(r.position[2] - 10 * r.scale[2]).toBeCloseTo(frame.cz);
    expect(230 * r.scale[0]).toBeGreaterThanOrEqual(frame.w);
    expect(300 * r.scale[2]).toBeGreaterThanOrEqual(frame.h);
  });
});

describe('rainingAt', () => {
  it('rains only while playing and while the uploaded storm is above zero', () => {
    expect(rainingAt(storm, 400, true)).toBe(true);
    expect(rainingAt(storm, 400, false)).toBe(false);
    expect(rainingAt(storm, 100, true)).toBe(false);
    expect(rainingAt(storm, 2000, true)).toBe(false);
    expect(rainingAt(null, 400, true)).toBe(false);
    expect(rainingAt(storm, undefined, true)).toBe(false);
  });
});
