// Pure helpers for the uploaded-site side-by-side before/after view (Compare tab).
import type { SimulationFrame, SimulationMetricsResponse, SimulationRun } from '../types';

/** Index of the frame with the greatest timestamp_s <= t (0 when t precedes every frame, -1 when empty). */
export function frameIndexAtTime(frames: readonly SimulationFrame[], t: number): number {
  if (!frames.length) return -1;
  let k = 0;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].timestamp_s <= t + 1e-6) k = i;
    else break;
  }
  return k;
}

/** The frame with the greatest timestamp_s <= t (the first frame when t precedes them all). */
export function frameAtTime(frames: readonly SimulationFrame[], t: number): SimulationFrame | undefined {
  const k = frameIndexAtTime(frames, t);
  return k < 0 ? undefined : frames[k];
}

export interface PipeChange { asset_id: string; after: number }

/** The first intervention change recorded in a run's input snapshot. */
export function runChange(run?: SimulationRun): PipeChange | undefined {
  const snap = run?.input_snapshot as { intervention?: { changes?: PipeChange[] } } | undefined;
  return snap?.intervention?.changes?.[0];
}

/** The automated analysis's fix label recorded with a run (`input_snapshot.intervention.label`), if any. */
export function runFixLabel(run?: SimulationRun): string | undefined {
  const label = (run?.input_snapshot as { intervention?: { label?: unknown } | null } | undefined)?.intervention?.label;
  return typeof label === 'string' && label.trim() ? label : undefined;
}

/** The target asset an analysed fix run records (`input_snapshot.intervention.asset_id`), if any. */
export function runFixAsset(run?: SimulationRun): string | undefined {
  const id = (run?.input_snapshot as { intervention?: { asset_id?: unknown } | null } | undefined)?.intervention?.asset_id;
  return typeof id === 'string' && id ? id : undefined;
}

/** True when a run changes something relative to the baseline (a pipe option or an analysed fix). */
export function hasIntervention(run?: SimulationRun): boolean {
  const iv = (run?.input_snapshot as { intervention?: unknown } | undefined)?.intervention;
  return iv !== null && iv !== undefined;
}

/** Right-pane title: the fix label when the run came from the automated analysis, else e.g. "AFTER · P07 Ø750 mm". */
export function candidateTitle(run?: SimulationRun): string {
  const label = runFixLabel(run);
  if (label) return `AFTER · ${label}`;
  const c = runChange(run);
  if (!c || !Number.isFinite(c.after)) return 'AFTER · Pipe option';
  return `AFTER · ${c.asset_id} Ø${Math.round(c.after * 1000)} mm`;
}

export type Direction = 'better' | 'worse' | 'same';
export interface ComparisonItem {
  key: 'flood_volume' | 'hotspot_peak' | 'homes_flooded';
  label: string;
  before: number | null;
  after: number | null;
  unit: string;
  /** Lower is better for every item; null when either value is missing. */
  direction: Direction | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function direction(before: number | null, after: number | null, tolerance = 1e-6): Direction | null {
  if (before === null || after === null) return null;
  if (Math.abs(after - before) <= tolerance) return 'same';
  return after < before ? 'better' : 'worse';
}

type EngineMetrics = SimulationMetricsResponse & { j07_peak_depth_m?: number; homes_flooded?: number };

/** Before -> after values for the comparison strip. */
export function comparisonItems(before: SimulationMetricsResponse, after: SimulationMetricsResponse, hotspotNodeId: string): ComparisonItem[] {
  const b = before as EngineMetrics, a = after as EngineMetrics;
  const item = (key: ComparisonItem['key'], label: string, x: unknown, y: unknown, unit: string): ComparisonItem => {
    const bv = num(x), av = num(y);
    return { key, label, before: bv, after: av, unit, direction: direction(bv, av) };
  };
  return [
    item('flood_volume', 'Street flood volume (≥ 0.15 m)', b.total_flooding_volume_m3, a.total_flooding_volume_m3, ' m³'),
    item('hotspot_peak', `Peak at ${hotspotNodeId}`, b.j07_peak_depth_m, a.j07_peak_depth_m, ' m'),
    item('homes_flooded', 'Homes flooded', b.homes_flooded, a.homes_flooded, ''),
  ];
}

/** A node's sampled depth above invert over a run, with each sample's time. */
export function nodeDepthSeries(frames: readonly SimulationFrame[], nodeId: string | undefined): { t: number[]; d: number[] } {
  return {
    t: frames.map((f) => f.timestamp_s),
    d: frames.map((f) => f.node_states.find((n) => n.node_id === nodeId)?.depth_m ?? 0),
  };
}

/** SVG polyline points on the depth plot's 700x105 box, x by time so runs of different lengths line up. */
export function curvePoints(series: { t: number[]; d: number[] }, tStart: number, tEnd: number, peak: number): string {
  const span = Math.max(1e-9, tEnd - tStart);
  return series.t.map((t, i) => `${20 + ((t - tStart) / span) * 660},${85 - (series.d[i] / Math.max(0.1, peak)) * 65}`).join(' ');
}
