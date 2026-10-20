export const WET = 0.01; // m

/** Display-only 3×3 smoothing of wet depths so the flood reads as one sheet; dry cells stay exactly 0. */
export function smoothDepth(depth: ArrayLike<number>, nx: number, ny: number, out: Float32Array): Float32Array {
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      if (!(depth[c] > WET)) {
        out[c] = 0;
        continue;
      }
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= nx) continue;
          const v = depth[jj * nx + ii];
          if (v > WET) {
            s += v;
            n++;
          }
        }
      }
      out[c] = s / n;
    }
  }
  return out;
}
