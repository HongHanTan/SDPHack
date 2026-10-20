import { TANK } from '@floodops/engine/scenario/config';
import { LAYOUT, toLocal } from '@floodops/engine/scenario/layout';
import { nodeSite } from '@floodops/engine/scenario/network';
import { INTERVENTIONS, type Intervention, type InterventionId } from '@floodops/engine/scenario/interventions';

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

const OUT01 = nodeSite('NODE-OUT01');

export const DISPLAY: Record<InterventionId, InterventionDisplay> = {
  'desilt-d07': { label: 'Desilt grate D07', short: 'desilt D07', icon: '🧹', group: 'Get water into the drains', site: nodeSite('NODE-J07') },
  'upsize-p07': { label: 'Bigger pipe P07 (Ø750)', short: 'upsize P07', icon: '⬇️', group: 'Move water out faster', site: (() => { const a = nodeSite('NODE-J07'); const b = nodeSite('NODE-J08'); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; })() },
  'flap-gate': { label: 'One-way valve at the outfall', short: 'valve', icon: '🚪', group: 'Stop the river coming back', site: OUT01 },
  'storage-tank': { label: 'Underground storage tank', short: 'tank', icon: '🛢️', group: 'Store water for later', site: toLocal(TANK.x, TANK.y) },
  'lake-overflow': { label: 'Overflow to Maple Grove pond', short: 'lake overflow', icon: '↪️', group: 'Store water for later', site: toLocal(LAYOUT.lake.x, LAYOUT.lake.y) },
  pump: { label: 'Pump station at J08', short: 'pump', icon: '⚡', group: 'Move water out faster', site: nodeSite('NODE-J08') },
};

export interface Combo {
  label: string;
  hint: string;
  ids: InterventionId[];
}

export const COMBOS: Combo[] = [
  { label: 'Combined desilt + upsize', hint: 'team option 3', ids: ['desilt-d07', 'upsize-p07'] },
  { label: 'High-river defence', hint: 'valve + pump', ids: ['flap-gate', 'pump'] },
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
