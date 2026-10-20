import { describe, expect, it } from 'vitest';
import { rainIntensityAt, STORMS } from '../../src/scenario/storms';
import { advanceBy, LiveSession } from '../../src/worker/liveSession';

describe('advanceBy', () => {
  it('maps 1× to one storm-minute per wall-second, capped', () => {
    expect(advanceBy(1, 0.05, 120)).toBeCloseTo(3, 12);
    expect(advanceBy(0.5, 2, 120)).toBeCloseTo(60, 12);
    expect(advanceBy(4, 1, 120)).toBe(120);
  });
  it('never goes backwards', () => {
    expect(advanceBy(0, 1, 120)).toBe(0);
    expect(advanceBy(1, -1, 120)).toBe(0);
  });
});

describe('LiveSession', () => {
  it('emits a frame every 10 storm-seconds', () => {
    const s = new LiveSession('100yr', [], []);
    expect(s.advance(5)).toBeNull();
    const f = s.advance(5);
    expect(f).not.toBeNull();
    expect(f!.t).toBeCloseTo(10, 9);
    expect(s.endT).toBe(10800);
  });

  it('reports rain, readouts and a closed water balance', () => {
    const s = new LiveSession('100yr', [], []);
    s.advance(600);
    const f = s.snapshot();
    expect(f.rainMmHr).toBeCloseTo(rainIntensityAt(STORMS['100yr'], f.t), 9);
    expect(f.readouts.sagPeak).toBeGreaterThanOrEqual(f.readouts.sagNow);
    expect(f.readouts.balanceError).toBeLessThan(0.01);
  });

  it('keeps the water where it is when patched', () => {
    const s = new LiveSession('100yr', [], []);
    s.advance(600);
    const before = Array.from(s.snapshot().frame.depth);
    s.patch(['desilt-d07'], []);
    expect(Array.from(s.snapshot().frame.depth)).toEqual(before);
    s.advance(60);
    expect(s.snapshot().readouts.balanceError).toBeLessThan(0.01);
  });

  it('removing the tank mid-storm loses no water', () => {
    const s = new LiveSession('100yr', ['storage-tank'], []);
    s.advance(1200);
    s.patch([], []);
    s.advance(10);
    expect(s.snapshot().readouts.balanceError).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    const a = new LiveSession('100yr', ['upsize-p07'], []);
    const b = new LiveSession('100yr', ['upsize-p07'], []);
    a.advance(120);
    b.advance(60);
    b.advance(60);
    expect(Array.from(a.snapshot().frame.depth)).toEqual(Array.from(b.snapshot().frame.depth));
  });

  it('passes scenario options through, including on patch', () => {
    const s = new LiveSession('100yr', [], [], { tailwater: 'high' });
    expect(s.scenario.river.levels[0]).toBe(9.4);
    s.patch(['desilt-d07'], []);
    expect(s.scenario.river.levels[0]).toBe(9.4);
    expect(new LiveSession('100yr', [], []).scenario.river.levels[0]).toBe(8.2);
  });
});
