import { buildScenario, type ScenarioOptions } from '../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../src/scenario/interventions';
import { nodeSite } from '../src/scenario/network';
import { cellAt } from '../src/scenario/terrain';
import { runSimulation } from '../src/sim/engine';

const STORM = 'synthetic_80mmh_60min';
const j08 = nodeSite('NODE-J08');
const j08Cell = cellAt(j08.x, j08.y);

const combos: Array<[string, InterventionId[], ScenarioOptions]> = [
  ['baseline', [], {}],
  ...INTERVENTIONS.map((iv): [string, InterventionId[], ScenarioOptions] => [iv.id, [iv.id], {}]),
  ['desilt + upsize', ['desilt-d07', 'upsize-p07'], {}],
  ['high: baseline', [], { tailwater: 'high' }],
  ['high: flap-gate', ['flap-gate'], { tailwater: 'high' }],
  ['high: pump', ['pump'], { tailwater: 'high' }],
];

const only = process.argv.slice(2);
const rows = combos
  .filter(([name]) => only.length === 0 || only.includes(name))
  .map(([name, ids, opts]) => {
    const t0 = performance.now();
    const sc = buildScenario(ids, STORM, [], opts);
    const { frames, metrics: m } = runSimulation(sc);
    const p07 = sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07');
    const p07Max = Math.max(...frames.map((f) => f.pipeLoad[p07]));
    return {
      scenario: name,
      'J07 peak (m)': m.peakSagDepth.toFixed(3),
      'J08 peak (m)': m.peakDepth[j08Cell].toFixed(3),
      homes: m.homesFlooded,
      'road area (m²)': m.floodedRoadArea,
      'P07 max load': p07Max.toFixed(3),
      'balance %': (m.balance.error * 100).toFixed(3),
      'run (s)': ((performance.now() - t0) / 1000).toFixed(1),
    };
  });
console.table(rows);
