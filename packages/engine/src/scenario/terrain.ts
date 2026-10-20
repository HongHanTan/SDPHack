import { LandUse, type Grid } from '../sim/types';
import { FUNNEL, GRID, HOUSE, INFILTRATION_MMHR, INLET_SUMP, LAKE, MMHR, ROAD_DROP } from './config';
import { cellIn, siteNodeLocal, siteToLocal, TAMAN_KYRA, type SiteSpec } from './site';

/** Cell index for grid-local metres in the built-in Taman Kyra grid (clamped to the grid). */
export function cellAt(x: number, y: number): number {
  return cellIn(GRID, x, y);
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

/**
 * Site ground: surveyed heights when the site has them, otherwise a least-squares plane through the asset ground levels
 * with grate funnels and the optional dip; then rivers, ponds, roads and houses.
 */
export function buildTerrain(site: SiteSpec = TAMAN_KYRA): Grid {
  const { nx, ny, dx } = site.gridSpec;
  const n = nx * ny;
  const z = new Float32Array(n);
  const land = new Uint8Array(n);
  const infil = new Float32Array(n);
  const building = new Int32Array(n).fill(-1);
  const h0 = new Float32Array(n);

  let plane: (x: number, y: number) => number = () => 0;
  if (!site.ground) {
    // Least-squares plane z = a + b·x + c·y through the node ground levels (grid-local coordinates).
    const pts = site.assets.nodes.map((nd) => ({ ...siteToLocal(site, nd.position_m.x, nd.position_m.y), g: nd.ground_elevation_m }));
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
    plane = (x: number, y: number) => pa + pb * x + pc * y;
  }
  const funnels = site.assets.inlets.map((i) => siteToLocal(site, i.position_m.x, i.position_m.y));
  const roads = site.layout.roads.map((r) => ({ ...r, ...siteToLocal(site, r.x, r.y) }));
  const houses = site.layout.houses.map((h, k) => ({ ...h, ...siteToLocal(site, h.x, h.y), k }));
  const ponds = site.ponds.map((p) => ({ ...p, ...siteToLocal(site, p.x, p.y) }));
  const rivers = site.rivers.map((r) => ({ ...r, ...siteToLocal(site, r.cx, r.cy) }));
  const dip = site.dip ? { ...siteNodeLocal(site, site.dip.nodeId), radius: site.dip.radius, depth: site.dip.depth } : null;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const x = (i + 0.5) * dx;
      const y = (j + 0.5) * dx;
      const surveyed = site.ground ? site.ground[c] : null;
      let zc = surveyed ?? plane(x, y);
      let lc: number = LandUse.LAWN;
      const river = rivers.find((r) => inRect(x, y, r.x, r.y, r.length, r.width, r.angleDeg));
      if (river) {
        z[c] = surveyed ?? river.bedZ;
        land[c] = LandUse.RIVER;
        continue;
      }
      if (surveyed === null) {
        if (dip) {
          const dd = Math.hypot(x - dip.x, y - dip.y);
          if (dd < dip.radius) zc -= dip.depth * (1 - (dd / dip.radius) ** 2);
        }
        for (const f of funnels) {
          const df = Math.hypot(x - f.x, y - f.y);
          if (df < FUNNEL.radius) zc -= FUNNEL.depth * (1 - (df / FUNNEL.radius) ** 2);
        }
      }
      const pond = ponds.find((p) => Math.hypot(x - p.x, y - p.y) < p.radius + LAKE.parkMargin);
      const dl = pond ? Math.hypot(x - pond.x, y - pond.y) : Infinity;
      if (pond && dl < pond.radius) {
        lc = LandUse.POND;
        if (surveyed === null) zc = pond.bedZ + (zc - pond.bedZ) * (dl / pond.radius) ** 2;
      } else if (pond) {
        lc = LandUse.PARK;
      } else if (roads.some((r) => (r.kind === 'circle' ? Math.hypot(x - r.x, y - r.y) <= r.radius : inRect(x, y, r.x, r.y, r.length, r.width, r.angleDeg)))) {
        lc = LandUse.ROAD;
        if (surveyed === null) zc -= ROAD_DROP;
      } else {
        const h = houses.find((hh) => inRect(x, y, hh.x, hh.y, hh.width ?? HOUSE.width * hh.scale, hh.depth ?? HOUSE.depth * hh.scale, hh.rotationDeg));
        if (h) {
          lc = LandUse.ROOF;
          building[c] = h.k;
        }
      }
      z[c] = zc;
      land[c] = lc;
      if (lc === LandUse.POND) h0[c] = Math.max(0, pond!.waterLevel - zc);
    }
  }
  for (const inlet of site.assets.inlets) {
    const p = siteToLocal(site, inlet.position_m.x, inlet.position_m.y);
    z[cellIn(site.gridSpec, p.x, p.y)] -= INLET_SUMP;
  }
  for (let c = 0; c < n; c++) infil[c] = INFIL_BY_LAND[land[c]];
  return { nx, ny, dx, z, land, infil, building, h0 };
}
