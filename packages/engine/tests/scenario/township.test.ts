import { describe, expect, it } from 'vitest';
import { GRID, P07_UPSIZED_D, TAILWATER } from '../../src/scenario/config';
import { buildScenario, buildTownship, hotspotCell, scenarioKey } from '../../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../../src/scenario/interventions';
import { ASSETS, toLocal } from '../../src/scenario/layout';
import { inletPerimeter, nodeSite } from '../../src/scenario/network';
import { buildTerrain, cellAt } from '../../src/scenario/terrain';
import { runSimulation } from '../../src/sim/engine';
import { LandUse } from '../../src/sim/types';

const grid = buildTerrain();
const at = (x: number, y: number) => {
  const p = toLocal(x, y);
  return cellAt(p.x, p.y);
};

describe('Taman Kyra terrain', () => {
  it('has the agreed grid', () => {
    expect([grid.nx, grid.ny, grid.dx]).toEqual([GRID.nx, GRID.ny, GRID.dx]);
    expect([GRID.nx, GRID.ny, GRID.dx]).toEqual([125, 145, 2]);
  });
  it('places roads, houses, pond, park and canal from the layout', () => {
    expect(grid.land[at(0, 0)]).toBe(LandUse.ROAD); // main avenue
    expect(grid.land[at(40, 60)]).toBe(LandUse.ROAD); // drainage boulevard
    expect(grid.land[at(-20, 138)]).toBe(LandUse.ROOF); // house H01
    expect(grid.building[at(-20, 138)]).toBe(0);
    expect(grid.land[at(130, 30)]).toBe(LandUse.POND);
    expect(grid.h0[at(130, 30)]).toBeGreaterThan(0);
    expect(grid.land[at(130, 56)]).toBe(LandUse.PARK);
    expect(grid.land[at(40, -100)]).toBe(LandUse.RIVER);
  });
  it('dips at the J07 junction', () => {
    expect(grid.z[at(40, 0)]).toBeLessThan(grid.z[at(80, 0)]);
  });
});

describe('Taman Kyra network', () => {
  const t = buildTownship([]);
  it('uses every asset node and conduit exactly', () => {
    expect(t.network.nodes.map((n) => n.id)).toEqual(ASSETS.nodes.map((n) => n.node_id));
    for (const cd of ASSETS.conduits) {
      const p = t.network.pipes.find((pp) => pp.id === cd.conduit_id)!;
      expect([p.from, p.to, p.diameter, p.length, p.n]).toEqual([cd.from_node_id, cd.to_node_id, cd.diameter_m, cd.length_m, cd.manning_n]);
    }
    for (const nd of ASSETS.nodes) expect(t.network.nodes.find((n) => n.id === nd.node_id)!.invert).toBe(nd.invert_elevation_m);
  });
  it('applies the D07 baseline blockage and only asset grates', () => {
    const d07 = ASSETS.inlets.find((i) => i.inlet_id === 'INLET-D07')!;
    expect(t.network.nodes.find((n) => n.id === 'NODE-J07')!.inletPerimeter).toBeCloseTo(inletPerimeter(d07.grate_area_m2, 0.4), 12);
    expect(t.network.nodes.find((n) => n.id === 'NODE-J01')!.inletPerimeter).toBeCloseTo(inletPerimeter(0.6, 0), 12);
    expect(t.network.nodes.find((n) => n.id === 'NODE-J03')!.inletPerimeter).toBe(0);
    expect(buildTownship([], [], { blockage: {} }).network.nodes.find((n) => n.id === 'NODE-J07')!.inletPerimeter).toBeCloseTo(inletPerimeter(0.6, 0), 12);
  });
  it('drains to OUT01 in the canal', () => {
    expect(t.network.outfalls[0].node).toBe('NODE-OUT01');
    expect(grid.land[t.network.outfalls[0].riverCell]).toBe(LandUse.RIVER);
  });
});

describe('interventions and scenario options', () => {
  const only = (id: InterventionId) => buildTownship([id]).network;
  it('applies each intervention', () => {
    expect(only('desilt-d07').nodes.find((n) => n.id === 'NODE-J07')!.inletPerimeter).toBeCloseTo(inletPerimeter(0.6, 0), 12);
    expect(only('upsize-p07').pipes.find((p) => p.id === 'PIPE-P07')!.diameter).toBe(P07_UPSIZED_D);
    expect(only('storage-tank').pipes.map((p) => p.id)).toEqual(expect.arrayContaining(['PIPE-TK-IN', 'PIPE-TK-OUT']));
    expect(only('lake-overflow').pipes.find((p) => p.id === 'PIPE-LK')!.slope).toBeGreaterThan(0);
  });
  it('sets the tailwater stage and the J07 hotspot', () => {
    expect(buildScenario([], 'synthetic_80mmh_60min', [], { tailwater: 'high' }).river.levels[0]).toBe(TAILWATER.high);
    const j07 = nodeSite('NODE-J07');
    expect(hotspotCell()).toBe(cellAt(j07.x, j07.y));
    expect(scenarioKey([], 'synthetic_80mmh_60min', [], { tailwater: 'high' })).not.toBe(scenarioKey([], 'synthetic_80mmh_60min'));
  });
});

describe('water balance (short storm)', () => {
  const cases: InterventionId[][] = [[], ...INTERVENTIONS.map((i) => [i.id]), INTERVENTIONS.map((i) => i.id)];
  it.each(cases)('within 1%%: %s', (...ids) => {
    const sc = buildScenario(ids, 'synthetic_80mmh_60min');
    const short = { ...sc, storm: { ...sc.storm, intensity: sc.storm.intensity.slice(0, 3) }, recessionS: 0 };
    expect(runSimulation(short).metrics.balance.error).toBeLessThan(0.01);
  });
});

describe('SWMM-style catchments (Tay hydrology.json)', () => {
  const sc = buildScenario([], 'synthetic_80mmh_60min');
  it('builds four disjoint 1 ha catchments at J01/J02/J04/J07', () => {
    expect(sc.catchments!.map((c) => c.node)).toEqual(['NODE-J01', 'NODE-J02', 'NODE-J04', 'NODE-J07']);
    for (const c of sc.catchments!) {
      // nearest-outlet assignment can leave a catchment short of 1 ha (J02's pool is 1469 cells)
      expect(c.cells.length).toBeGreaterThan(1000);
      expect(c.cells.length).toBeLessThanOrEqual(2500);
      expect(c.directFraction).toBe(0.8);
    }
    const all = sc.catchments!.flatMap((c) => Array.from(c.cells));
    expect(new Set(all).size).toBe(all.length);
  });
  it('can be disabled', () => {
    expect(buildScenario([], 'synthetic_80mmh_60min', [], { catchments: false }).catchments).toBeUndefined();
  });
});
