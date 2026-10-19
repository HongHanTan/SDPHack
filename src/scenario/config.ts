import type { RiverStage, Thresholds } from '../sim/types';

// Coordinates: x east, y north, metres from the south-west corner. Cell (i, j) centre = ((i+0.5)·dx, (j+0.5)·dx).
export const GRID = { nx: 128, ny: 128, dx: 4 };
export const RIVER_ROWS = 6; // j < 6 is river

export const TERRAIN = { baseZ: 3, slope: 0.02, hillStartY: 380, hillSlope: 0.08, roadDrop: 0.05 };
export const SAG = { x: 100, y: 64, r: 80, depth: 2.5 };
export const SAG_CHART_POINT = { x: 82, y: 42 }; // node S3, on the lowest sag road
export const POND = { x: 430, y: 60, r: 36, depth: 4, initialLevel: 1.0, parkMargin: 30 };
export const BUND = { xMin: 20, xMax: 180, z: 4.0 }; // riverside bund protecting the sag, rows RIVER_ROWS..+1
export const BOULEVARD_I = 64; // 3-cell-wide main road at i = 63..65
export const BIOSWALE_Y = { min: 122, max: 362 };

export const COVER = 1.5; // m, ground to manhole invert
export const MANHOLE = { area: 1, inletPerimeter: 2 };
export const PIPE_D = { trunk: 0.6, branch: 0.45, local: 0.375, trunkUpsized: 0.9 };
export const TANK = { x: 162, y: 122, area: 1500, depth: 3, inflowD: 0.9, outflowD: 0.15 };
export const PUMP_RATE = 1.0; // m³/s

export const RIVER_STAGE: RiverStage = { times: [0, 3600, 7200, 10800], levels: [0.8, 2.2, 3.2, 1.5] };
export const THRESHOLDS: Thresholds = { road: 0.15, home: 0.3 };

export const MMHR = 1 / 3.6e6; // mm/hr -> m/s
export const INFILTRATION_MMHR = { ROOF: 0, ROAD: 0, LAWN: 15, PARK: 25, POND: 0, RIVER: 0, BIOSWALE: 60 };

export const SIM = { dt: 0.25, recessionS: 3600, frameEveryS: 30 };
