import { LandUse, type DrainNode, type Grid, type Scenario } from '../src/sim/types';

export function makeGrid(
  nx: number,
  ny: number,
  dx: number,
  zFn: (i: number, j: number) => number,
  hFn: (i: number, j: number) => number = () => 0,
  land: number = LandUse.LAWN,
): Grid {
  const n = nx * ny;
  const z = new Float32Array(n);
  const h0 = new Float32Array(n);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      z[j * nx + i] = zFn(i, j);
      h0[j * nx + i] = hFn(i, j);
    }
  }
  return {
    nx,
    ny,
    dx,
    z,
    h0,
    land: new Uint8Array(n).fill(land),
    infil: new Float32Array(n),
    building: new Int32Array(n).fill(-1),
  };
}

export function sum(a: ArrayLike<number>): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k];
  return s;
}

export function makeNode(id: string, cell: number, invert = 0, maxDepth = 1.5, inletPerimeter = 2): DrainNode {
  return { id, x: 0, y: 0, cell, invert, area: 1, maxDepth, inletPerimeter };
}

/** 20×20 test township: river in rows 0–1, ground rising north; node A (inlet) piped to outfall node B. */
export function makeScenario(
  opts: { diameter?: number; flapGate?: boolean; riverLevels?: [number, number]; rainMmHr?: number } = {},
): Scenario {
  const nx = 20;
  const ny = 20;
  const dx = 4;
  const grid = makeGrid(nx, ny, dx, (_i, j) => (j < 2 ? 0 : 2 + j * 0.05));
  for (let c = 0; c < 2 * nx; c++) grid.land[c] = LandUse.RIVER;
  for (let i = 0; i < nx; i++) grid.land[10 * nx + i] = LandUse.ROAD;
  grid.building[12 * nx + 5] = 0;
  const node = (id: string, i: number, j: number) => {
    const cell = j * nx + i;
    return { id, x: (i + 0.5) * dx, y: (j + 0.5) * dx, cell, invert: grid.z[cell] - 1.5, area: 1, maxDepth: 1.5, inletPerimeter: 2 };
  };
  const A = node('A', 10, 12);
  const B = node('B', 10, 3);
  const d = opts.diameter ?? 0.3;
  return {
    grid,
    network: {
      nodes: [A, B],
      pipes: [{ id: 'A-B', from: 'A', to: 'B', diameter: d, length: 36, slope: (A.invert - B.invert) / 36, n: 0.013 }],
      outfalls: [{ node: 'B', riverCell: 1 * nx + 10, area: (Math.PI * d * d) / 4, flapGate: opts.flapGate ?? false }],
      pumps: [],
    },
    storm: {
      id: 'test',
      label: 'test',
      returnPeriod: 0,
      blockS: 60,
      intensity: new Array(10).fill((opts.rainMmHr ?? 100) / 3.6e6),
      provisional: false,
      peakMinute: 5,
    },
    river: { times: [0, 600], levels: opts.riverLevels ?? [0.5, 0.5] },
    dt: 0.5,
    recessionS: 300,
    frameEveryS: 30,
    thresholds: { road: 0.15, home: 0.3 },
    sagCell: 12 * nx + 10,
  };
}
