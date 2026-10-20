import { LandUse, type DrainNode, type Grid, type Network } from '../sim/types';
import { LAKE, LAKE_OVERFLOW, P07_UPSIZED_D, PUMP, TANK } from './config';
import { ASSETS, LAYOUT, toLocal } from './layout';
import { inletPerimeter, makeNode, makePipe } from './network';

export interface Township {
  grid: Grid;
  network: Network;
}

export type InterventionId = 'desilt-d07' | 'upsize-p07' | 'flap-gate' | 'storage-tank' | 'lake-overflow' | 'pump';

export interface Intervention {
  id: InterventionId;
  name: string;
  description: string;
  costRM: number; // INDICATIVE PLACEHOLDER — replace with SDP quantity-surveyor rates
  disruption: 'Low' | 'Medium' | 'High';
  teamRating?: string; // team InterventionDashboard cost rating / lead time
  apply(t: Township): void;
}

export function findNode(t: Township, id: string): DrainNode {
  const n = t.network.nodes.find((node) => node.id === id);
  if (!n) throw new Error(`Missing node ${id}`);
  return n;
}

export const INTERVENTIONS: Intervention[] = [
  {
    id: 'desilt-d07',
    name: 'Emergency desilting of INLET-D07',
    description: 'Remove leaf litter and sediment from INLET-D07, restoring full grate capacity',
    costRM: 15_000,
    disruption: 'Low',
    teamRating: 'LOW · < 24 hours',
    apply(t) {
      const d07 = ASSETS.inlets.find((i) => i.inlet_id === 'INLET-D07')!;
      findNode(t, d07.node_id).inletPerimeter = inletPerimeter(d07.grate_area_m2, 0);
    },
  },
  {
    id: 'upsize-p07',
    name: 'Upsize PIPE-P07 to Ø750',
    description: 'Replace trunk conduit PIPE-P07 (NODE-J07 → NODE-J08) Ø600 with Ø750 RCP',
    costRM: 1_200_000,
    disruption: 'High',
    teamRating: 'HIGH · 3–6 months',
    apply(t) {
      const p = t.network.pipes.find((pp) => pp.id === 'PIPE-P07')!;
      p.diameter = P07_UPSIZED_D;
    },
  },
  {
    id: 'flap-gate',
    name: 'One-way valve at OUT01',
    description: 'Non-return flap gate stops canal backflow into the drains',
    costRM: 150_000,
    disruption: 'Low',
    apply(t) {
      for (const o of t.network.outfalls) o.flapGate = true;
    },
  },
  {
    id: 'storage-tank',
    name: 'Underground storage tank near J07',
    description: `${TANK.area * TANK.depth} m³ off-line tank fed from NODE-J05, slow release to NODE-J08`,
    costRM: 2_500_000,
    disruption: 'Medium',
    apply(t) {
      const p = toLocal(TANK.x, TANK.y);
      const tk = makeNode(t.grid, 'TK', p.x, p.y, { invert: TANK.invert, area: TANK.area, maxDepth: TANK.depth, inletPerimeter: 0 });
      t.network.nodes.push(tk);
      t.network.pipes.push(
        { ...makePipe(findNode(t, TANK.feedNode), tk, TANK.inflowD), id: 'PIPE-TK-IN' },
        { ...makePipe(tk, findNode(t, TANK.outNode), TANK.outflowD), id: 'PIPE-TK-OUT' },
      );
    },
  },
  {
    id: 'lake-overflow',
    name: 'Overflow from J04 to Maple Grove pond',
    description: 'Relief pipe diverts the J04 branch into the retention pond',
    costRM: 1_800_000,
    disruption: 'Medium',
    apply(t) {
      const g = t.grid;
      const cellArea = g.dx * g.dx;
      let live = 0;
      for (let c = 0; c < g.z.length; c++) {
        if (g.land[c] === LandUse.POND) {
          live += (Math.max(0, LAKE.waterLevel + LAKE.liveRise - g.z[c]) - Math.max(0, LAKE.waterLevel - g.z[c])) * cellArea;
        }
      }
      const p = toLocal(LAYOUT.lake.x, LAYOUT.lake.y);
      const lk = makeNode(g, 'LK', p.x, p.y, { invert: LAKE.waterLevel, area: live / LAKE.liveRise, maxDepth: LAKE.liveRise, inletPerimeter: 0 });
      t.network.nodes.push(lk);
      t.network.pipes.push({ ...makePipe(findNode(t, LAKE_OVERFLOW.fromNode), lk, LAKE_OVERFLOW.diameter), id: 'PIPE-LK' });
    },
  },
  {
    id: 'pump',
    name: 'Pump station at J08',
    description: `${PUMP.rate} m³/s pump from NODE-J08 to the outfall canal`,
    costRM: 3_000_000,
    disruption: 'Medium',
    apply(t) {
      t.network.pumps.push({ node: PUMP.node, rate: PUMP.rate, riverCell: t.network.outfalls[0].riverCell });
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
