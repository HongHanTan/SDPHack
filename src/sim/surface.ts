import type { Grid } from './types';

export const G = 9.81;
/** Per-step flux damping standing in for bed friction (assumption; shown in the UI). */
export const DAMPING = 0.995;

export interface SurfaceState {
  h: Float64Array; // water depth per cell, m
  fL: Float64Array; // outflow fluxes to each neighbour, m³/s
  fR: Float64Array;
  fB: Float64Array; // south (j - 1)
  fT: Float64Array; // north (j + 1)
}

export function createSurface(grid: Grid): SurfaceState {
  const n = grid.nx * grid.ny;
  return {
    h: Float64Array.from(grid.h0),
    fL: new Float64Array(n),
    fR: new Float64Array(n),
    fB: new Float64Array(n),
    fT: new Float64Array(n),
  };
}

/**
 * One step of the virtual-pipes shallow-water scheme (Mei et al. 2007).
 * Domain edges are walls. Volume is conserved up to float error.
 * NaN is deliberately preserved (not clamped) so the engine's validator can catch it.
 */
export function stepSurface(grid: Grid, s: SurfaceState, dt: number): void {
  const { nx, ny, dx, z } = grid;
  const { h, fL, fR, fB, fT } = s;
  const area = dx * dx;
  const k = dt * G * dx; // dt * g * A / l with A = dx², l = dx

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const H = z[c] + h[c];
      let l = i > 0 ? DAMPING * fL[c] + k * (H - z[c - 1] - h[c - 1]) : 0;
      let r = i < nx - 1 ? DAMPING * fR[c] + k * (H - z[c + 1] - h[c + 1]) : 0;
      let b = j > 0 ? DAMPING * fB[c] + k * (H - z[c - nx] - h[c - nx]) : 0;
      let t = j < ny - 1 ? DAMPING * fT[c] + k * (H - z[c + nx] - h[c + nx]) : 0;
      if (l < 0) l = 0;
      if (r < 0) r = 0;
      if (b < 0) b = 0;
      if (t < 0) t = 0;
      const out = (l + r + b + t) * dt;
      const vol = h[c] * area;
      if (out > vol) {
        const K = out > 0 ? vol / out : 0;
        l *= K;
        r *= K;
        b *= K;
        t *= K;
      }
      fL[c] = l;
      fR[c] = r;
      fB[c] = b;
      fT[c] = t;
    }
  }

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const inflow =
        (i > 0 ? fR[c - 1] : 0) +
        (i < nx - 1 ? fL[c + 1] : 0) +
        (j > 0 ? fT[c - nx] : 0) +
        (j < ny - 1 ? fB[c + nx] : 0);
      const outflow = fL[c] + fR[c] + fB[c] + fT[c];
      const next = h[c] + (dt * (inflow - outflow)) / area;
      h[c] = next < 0 ? 0 : next;
    }
  }
}
