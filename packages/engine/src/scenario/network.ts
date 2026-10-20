import { MANNING_N } from '../sim/pipes';
import type { DrainNode, Grid, Network, Pipe } from '../sim/types';
import { COVER, MANHOLE } from './config';
import { ASSETS, toLocal } from './layout';
import { cellAt } from './terrain';

export function makeNode(
  grid: Grid,
  id: string,
  x: number,
  y: number,
  opts: Partial<Pick<DrainNode, 'invert' | 'area' | 'maxDepth' | 'inletPerimeter'>> = {},
): DrainNode {
  const cell = cellAt(x, y);
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

/** Grid-local position of an asset node. */
export function nodeSite(id: string): { x: number; y: number } {
  const nd = ASSETS.nodes.find((n) => n.node_id === id);
  if (!nd) throw new Error(`Unknown asset node ${id}`);
  return toLocal(nd.position_m.x, nd.position_m.y);
}

/** Effective weir edge of a square grate (m), reduced by the blocked fraction. */
export function inletPerimeter(grateAreaM2: number, blockage = 0): number {
  return 4 * Math.sqrt(grateAreaM2) * (1 - Math.min(1, Math.max(0, blockage)));
}

/** Tay's Taman Kyra network on the grid; blockage maps inlet_id → blocked fraction. */
export function buildNetwork(grid: Grid, blockage: Record<string, number> = {}): Network {
  const inletByNode = new Map(ASSETS.inlets.map((i) => [i.node_id, i]));
  const nodes: DrainNode[] = ASSETS.nodes.map((nd) => {
    const p = toLocal(nd.position_m.x, nd.position_m.y);
    const inlet = inletByNode.get(nd.node_id);
    return makeNode(grid, nd.node_id, p.x, p.y, {
      invert: nd.invert_elevation_m,
      inletPerimeter: inlet ? inletPerimeter(inlet.grate_area_m2, blockage[inlet.inlet_id] ?? 0) : 0,
    });
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pipes: Pipe[] = ASSETS.conduits.map((cd) => {
    const a = byId.get(cd.from_node_id)!;
    const b = byId.get(cd.to_node_id)!;
    return { id: cd.conduit_id, from: a.id, to: b.id, diameter: cd.diameter_m, length: cd.length_m, slope: (a.invert - b.invert) / cd.length_m, n: cd.manning_n };
  });
  const outfall = nodes.find((n) => ASSETS.nodes.find((a) => a.node_id === n.id)!.node_type === 'outfall')!;
  const lastPipe = pipes.find((p) => p.to === outfall.id)!;
  return {
    nodes,
    pipes,
    outfalls: [{ node: outfall.id, riverCell: outfall.cell, area: (Math.PI * lastPipe.diameter ** 2) / 4, flapGate: false }],
    pumps: [],
  };
}
