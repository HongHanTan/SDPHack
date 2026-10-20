import { LandUse, type Frame, type Metrics, type Scenario } from './types';

export interface MetricsTracker {
  afterStep(h: Float64Array, outfallQ: number): void;
  onFrame(f: Frame): void;
  finish(stormEnd: number, balance: { rain: number; error: number }): Metrics;
}

export function createMetricsTracker(sc: Scenario): MetricsTracker {
  const { grid, thresholds, sagCell } = sc;
  const peak = new Float32Array(grid.nx * grid.ny);
  const roadCells: number[] = [];
  grid.land.forEach((l, c) => {
    if (l === LandUse.ROAD) roadCells.push(c);
  });
  let peakOutfall = 0;
  let lastFloodedT = 0;
  let floodedAtEnd = false;
  const sagT: number[] = [];
  const sagD: number[] = [];

  return {
    afterStep(h, outfallQ) {
      for (let c = 0; c < h.length; c++) if (h[c] > peak[c]) peak[c] = h[c];
      if (outfallQ > peakOutfall) peakOutfall = outfallQ;
    },
    onFrame(f) {
      sagT.push(f.t / 60);
      sagD.push(f.depth[sagCell]);
      floodedAtEnd = roadCells.some((c) => f.depth[c] >= thresholds.road);
      if (floodedAtEnd) lastFloodedT = f.t;
    },
    finish(stormEnd, balance) {
      const area = grid.dx * grid.dx;
      const homes = new Set<number>();
      grid.building.forEach((b, c) => {
        if (b >= 0 && peak[c] >= thresholds.home) homes.add(b);
      });
      return {
        peakDepth: peak,
        peakSagDepth: peak[sagCell],
        floodedRoadArea: roadCells.filter((c) => peak[c] >= thresholds.road).length * area,
        homesFlooded: homes.size,
        minutesToPassable: floodedAtEnd ? null : Math.max(0, lastFloodedT - stormEnd) / 60,
        peakOutfallFlow: peakOutfall,
        sagSeries: { t: sagT, depth: sagD },
        balance,
      };
    },
  };
}
