import * as THREE from 'three';
import type { Grid } from '@floodops/engine/sim/types';
import { worldX, worldZ } from './coords';

/** One vertex per cell centre, two upward-facing triangles per quad. y and colour are filled by the caller. */
export function createGridGeometry(grid: Grid): THREE.BufferGeometry {
  const { nx, ny, dx } = grid;
  const n = nx * ny;
  const pos = new Float32Array(n * 3);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      pos[3 * c] = worldX(grid, (i + 0.5) * dx);
      pos[3 * c + 2] = worldZ(grid, (j + 0.5) * dx);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const d = a + nx;
      const e = d + 1;
      index.push(a, b, d, b, e, d);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setIndex(index);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return geom;
}
