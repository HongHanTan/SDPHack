import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldY } from './coords';
import { createGridGeometry } from './gridGeometry';

// Indexed by LandUse code: ROOF, ROAD, LAWN, PARK, POND, RIVER
const LAND_COLORS = ['#b9ad9b', '#5b6270', '#8fbf6a', '#3f7f3a', '#6e8f5a', '#4f6f5a'].map((c) => new THREE.Color(c));

export function createTerrainMesh(grid: Grid): THREE.Mesh {
  const geom = createGridGeometry(grid);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const col = geom.getAttribute('color') as THREE.BufferAttribute;
  for (let c = 0; c < grid.nx * grid.ny; c++) {
    pos.setY(c, worldY(grid.z[c]));
    const color = LAND_COLORS[grid.land[c]];
    col.setXYZ(c, color.r, color.g, color.b);
  }
  geom.computeVertexNormals();
  return new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }));
}
