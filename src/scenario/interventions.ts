import { LandUse, type DrainNode, type Grid, type Network } from '../sim/types';
import { BIOSWALE, GRID, INFILTRATION_MMHR, MANHOLE, MMHR, PIPE_D, POND, PUMP_RATE, TANK } from './config';
import { makeNode, makePipe, OUTFALL_RIVER_POINT, SAG_NODE_IDS, TRUNK_PIPE_IDS } from './network';
import { cellAt } from './terrain';

export interface Township {
  grid: Grid;
  network: Network;
}

export type InterventionId =
  | 'upsize-trunk'
  | 'relief-pond'
  | 'detention-tank'
  | 'bioswales'
  | 'flap-gate'
  | 'sag-inlets'
  | 'pump';

export interface Intervention {
  id: InterventionId;
  name: string;
  description: string;
  costRM: number; // INDICATIVE PLACEHOLDER — replace with SDP quantity-surveyor rates
  disruption: 'Low' | 'Medium' | 'High';
  apply(t: Township): void;
}

export function findNode(t: Township, id: string): DrainNode {
  const n = t.network.nodes.find((node) => node.id === id);
  if (!n) throw new Error(`Missing node ${id}`);
  return n;
}

export const INTERVENTIONS: Intervention[] = [
  {
    id: 'upsize-trunk',
    name: 'Upsize trunk drain',
    description: 'Main trunk and sag collector 600 → 900 mm',
    costRM: 4_500_000,
    disruption: 'High',
    apply(t) {
      for (const p of t.network.pipes) if (TRUNK_PIPE_IDS.includes(p.id)) p.diameter = PIPE_D.trunkUpsized;
      for (const o of t.network.outfalls) o.area = (Math.PI * PIPE_D.trunkUpsized ** 2) / 4;
    },
  },
  {
    id: 'relief-pond',
    name: 'Relief pipe to pond',
    description: '900 mm relief pipe from the sag to the retention pond',
    costRM: 1_800_000,
    disruption: 'Medium',
    apply(t) {
      // The pipe discharges into the pond. A node with no outlet would block after its first 0.5 m³, so the
      // pond's live storage (normal level → +reliefRise, measured on the grid) is modelled as storage at node P;
      // if that ever fills, the excess spills onto the pond surface.
      const g = t.grid;
      const cellArea = g.dx * g.dx;
      const lo = POND.initialLevel;
      const hi = POND.initialLevel + POND.reliefRise;
      let live = 0;
      for (let c = 0; c < g.z.length; c++) {
        if (g.land[c] === LandUse.POND) live += (Math.max(0, hi - g.z[c]) - Math.max(0, lo - g.z[c])) * cellArea;
      }
      const ground = g.z[cellAt(POND.x, POND.y)];
      const p = makeNode(g, 'P', POND.x, POND.y, { invert: ground, area: live / POND.reliefRise, maxDepth: POND.reliefRise, inletPerimeter: 0 });
      t.network.nodes.push(p);
      t.network.pipes.push(makePipe(findNode(t, 'S3'), p, 0.9));
    },
  },
  {
    id: 'detention-tank',
    name: 'Underground detention tank',
    description: `${TANK.area * TANK.depth} m³ tank fed from the trunk, slow release to the outfall`,
    costRM: 2_500_000,
    disruption: 'Medium',
    apply(t) {
      const o = findNode(t, 'O');
      const tk = makeNode(t.grid, 'TK', TANK.x, TANK.y, { invert: o.invert + 0.3, area: TANK.area, maxDepth: TANK.depth, inletPerimeter: 0 });
      t.network.nodes.push(tk);
      t.network.pipes.push(makePipe(findNode(t, TANK.feedNode), tk, TANK.inflowD), makePipe(tk, o, TANK.outflowD));
    },
  },
  {
    id: 'bioswales',
    name: 'Bioswales on the sag approach street',
    description: 'Planted, lowered verges either side of the street above the sag, intercepting runoff across the slope',
    costRM: 800_000,
    disruption: 'Low',
    apply(t) {
      const g = t.grid;
      for (const j of [BIOSWALE.roadJ - 1, BIOSWALE.roadJ + 1]) {
        for (let i = 0; i < GRID.nx; i++) {
          if ((i + 0.5) * GRID.dx > BIOSWALE.xMax) break;
          const c = j * GRID.nx + i;
          if (g.land[c] === LandUse.ROAD) continue; // cross streets stay open
          g.land[c] = LandUse.PARK;
          g.infil[c] = INFILTRATION_MMHR.BIOSWALE * MMHR;
          g.z[c] -= BIOSWALE.depth;
          g.building[c] = -1;
        }
      }
    },
  },
  {
    id: 'flap-gate',
    name: 'Flap gate on outfall',
    description: 'Non-return valve stops river backflow into the drains',
    costRM: 150_000,
    disruption: 'Low',
    apply(t) {
      for (const o of t.network.outfalls) o.flapGate = true;
    },
  },
  {
    id: 'sag-inlets',
    name: 'Extra inlets in the sag',
    description: 'Add two gully grates at every sag manhole, including the low point',
    costRM: 300_000,
    disruption: 'Low',
    apply(t) {
      for (const id of SAG_NODE_IDS) findNode(t, id).inletPerimeter += 2 * MANHOLE.inletPerimeter;
    },
  },
  {
    id: 'pump',
    name: 'Pump station at the sag',
    description: `${PUMP_RATE} m³/s pump from the outfall chamber to the river`,
    costRM: 3_000_000,
    disruption: 'Medium',
    apply(t) {
      t.network.pumps.push({ node: 'O', rate: PUMP_RATE, riverCell: cellAt(OUTFALL_RIVER_POINT.x, OUTFALL_RIVER_POINT.y) });
    },
  },
];

/** Deep-copies the base and applies the chosen presets in a fixed order. */
export function applyInterventions(base: Township, ids: readonly InterventionId[]): Township {
  const t = structuredClone(base);
  for (const iv of INTERVENTIONS) if (ids.includes(iv.id)) iv.apply(t);
  return t;
}

export function totalCost(ids: readonly InterventionId[]): number {
  return INTERVENTIONS.filter((iv) => ids.includes(iv.id)).reduce((s, iv) => s + iv.costRM, 0);
}
