import * as THREE from 'three';

/** X-ray ghost for the team surface (legacy x-ray terrain look: dark blue, 35%). */
export const GHOST_MATERIAL = new THREE.MeshBasicMaterial({ color: '#1c2c44', transparent: true, opacity: 0.35, depthWrite: false });

const ORIG = '__origMaterial';

/** drei <Text> renders troika-three-text meshes, recognised by their `text` field and `sync()` method. */
export function isTextObject(o: THREE.Object3D): boolean {
  const t = o as unknown as { text?: unknown; sync?: unknown };
  return typeof t.sync === 'function' && 'text' in t;
}

/**
 * Ghosts every mesh under `root` (keeping the original material in userData to restore later) and hides text
 * labels in 2D. Subtrees with `userData.noGhost` are left alone. Safe to call repeatedly.
 */
export function applySurfaceLook(root: THREE.Object3D, ghost: boolean, is2d: boolean): void {
  const walk = (o: THREE.Object3D) => {
    if (o.userData.noGhost) return;
    if (isTextObject(o)) {
      o.visible = !is2d;
      return;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      if (ghost) {
        if (mesh.material !== GHOST_MATERIAL) {
          mesh.userData[ORIG] = mesh.material;
          mesh.material = GHOST_MATERIAL;
        }
      } else if (mesh.userData[ORIG]) {
        mesh.material = mesh.userData[ORIG] as THREE.Material;
        delete mesh.userData[ORIG];
      }
    }
    o.children.forEach(walk);
  };
  walk(root);
}
