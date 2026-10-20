import { describe, expect, it } from 'vitest';
import { totalCost } from '../../src/scenario/interventions';
import { activePipes, Selection, selectionCost } from '../../src/ui/selection';

describe('Selection', () => {
  it('emits a readable label on change and ignores no-op sets', () => {
    const s = new Selection();
    const labels: string[] = [];
    s.subscribe((_st, label) => labels.push(label));
    s.set('flap-gate', true);
    s.set('flap-gate', true);
    s.set('flap-gate', false);
    expect(labels).toEqual(['+ valve', '− valve']);
  });

  it('orders interventions like INTERVENTIONS regardless of click order', () => {
    const s = new Selection();
    s.set('pump', true);
    s.set('upsize-trunk', true);
    expect(s.state.interventions).toEqual(['upsize-trunk', 'pump']);
  });

  it('applying a combo replaces interventions and keeps custom pipes', () => {
    const s = new Selection();
    s.set('upsize-trunk', true);
    s.addPipe({ from: 'SL0', to: 'O', diameter: 0.6 });
    s.applyCombo(['flap-gate', 'detention-tank'], 'Cheapest fix');
    expect(s.state.interventions).toEqual(['detention-tank', 'flap-gate']);
    expect(s.state.custom).toEqual([{ from: 'SL0', to: 'O', diameter: 0.6 }]);
  });

  it('applyCombo with an unchanged set emits nothing', () => {
    const s = new Selection();
    s.applyCombo(['flap-gate', 'detention-tank'], 'Cheapest fix');
    const labels: string[] = [];
    s.subscribe((_st, label) => labels.push(label));
    s.applyCombo(['detention-tank', 'flap-gate'], 'Cheapest fix');
    expect(labels).toEqual([]);
    s.applyCombo(['flap-gate'], 'Less');
    expect(labels).toEqual(['Less']);
  });

  it('state is a copy', () => {
    const s = new Selection();
    s.addPipe({ from: 'SL0', to: 'O', diameter: 0.6 });
    s.state.custom.pop();
    expect(s.state.custom.length).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    const s = new Selection();
    let n = 0;
    const off = s.subscribe(() => n++);
    off();
    s.set('pump', true);
    expect(n).toBe(0);
  });
});

describe('activePipes / selectionCost', () => {
  it('drops pipes whose node is not in the scenario', () => {
    const state = { interventions: [], custom: [{ from: 'S3', to: 'P', diameter: 0.6 }, { from: 'SL0', to: 'O', diameter: 0.6 }] };
    expect(activePipes(state)).toEqual([{ from: 'SL0', to: 'O', diameter: 0.6 }]);
    expect(activePipes({ ...state, interventions: ['relief-pond'] }).length).toBe(2);
  });

  it('costs interventions plus active pipes', () => {
    expect(selectionCost({ interventions: ['flap-gate', 'pump'], custom: [] })).toBe(totalCost(['flap-gate', 'pump']));
    expect(selectionCost({ interventions: [], custom: [{ from: 'SL0', to: 'O', diameter: 0.6 }] })).toBeGreaterThan(0);
  });
});
