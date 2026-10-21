import { siteToTeam, type SiteSpec } from '@floodops/engine/scenario/site';
import { LandUse } from '@floodops/engine/sim/types';

export type ScenePoint = (x: number, y: number, z: number) => [number, number, number];

/** Centre of engine cell (i, j) in file metres (the coordinates of Tay's imported site): file = team + shift. */
export function cellFilePoint(site: SiteSpec, i: number, j: number): { x: number; y: number } {
  const t = siteToTeam(site, (i + 0.5) * site.gridSpec.dx, (j + 0.5) * site.gridSpec.dx);
  return { x: t.x + site.shift.dx, y: t.y + site.shift.dy };
}

export interface SiteWaterBase {
  nx: number;
  ny: number;
  /** Scene x and z of each cell centre (scene y comes from `groundY` + depth). */
  sceneX: Float32Array;
  sceneZ: Float32Array;
  /** Scene y of the engine ground (file z = team z + shift.dz) at each cell. */
  groundY: Float32Array;
  /** 0 for pond and river cells, which are never drawn as street water. */
  mask: Uint8Array;
}

/** Places each engine cell centre on Tay's map: team → file metres → scene through his `point`. */
export function siteWaterBase(site: SiteSpec, grid: { z: ArrayLike<number>; land: ArrayLike<number> }, point: ScenePoint): SiteWaterBase {
  const { nx, ny } = site.gridSpec;
  const n = nx * ny;
  const sceneX = new Float32Array(n), sceneZ = new Float32Array(n), groundY = new Float32Array(n), mask = new Uint8Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const f = cellFilePoint(site, i, j);
      const p = point(f.x, f.y, grid.z[c] + site.shift.dz);
      sceneX[c] = p[0];
      groundY[c] = p[1];
      sceneZ[c] = p[2];
      mask[c] = grid.land[c] === LandUse.POND || grid.land[c] === LandUse.RIVER ? 0 : 1;
    }
  }
  return { nx, ny, sceneX, sceneZ, groundY, mask };
}
