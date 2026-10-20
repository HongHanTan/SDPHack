import { describe, expect, it } from 'vitest';
import { describeChange, formatRM } from '../../src/ui/format';

describe('describeChange', () => {
  it('reports improvements when lower is better', () => {
    expect(describeChange(1, 0.5, 2)).toEqual({ text: '-0.50 (-50%)', tone: 'better' });
  });
  it('reports no change within rounding', () => {
    expect(describeChange(3, 3, 0)).toEqual({ text: 'no change', tone: 'same' });
  });
  it('omits percentage from a zero baseline', () => {
    expect(describeChange(0, 2, 2)).toEqual({ text: '+2.00', tone: 'worse' });
  });
  it('flips tone when higher is better', () => {
    expect(describeChange(1, 2, 1, false).tone).toBe('better');
  });
});

describe('formatRM', () => {
  it('formats millions', () => {
    expect(formatRM(2_650_000)).toBe('RM 2.65M');
    expect(formatRM(0)).toBe('RM 0');
  });
});
