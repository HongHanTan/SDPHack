import { LandUse, type DrainNode, type Grid, type Network } from '../sim/types';
import { BIOSWALE_Y, BOULEVARD_I, GRID, INFILTRATION_MMHR, MMHR, PIPE_D, POND, PUMP_RATE, TANK } from './config';
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
      const ground = t.grid.z[cellAt(POND.x, POND.y)];
      const p = makeNode(t.grid, 'P', POND.x, POND.y, { invert: ground, maxDepth: 0.5, inletPerimeter: 0 });
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
      t.network.pipes.push(makePipe(findNode(t, 'T6'), tk, TANK.inflowD), makePipe(tk, o, TANK.outflowD));
    },
  },
  {
    id: 'bioswales',
    name: 'Bioswales on the boulevard',
    description: 'Planted, lowered strips either side of the main boulevard',
    costRM: 800_000,
    disruption: 'Low',
    apply(t) {
      const g = t.grid;
      for (let j = 0; j < GRID.ny; j++) {
        const y = (j + 0.5) * GRID.dx;
        if (y < BIOSWALE_Y.min || y > BIOSWALE_Y.max) continue;
        for (const i of [BOULEVARD_I - 3, BOULEVARD_I - 2, BOULEVARD_I + 2, BOULEVARD_I + 3]) {
          const c = j * GRID.nx + i;
          g.land[c] = LandUse.PARK;
          g.infil[c] = INFILTRATION_MMHR.BIOSWALE * MMHR;
          g.z[c] -= 0.2;
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
    description: 'Triple the grate capacity at sag manholes',
    costRM: 300_000,
    disruption: 'Low',
    apply(t) {
      for (const id of SAG_NODE_IDS) findNode(t, id).inletPerimeter *= 3;
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
