import { describe, expect, it } from 'vitest';
import { BUND, GRID, INFILTRATION_MMHR, INLET_SUMP, MMHR, PIPE_D, RIVER_ROWS } from '../../src/scenario/config';
import { buildScenario, buildTownship, scenarioKey } from '../../src/scenario/index';
import { applyInterventions, INTERVENTIONS, type InterventionId } from '../../src/scenario/interventions';
import { buildNetwork, TRUNK_PIPE_IDS } from '../../src/scenario/network';
import { buildTerrain, cellAt } from '../../src/scenario/terrain';
import { runSimulation } from '../../src/sim/engine';
import { LandUse } from '../../src/sim/types';

const grid = buildTerrain();

describe('terrain', () => {
  it('has river rows along the south edge', () => {
    for (let c = 0; c < RIVER_ROWS * GRID.nx; c++) expect(grid.land[c]).toBe(LandUse.RIVER);
    expect(grid.land[RIVER_ROWS * GRID.nx + 64]).not.toBe(LandUse.RIVER);
  });

  it('has a sag lower than its surroundings', () => {
    expect(grid.z[cellAt(100, 64)]).toBeLessThan(grid.z[cellAt(250, 64)] - 0.9);
  });

  it('encloses the sag catchment with a ridge above its upslope swale and the sag side', () => {
    const crest = grid.z[cellAt(140, 120)]; // on the diagonal ridge
    expect(crest).toBeGreaterThan(grid.z[cellAt(140, 128)] + 0.3); // diversion swale, just upslope
    expect(crest).toBeGreaterThan(grid.z[cellAt(140, 104)] + 0.2); // polder side
    expect(grid.land[cellAt(140, 128)]).toBe(LandUse.PARK); // grassed swale, no houses
  });

  it('sets inlets in gully sumps below the street', () => {
    expect(grid.z[cellAt(258, 202)]).toBeCloseTo(grid.z[cellAt(258, 206)] - 0.08 - INLET_SUMP, 4);
  });

  it('protects the sag frontage with a bund', () => {
    expect(grid.z[cellAt(100, 26)]).toBeGreaterThanOrEqual(BUND.z);
  });

  it('has roads, many buildings, and an initially wet pond', () => {
    expect(grid.land.filter((l) => l === LandUse.ROAD).length).toBeGreaterThan(1000);
    expect(new Set(Array.from(grid.building).filter((b) => b >= 0)).size).toBeGreaterThan(50);
    expect(grid.h0[cellAt(430, 60)]).toBeGreaterThan(0);
  });
});

describe('network', () => {
  const net = buildNetwork(grid);

  it('drains every node to the outfall', () => {
    const next = new Map(net.pipes.map((p) => [p.from, p.to]));
    for (const n of net.nodes) {
      let cur = n.id;
      for (let hops = 0; cur !== 'O' && hops < 50; hops++) cur = next.get(cur)!;
      expect(cur).toBe('O');
    }
  });

  it('has 13 trunk pipes at baseline diameter', () => {
    expect(TRUNK_PIPE_IDS.length).toBe(13);
    for (const id of TRUNK_PIPE_IDS) expect(net.pipes.find((p) => p.id === id)!.diameter).toBe(PIPE_D.trunk);
  });
});

describe('interventions', () => {
  const base = buildTownship([]);
  const only = (id: InterventionId) => applyInterventions(base, [id]);

  it('does not mutate the base township', () => {
    applyInterventions(base, INTERVENTIONS.map((i) => i.id));
    expect(base.network.outfalls[0].flapGate).toBe(false);
    expect(base.network.nodes.length).toBe(22);
  });

  it('applies each preset', () => {
    expect(only('upsize-trunk').network.pipes.find((p) => p.id === 'S3-O')!.diameter).toBe(PIPE_D.trunkUpsized);
    expect(only('relief-pond').network.pipes.some((p) => p.id === 'S3-P')).toBe(true);
    const tank = only('detention-tank').network;
    expect(tank.nodes.find((n) => n.id === 'TK')!.area).toBe(1500);
    expect(tank.pipes.map((p) => p.id)).toEqual(expect.arrayContaining(['T8-TK', 'TK-O']));
    const swale = only('bioswales').grid;
    const c = cellAt(50, 78); // verge just south of the sag approach street (road row j = 20)
    expect(swale.land[c]).toBe(LandUse.PARK);
    expect(swale.infil[c]).toBeCloseTo(INFILTRATION_MMHR.BIOSWALE * MMHR, 12);
    expect(only('flap-gate').network.outfalls[0].flapGate).toBe(true);
    expect(base.network.nodes.find((n) => n.id === 'S3')!.inletPerimeter).toBe(0); // solid cover at the low point
    expect(only('sag-inlets').network.nodes.find((n) => n.id === 'S3')!.inletPerimeter).toBe(4);
    expect(only('sag-inlets').network.nodes.find((n) => n.id === 'SL1')!.inletPerimeter).toBe(6);
    expect(only('pump').network.pumps.length).toBe(1);
  });

  it('builds a stable cache key regardless of selection order', () => {
    expect(scenarioKey(['pump', 'flap-gate'], '100yr')).toBe(scenarioKey(['flap-gate', 'pump'], '100yr'));
  });

  it('adds custom pipes', () => {
    const t = buildTownship([], [{ from: 'SL0', to: 'O', diameter: 0.45 }]);
    expect(t.network.pipes.some((p) => p.id === 'custom-0' && p.from === 'SL0')).toBe(true);
  });
});

describe('water balance on the real township (short storm)', () => {
  const cases: InterventionId[][] = [...INTERVENTIONS.map((i) => [i.id]), INTERVENTIONS.map((i) => i.id)];
  it.each(cases)('within 1%%: %s', (...ids) => {
    const sc = buildScenario(ids, '100yr');
    const short = { ...sc, storm: { ...sc.storm, intensity: sc.storm.intensity.slice(10, 14) }, recessionS: 0 };
    const { metrics } = runSimulation(short);
    expect(metrics.balance.error).toBeLessThan(0.01);
  });
});
