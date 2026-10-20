// Ported from apps/legacy/src/render/flowMath.ts and flowRibbons.ts (Hong Han).
import * as THREE from 'three';
import type { SimulationFrame } from '../types';

export const MIN_ARROW_LOAD = 0.02;

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Ribbon-lengths per second. */
export function arrowSpeed(load: number): number {
  return 0.2 + 1.8 * clamp01(load);
}

export function arrowsVisible(load: number): boolean {
  return load >= MIN_ARROW_LOAD;
}

/** Advances a chevron phase in [0, 1), in chevron units: `scale` = ribbon length / chevron spacing. */
export function advancePhase(phase: number, dtS: number, load: number, scale = 1): number {
  const p = (phase + arrowSpeed(load) * Math.max(0, dtS) * scale) % 1;
  return p < 0 ? p + 1 : p;
}

export function loadColorBetween(load: number, low: THREE.Color, mid: THREE.Color, high: THREE.Color, out: THREE.Color): THREE.Color {
  const t = clamp01(load);
  return t < 0.5 ? out.copy(low).lerp(mid, t * 2) : out.copy(mid).lerp(high, (t - 0.5) * 2);
}

/** Pipe load (0..1+) for a conduit in a team frame: capacity_fraction, else a value from its status. */
export function pipeLoad(frame: SimulationFrame | null | undefined, conduitId: string): number {
  const p = frame?.pipe_states?.find((s) => s.conduit_id === conduitId);
  if (!p) return 0;
  if (typeof p.capacity_fraction === 'number' && Number.isFinite(p.capacity_fraction)) return p.capacity_fraction;
  return p.status === 'surcharged' ? 1 : p.status === 'near_capacity' ? 0.85 : 0.4;
}
