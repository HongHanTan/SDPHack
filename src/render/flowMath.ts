export const MIN_ARROW_LOAD = 0.02;

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Ribbon-lengths per second. */
export function arrowSpeed(load: number): number {
  return 0.2 + 1.8 * clamp01(load);
}

export function arrowsVisible(load: number): boolean {
  return load >= MIN_ARROW_LOAD;
}

/** Advances a chevron phase in [0, 1). */
export function advancePhase(phase: number, dtS: number, load: number): number {
  const p = (phase + arrowSpeed(load) * Math.max(0, dtS)) % 1;
  return p < 0 ? p + 1 : p;
}
