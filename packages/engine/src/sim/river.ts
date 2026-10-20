import type { Grid, RiverStage } from './types';
import type { SurfaceState } from './surface';

/** River water level at time t (linear interpolation, clamped at the ends). */
export function stageAt(river: RiverStage, t: number): number {
  const { times, levels } = river;
  if (t <= times[0]) return levels[0];
  for (let k = 1; k < times.length; k++) {
    if (t <= times[k]) {
      const f = (t - times[k - 1]) / (times[k] - times[k - 1]);
      return levels[k - 1] + f * (levels[k] - levels[k - 1]);
    }
  }
  return levels[levels.length - 1];
}

/** Forces river cells to the stage level. Returns the volumes added and removed (m³) for the water balance. */
export function resetRiver(grid: Grid, surf: SurfaceState, riverCells: Int32Array, level: number): { added: number; removed: number } {
  const area = grid.dx * grid.dx;
  let added = 0;
  let removed = 0;
  for (const c of riverCells) {
    const target = Math.max(0, level - grid.z[c]);
    const delta = (target - surf.h[c]) * area;
    if (delta > 0) added += delta;
    else removed -= delta;
    surf.h[c] = target;
  }
  return { added, removed };
}
