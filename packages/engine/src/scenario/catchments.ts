import { LandUse, type Catchment, type Grid } from '../sim/types';
import { CATCHMENT } from './config';
import { siteNodeLocal, siteToLocal, TAMAN_KYRA, type SiteSpec } from './site';

/** Even-odd ray test: point inside a polygon (same coordinates). */
function inPolygon(x: number, y: number, poly: ReadonlyArray<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/**
 * The site's subcatchments (default Tay's four 1 ha Taman Kyra ones). A subcatchment with a polygon takes the non-water
 * cells whose centre lies inside it (claimed first, in order); the rest take the area_ha worth of remaining non-water
 * cells nearest each outlet node (nearest-outlet assignment).
 */
export function buildCatchments(grid: Grid, blockage: Record<string, number> = {}, site: SiteSpec = TAMAN_KYRA): Catchment[] {
  const subs = site.subcatchments;
  const n = grid.nx * grid.ny;
  const claimed = new Uint8Array(n);
  const isWater = (c: number) => grid.land[c] === LandUse.RIVER || grid.land[c] === LandUse.POND;
  const centre = (c: number) => ({ x: ((c % grid.nx) + 0.5) * grid.dx, y: (Math.floor(c / grid.nx) + 0.5) * grid.dx });

  const polyCells: Array<number[] | null> = subs.map((s) => {
    if (!s.polygon) return null;
    const poly = s.polygon.map(([px, py]) => siteToLocal(site, px, py));
    const cells: number[] = [];
    for (let c = 0; c < n; c++) {
      if (claimed[c] || isWater(c)) continue;
      const { x, y } = centre(c);
      if (inPolygon(x, y, poly)) {
        cells.push(c);
        claimed[c] = 1;
      }
    }
    return cells;
  });

  const nearest = subs.map((s, k) => ({ k, site: siteNodeLocal(site, s.outletNodeId) })).filter(({ k }) => !subs[k].polygon);
  const lists: Array<Array<{ c: number; d: number }>> = subs.map(() => []);
  if (nearest.length) {
    for (let c = 0; c < n; c++) {
      if (claimed[c] || isWater(c)) continue;
      const { x, y } = centre(c);
      let best = nearest[0].k;
      let bestD = Infinity;
      for (const s of nearest) {
        const d = Math.hypot(x - s.site.x, y - s.site.y);
        if (d < bestD) {
          bestD = d;
          best = s.k;
        }
      }
      lists[best].push({ c, d: bestD });
    }
  }
  return subs.map((s, k) => {
    const want = Math.round((s.areaHa * 1e4) / (grid.dx * grid.dx));
    const cells = polyCells[k] ?? lists[k].sort((a, b) => a.d - b.d || a.c - b.c).slice(0, want).map((e) => e.c);
    return { id: s.id, node: s.outletNodeId, cells: Int32Array.from(cells), directFraction: s.imperviousPercent / 100, lagS: CATCHMENT.lagS,
      captureCurve: site.captureCurve,
      captureLoss: blockage[site.assets.inlets.find((i) => i.node_id === s.outletNodeId)?.inlet_id ?? ''] ?? 0,
    };
  });
}
