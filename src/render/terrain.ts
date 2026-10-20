import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldY } from './coords';
import { createGridGeometry } from './gridGeometry';
import { isBioswale, paintGround, type Look } from './groundTexture';

export interface TerrainView {
  mesh: THREE.Mesh;
  setLook(look: Look): void;
  setOpacity(o: number): void;
  dispose(): void;
}

// Townships differ only by the bioswale preset, so textures are cached by (look, size, bioswale cell count).
const cache = new Map<string, THREE.CanvasTexture>();

function groundTexture(grid: Grid, look: Look, size: number): THREE.CanvasTexture {
  let swales = 0;
  for (let c = 0; c < grid.land.length; c++) if (isBioswale(grid, c)) swales++;
  const key = `${look}|${size}|${swales}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = paintGround(grid, look, size);
    cache.set(key, tex);
  }
  return tex;
}

export function createTerrain(grid: Grid, textureSize = 2048): TerrainView {
  const { nx, ny } = grid;
  const geom = createGridGeometry(grid);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(nx * ny * 2);
  for (let c = 0; c < nx * ny; c++) {
    pos.setY(c, worldY(grid.z[c]));
    uv[2 * c] = ((c % nx) + 0.5) / nx;
    uv[2 * c + 1] = (Math.floor(c / nx) + 0.5) / ny;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geom.deleteAttribute('color');
  geom.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ map: groundTexture(grid, 'day', textureSize) });
  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = true;
  let look: Look = 'day';

  return {
    mesh,
    setLook(next) {
      if (next === look) return;
      look = next;
      material.map = groundTexture(grid, next, textureSize);
      material.needsUpdate = true;
    },
    setOpacity(o) {
      const transparent = o < 0.999;
      material.opacity = o;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.depthWrite = !transparent;
        material.needsUpdate = true;
      }
    },
    dispose() {
      geom.dispose();
      material.dispose(); // textures are cached and shared
    },
  };
}

/** Compatibility wrapper used by scene.ts until the conductor rewrite (Task 5). */
export function createTerrainMesh(grid: Grid): THREE.Mesh {
  return createTerrain(grid).mesh;
}
