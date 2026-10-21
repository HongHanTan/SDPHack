import type { Frame } from '@floodops/engine/sim/types';
import type { SimulationFrame, TownshipAssetsResponse } from '../types';
import type { ComparisonResult, ScenarioSelection } from '../maintenance/model';
import type { Grid } from '@floodops/engine/sim/types';
import type { RoadStudy, RoadSummary } from './roadStudy';

export const REFERENCE_DEPTH_M = 0.15;
export type StoryCase = 'baseline' | 'desilt-d07' | 'upsize-p07';
export interface StreetSummary {
  peakM: number;
  peakSampleTimeS: number;
  aboveReferenceS: number;
  stillAboveAtEnd: boolean;
  p07AtCapacityS: number;
  series: { timeS: number; depthM: number }[];
}
export interface StoryRun {
  caseId: StoryCase;
  scenario: ScenarioSelection;
  frames: Frame[];
  teamFrames: SimulationFrame[];
  assets: TownshipAssetsResponse;
  summary: RoadSummary;
  roadStudy: RoadStudy;
  grid: Grid;
  p07Index: number;
  sumpSummary: StreetSummary;
  result: ComparisonResult;
  surfaceCell: number;
}

/** Right-endpoint duration estimate from actual output samples. No road-safety claim. */
export function streetSummary(frames: Frame[], surfaceCell: number, exactPeakM: number, p07Index: number): StreetSummary {
  let aboveReferenceS = 0;
  let p07AtCapacityS = 0;
  let previousS = 0;
  let peakSampleM = -Infinity;
  let peakSampleTimeS = 0;
  const series = frames.map(f => {
    const depthM = f.depth[surfaceCell];
    if (!Number.isFinite(depthM)) throw new Error('D07 surface depth is unavailable in this run.');
    const interval = Math.max(0, f.t - previousS);
    if (depthM >= REFERENCE_DEPTH_M) aboveReferenceS += interval;
    if (p07Index >= 0 && f.pipeLoad[p07Index] >= 0.999) p07AtCapacityS += interval;
    if (depthM > peakSampleM) { peakSampleM = depthM; peakSampleTimeS = f.t; }
    previousS = f.t;
    return { timeS: f.t, depthM };
  });
  if (!frames.length || !Number.isFinite(exactPeakM)) throw new Error('The simulation returned no street results.');
  return { peakM: exactPeakM, peakSampleTimeS, aboveReferenceS, p07AtCapacityS,
    stillAboveAtEnd: series[series.length - 1].depthM >= REFERENCE_DEPTH_M, series };
}

export function frameIndexAt(frames: Frame[], timeS: number): number {
  let index = -1;
  for (let i = 0; i < frames.length && frames[i].t <= timeS + 1e-6; i++) index = i;
  return index;
}
export const depthCm = (metres: number) => `${(metres * 100).toFixed(1)} cm`;
export function clockLabel(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
export function changeDescription(before: StreetSummary, after: StreetSummary): string {
  const deltaCm = (before.peakM - after.peakM) * 100;
  if (Math.abs(deltaCm) < 0.1) return 'The sampled peak at the selected road point is essentially unchanged.';
  return `The sampled peak at the selected road point is ${Math.abs(deltaCm).toFixed(1)} cm ${deltaCm > 0 ? 'lower' : 'higher'}.`;
}
export function cleaningFinding(before: StreetSummary, clean: StreetSummary): string {
  const drop = before.peakM - clean.peakM;
  if (drop < -0.001) return 'Cleaning increases the sampled peak at this road point. Review the wider response before choosing work.';
  if (drop < Math.max(0.01, before.peakM * 0.05)) return 'Cleaning alone changes little at this road point. Test the pipe option; this comparison does not establish the real cause.';
  return 'Cleaning reduces the sampled peak at this road point. Compare the pipe option and affected road area before choosing work.';
}

export const STORY_CASES: Record<StoryCase, { title: string; interventions: ('desilt-d07' | 'upsize-p07')[]; targets: string[] }> = {
  baseline: { title: 'Current network', interventions: [], targets: [] },
  'desilt-d07': { title: 'Clean D07 only', interventions: ['desilt-d07'], targets: ['INLET-D07'] },
  'upsize-p07': { title: 'Test a larger P07 pipe', interventions: ['upsize-p07'], targets: ['PIPE-P07'] },
};
