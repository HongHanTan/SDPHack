import { describe, expect, it } from 'vitest';
import { computeEffects } from '../scripts/computeEffects';
import stored from '../src/scenario/effects.json';

type Table = Record<string, Record<string, Record<string, { dSag: number; dHomes: number }>>>;

describe('pre-computed intervention effects', () => {
  it('still match the live model (re-run `npm run effects` after retuning)', () => {
    const fresh = computeEffects() as unknown as Table;
    const saved = stored as unknown as Table;
    for (const [tw, storms] of Object.entries(fresh)) {
      for (const [storm, row] of Object.entries(storms)) {
        for (const [id, e] of Object.entries(row)) {
          expect(Math.abs(saved[tw][storm][id].dSag - e.dSag), `${tw} ${storm} ${id} dSag`).toBeLessThanOrEqual(0.005);
          expect(saved[tw][storm][id].dHomes, `${tw} ${storm} ${id} dHomes`).toBe(e.dHomes);
        }
      }
    }
  }, 3_000_000);
});
