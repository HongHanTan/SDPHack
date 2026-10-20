import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applySurfaceLook, GHOST_MATERIAL } from '../surfaceLook';

function scene() {
  const root = new THREE.Group();
  const house = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const water = new THREE.Group();
  water.userData.noGhost = true;
  const pond = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  water.add(pond);
  // Duck-typed troika text: a mesh with `text` and `sync()`.
  const label = Object.assign(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()), { text: 'J07', sync: () => {} });
  root.add(house, water, label);
  return { root, house, pond, label };
}

describe('applySurfaceLook', () => {
  it('ghosts meshes, skips noGhost subtrees and text, and restores the originals', () => {
    const { root, house, pond, label } = scene();
    const houseMat = house.material;
    const pondMat = pond.material;
    const labelMat = label.material;
    applySurfaceLook(root, true, false);
    expect(house.material).toBe(GHOST_MATERIAL);
    expect(pond.material).toBe(pondMat);
    expect(label.material).toBe(labelMat);
    expect(label.visible).toBe(true);
    applySurfaceLook(root, true, false); // idempotent
    applySurfaceLook(root, false, false);
    expect(house.material).toBe(houseMat);
  });
  it('re-ghosts a mesh whose material was replaced while ghosted', () => {
    const { root, house } = scene();
    applySurfaceLook(root, true, false);
    const fresh = new THREE.MeshStandardMaterial();
    house.material = fresh;
    applySurfaceLook(root, true, false);
    expect(house.material).toBe(GHOST_MATERIAL);
    applySurfaceLook(root, false, false);
    expect(house.material).toBe(fresh);
  });
  it('hides text labels in 2D and shows them again in 3D', () => {
    const { root, label } = scene();
    applySurfaceLook(root, false, true);
    expect(label.visible).toBe(false);
    applySurfaceLook(root, false, false);
    expect(label.visible).toBe(true);
  });
});
