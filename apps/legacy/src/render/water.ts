import * as THREE from 'three';
import type { Grid } from '@floodops/engine/sim/types';
import { worldY } from './coords';
import { createGridGeometry } from './gridGeometry';
import { smoothDepth, WET } from '@floodops/engine/client/smoothDepth';
import { DAY, type Theme } from './theme';
import { createWaterMaterial } from './waterMaterial';

/** Flood surface: smoothed display depths, shader water, Phong fallback if the shader cannot compile. */
export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private readonly geom: THREE.BufferGeometry;
  private readonly depthAttr: THREE.BufferAttribute;
  private readonly smoothed: Float32Array;
  private readonly shader = createWaterMaterial();
  private fallback: THREE.MeshPhongMaterial | null = null;
  private readonly shallow = new THREE.Color();
  private readonly deep = new THREE.Color();
  private readonly tmp = new THREE.Color();

  constructor(private readonly grid: Grid) {
    const n = grid.nx * grid.ny;
    this.geom = createGridGeometry(grid);
    this.depthAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    this.geom.setAttribute('aDepth', this.depthAttr);
    this.smoothed = new Float32Array(n);
    this.mesh = new THREE.Mesh(this.geom, this.shader);
    this.mesh.renderOrder = 2;
    this.setTheme(DAY);
    this.update(grid.h0);
  }

  update(depth: ArrayLike<number>): void {
    const { nx, ny, z } = this.grid;
    smoothDepth(depth, nx, ny, this.smoothed);
    const pos = this.geom.getAttribute('position') as THREE.BufferAttribute;
    const col = this.geom.getAttribute('color') as THREE.BufferAttribute;
    for (let c = 0; c < this.smoothed.length; c++) {
      const d = this.smoothed[c];
      pos.setY(c, d > WET ? worldY(z[c] + d) + 0.05 : worldY(z[c]) - 1);
      this.depthAttr.setX(c, d);
      if (this.fallback) {
        this.tmp.copy(this.shallow).lerp(this.deep, Math.min(1, d));
        col.setXYZ(c, this.tmp.r, this.tmp.g, this.tmp.b);
      }
    }
    pos.needsUpdate = true;
    this.depthAttr.needsUpdate = true;
    if (this.fallback) col.needsUpdate = true;
    this.geom.computeVertexNormals();
  }

  setTheme(th: Theme): void {
    const u = this.shader.uniforms;
    (u.uShallow.value as THREE.Color).set(th.waterShallow);
    (u.uDeep.value as THREE.Color).set(th.waterDeep);
    u.uOpMin.value = th.waterOpacityMin;
    u.uOpMax.value = th.waterOpacityMax;
    u.uEmissive.value = th.waterEmissive;
    this.shallow.set(th.waterShallow);
    this.deep.set(th.waterDeep);
    if (this.fallback) this.fallback.opacity = (th.waterOpacityMin + th.waterOpacityMax) / 2;
  }

  setRipples(on: boolean): void {
    this.shader.uniforms.uRipple.value = on ? 1 : 0;
  }

  tick(timeS: number): void {
    this.shader.uniforms.uTime.value = timeS;
  }

  /** Switch to plain Phong water (used if the shader fails to compile). */
  useFallback(): void {
    if (this.fallback) return;
    this.fallback = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.6, shininess: 80, depthWrite: false });
    this.mesh.material = this.fallback;
    this.update(Array.from(this.smoothed));
  }

  dispose(): void {
    this.geom.dispose();
    this.shader.dispose();
    this.fallback?.dispose();
  }
}
