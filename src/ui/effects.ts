import data from '../scenario/effects.json';
import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';

export interface Effect {
  dSag: number;
  dHomes: number;
}

const table = data as Partial<Record<string, Partial<Record<string, Effect>>>>;

/** Pre-computed change vs baseline (from `npm run effects`), or null if missing. */
export function effectOf(storm: StormId, id: InterventionId): Effect | null {
  return table[storm]?.[id] ?? null;
}
