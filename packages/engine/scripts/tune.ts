import { buildScenario } from '../src/scenario/index';
import { INTERVENTIONS, totalCost, type InterventionId } from '../src/scenario/interventions';
import { runSimulation } from '../src/sim/engine';

const combos: Array<[string, InterventionId[]]> = [
  ['baseline', []],
  ...INTERVENTIONS.map((iv, k): [string, InterventionId[]] => [`#${k + 1} ${iv.name}`, [iv.id]]),
  ['tank + flap', ['storage-tank', 'flap-gate']],
  ['desilt + upsize', ['desilt-d07', 'upsize-p07']],
  ['desilt + pump', ['desilt-d07', 'pump']],
];

const rows = combos.map(([name, ids]) => {
  const t0 = performance.now();
  const m = runSimulation(buildScenario(ids, 'synthetic_80mmh_60min')).metrics;
  return {
    scenario: name,
    'sag peak (m)': m.peakSagDepth.toFixed(3),
    homes: m.homesFlooded,
    'road area (m²)': m.floodedRoadArea,
    'passable (min)': m.minutesToPassable === null ? '> 60' : m.minutesToPassable.toFixed(0),
    'cost (RM M)': (totalCost(ids) / 1e6).toFixed(2),
    'balance %': (m.balance.error * 100).toFixed(3),
    'run (s)': ((performance.now() - t0) / 1000).toFixed(1),
  };
});
console.table(rows);
