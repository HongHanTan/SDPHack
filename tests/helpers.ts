import { LandUse, type Grid } from '../src/sim/types';

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
