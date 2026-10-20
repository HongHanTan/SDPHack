export const LandUse = { ROOF: 0, ROAD: 1, LAWN: 2, PARK: 3, POND: 4, RIVER: 5 } as const;

export interface Grid {
  nx: number;
  ny: number;
  dx: number; // cell size, m
  z: Float32Array; // ground elevation, m
  land: Uint8Array; // LandUse code
  infil: Float32Array; // infiltration capacity, m/s
  building: Int32Array; // building id, -1 = none
  h0: Float32Array; // initial water depth, m
}

export interface DrainNode {
  id: string;
  x: number; // m, east
  y: number; // m, north
  cell: number;
  invert: number; // m
  area: number; // plan area of storage, m²
  maxDepth: number; // m; storage = area * maxDepth
  inletPerimeter: number; // m of weir crest; 0 = no surface inlet
}

export interface Pipe {
  id: string;
  from: string;
  to: string;
  diameter: number; // m
  length: number; // m
  slope: number; // m/m (may be <= 0; clamped to MIN_SLOPE for capacity)
  n: number; // Manning roughness
}

export interface Outfall {
  node: string;
  riverCell: number;
  area: number; // orifice area, m²
  flapGate: boolean;
}

export interface Pump {
  node: string;
  rate: number; // m³/s
  riverCell: number;
}

export interface Network {
  nodes: DrainNode[];
  pipes: Pipe[];
  outfalls: Outfall[];
  pumps: Pump[];
}

export interface Storm {
  id: string;
  label: string;
  returnPeriod: number;
  blockS: number;
  intensity: number[]; // m/s per block
  provisional: boolean;
}

export interface RiverStage {
  times: number[]; // s
  levels: number[]; // water surface elevation, m
}

export interface Thresholds {
  road: number;
  home: number;
}

export interface Scenario {
  grid: Grid;
  network: Network;
  storm: Storm;
  river: RiverStage;
  dt: number;
  recessionS: number;
  frameEveryS: number;
  thresholds: Thresholds;
  sagCell: number;
}

export interface Frame {
  t: number; // s
  depth: Float32Array; // per cell
  nodeFill: Float32Array; // vol / vmax per node
  pipeLoad: Float32Array; // q / qFull per pipe
}

export interface Metrics {
  peakDepth: Float32Array;
  peakSagDepth: number;
  floodedRoadArea: number; // m²
  homesFlooded: number;
  minutesToPassable: number | null; // null = still flooded at end of run
  peakOutfallFlow: number; // m³/s, positive = to river
  sagSeries: { t: number[]; depth: number[] }; // t in minutes
  balance: { rain: number; error: number }; // error relative to rain volume
}

export interface SimResult {
  frames: Frame[];
  metrics: Metrics;
}

export class SimError extends Error {
  constructor(
    message: string,
    public readonly step: number,
  ) {
    super(message);
    this.name = 'SimError';
  }
}
