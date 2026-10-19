import type { Grid } from '../sim/types';

/** Vertical exaggeration so 10 m of relief reads clearly across a 512 m site. */
export const VERT = 4;

export const worldX = (grid: Grid, x: number): number => x - (grid.nx * grid.dx) / 2;
export const worldZ = (grid: Grid, y: number): number => (grid.ny * grid.dx) / 2 - y;
export const worldY = (elevation: number): number => elevation * VERT;
