import type { RiverStage, Thresholds } from '../sim/types';

// Coordinates: x east, y north, metres from the south-west corner. Cell (i, j) centre = ((i+0.5)·dx, (j+0.5)·dx).
export const GRID = { nx: 128, ny: 128, dx: 4 };
export const RIVER_ROWS = 6; // j < 6 is river

export const TERRAIN = { baseZ: 3, slope: 0.02, hillStartY: 380, hillSlope: 0.08, roadDrop: 0.05 };
export const SAG = { x: 100, y: 64, r: 80, depth: 1.0 };
export const SAG_CHART_POINT = { x: 82, y: 42 }; // node S3, on the lowest sag road (bowl floor ≈ 2.8 m, below the river peak)
export const POND = { x: 430, y: 60, r: 36, depth: 4, initialLevel: 1.0, parkMargin: 30, reliefRise: 1.5 };
export const BUND = { xMin: 0, xMax: 282, z: 4.0 }; // riverside bund protecting the sag, rows RIVER_ROWS..+1
/**
 * Graded diversion ridge (raised kerb line / road crest) that, with the bund and the west boundary, encloses
 * the sag's own catchment (a "polder"). Upslope runoff is carried along the ridge and past the sag's east side
 * to the open riverbank, so the sag drains only through its pipes. Crest = local ground + height.
 */
export const RIDGE = {
  points: [[0, 150], [280, 90], [280, 32]] as Array<[number, number]>,
  height: 0.5,
  halfWidth: 3,
  swaleWidth: 8, // grassed diversion swale on the upslope (left) side: no houses, lowered
  swaleDepth: 0.2,
};
/** Gully sump: each inlet cell sits this far below the street so the grate sees ponded, not sheet, flow. */
export const INLET_SUMP = 0.1;
export const BOULEVARD_I = 64; // 3-cell-wide main road at i = 63..65
/** Bioswales: planted, lowered verges either side of the sag's approach street (road row j), across the slope. */
export const BIOSWALE = { roadJ: 20, xMax: 276, depth: 0.2 };

// Drain nodes (manholes) sit on road cells: x or y = 2 + 40k, or on the boulevard (x = 258).
export const NODE_LAYOUT: Array<[string, number, number]> = [
  ['T0', 258, 362], ['T1', 258, 322], ['T2', 258, 282], ['T3', 258, 242], ['T4', 258, 202],
  ['T5', 258, 162], ['T6', 258, 122], ['T7', 258, 82], ['T8', 258, 42],
  ['W0', 122, 242], ['W1', 162, 242], ['W2', 202, 242],
  ['E0', 362, 162], ['E1', 322, 162], ['E2', 282, 162],
  ['S0', 202, 42], ['S1', 162, 42], ['S2', 122, 42], ['S3', 82, 42],
  ['SL0', 42, 82], ['SL1', 122, 82],
  ['O', 82, 34],
];

export const COVER = 1.5; // m, ground to manhole invert
export const MANHOLE = { area: 1, inletPerimeter: 2 };
/**
 * Per-node grate perimeter overrides (m); 0 = solid cover (no surface inlet). The collector and outfall manholes at
 * the sag's low point (S2, S3, O) have solid covers: the sag's gullies are on its rim streets (S1, SL0, SL1), so
 * water pooled at the low point has no way into the drains until preset #6 adds grates there.
 */
export const NODE_INLETS: Record<string, number> = { S2: 0, S3: 0, O: 0 };
/** The outfall chamber is graded this far below cover depth so the outfall pipe has real fall. */
export const OUTFALL_DROP = 0.3;
export const PIPE_D = { trunk: 0.6, branch: 0.45, local: 0.375, trunkUpsized: 0.9 };
// Fed from T8, the last trunk manhole before the trunk enters the sag collector; sits under the street beside it.
export const TANK = { x: 242, y: 62, area: 1500, depth: 3, inflowD: 0.9, outflowD: 0.15, feedNode: 'T8' };
export const PUMP_RATE = 1.0; // m³/s

export const RIVER_STAGE: RiverStage = { times: [0, 3600, 7200, 10800], levels: [0.8, 2.2, 3.2, 1.5] };
export const THRESHOLDS: Thresholds = { road: 0.15, home: 0.3 };

export const MMHR = 1 / 3.6e6; // mm/hr -> m/s
export const INFILTRATION_MMHR = { ROOF: 0, ROAD: 0, LAWN: 15, PARK: 25, POND: 0, RIVER: 0, BIOSWALE: 100 };

// dt is the coupling step (rain, inlets, pipes, outfalls); the surface is sub-stepped inside the engine.
export const SIM = { dt: 0.5, recessionS: 3600, frameEveryS: 30 };
