import { describe, expect, it } from 'vitest';
import { totalCost } from '@floodops/engine/scenario/interventions';
import { activePipes, Selection, selectionCost } from '../../src/ui/selection';

describe('Selection', () => {
  it('emits a readable label on change and ignores no-op sets', () => {
    const s = new Selection();
    const labels: string[] = [];
    s.subscribe((_st, label) => labels.push(label));
    s.set('storage-tank', true);
    s.set('storage-tank', true);
    s.set('storage-tank', false);
    expect(labels).toEqual(['+ tank', '− tank']);
  });

  it('orders interventions like INTERVENTIONS regardless of click order', () => {
    const s = new Selection();
    s.set('lake-overflow', true);
    s.set('upsize-p07', true);
    expect(s.state.interventions).toEqual(['upsize-p07', 'lake-overflow']);
  });

  it('applying a combo replaces interventions and keeps custom pipes', () => {
    const s = new Selection();
    s.set('upsize-p07', true);
    s.addPipe({ from: 'NODE-J06', to: 'NODE-J08', diameter: 0.6 });
    s.applyCombo(['storage-tank', 'lake-overflow'], 'Cheapest fix');
    expect(s.state.interventions).toEqual(['storage-tank', 'lake-overflow']);
    expect(s.state.custom).toEqual([{ from: 'NODE-J06', to: 'NODE-J08', diameter: 0.6 }]);
  });

  it('applyCombo with an unchanged set emits nothing', () => {
    const s = new Selection();
    s.applyCombo(['storage-tank', 'lake-overflow'], 'Cheapest fix');
    const labels: string[] = [];
    s.subscribe((_st, label) => labels.push(label));
    s.applyCombo(['lake-overflow', 'storage-tank'], 'Cheapest fix');
    expect(labels).toEqual([]);
    s.applyCombo(['storage-tank'], 'Less');
    expect(labels).toEqual(['Less']);
  });

  it('state is a copy', () => {
    const s = new Selection();
    s.addPipe({ from: 'NODE-J06', to: 'NODE-J08', diameter: 0.6 });
    s.state.custom.pop();
    expect(s.state.custom.length).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    const s = new Selection();
    let n = 0;
    const off = s.subscribe(() => n++);
    off();
    s.set('lake-overflow', true);
    expect(n).toBe(0);
  });
});

describe('activePipes / selectionCost', () => {
  it('drops pipes whose node is not in the scenario', () => {
    const state = { interventions: [], custom: [{ from: 'NODE-J04', to: 'LK', diameter: 0.6 }, { from: 'NODE-J06', to: 'NODE-J08', diameter: 0.6 }] };
    expect(activePipes(state)).toEqual([{ from: 'NODE-J06', to: 'NODE-J08', diameter: 0.6 }]);
    expect(activePipes({ ...state, interventions: ['lake-overflow'] }).length).toBe(2);
  });

  it('costs interventions plus active pipes', () => {
    expect(selectionCost({ interventions: ['storage-tank', 'lake-overflow'], custom: [] })).toBe(totalCost(['storage-tank', 'lake-overflow']));
    expect(selectionCost({ interventions: [], custom: [{ from: 'NODE-J06', to: 'NODE-J08', diameter: 0.6 }] })).toBeGreaterThan(0);
  });
});
