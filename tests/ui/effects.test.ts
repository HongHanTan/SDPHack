import { describe, expect, it } from 'vitest';
import { INTERVENTIONS } from '../../src/scenario/interventions';
import type { StormId } from '../../src/scenario/storms';
import { effectOf } from '../../src/ui/effects';

describe('effectOf', () => {
  it('returns a stored effect for every storm and intervention', () => {
    for (const storm of ['10yr', '100yr'] as StormId[]) {
      for (const iv of INTERVENTIONS) {
        const e = effectOf(storm, iv.id);
        expect(e).not.toBeNull();
        expect(Number.isFinite(e!.dSag)).toBe(true);
        expect(Number.isInteger(e!.dHomes)).toBe(true);
      }
    }
  });

  it('returns null for unknown storms instead of crashing', () => {
    expect(effectOf('500yr' as StormId, 'pump')).toBeNull();
  });
});
