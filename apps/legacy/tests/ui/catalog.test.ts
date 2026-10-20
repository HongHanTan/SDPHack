import { describe, expect, it } from 'vitest';
import { baseTownship } from '@floodops/engine/scenario/index';
import { INTERVENTIONS } from '@floodops/engine/scenario/interventions';
import { COMBOS, costScale, DISPLAY, formatEffect, GROUPS, groupedInterventions } from '../../src/ui/catalog';

describe('catalog', () => {
  it('lists every intervention in exactly one group, in group order', () => {
    const grouped = groupedInterventions();
    expect(grouped.map((g) => g.group)).toEqual([...GROUPS]);
    const ids = grouped.flatMap((g) => g.items.map((iv) => iv.id));
    expect([...ids].sort()).toEqual(INTERVENTIONS.map((iv) => iv.id).sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('combos reference real interventions', () => {
    const valid = new Set(INTERVENTIONS.map((iv) => iv.id));
    for (const c of COMBOS) for (const id of c.ids) expect(valid.has(id)).toBe(true);
    expect(COMBOS.map((c) => c.ids)).toEqual([
      ['desilt-d07', 'upsize-p07'],
      ['storage-tank', 'lake-overflow'],
    ]);
  });

  it('maps cost to a 1–4 scale', () => {
    expect(costScale(150_000)).toBe(1);
    expect(costScale(499_999)).toBe(1);
    expect(costScale(500_000)).toBe(2);
    expect(costScale(1_999_999)).toBe(2);
    expect(costScale(2_000_000)).toBe(3);
    expect(costScale(3_999_999)).toBe(3);
    expect(costScale(4_000_000)).toBe(4);
  });

  it('formats effects with tone', () => {
    expect(formatEffect(-0.11)).toEqual({ text: '−0.11 m', tone: 'better' });
    expect(formatEffect(0.06)).toEqual({ text: '+0.06 m', tone: 'worse' });
    expect(formatEffect(0.003)).toEqual({ text: '≈ 0 m', tone: 'same' });
  });

  it('places node-based pins on their manholes', () => {
    const nodes = new Map(baseTownship().network.nodes.map((n) => [n.id, n]));
    for (const [id, node] of [['desilt-d07', 'NODE-J07']] as const) {
      expect(DISPLAY[id].site).toEqual({ x: nodes.get(node)!.x, y: nodes.get(node)!.y });
    }
  });
});
