import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOULEVARD_I } from '../scenario/config';
import { cellAt } from '../scenario/terrain';
import { LandUse, type Grid } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';
import { isBioswale } from './groundTexture';
import { mulberry32 } from './rng';

export interface TreeSpot {
  x: number;
  y: number;
  scale: number;
}

export const TREE_COUNT = 400;
export const NODE_CLEARANCE_M = 6;
const BOULEVARD_BAND_M = 12;
const JITTER_M = 1.5;

/** Park/hill cells (not bioswales), or lawn within 12 m of the boulevard. */
export function treeCellAllowed(grid: Grid, c: number): boolean {
  const land = grid.land[c];
  if (land === LandUse.PARK) return !isBioswale(grid, c);
  if (land !== LandUse.LAWN) return false;
  const x = ((c % grid.nx) + 0.5) * grid.dx;
  return Math.abs(x - (BOULEVARD_I + 0.5) * grid.dx) <= BOULEVARD_BAND_M;
}

/** Deterministic tree positions (township metres), kept clear of drain nodes. */
export function placeTrees(
  grid: Grid,
  nodes: ReadonlyArray<{ x: number; y: number }>,
  seed = 42,
  count = TREE_COUNT,
): TreeSpot[] {
  const { nx, ny, dx } = grid;
  const clearance = NODE_CLEARANCE_M + JITTER_M * Math.SQRT2 + 0.01;
  const candidates: number[] = [];
  for (let c = 0; c < nx * ny; c++) {
    if (!treeCellAllowed(grid, c)) continue;
    const x = ((c % nx) + 0.5) * dx;
    const y = (Math.floor(c / nx) + 0.5) * dx;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < clearance)) continue;
    candidates.push(c);
  }
  const rnd = mulberry32(seed);
  const n = Math.min(count, candidates.length);
  for (let k = 0; k < n; k++) {
    const r = k + Math.floor(rnd() * (candidates.length - k));
    [candidates[k], candidates[r]] = [candidates[r], candidates[k]];
  }
  return candidates
    .slice(0, n)
    .sort((a, b) => a - b)
    .map((c) => ({
      x: ((c % nx) + 0.5) * dx + (rnd() - 0.5) * 2 * JITTER_M,
      y: (Math.floor(c / nx) + 0.5) * dx + (rnd() - 0.5) * 2 * JITTER_M,
      scale: 0.8 + 0.4 * rnd(),
    }));
}

function colorize(geom: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geom.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) arr.set([c.r, c.g, c.b], k * 3);
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/** All trees in one instanced draw call; setScale(0) hides them (x-ray / plan). */
export class TreesView {
  readonly mesh: THREE.InstancedMesh;
  private readonly base: THREE.Matrix4[] = [];
  private readonly tmp = new THREE.Matrix4();
  private readonly scaleM = new THREE.Matrix4();
  private scale = 1;

  constructor(grid: Grid, spots: TreeSpot[]) {
    const trunk = colorize(new THREE.CylinderGeometry(0.6, 0.8, 3, 5).translate(0, 1.5, 0), '#b8a58a');
    const canopy = colorize(new THREE.ConeGeometry(4, 10, 6).translate(0, 8, 0), '#9cc29a');
    const geom = mergeGeometries([trunk, canopy])!;
    this.mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }), spots.length);
    this.mesh.castShadow = true;
    const q = new THREE.Quaternion();
    spots.forEach((s, k) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(worldX(grid, s.x), worldY(grid.z[cellAt(s.x, s.y)]), worldZ(grid, s.y)),
        q,
        new THREE.Vector3(s.scale, s.scale, s.scale),
      );
      this.base.push(m);
      this.mesh.setMatrixAt(k, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setScale(s: number): void {
    if (Math.abs(s - this.scale) < 1e-4) return;
    this.scale = s;
    this.mesh.visible = s > 0.001;
    this.scaleM.makeScale(s, s, s);
    this.base.forEach((b, k) => this.mesh.setMatrixAt(k, this.tmp.multiplyMatrices(b, this.scaleM)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
