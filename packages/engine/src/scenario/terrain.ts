import { LandUse, type Grid } from '../sim/types';
import { CANAL, DIP, FUNNEL, GRID, HOUSE, INFILTRATION_MMHR, INLET_SUMP, LAKE, MMHR, ROAD_DROP } from './config';
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

/** Taman Kyra ground: a least-squares plane through the 9 asset ground levels, grate funnels, the J07 dip, then roads, houses, pond and canal. */
export function buildTerrain(): Grid {
  const { nx, ny, dx } = GRID;
  const n = nx * ny;
  const z = new Float32Array(n);
  const land = new Uint8Array(n);
  const infil = new Float32Array(n);
  const building = new Int32Array(n).fill(-1);
  const h0 = new Float32Array(n);

  // Least-squares plane z = a + b·x + c·y through the node ground levels (grid-local coordinates).
  const pts = ASSETS.nodes.map((nd) => ({ ...toLocal(nd.position_m.x, nd.position_m.y), g: nd.ground_elevation_m }));
  const S = { n: pts.length, x: 0, y: 0, xx: 0, xy: 0, yy: 0, g: 0, xg: 0, yg: 0 };
  for (const p of pts) {
    S.x += p.x; S.y += p.y; S.xx += p.x * p.x; S.xy += p.x * p.y; S.yy += p.y * p.y;
    S.g += p.g; S.xg += p.x * p.g; S.yg += p.y * p.g;
  }
  const M = [[S.n, S.x, S.y], [S.x, S.xx, S.xy], [S.y, S.xy, S.yy]];
  const v = [S.g, S.xg, S.yg];
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M);
  const col = (k: number) => M.map((row, r) => row.map((val, c) => (c === k ? v[r] : val)));
  const [pa, pb, pc] = [0, 1, 2].map((k) => det3(col(k)) / D);
  const plane = (x: number, y: number) => pa + pb * x + pc * y;
  const funnels = ASSETS.inlets.map((i) => toLocal(i.position_m.x, i.position_m.y));
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
      let zc = plane(x, y);
      let lc: number = LandUse.LAWN;

      if (inRect(x, y, canalC.x, canalC.y, canalLen, canal.width, 90)) {
        z[c] = CANAL.bedZ;
        land[c] = LandUse.RIVER;
        continue;
      }
      const dd = Math.hypot(x - dip.x, y - dip.y);
      if (dd < DIP.radius) zc -= DIP.depth * (1 - (dd / DIP.radius) ** 2);
      for (const f of funnels) {
        const df = Math.hypot(x - f.x, y - f.y);
        if (df < FUNNEL.radius) zc -= FUNNEL.depth * (1 - (df / FUNNEL.radius) ** 2);
      }

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
