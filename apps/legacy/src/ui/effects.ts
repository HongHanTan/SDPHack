import data from '@floodops/engine/scenario/effects.json';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import type { StormId } from '@floodops/engine/scenario/storms';

export interface Effect {
  dSag: number;
  dHomes: number;
}

const table = data as Partial<Record<string, Partial<Record<string, Effect>>>>;

/** Pre-computed change vs baseline (from `npm run effects`), or null if missing. */
export function effectOf(storm: StormId, id: InterventionId): Effect | null {
  return table[storm]?.[id] ?? null;
}
