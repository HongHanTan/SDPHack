import { LandUse, type Grid } from '../sim/types';
import { BOULEVARD_I, BUND, GRID, INFILTRATION_MMHR, INLET_SUMP, MMHR, NODE_LAYOUT, POND, RIDGE, RIVER_ROWS, SAG, TERRAIN } from './config';

export function cellAt(x: number, y: number): number {
  return Math.floor(y / GRID.dx) * GRID.nx + Math.floor(x / GRID.dx);
}

/** Infiltration (m/s) indexed by LandUse code. */
export const INFIL_BY_LAND: number[] = [
  INFILTRATION_MMHR.ROOF,
  INFILTRATION_MMHR.ROAD,
  INFILTRATION_MMHR.LAWN,
  INFILTRATION_MMHR.PARK,
  INFILTRATION_MMHR.POND,
  INFILTRATION_MMHR.RIVER,
].map((v) => v * MMHR);

function bowl(x: number, y: number, cx: number, cy: number, r: number, depth: number): number {
  const d = Math.hypot(x - cx, y - cy);
  return d < r ? depth * (1 - (d / r) ** 2) : 0;
}

function distToSegment(x: number, y: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const vx = bx - ax;
  const vy = by - ay;
  const f = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(x - ax - f * vx, y - ay - f * vy);
}

/** 0 = off the ridge, 1 = ridge crest, 2 = diversion swale on the ridge's upslope (left-hand) side. */
function ridgeZone(x: number, y: number): 0 | 1 | 2 {
  const p = RIDGE.points;
  let zone: 0 | 1 | 2 = 0;
  for (let k = 0; k + 1 < p.length; k++) {
    const d = distToSegment(x, y, p[k], p[k + 1]);
    if (d <= RIDGE.halfWidth) return 1;
    const left = (p[k + 1][0] - p[k][0]) * (y - p[k][1]) - (p[k + 1][1] - p[k][1]) * (x - p[k][0]) > 0;
    if (left && d <= RIDGE.halfWidth + RIDGE.swaleWidth) zone = 2;
  }
  return zone;
}

/** Deterministic synthetic township: hill (north) → housing grid → sag (SW) + pond (SE) → river (south). */
export function buildTerrain(): Grid {
  const { nx, ny, dx } = GRID;
  const n = nx * ny;
  const z = new Float32Array(n);
  const land = new Uint8Array(n);
  const infil = new Float32Array(n);
  const building = new Int32Array(n).fill(-1);
  const h0 = new Float32Array(n);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const x = (i + 0.5) * dx;
      const y = (j + 0.5) * dx;
      if (j < RIVER_ROWS) {
        z[c] = 0;
        land[c] = LandUse.RIVER;
        continue;
      }
      const plane = TERRAIN.baseZ + TERRAIN.slope * y + Math.max(0, y - TERRAIN.hillStartY) * TERRAIN.hillSlope;
      let zc = plane;
      zc -= bowl(x, y, SAG.x, SAG.y, SAG.r, SAG.depth);
      zc -= bowl(x, y, POND.x, POND.y, POND.r, POND.depth);
      const pondDist = Math.hypot(x - POND.x, y - POND.y);

      let lc: number = LandUse.LAWN;
      if (pondDist < POND.r) lc = LandUse.POND;
      else if (pondDist < POND.r + POND.parkMargin || y > TERRAIN.hillStartY) lc = LandUse.PARK;
      else if (i % 10 === 0 || j % 10 === 0 || Math.abs(i - BOULEVARD_I) <= 1) {
        lc = LandUse.ROAD;
        zc -= TERRAIN.roadDrop;
      } else if (i % 10 >= 2 && i % 10 <= 8 && j % 10 >= 2 && j % 10 <= 8) {
        lc = LandUse.ROOF;
        building[c] = Math.floor(i / 10) + Math.floor(j / 10) * 100;
      }

      const rz = ridgeZone(x, y);
      if (rz === 1) {
        zc = plane + RIDGE.height;
        if (lc !== LandUse.ROAD) lc = LandUse.LAWN;
        building[c] = -1;
      } else if (rz === 2 && pondDist >= POND.r) {
        zc -= RIDGE.swaleDepth;
        if (lc !== LandUse.ROAD) lc = LandUse.PARK;
        building[c] = -1;
      }

      if (j < RIVER_ROWS + 2 && x >= BUND.xMin && x <= BUND.xMax) {
        zc = Math.max(zc, BUND.z);
        lc = LandUse.LAWN;
        building[c] = -1;
      }

      z[c] = zc;
      land[c] = lc;
      if (lc === LandUse.POND) h0[c] = Math.max(0, POND.initialLevel - zc);
    }
  }
  for (const [, x, y] of NODE_LAYOUT) z[cellAt(x, y)] -= INLET_SUMP;
  for (let c = 0; c < n; c++) infil[c] = INFIL_BY_LAND[land[c]];
  return { nx, ny, dx, z, land, infil, building, h0 };
}
