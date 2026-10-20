import { LandUse, type Grid } from '../sim/types';
import { CANAL, DIP, GRID, HOUSE, INFILTRATION_MMHR, INLET_SUMP, LAKE, MMHR, ROAD_DROP } from './config';
import { ASSETS, LAYOUT, toLocal } from './layout';

/** Cell index for grid-local metres (clamped to the grid). */
export function cellAt(x: number, y: number): number {
  const i = Math.min(GRID.nx - 1, Math.max(0, Math.floor(x / GRID.dx)));
  const j = Math.min(GRID.ny - 1, Math.max(0, Math.floor(y / GRID.dx)));
  return j * GRID.nx + i;
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

/** Point inside a rectangle centred at (cx, cy) whose `length` axis points at angleDeg (from east). */
function inRect(x: number, y: number, cx: number, cy: number, length: number, width: number, angleDeg: number): boolean {
  const a = (angleDeg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const along = dx * Math.cos(a) + dy * Math.sin(a);
  const across = -dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(along) <= length / 2 && Math.abs(across) <= width / 2;
}

/** Taman Kyra ground: IDW of the 9 asset ground levels, then roads, houses, pond, canal and the J07 dip. */
export function buildTerrain(): Grid {
  const { nx, ny, dx } = GRID;
  const n = nx * ny;
  const z = new Float32Array(n);
  const land = new Uint8Array(n);
  const infil = new Float32Array(n);
  const building = new Int32Array(n).fill(-1);
  const h0 = new Float32Array(n);

  const ground = ASSETS.nodes.map((nd) => ({ ...toLocal(nd.position_m.x, nd.position_m.y), g: nd.ground_elevation_m }));
  const idw = (x: number, y: number) => {
    let s = 0;
    let w = 0;
    for (const p of ground) {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d2 < 1e-6) return p.g;
      s += p.g / d2;
      w += 1 / d2;
    }
    return s / w;
  };
  const roads = LAYOUT.roads.map((r) => ({ ...r, ...toLocal(r.x, r.y) }));
  const houses = LAYOUT.houses.map((h, k) => ({ ...h, ...toLocal(h.x, h.y), k }));
  const lake = { ...LAYOUT.lake, ...toLocal(LAYOUT.lake.x, LAYOUT.lake.y) };
  const canal = LAYOUT.canal;
  const canalC = toLocal(canal.x, (canal.yFrom + canal.yTo) / 2);
  const canalLen = Math.abs(canal.yTo - canal.yFrom);
  const j07 = ASSETS.nodes.find((nd) => nd.node_id === 'NODE-J07')!;
  const dip = toLocal(j07.position_m.x, j07.position_m.y);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const x = (i + 0.5) * dx;
      const y = (j + 0.5) * dx;
      let zc = idw(x, y);
      let lc: number = LandUse.LAWN;

      if (inRect(x, y, canalC.x, canalC.y, canalLen, canal.width, 90)) {
        z[c] = CANAL.bedZ;
        land[c] = LandUse.RIVER;
        continue;
      }
      const dd = Math.hypot(x - dip.x, y - dip.y);
      if (dd < DIP.radius) zc -= DIP.depth * (1 - (dd / DIP.radius) ** 2);

      const dl = Math.hypot(x - lake.x, y - lake.y);
      if (dl < lake.radius) {
        lc = LandUse.POND;
        zc = LAKE.bedZ + (zc - LAKE.bedZ) * (dl / lake.radius) ** 2;
      } else if (dl < lake.radius + LAKE.parkMargin) {
        lc = LandUse.PARK;
      } else if (
        roads.some((r) => (r.kind === 'circle' ? Math.hypot(x - r.x, y - r.y) <= r.radius : inRect(x, y, r.x, r.y, r.length, r.width, r.angleDeg)))
      ) {
        lc = LandUse.ROAD;
        zc -= ROAD_DROP;
      } else {
        const h = houses.find((hh) => inRect(x, y, hh.x, hh.y, HOUSE.width * hh.scale, HOUSE.depth * hh.scale, hh.rotationDeg));
        if (h) {
          lc = LandUse.ROOF;
          building[c] = h.k;
        }
      }
      z[c] = zc;
      land[c] = lc;
      if (lc === LandUse.POND) h0[c] = Math.max(0, LAKE.waterLevel - zc);
    }
  }
  for (const inlet of ASSETS.inlets) {
    const p = toLocal(inlet.position_m.x, inlet.position_m.y);
    z[cellAt(p.x, p.y)] -= INLET_SUMP;
  }
  for (let c = 0; c < n; c++) infil[c] = INFIL_BY_LAND[land[c]];
  return { nx, ny, dx, z, land, infil, building, h0 };
}
