import { MANNING_N } from '../sim/pipes';
import type { DrainNode, Grid, Network, Pipe } from '../sim/types';
import { COVER, MANHOLE, NODE_INLETS, NODE_LAYOUT, OUTFALL_DROP, PIPE_D } from './config';
import { cellAt } from './terrain';

export const OUTFALL_RIVER_POINT = { x: 82, y: 10 };

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
    maxDepth: opts.maxDepth ?? ground - invert,
    inletPerimeter: opts.inletPerimeter ?? MANHOLE.inletPerimeter,
  };
}

export function makePipe(a: DrainNode, b: DrainNode, diameter: number): Pipe {
  const length = Math.hypot(a.x - b.x, a.y - b.y);
  return { id: `${a.id}-${b.id}`, from: a.id, to: b.id, diameter, length, slope: (a.invert - b.invert) / length, n: MANNING_N };
}

type Kind = 'trunk' | 'branch' | 'local';
const LINKS: Array<[string, string, Kind]> = [
  ['T0', 'T1', 'trunk'], ['T1', 'T2', 'trunk'], ['T2', 'T3', 'trunk'], ['T3', 'T4', 'trunk'],
  ['T4', 'T5', 'trunk'], ['T5', 'T6', 'trunk'], ['T6', 'T7', 'trunk'], ['T7', 'T8', 'trunk'],
  ['T8', 'S0', 'trunk'], ['S0', 'S1', 'trunk'], ['S1', 'S2', 'trunk'], ['S2', 'S3', 'trunk'], ['S3', 'O', 'trunk'],
  ['W0', 'W1', 'branch'], ['W1', 'W2', 'branch'], ['W2', 'T3', 'branch'],
  ['E0', 'E1', 'branch'], ['E1', 'E2', 'branch'], ['E2', 'T5', 'branch'],
  ['SL0', 'S3', 'local'], ['SL1', 'S2', 'local'],
];

export const TRUNK_PIPE_IDS: string[] = LINKS.filter((l) => l[2] === 'trunk').map(([a, b]) => `${a}-${b}`);
export const SAG_NODE_IDS = ['S0', 'S1', 'S2', 'S3', 'SL0', 'SL1', 'O'];

export function buildNetwork(grid: Grid): Network {
  const nodes = NODE_LAYOUT.map(([id, x, y]) =>
    makeNode(grid, id, x, y, {
      ...(id in NODE_INLETS ? { inletPerimeter: NODE_INLETS[id] } : {}),
      ...(id === 'O' ? { invert: grid.z[cellAt(x, y)] - COVER - OUTFALL_DROP } : {}),
    }),
  );
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pipes = LINKS.map(([a, b, kind]) =>
    makePipe(byId.get(a)!, byId.get(b)!, kind === 'trunk' ? PIPE_D.trunk : kind === 'branch' ? PIPE_D.branch : PIPE_D.local),
  );
  return {
    nodes,
    pipes,
    outfalls: [
      { node: 'O', riverCell: cellAt(OUTFALL_RIVER_POINT.x, OUTFALL_RIVER_POINT.y), area: (Math.PI * PIPE_D.trunk ** 2) / 4, flapGate: false },
    ],
    pumps: [],
  };
}
