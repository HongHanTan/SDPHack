import { rainIntensityAt } from '@floodops/engine/scenario/storms';
import type { Storm } from '@floodops/engine/sim/types';
import type { SiteFrame } from './siteFrame';

/** The Taman Kyra scene the shared fog and rain were tuned for spans about 250 m. */
const REFERENCE_SPAN_M = 250;
/** RainEffect drops fall over x ∈ [−70, 160], z ∈ [−160, 140] and land at y = 11 (the built-in ground). */
const RAIN_CENTRE = { x: 45, y: 11, z: -10 };
const RAIN_SIZE = { x: 230, z: 300 };

export interface CityCamera {
  target: [number, number, number];
  position: [number, number, number];
  maxDistance: number;
  far: number;
}

/** Opening camera over an imported site (scene coordinates). */
export function cityCamera(f: SiteFrame): CityCamera {
  const span = Math.max(f.w, f.h);
  return {
    target: [f.cx, f.groundY, f.cz],
    position: [f.cx + 15, f.groundY + span * 0.45, f.cz + span * 0.55],
    maxDistance: Math.max(400, span * 2.5),
    far: Math.max(1000, span * 6),
  };
}

/** Fog distances scale up for sites larger than the built-in one, so a big site is not fogged out. */
export const fogScale = (f: SiteFrame) => Math.max(1, Math.max(f.w, f.h) / REFERENCE_SPAN_M);

/** Group transform that moves RainEffect's fixed rain box onto the site and stretches it to cover it. */
export function rainPlacement(f: SiteFrame): { position: [number, number, number]; scale: [number, number, number] } {
  const sx = Math.max(1, f.w / RAIN_SIZE.x);
  const sz = Math.max(1, f.h / RAIN_SIZE.z);
  return {
    position: [f.cx - RAIN_CENTRE.x * sx, f.groundY - RAIN_CENTRE.y, f.cz - RAIN_CENTRE.z * sz],
    scale: [sx, 1, sz],
  };
}

/** Rain shows while playback runs and the uploaded storm is falling at the shown time. */
export function rainingAt(storm: Storm | null | undefined, timestampS: number | undefined, playing: boolean): boolean {
  if (!playing || !storm || timestampS === undefined) return false;
  return rainIntensityAt(storm, timestampS) > 0;
}
