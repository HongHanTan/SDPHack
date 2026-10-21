// Pure helpers for the automated fix analysis pins (spec 2026-10-21 automated fix finder, §9): which problem pins are
// visible at a playback time, and what each pin says. Every number comes from a simulation run during the analysis.
import { bestFixPerProblem, diagnose, logLines, NO_IMPROVING_FIX_TEXT, type CandidateResult, type Diagnosis, type Outcome, type Problem } from '@floodops/engine/analysis/fixFinder';
import { hotspotCell } from '@floodops/engine/scenario/index';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import type { SimulationMetricsResponse } from '../types';
import { depthAt } from './local/runs';
import type { SiteResult } from './types';

/** Problems whose onset has been reached at playback time `t` and that were not dismissed (seeking back hides later ones). */
export function visibleProblems(problems: readonly Problem[], t: number | undefined, dismissed: ReadonlySet<string> = new Set()): Problem[] {
  if (t === undefined || !Number.isFinite(t)) return [];
  return problems.filter((p) => p.onsetS <= t + 1e-6 && !dismissed.has(p.id));
}

type EngineMetrics = SimulationMetricsResponse & { j07_peak_depth_m: number; homes_flooded: number };

/**
 * The baseline diagnosis computed in the page (same inputs as the analysis: frames, metrics, and the hotspot's street
 * depth from the stored grids), so the problem pins can show "testing fixes…" before the analysis finishes.
 */
export function previewDiagnosis(baseline: SiteResult, site: SiteSpec): Diagnosis {
  let cell: number | undefined;
  try {
    cell = hotspotCell(site);
  } catch {
    cell = undefined;
  }
  const series = cell === undefined || !baseline.depth ? undefined : baseline.frames.map((f) => depthAt(baseline.depth, f.timestamp_s)?.[cell!] ?? 0);
  return diagnose(baseline.frames, baseline.metrics as EngineMetrics, site, { hotspotStreetDepthM: series });
}

export type AnalysisPhase = 'running' | 'done' | 'stopped' | 'failed';

export interface PinRow { label: string; before: string; after: string }
export interface PinView {
  /** "⚠ Bottleneck: PIPE-P07 full at 12:30", or the pending "⚠ Bottleneck detected — testing fixes… (i/n)". */
  heading: string;
  pending: boolean;
  /** The suggested fix, when one improved on the baseline. */
  fix?: { label: string; rows: PinRow[]; cost: string; resultKey: string };
  /** Shown instead of a fix: no improving fix, or the analysis stopped / failed. */
  note?: string;
}

const m2 = (v: number) => `${v.toFixed(2)} m`;
const m3 = (v: number) => `${Math.round(v).toLocaleString('en-US')} m³`;
/** "about RM 112,500 (indicative)". */
export const indicativeCost = (rm: number) => `about RM ${Math.round(rm).toLocaleString('en-US')} (indicative)`;

/** Before → after rows for homes flooded, street flood volume and hotspot peak. */
export function outcomeRows(before: Outcome, after: Outcome, hotspotNodeId: string): PinRow[] {
  return [
    { label: 'Homes flooded', before: String(before.homesFlooded), after: String(after.homesFlooded) },
    { label: 'Street flood volume', before: m3(before.floodVolumeM3), after: m3(after.floodVolumeM3) },
    { label: `${hotspotNodeId} peak`, before: m2(before.hotspotPeakM), after: m2(after.hotspotPeakM) },
  ];
}

const pendingHeading = (p: Problem, progress: { done: number; total: number } | null) =>
  progress && progress.total > 0
    ? logLines.problemPending(p, progress.done, progress.total)
    : `⚠ ${p.kind === 'bottleneck' ? 'Bottleneck' : 'Ponding'} detected — testing fixes…`;

/** What one problem's pin says, given the analysis state. */
export function pinView(
  problem: Problem,
  state: { phase: AnalysisPhase; progress: { done: number; total: number } | null; diagnosis?: Diagnosis | null; ranked?: ReadonlyArray<CandidateResult & { resultKey: string }> },
): PinView {
  if (state.phase === 'running') return { heading: pendingHeading(problem, state.progress), pending: true };
  const heading = logLines.problem(problem);
  if (state.phase === 'stopped') return { heading, pending: false, note: 'Automated analysis stopped before a fix was found.' };
  if (state.phase === 'failed' || !state.diagnosis) return { heading, pending: false, note: 'Automated analysis failed; no fix to suggest.' };
  const d = state.diagnosis;
  const best = bestFixPerProblem(state.ranked ?? [])[problem.id];
  if (!best) return { heading, pending: false, note: NO_IMPROVING_FIX_TEXT };
  const before: Outcome = { homesFlooded: d.homesFlooded, floodVolumeM3: d.floodVolumeM3, hotspotPeakM: d.hotspotPeakM };
  return { heading, pending: false, fix: { label: best.label, rows: outcomeRows(before, best.outcome, d.hotspotNodeId), cost: indicativeCost(best.costRM), resultKey: best.resultKey } };
}

/** The ground height (team metres) for a pin at a plan position: the nearest node's ground level. */
export function groundAt(site: SiteSpec, x: number, y: number): number {
  let best = Infinity, z = 0;
  for (const n of site.assets.nodes) {
    const d = Math.hypot(n.position_m.x - x, n.position_m.y - y);
    if (d < best) {
      best = d;
      z = n.ground_elevation_m;
    }
  }
  return z;
}
