import { describe, expect, it } from 'vitest';
import { alternatingBlock, designStorm, IDF, idfIntensity, STORMS } from '../../src/scenario/storms';

describe('idfIntensity', () => {
  it('follows i = λT^κ / (d + θ)^η', () => {
    const c = { station: 't', lambda: 60, kappa: 0.17, theta: 0.25, eta: 0.8, provisional: true };
    expect(idfIntensity(c, 100, 2)).toBeCloseTo((60 * Math.pow(100, 0.17)) / Math.pow(2.25, 0.8), 9);
  });

  it('rarer storms are more intense', () => {
    expect(idfIntensity(IDF, 100, 2)).toBeGreaterThan(idfIntensity(IDF, 10, 2));
  });
});

describe('alternatingBlock', () => {
  const blocks = alternatingBlock(IDF, 100, 7200, 300);

  it('has 24 five-minute blocks', () => {
    expect(blocks.length).toBe(24);
  });

  it('preserves the total 2-hour depth', () => {
    const totalMm = blocks.reduce((s, i) => s + (i * 300) / 3600, 0);
    expect(totalMm).toBeCloseTo(idfIntensity(IDF, 100, 2) * 2, 6);
  });

  it('puts the peak at the centre', () => {
    expect(blocks.indexOf(Math.max(...blocks))).toBe(12);
  });
});

describe('designStorm', () => {
  it('converts to m/s and carries the provisional flag', () => {
    const s = designStorm(100);
    expect(s.intensity[12]).toBeCloseTo(alternatingBlock(IDF, 100, 7200, 300)[12] / 3.6e6, 15);
    expect(s.provisional).toBe(IDF.provisional);
    expect(STORMS['10yr'].returnPeriod).toBe(10);
  });
});
