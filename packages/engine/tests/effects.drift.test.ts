import { describe, expect, it } from 'vitest';
import { computeEffects } from '../scripts/computeEffects';
import stored from '../src/scenario/effects.json';

type Table = Record<string, Record<string, { dSag: number; dHomes: number }>>;

describe('pre-computed intervention effects', () => {
  it('still match the live model (re-run `npm run effects` after retuning)', () => {
    const fresh = computeEffects() as unknown as Table;
    const saved = stored as Table;
    for (const [storm, row] of Object.entries(fresh)) {
      for (const [id, e] of Object.entries(row)) {
        expect(Math.abs(saved[storm][id].dSag - e.dSag), `${storm} ${id} dSag`).toBeLessThanOrEqual(0.005);
        expect(saved[storm][id].dHomes, `${storm} ${id} dHomes`).toBe(e.dHomes);
      }
    }
  }, 1_500_000);
});
