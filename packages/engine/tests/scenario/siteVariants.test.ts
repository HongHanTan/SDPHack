import { describe, expect, it } from 'vitest';
import { buildScenario, scenarioKey, TAMAN_KYRA } from '../../src/scenario';
import { withPipeDiameter } from '../../src/scenario/siteVariants';
import type { Storm } from '../../src/sim/types';

describe('withPipeDiameter', () => {
  const id = TAMAN_KYRA.assets.conduits[0].conduit_id;
  it('changes only that conduit and the key', () => {
    const s = withPipeDiameter(TAMAN_KYRA, id, 0.9);
    expect(s.key).toBe(`${TAMAN_KYRA.key}|${id}@0.9`);
    expect(s.assets.conduits.find((c) => c.conduit_id === id)!.diameter_m).toBe(0.9);
    const rest = (x: typeof s) => x.assets.conduits.filter((c) => c.conduit_id !== id);
    expect(rest(s)).toEqual(rest(TAMAN_KYRA));
    expect(TAMAN_KYRA.assets.conduits.find((c) => c.conduit_id === id)!.diameter_m).not.toBe(0.9);
  });
  it('throws for an unknown pipe', () => {
    expect(() => withPipeDiameter(TAMAN_KYRA, 'NOPE', 1)).toThrow();
  });
});

describe('storm override', () => {
  const storm: Storm = { id: 'uploaded_rainfall', label: 'Uploaded rainfall', returnPeriod: 0, blockS: 300, intensity: [1e-5, 0], provisional: false, peakMinute: 0 };
  it('buildScenario uses it and scenarioKey differs', () => {
    const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site: TAMAN_KYRA, storm });
    expect(sc.storm).toBe(storm);
    expect(scenarioKey([], 'synthetic_80mmh_60min', [], { site: TAMAN_KYRA, storm })).not.toBe(scenarioKey([], 'synthetic_80mmh_60min', [], { site: TAMAN_KYRA }));
  });
});
