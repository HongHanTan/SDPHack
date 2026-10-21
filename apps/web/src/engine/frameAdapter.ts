import { ASSETS } from '@floodops/engine/scenario/layout';
import { createNetworkState } from '@floodops/engine/sim/pipes';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { LandUse, type Frame, type Grid, type Metrics, type Network } from '@floodops/engine/sim/types';
import type { AssetInlet, ConduitStatus, InletState, NodeState, PipeState, SimulationFrame, SimulationMetricsResponse } from '../types';

export const NEAR_CAPACITY = 0.8;
export const SURCHARGED = 0.999;
const TRUNK = ['PIPE-P03', 'PIPE-P05', 'PIPE-P07', 'PIPE-P08'];
const ROAD_THRESHOLD_M = 0.15;

export function pipeStatus(load: number): ConduitStatus {
  if (!Number.isFinite(load)) return 'unknown';
  return load >= SURCHARGED ? 'surcharged' : load >= NEAR_CAPACITY ? 'near_capacity' : 'normal';
}

export interface AdapterContext {
  network: Network;
  grid: Grid;
  qFull: Float64Array;
  blockage: Record<string, number>;
  inlets: AssetInlet[];
}

export function makeContext(
  network: Network,
  grid: Grid,
  blockage: Record<string, number>,
  inlets: AssetInlet[] = ASSETS.inlets as unknown as AssetInlet[],
): AdapterContext {
  return { network, grid, qFull: createNetworkState(network).qFull, blockage, inlets };
}

export function toTeamFrame(frame: Frame, ctx: AdapterContext): SimulationFrame {
  const { network } = ctx;
  const pipesOk = frame.pipeLoad.length === network.pipes.length;
  const nodesOk = frame.nodeFill.length === network.nodes.length;
  const pipe_states: PipeState[] = network.pipes.map((p, k) => {
    const load = pipesOk ? frame.pipeLoad[k] : Number.NaN;
    return {
      conduit_id: p.id,
      flow_m3s: pipesOk ? load * ctx.qFull[k] : 0,
      depth_m: pipesOk ? p.diameter * Math.min(1, Math.max(0, load)) : 0,
      status: pipeStatus(load),
      capacity_fraction: pipesOk ? load : undefined,
    };
  });
  const node_states: NodeState[] = network.nodes.map((n, k) => {
    const fill = nodesOk ? frame.nodeFill[k] : Number.NaN;
    const surcharged = fill >= SURCHARGED;
    const wet = frame.depth[n.cell] > 0.01;
    return {
      node_id: n.id,
      depth_m: nodesOk ? fill * n.maxDepth : 0,
      flooding_rate_m3s: 0,
      surcharge_flag: surcharged,
      status: !nodesOk ? 'unknown' : surcharged && wet ? 'flooding' : surcharged ? 'surcharged' : 'normal',
    };
  });
  const inlet_states: InletState[] = ctx.inlets.map((i) => ({
    inlet_id: i.inlet_id,
    hydraulic_inlet_clogging_fraction: ctx.blockage[i.inlet_id] ?? 0,
    parameter_status: 'assumed_not_calibrated',
    capture_flow_m3s: null,
    bypass_flow_m3s: null,
  }));
  return { timestamp_s: frame.t, pipe_states, node_states, inlet_states };
}

export interface EngineMetricsExtras {
  j07_peak_depth_m: number;
  homes_flooded: number;
}

export function toTeamMetrics(
  runId: string,
  m: Metrics,
  teamFrames: SimulationFrame[],
  ctx: AdapterContext,
  frameEveryS: number,
  site?: SiteSpec,
): SimulationMetricsResponse & EngineMetricsExtras {
  const imported = !!site && !site.builtIn;
  // Built-in: the trunk and PIPE-P07; imported: the pipe(s) flowing out of the hotspot node.
  const surchargeIds = imported ? ctx.network.pipes.filter((p) => p.from === site!.hotspotNodeId).map((p) => p.id) : TRUNK;
  const peakIds = imported ? surchargeIds : ['PIPE-P07'];
  const area = ctx.grid.dx * ctx.grid.dx;
  let floodVol = 0;
  for (let c = 0; c < m.peakDepth.length; c++) {
    const land = ctx.grid.land[c];
    if (land === LandUse.RIVER || land === LandUse.POND) continue;
    if (m.peakDepth[c] >= ROAD_THRESHOLD_M) floodVol += m.peakDepth[c] * area;
  }
  const flooded = new Set<string>();
  let surchargedFrames = 0;
  let p07Peak = 0;
  for (const f of teamFrames) {
    for (const n of f.node_states) if (n.status === 'flooding') flooded.add(n.node_id);
    if (f.pipe_states.some((p) => surchargeIds.includes(p.conduit_id) && p.status === 'surcharged')) surchargedFrames++;
    let flow = 0;
    for (const p of f.pipe_states) if (peakIds.includes(p.conduit_id)) flow += p.flow_m3s;
    if (flow > p07Peak) p07Peak = flow;
  }
  return {
    run_id: runId,
    model_version_id: imported ? 'imported_site' : 'taman_kyra_synthetic_v1',
    result_type: 'simulated',
    engine: 'FloodOps TS engine',
    engine_version: '1.0',
    is_verified_site_model: false,
    assumptions: imported
      ? [
          `2D surface flow on a ${ctx.grid.dx} m grid coupled to capacity-routed pipes; SWMM-style catchments through grate capture.`,
          `Imported site ${site!.label}: generated from uploaded files; not a verified site model. Surcharge duration and peak flow follow the pipe(s) leaving hotspot ${site!.hotspotNodeId}.`,
        ]
      : [
          '2D surface flow on a 2 m grid coupled to capacity-routed pipes; SWMM-style catchments through grate capture.',
          'Synthetic Taman Kyra network (Tay Zheheng) and layout (TEH JIA JIE); not a surveyed site.',
        ],
    warnings: m.balance.error >= 0.01 ? [`Water balance error ${(m.balance.error * 100).toFixed(2)}%`] : [],
    status_definitions: { surcharged: 'pipe load ≥ 99.9% of full-bore capacity', near_capacity: 'pipe load ≥ 80%', flooding: 'manhole full and street wet at its cell' },
    total_flooding_volume_m3: Math.round(floodVol * 10) / 10,
    flooded_node_count: flooded.size,
    surcharge_duration_s: surchargedFrames * frameEveryS,
    metric_definitions: {
      total_flooding_volume_m3: 'Sum of individual cell peak water volumes where depth reaches ≥15 cm; not a simultaneous peak (pond/canal excluded)',
      surcharge_duration_s: 'Approximate time any selected trunk pipe reaches ≥99.9% of model flow capacity, sampled from output frames; not pressure-based surcharge',
    },
    peak_flow_m3s: p07Peak,
    inlet_volumes: null,
    j07_peak_depth_m: m.peakSagDepth,
    homes_flooded: m.homesFlooded,
  };
}
