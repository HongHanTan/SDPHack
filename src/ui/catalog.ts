import { BIOSWALE, GRID, NODE_LAYOUT, POND, TANK } from '../scenario/config';
import { INTERVENTIONS, type Intervention, type InterventionId } from '../scenario/interventions';

export const GROUPS = [
  'Stop the river coming back',
  'Store water for later',
  'Get water into the drains',
  'Move water out faster',
] as const;
export type Group = (typeof GROUPS)[number];

export interface InterventionDisplay {
  label: string;
  short: string; // used in live-chart annotations, e.g. "+ valve @ 64 min"
  icon: string;
  group: Group;
  site: { x: number; y: number }; // township metres: x east, y north
}

function nodeSite(id: string): { x: number; y: number } {
  const n = NODE_LAYOUT.find(([nid]) => nid === id);
  if (!n) throw new Error(`Unknown node ${id}`);
  return { x: n[1], y: n[2] };
}

const OUTFALL = nodeSite('O');

export const DISPLAY: Record<InterventionId, InterventionDisplay> = {
  'flap-gate': { label: 'One-way valve at the river', short: 'valve', icon: '🚪', group: 'Stop the river coming back', site: OUTFALL },
  'detention-tank': { label: 'Underground storage tank', short: 'tank', icon: '🛢️', group: 'Store water for later', site: { x: TANK.x, y: TANK.y } },
  'relief-pond': { label: 'Overflow pipe to pond', short: 'overflow pipe', icon: '↪️', group: 'Store water for later', site: { x: POND.x, y: POND.y } },
  'sag-inlets': { label: 'More drain grates in the low area', short: 'grates', icon: '🕳️', group: 'Get water into the drains', site: nodeSite('S1') },
  bioswales: {
    label: 'Rain gardens on the slope',
    short: 'rain gardens',
    icon: '🌿',
    group: 'Get water into the drains',
    site: { x: BIOSWALE.xMax / 2, y: (BIOSWALE.roadJ + 0.5) * GRID.dx },
  },
  'upsize-trunk': { label: 'Bigger main drain', short: 'bigger drain', icon: '⬇️', group: 'Move water out faster', site: nodeSite('T4') },
  pump: { label: 'Pump station', short: 'pump', icon: '⚡', group: 'Move water out faster', site: { x: OUTFALL.x + 12, y: OUTFALL.y } },
};

export interface Combo {
  label: string;
  hint: string;
  ids: InterventionId[];
}

export const COMBOS: Combo[] = [
  { label: 'Cheapest fix', hint: 'valve + tank', ids: ['flap-gate', 'detention-tank'] },
  { label: 'Clear the roads', hint: 'grates + pump', ids: ['sag-inlets', 'pump'] },
];

export function costScale(costRM: number): 1 | 2 | 3 | 4 {
  if (costRM < 500_000) return 1;
  if (costRM < 2_000_000) return 2;
  if (costRM < 4_000_000) return 3;
  return 4;
}

export function groupedInterventions(): Array<{ group: Group; items: Intervention[] }> {
  return GROUPS.map((group) => ({ group, items: INTERVENTIONS.filter((iv) => DISPLAY[iv.id].group === group) }));
}

export function formatEffect(dSag: number): { text: string; tone: 'better' | 'worse' | 'same' } {
  if (dSag < -0.005) return { text: `−${Math.abs(dSag).toFixed(2)} m`, tone: 'better' };
  if (dSag > 0.005) return { text: `+${dSag.toFixed(2)} m`, tone: 'worse' };
  return { text: '≈ 0 m', tone: 'same' };
}
