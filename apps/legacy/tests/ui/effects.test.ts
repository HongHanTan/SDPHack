import { describe, expect, it } from 'vitest';
import type { StormId } from '@floodops/engine/scenario/storms';
import { effectOf } from '../../src/ui/effects';

describe('effectOf', () => {
  it('returns null for unknown storms or tailwater instead of crashing', () => {
    expect(effectOf('500yr' as StormId, 'upsize-p07')).toBeNull();
    expect(effectOf('synthetic_80mmh_60min', 'upsize-p07', 'flood' as never)).toBeNull();
  });
  it('has badges for every intervention on the default storm', () => {
    for (const id of ['desilt-d07', 'upsize-p07', 'storage-tank', 'lake-overflow'] as const) {
      expect(effectOf('synthetic_80mmh_60min', id)).not.toBeNull();
    }
  });
  it('returns finite numbers whenever an entry exists', () => {
    const e = effectOf('synthetic_80mmh_60min', 'desilt-d07');
    if (e) {
      expect(Number.isFinite(e.dSag)).toBe(true);
      expect(Number.isInteger(e.dHomes)).toBe(true);
    }
  });
});
