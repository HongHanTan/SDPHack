import hydrology from '../../../../models/illustrative_taman_kyra/hydrology.json';
import capture from '../../../../models/illustrative_taman_kyra/inlet_capture.json';
import { LandUse, type Catchment, type Grid } from '../sim/types';
import { CATCHMENT } from './config';
import { ASSETS } from './layout';
import { nodeSite } from './network';

interface Sub { subcatchment_id: string; outlet_node_id: string; area_ha: number; impervious_percent: number }

/** Tay's four 1 ha subcatchments: the area_ha worth of non-water cells nearest each outlet node (nearest-outlet assignment). */
export function buildCatchments(grid: Grid, blockage: Record<string, number> = {}): Catchment[] {
  const subs = (hydrology as unknown as { subcatchments: Sub[] }).subcatchments;
  const sites = subs.map((s) => nodeSite(s.outlet_node_id));
  const lists: Array<Array<{ c: number; d: number }>> = subs.map(() => []);
  for (let c = 0; c < grid.nx * grid.ny; c++) {
    const land = grid.land[c];
    if (land === LandUse.RIVER || land === LandUse.POND) continue;
    const x = ((c % grid.nx) + 0.5) * grid.dx;
    const y = (Math.floor(c / grid.nx) + 0.5) * grid.dx;
    let best = 0;
    let bestD = Infinity;
    sites.forEach((s, k) => {
      const d = Math.hypot(x - s.x, y - s.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    });
    lists[best].push({ c, d: bestD });
  }
  return subs.map((s, k) => {
    const want = Math.round((s.area_ha * 1e4) / (grid.dx * grid.dx));
    const cells = lists[k].sort((a, b) => a.d - b.d || a.c - b.c).slice(0, want).map((e) => e.c);
    return { id: s.subcatchment_id, node: s.outlet_node_id, cells: Int32Array.from(cells), directFraction: s.impervious_percent / 100, lagS: CATCHMENT.lagS,
      captureCurve: (capture as unknown as { capture_curve_m3s: Array<[number, number]> }).capture_curve_m3s,
      captureLoss: blockage[ASSETS.inlets.find((i) => i.node_id === s.outlet_node_id)?.inlet_id ?? ''] ?? 0,
    };
  });
}
