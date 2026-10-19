import { describe, expect, it } from 'vitest';
import { createNetworkState, manningFullCapacity, routePipes } from '../../src/sim/pipes';
import type { Network } from '../../src/sim/types';
import { makeNode } from '../helpers';

const pipe = (from: string, to: string, diameter = 0.6, slope = 0.005) => ({
  id: `${from}-${to}`,
  from,
  to,
  diameter,
  length: 40,
  slope,
  n: 0.013,
});

describe('manningFullCapacity', () => {
  it('matches a hand calculation for 600 mm at 0.5% within 1%', () => {
    // Q = (1/n) A R^(2/3) S^(1/2) = 76.923 * 0.28274 * 0.28231 * 0.070711 = 0.4342 m³/s
    const q = manningFullCapacity(0.6, 0.005);
    expect(Math.abs(q - 0.4342) / 0.4342).toBeLessThan(0.01);
  });

  it('clamps flat or adverse slopes to the minimum grade', () => {
    expect(manningFullCapacity(0.6, 0)).toBeCloseTo(manningFullCapacity(0.6, 0.001), 12);
    expect(manningFullCapacity(0.6, -0.01)).toBeCloseTo(manningFullCapacity(0.6, 0.001), 12);
  });
});

describe('routePipes', () => {
  const net: Network = {
    nodes: [makeNode('A', 0), makeNode('B', 1, 0, 100), makeNode('C', 2, 0, 100)],
    pipes: [pipe('A', 'B'), pipe('B', 'C')],
    outfalls: [],
    pumps: [],
  };

  it('moves only the water available upstream', () => {
    const st = createNetworkState(net);
    st.vol[0] = 0.1;
    routePipes(st, 1);
    expect(st.vol[0]).toBeCloseTo(0, 12);
    expect(st.vol[1]).toBeCloseTo(0.1, 12);
  });

  it('caps flow at pipe capacity', () => {
    const st = createNetworkState(net);
    st.vol[0] = 1.5;
    routePipes(st, 1);
    expect(st.vol[1]).toBeCloseTo(st.qFull[0], 9);
  });

  it('blocks flow into a full downstream node with no outflow', () => {
    const blocked: Network = { ...net, nodes: [makeNode('A', 0), makeNode('B', 1), makeNode('C', 2)], pipes: [pipe('A', 'B')] };
    const st = createNetworkState(blocked);
    st.vol[0] = 1;
    st.vol[1] = st.vmax[1];
    routePipes(st, 1);
    expect(st.vol[0]).toBeCloseTo(1, 12);
  });

  it('conserves volume and never goes negative', () => {
    const st = createNetworkState(net);
    st.vol[0] = 1.5;
    st.vol[1] = 20;
    const total = st.vol[0] + st.vol[1] + st.vol[2];
    for (let k = 0; k < 100; k++) {
      routePipes(st, 0.5);
      for (const v of st.vol) expect(v).toBeGreaterThanOrEqual(0);
    }
    expect(st.vol[0] + st.vol[1] + st.vol[2]).toBeCloseTo(total, 9);
  });

  it('rejects pipes that reference unknown nodes', () => {
    expect(() => createNetworkState({ ...net, pipes: [pipe('A', 'Z')] })).toThrow('Unknown node Z');
  });
});
