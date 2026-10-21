import { describe, expect, it } from 'vitest';
import type { SimulationFrame, SimulationMetricsResponse, SimulationRun } from '../../types';
import { candidateTitle, comparisonItems, curvePoints, direction, frameAtTime, frameIndexAtTime, hasIntervention, nodeDepthSeries, runFixAsset, runFixLabel } from '../compare';

const frame = (t: number, depth = 0): SimulationFrame => ({ timestamp_s: t, pipe_states: [], node_states: [{ node_id: 'J1', depth_m: depth, flooding_rate_m3s: 0, surcharge_flag: false, status: 'normal' }], inlet_states: [] });
const frames = [0, 30, 60, 90].map((t) => frame(t, t / 100));
const metrics = (volume: number, peak: number | undefined, homes: number | undefined) =>
  ({ total_flooding_volume_m3: volume, j07_peak_depth_m: peak, homes_flooded: homes } as unknown as SimulationMetricsResponse);
const run = (snapshot?: Record<string, unknown>) => ({ run_id: 'r', input_snapshot: snapshot } as unknown as SimulationRun);

describe('frameAtTime', () => {
  it('picks the frame with the greatest time at or before t', () => {
    expect(frameAtTime(frames, 45)?.timestamp_s).toBe(30);
    expect(frameAtTime(frames, 60)?.timestamp_s).toBe(60);
    expect(frameAtTime(frames, 1e9)?.timestamp_s).toBe(90);
    expect(frameIndexAtTime(frames, 89.9)).toBe(2);
  });
  it('falls back to the first frame before the run starts and to nothing when empty', () => {
    expect(frameAtTime(frames, -5)?.timestamp_s).toBe(0);
    expect(frameAtTime([], 10)).toBeUndefined();
    expect(frameIndexAtTime([], 10)).toBe(-1);
  });
});

describe('comparison values', () => {
  it('reports before/after with direction (lower is better)', () => {
    const items = comparisonItems(metrics(120, 0.42, 5), metrics(80, 0.42, 7), 'NODE-J07');
    expect(items.map((i) => i.key)).toEqual(['flood_volume', 'hotspot_peak', 'homes_flooded']);
    expect(items[0]).toMatchObject({ label: 'Street flood volume (≥ 0.15 m)', before: 120, after: 80, direction: 'better' });
    expect(items[1]).toMatchObject({ label: 'Peak at NODE-J07', before: 0.42, after: 0.42, direction: 'same' });
    expect(items[2]).toMatchObject({ label: 'Homes flooded', before: 5, after: 7, direction: 'worse' });
  });
  it('leaves direction empty when a value is missing', () => {
    const items = comparisonItems(metrics(1, undefined, undefined), metrics(1, 0.2, undefined), 'J1');
    expect(items[1]).toMatchObject({ before: null, after: 0.2, direction: null });
    expect(items[2].direction).toBeNull();
    expect(direction(1, 1 + 1e-9)).toBe('same');
  });
});

describe('candidateTitle', () => {
  it('names the changed pipe and its new diameter in mm', () => {
    expect(candidateTitle(run({ intervention: { changes: [{ asset_id: 'PIPE-P07', after: 0.75 }] } }))).toBe('AFTER · PIPE-P07 Ø750 mm');
    expect(candidateTitle(run({ intervention: { changes: [{ asset_id: 'C2', after: 0.6000000001 }] } }))).toBe('AFTER · C2 Ø600 mm');
  });
  it('uses the automated analysis fix label when the run has one', () => {
    const fixRun = run({ intervention: { kind: 'storage', label: 'Storage 300 m³ at NODE-J05', asset_id: 'NODE-J05', changes: [] } });
    expect(candidateTitle(fixRun)).toBe('AFTER · Storage 300 m³ at NODE-J05');
    expect(runFixLabel(fixRun)).toBe('Storage 300 m³ at NODE-J05');
    expect(runFixAsset(fixRun)).toBe('NODE-J05');
    expect(candidateTitle(run({ intervention: { label: '', changes: [{ asset_id: 'C2', after: 0.6 }] } }))).toBe('AFTER · C2 Ø600 mm');
  });
  it('tells baseline runs (null intervention) from changed runs', () => {
    expect(hasIntervention(run({ intervention: null }))).toBe(false);
    expect(hasIntervention(run({ intervention: { changes: [] } }))).toBe(true);
    expect(runFixLabel(run({ intervention: null }))).toBeUndefined();
    expect(runFixAsset(run({ intervention: { changes: [] } }))).toBeUndefined();
  });
  it('falls back when the snapshot has no change', () => {
    expect(candidateTitle(run({}))).toBe('AFTER · Pipe option');
    expect(candidateTitle(undefined)).toBe('AFTER · Pipe option');
  });
});

describe('depth curves', () => {
  it('places samples by time so runs of different lengths align', () => {
    const s = nodeDepthSeries(frames, 'J1');
    expect(s.d).toEqual([0, 0.3, 0.6, 0.9]);
    const pts = curvePoints({ t: [0, 90], d: [0, 0.9] }, 0, 180, 0.9).split(' ');
    expect(pts).toEqual(['20,85', '350,20']);
  });
});
