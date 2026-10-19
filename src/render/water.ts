import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldY } from './coords';
import { createGridGeometry } from './gridGeometry';

const SHALLOW = new THREE.Color('#9fd3ff');
const DEEP = new THREE.Color('#08306b');
const WET = 0.01; // m
const FULL_COLOUR_DEPTH = 1.0; // m

export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private readonly geom: THREE.BufferGeometry;
  private readonly tmp = new THREE.Color();

  constructor(private readonly grid: Grid) {
    this.geom = createGridGeometry(grid);
    this.mesh = new THREE.Mesh(
      this.geom,
      new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.6, shininess: 80 }),
    );
    this.update(grid.h0);
  }

  update(depth: ArrayLike<number>): void {
    const pos = this.geom.getAttribute('position') as THREE.BufferAttribute;
    const col = this.geom.getAttribute('color') as THREE.BufferAttribute;
    const { z } = this.grid;
    for (let c = 0; c < depth.length; c++) {
      const d = depth[c];
      pos.setY(c, d > WET ? worldY(z[c] + d) + 0.05 : worldY(z[c]) - 1);
      this.tmp.copy(SHALLOW).lerp(DEEP, Math.min(1, d / FULL_COLOUR_DEPTH));
      col.setXYZ(c, this.tmp.r, this.tmp.g, this.tmp.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.geom.computeVertexNormals();
  }

  dispose(): void {
    this.geom.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
