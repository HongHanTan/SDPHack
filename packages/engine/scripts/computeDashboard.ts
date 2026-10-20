import { writeFileSync } from 'node:fs';
import { buildScenario } from '../src/scenario/index';
import type { InterventionId } from '../src/scenario/interventions';
import { STORMS, type StormId } from '../src/scenario/storms';
import { runSimulation } from '../src/sim/engine';

export interface DashboardMetrics {
  j07PeakM: number;
  homesFlooded: number;
  p07SurchargeMin: number;
  p07PeakUtilPct: number;
  floodedRoadAreaM2: number;
}

export const DASHBOARD_OPTIONS: Record<string, InterventionId[]> = {
  baseline: [],
  'desilt-d07': ['desilt-d07'],
  'upsize-p07': ['upsize-p07'],
  'storage-tank': ['storage-tank'],
  'lake-overflow': ['lake-overflow'],
  combined: ['desilt-d07', 'upsize-p07'],
  'store-peak': ['storage-tank', 'lake-overflow'],
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function computeDashboard(log: (s: string) => void = () => {}): Record<string, Record<string, DashboardMetrics>> {
  const out: Record<string, Record<string, DashboardMetrics>> = {};
  for (const storm of Object.keys(STORMS) as StormId[]) {
    out[storm] = {};
    for (const [opt, ids] of Object.entries(DASHBOARD_OPTIONS)) {
      const sc = buildScenario(ids, storm);
      const { frames, metrics } = runSimulation(sc);
      const p07 = sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07');
      const loads = frames.map((f) => f.pipeLoad[p07]);
      out[storm][opt] = {
        j07PeakM: r3(metrics.peakSagDepth),
        homesFlooded: metrics.homesFlooded,
        p07SurchargeMin: r3((loads.filter((l) => l >= 0.999).length * sc.frameEveryS) / 60),
        p07PeakUtilPct: Math.round(Math.max(...loads) * 100),
        floodedRoadAreaM2: Math.round(metrics.floodedRoadArea),
      };
      log(`${storm} ${opt}: ${JSON.stringify(out[storm][opt])}`);
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('computeDashboard.ts')) {
  const data = computeDashboard((s) => console.log(s));
  writeFileSync(new URL('../src/scenario/dashboard.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
  console.log('Wrote src/scenario/dashboard.json');
}
