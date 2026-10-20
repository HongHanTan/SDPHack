import { describe, expect, it } from 'vitest';
import { buildScenario } from '@floodops/engine/scenario/index';
import type { Frame } from '@floodops/engine/sim/types';
import { makeContext, pipeStatus, toTeamFrame, toTeamMetrics } from '../frameAdapter';

const sc = buildScenario([], 'synthetic_80mmh_60min');
const ctx = makeContext(sc.network, sc.grid, { 'INLET-D07': 0.4 });
const nP = sc.network.pipes.length;
const nN = sc.network.nodes.length;
const frame = (load: number, fill: number, wetAt?: number): Frame => {
  const depth = new Float32Array(sc.grid.nx * sc.grid.ny);
  if (wetAt !== undefined) depth[wetAt] = 0.2;
  return { t: 60, depth, nodeFill: new Float32Array(nN).fill(fill), pipeLoad: new Float32Array(nP).fill(load) };
};

describe('frameAdapter', () => {
  it('classifies pipe status by load', () => {
    expect([pipeStatus(0.5), pipeStatus(0.8), pipeStatus(0.999), pipeStatus(Number.NaN)]).toEqual(['normal', 'near_capacity', 'surcharged', 'unknown']);
  });
  it('maps flow = load × qFull and node flooding when full and the street is wet', () => {
    const j07 = sc.network.nodes.find((n) => n.id === 'NODE-J07')!;
    const f = toTeamFrame(frame(0.5, 1, j07.cell), ctx);
    expect(f.timestamp_s).toBe(60);
    expect(f.pipe_states[0].flow_m3s).toBeCloseTo(0.5 * ctx.qFull[0], 9);
    expect(f.node_states.find((n) => n.node_id === 'NODE-J07')!.status).toBe('flooding');
    expect(f.node_states.find((n) => n.node_id === 'NODE-J01')!.status).toBe('surcharged');
    expect(f.inlet_states.find((i) => i.inlet_id === 'INLET-D07')!.hydraulic_inlet_clogging_fraction).toBe(0.4);
  });
  it('is safe when frame sizes do not match the network', () => {
    const bad: Frame = { t: 0, depth: new Float32Array(sc.grid.nx * sc.grid.ny), nodeFill: new Float32Array(1), pipeLoad: new Float32Array(1) };
    const f = toTeamFrame(bad, ctx);
    expect(f.pipe_states.every((p) => p.status === 'unknown')).toBe(true);
    expect(f.node_states.every((n) => n.status === 'unknown')).toBe(true);
  });
  it('maps metrics with engine extras', () => {
    const tf = [toTeamFrame(frame(1, 0.5), ctx), toTeamFrame(frame(0.2, 0.2), ctx)];
    const metrics = { peakDepth: new Float32Array(sc.grid.nx * sc.grid.ny), peakSagDepth: 0.66, floodedRoadArea: 10, homesFlooded: 2, minutesToPassable: null, peakOutfallFlow: 0.5, sagSeries: { t: [], depth: [] }, balance: { rain: 1, error: 0 } };
    const m = toTeamMetrics('engine-1', metrics, tf, ctx, 30);
    expect(m.j07_peak_depth_m).toBe(0.66);
    expect(m.homes_flooded).toBe(2);
    expect(m.surcharge_duration_s).toBe(30);
    expect(m.peak_flow_m3s).toBeCloseTo(ctx.qFull[sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07')], 9);
    expect(m.engine).toBe('FloodOps TS engine');
  });
});
