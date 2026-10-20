import type { Thresholds } from '../sim/types';

/** Grid-local metres = team datum metres − DATUM. The grid covers team x ∈ [−80, 170], y ∈ [−140, 150]. */
export const DATUM = { x0: -80, y0: -140 };
export const GRID = { nx: 125, ny: 145, dx: 2 };

export const ROAD_DROP = 0.1; // m, kerb: road surface below verge
export const HOUSE = { width: 12, depth: 13 }; // m footprint before the layout's scale
/** Maple Grove pond: bed level, normal water level (below NODE-J04 invert 10.0), park margin, overflow live rise. */
export const LAKE = { bedZ: 9.2, waterLevel: 9.8, parkMargin: 12, liveRise: 1.0 };
export const CANAL = { bedZ: 7.6 };
/** Shallow bowl at the J07 junction so street water gathers there. Tunable. */
export const DIP = { radius: 30, depth: 0.5 };
/** Shallow bowl around every grate so street water drains to it (D07 additionally sits in DIP). Tunable. */
export const FUNNEL = { radius: 30, depth: 0.3 };
/** Gully sump: each grate cell sits this far below the street. */
export const INLET_SUMP = 0.1;
export const COVER = 1.5; // m, default cover for nodes added by interventions
export const MANHOLE = { area: 1 };

export const BASELINE_BLOCKAGE: Record<string, number> = { 'INLET-D07': 0.4 };
export const TAILWATER = { normal: 8.2, high: 9.4 } as const; // m, constant canal stage (team tailwater cases)
export type TailwaterCase = keyof typeof TAILWATER;

/** Off-line storage tank near J07: fed from J05, slow release to J08. Positions in team datum. */
export const TANK = { x: 60, y: 20, invert: 8.9, area: 2000, depth: 2.0, feedNode: 'NODE-J05', outNode: 'NODE-J08', inflowD: 0.9, outflowD: 0.15 };
export const LAKE_OVERFLOW = { fromNode: 'NODE-J04', diameter: 0.6 };
export const PUMP = { node: 'NODE-J08', rate: 0.5 }; // m³/s to the canal
export const P07_UPSIZED_D = 0.75;

export const THRESHOLDS: Thresholds = { road: 0.15, home: 0.3 };
export const MMHR = 1 / 3.6e6;
export const INFILTRATION_MMHR = { ROOF: 0, ROAD: 0, LAWN: 15, PARK: 25, POND: 0, RIVER: 0 };

// dt is the coupling step; the surface is sub-stepped inside the engine.
export const SIM = { dt: 0.5, recessionS: 3600, frameEveryS: 30 };
