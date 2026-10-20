import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';

const TOPSOIL_M = 0.6;
const BASE_ELEV = -4;

/** Soil cross-section on the four sides: topsoil band over clay; the south (river) face in river colour. */
export class SkirtView {
  readonly mesh: THREE.Mesh;
  private readonly bands: Uint8Array; // per vertex: 0 topsoil, 1 clay, 2 river
  private readonly colors: Float32Array;
  private readonly cols = [new THREE.Color(), new THREE.Color(), new THREE.Color()];

  constructor(grid: Grid) {
    const { nx, ny, dx, z } = grid;
    const ring: Array<{ c: number; south: boolean }> = [];
    for (let i = 0; i < nx; i++) ring.push({ c: i, south: true });
    for (let j = 1; j < ny; j++) ring.push({ c: j * nx + nx - 1, south: false });
    for (let i = nx - 2; i >= 0; i--) ring.push({ c: (ny - 1) * nx + i, south: false });
    for (let j = ny - 2; j >= 0; j--) ring.push({ c: j * nx, south: false });

    const pos: number[] = [];
    const band: number[] = [];
    const xy = (c: number) => ({ x: worldX(grid, ((c % nx) + 0.5) * dx), zz: worldZ(grid, (Math.floor(c / nx) + 0.5) * dx) });
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, tag: number) => {
      for (const v of [a, b, c, b, d, c]) {
        pos.push(v.x, v.y, v.z);
        band.push(tag);
      }
    };
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k];
      const q = ring[(k + 1) % ring.length];
      const south = p.south && q.south;
      const A = xy(p.c);
      const B = xy(q.c);
      const yA = worldY(z[p.c]);
      const yB = worldY(z[q.c]);
      const mA = worldY(z[p.c] - TOPSOIL_M);
      const mB = worldY(z[q.c] - TOPSOIL_M);
      const base = worldY(BASE_ELEV);
      const v = (x: number, y: number, zz: number) => new THREE.Vector3(x, y, zz);
      quad(v(A.x, yA, A.zz), v(B.x, yB, B.zz), v(A.x, mA, A.zz), v(B.x, mB, B.zz), south ? 2 : 0);
      quad(v(A.x, mA, A.zz), v(B.x, mB, B.zz), v(A.x, base, A.zz), v(B.x, base, B.zz), south ? 2 : 1);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.colors = new Float32Array(pos.length);
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geom.computeVertexNormals();
    this.bands = Uint8Array.from(band);
    this.mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.setColors('#b9a887', '#cbbfa8', '#7fb8cf');
  }

  setColors(top: string, bottom: string, river: string): void {
    const cols = this.cols;
    cols[0].set(top);
    cols[1].set(bottom);
    cols[2].set(river);
    for (let k = 0; k < this.bands.length; k++) {
      const c = cols[this.bands[k]];
      this.colors[3 * k] = c.r;
      this.colors[3 * k + 1] = c.g;
      this.colors[3 * k + 2] = c.b;
    }
    (this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
