import { MANNING_N } from '../sim/pipes';
import { LandUse, type DrainNode, type Grid, type Network, type Pipe } from '../sim/types';
import { COVER, MANHOLE } from './config';
import { cellIn, siteNodeLocal, siteToLocal, TAMAN_KYRA, type SiteSpec } from './site';

export function makeNode(
  grid: Grid,
  id: string,
  x: number,
  y: number,
  opts: Partial<Pick<DrainNode, 'invert' | 'area' | 'maxDepth' | 'inletPerimeter'>> = {},
): DrainNode {
  const cell = cellIn(grid, x, y);
  const ground = grid.z[cell];
  const invert = opts.invert ?? ground - COVER;
  return {
    id,
    x,
    y,
    cell,
    invert,
    area: opts.area ?? MANHOLE.area,
    maxDepth: opts.maxDepth ?? Math.max(0.3, ground - invert),
    inletPerimeter: opts.inletPerimeter ?? 0,
  };
}

export function makePipe(a: DrainNode, b: DrainNode, diameter: number): Pipe {
  const length = Math.hypot(a.x - b.x, a.y - b.y);
  return { id: `${a.id}-${b.id}`, from: a.id, to: b.id, diameter, length, slope: (a.invert - b.invert) / length, n: MANNING_N };
}

/** Grid-local position of a built-in Taman Kyra asset node. */
export function nodeSite(id: string): { x: number; y: number } {
  return siteNodeLocal(TAMAN_KYRA, id);
}

/** The outfall's own cell when it is river, else the nearest river cell (Euclidean cell distance, ties to the lower index). */
export function nearestRiverCell(grid: Grid, cell: number): number {
  if (grid.land[cell] === LandUse.RIVER) return cell;
  const ci = cell % grid.nx;
  const cj = Math.floor(cell / grid.nx);
  let best = -1;
  let bestD = Infinity;
  for (let c = 0; c < grid.nx * grid.ny; c++) {
    if (grid.land[c] !== LandUse.RIVER) continue;
    const d = (c % grid.nx - ci) ** 2 + (Math.floor(c / grid.nx) - cj) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best < 0) throw new Error('No river cell for outfall');
  return best;
}

/** Effective weir edge of a square grate (m), reduced by the blocked fraction. */
export function inletPerimeter(grateAreaM2: number, blockage = 0): number {
  return 4 * Math.sqrt(grateAreaM2) * (1 - Math.min(1, Math.max(0, blockage)));
}

/** The site's drainage network on the grid (default Tay's Taman Kyra); blockage maps inlet_id → blocked fraction. */
export function buildNetwork(grid: Grid, blockage: Record<string, number> = {}, site: SiteSpec = TAMAN_KYRA): Network {
  const inletByNode = new Map(site.assets.inlets.map((i) => [i.node_id, i]));
  const nodes: DrainNode[] = site.assets.nodes.map((nd) => {
    const p = siteToLocal(site, nd.position_m.x, nd.position_m.y);
    const inlet = inletByNode.get(nd.node_id);
    return makeNode(grid, nd.node_id, p.x, p.y, {
      invert: nd.invert_elevation_m,
      inletPerimeter: inlet ? inletPerimeter(inlet.grate_area_m2, blockage[inlet.inlet_id] ?? 0) : 0,
      // The outfall headwall chamber keeps its asset depth, so canal backflow can fill it and throttle P08.
      ...(nd.node_type === 'outfall' ? { maxDepth: nd.max_depth_m } : {}),
    });
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pipes: Pipe[] = site.assets.conduits.map((cd) => {
    const a = byId.get(cd.from_node_id)!;
    const b = byId.get(cd.to_node_id)!;
    return { id: cd.conduit_id, from: a.id, to: b.id, diameter: cd.diameter_m, length: cd.length_m, slope: (a.invert - b.invert) / cd.length_m, n: cd.manning_n };
  });
  const outfalls = site.assets.nodes
    .filter((a) => a.node_type === 'outfall')
    .map((a) => {
      const node = byId.get(a.node_id)!;
      const into = pipes.find((p) => p.to === node.id);
      if (!into) throw new Error(`Outfall ${node.id} has no incoming pipe`);
      return { node: node.id, riverCell: nearestRiverCell(grid, node.cell), area: (Math.PI * into.diameter ** 2) / 4, flapGate: false };
    });
  return { nodes, pipes, outfalls, pumps: [] };
}
