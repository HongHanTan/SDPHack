import * as THREE from 'three';

/** X-ray ghost for the team surface (legacy x-ray terrain look: dark blue, 35%). */
export const GHOST_MATERIAL = new THREE.MeshBasicMaterial({ color: '#1c2c44', transparent: true, opacity: 0.35, depthWrite: false });

const ORIG = new WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]>();

/** drei <Text> renders troika-three-text meshes, recognised by their `text` field and `sync()` method. */
export function isTextObject(o: THREE.Object3D): boolean {
  const t = o as unknown as { text?: unknown; sync?: unknown };
  return typeof t.sync === 'function' && 'text' in t;
}

/**
 * Ghosts every mesh under `root` (keeping the original material in a WeakMap to restore later) and hides text
 * labels in 2D. Subtrees with `userData.noGhost` keep their materials (text inside is still hidden in 2D). Safe to call repeatedly.
 */
export function applySurfaceLook(root: THREE.Object3D, ghost: boolean, is2d: boolean): void {
  const walk = (o: THREE.Object3D, skip: boolean) => {
    const noGhost = skip || !!o.userData.noGhost;
    if (isTextObject(o)) {
      o.visible = !is2d;
      return;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !noGhost) {
      if (ghost) {
        if (mesh.material !== GHOST_MATERIAL) {
          ORIG.set(mesh, mesh.material);
          mesh.material = GHOST_MATERIAL;
        }
      } else if (ORIG.has(mesh)) {
        mesh.material = ORIG.get(mesh)!;
        ORIG.delete(mesh);
      }
    }
    o.children.forEach((c) => walk(c, noGhost));
  };
  walk(root, false);
}
