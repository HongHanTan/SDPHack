import type { Grid } from './types';

export const G = 9.81;
/** Per-step flux damping standing in for bed friction (assumption; shown in the UI). */
export const DAMPING = 0.995;

/** Fraction of the stability limit actually used (margin for wet/dry fronts and the outflow limiter). */
export const STABILITY_SAFETY = 0.8;

/**
 * Largest surface sub-step the virtual-pipes scheme tolerates, s.
 *
 * Linearised, each face flux obeys df/dt = g·dx·ΔH and each cell dh/dt = −Σf/dx², so the
 * pipe "cross-section" is dx² and the wave speed is depth-independent. The scheme is symplectic
 * Euler, stable while dt·ω_max ≤ 2. For the checkerboard mode, ω² = 8g/dx when a face carries flow
 * one way only, giving dt ≤ √(dx / 2g) ≈ 0.45 s at dx = 4 m (a flat dam-break is indeed smooth up to
 * 0.45 s). But the scheme keeps a separate non-negative flux per direction, and while both directions
 * of a face are positive (flow reversing) both respond to ΔH, doubling the gain: ω² = 16g/dx and
 * dt ≤ √(dx / 4g) ≈ 0.319 s at dx = 4 m. Empirically the synthetic township under 300 mm/hr rain is
 * smooth at 0.30 s and blows up (checkerboard, 5.9 m depths) at 0.33 s, matching this bound.
 * With STABILITY_SAFETY = 0.8 the sub-step is 0.255 s at dx = 4 m.
 */
export function maxStableDt(dx: number): number {
  return STABILITY_SAFETY * Math.sqrt(dx / (4 * G));
}

/** Number of equal sub-steps advanceSurface uses for a coupling step dt. */
export function surfaceSubsteps(dx: number, dt: number): number {
  return Math.max(1, Math.ceil(dt / maxStableDt(dx) - 1e-9));
}

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
 * Unguarded: dt must not exceed maxStableDt(dx). Use advanceSurface for arbitrary dt.
 * Domain edges are walls. Volume is conserved up to float error.
 * NaN is deliberately preserved (not clamped) so the engine's validator can catch it.
 */
export function stepSurface(grid: Grid, s: SurfaceState, dt: number): void {
  const { nx, ny, dx, z } = grid;
  const { h, fL, fR, fB, fT } = s;
  const area = dx * dx;
  const k = dt * G * dx; // dt * g * A / l with A = dx², l = dx

  for (let j = 0; j < ny; j++) {
    const hasB = j > 0;
    const hasT = j < ny - 1;
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const hc = h[c];
      if (hc === 0) {
        // A dry cell's outflows would be scaled to zero by the limiter below; skip the work (bit-identical).
        fL[c] = 0;
        fR[c] = 0;
        fB[c] = 0;
        fT[c] = 0;
        continue;
      }
      const H = z[c] + hc;
      let l = i > 0 ? DAMPING * fL[c] + k * (H - z[c - 1] - h[c - 1]) : 0;
      let r = i < nx - 1 ? DAMPING * fR[c] + k * (H - z[c + 1] - h[c + 1]) : 0;
      let b = hasB ? DAMPING * fB[c] + k * (H - z[c - nx] - h[c - nx]) : 0;
      let t = hasT ? DAMPING * fT[c] + k * (H - z[c + nx] - h[c + nx]) : 0;
      if (l < 0) l = 0;
      if (r < 0) r = 0;
      if (b < 0) b = 0;
      if (t < 0) t = 0;
      const out = (l + r + b + t) * dt;
      const vol = hc * area;
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

/** Advances the surface by dt using n = ceil(dt / maxStableDt) equal sub-steps: stable for any dt. */
export function advanceSurface(grid: Grid, s: SurfaceState, dt: number): void {
  const n = surfaceSubsteps(grid.dx, dt);
  const sub = dt / n;
  for (let k = 0; k < n; k++) stepSurface(grid, s, sub);
}
