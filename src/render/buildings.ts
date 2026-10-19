import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';

const HEIGHT = 8; // world units (not exaggerated)

/** One box per building id, sized to its footprint. */
export function createBuildings(grid: Grid): THREE.InstancedMesh {
  const boxes = new Map<number, { i0: number; i1: number; j0: number; j1: number; zMin: number }>();
  for (let j = 0; j < grid.ny; j++) {
    for (let i = 0; i < grid.nx; i++) {
      const c = j * grid.nx + i;
      const id = grid.building[c];
      if (id < 0) continue;
      const b = boxes.get(id);
      if (!b) boxes.set(id, { i0: i, i1: i, j0: j, j1: j, zMin: grid.z[c] });
      else {
        b.i0 = Math.min(b.i0, i);
        b.i1 = Math.max(b.i1, i);
        b.j0 = Math.min(b.j0, j);
        b.j1 = Math.max(b.j1, j);
        b.zMin = Math.min(b.zMin, grid.z[c]);
      }
    }
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: '#efe6d8' }),
    boxes.size,
  );
  const m = new THREE.Matrix4();
  let k = 0;
  for (const b of boxes.values()) {
    const w = (b.i1 - b.i0 + 1) * grid.dx;
    const d = (b.j1 - b.j0 + 1) * grid.dx;
    const x = worldX(grid, b.i0 * grid.dx + w / 2);
    const z = worldZ(grid, b.j0 * grid.dx + d / 2);
    m.compose(new THREE.Vector3(x, worldY(b.zMin) + HEIGHT / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, HEIGHT, d));
    mesh.setMatrixAt(k++, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}
