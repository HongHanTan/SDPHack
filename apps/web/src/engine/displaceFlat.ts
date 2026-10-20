import * as THREE from 'three';

export interface FlatPlacement {
  x: number; // group position (scene)
  y: number;
  z: number;
  rotY: number; // group rotation about Y
  meshY: number; // mesh offset above the group
}

/**
 * Displaces a flat geometry drawn in a mesh rotated −π/2 about X (local XY plane) inside a group placed at `place`.
 * heightAt(teamX, teamY) returns the absolute elevation; team y = −scene z.
 */
export function displaceFlat(geom: THREE.BufferGeometry, place: FlatPlacement, heightAt: (tx: number, ty: number) => number): THREE.BufferGeometry {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const c = Math.cos(place.rotY);
  const s = Math.sin(place.rotY);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = -pos.getY(i);
    const sx = place.x + lx * c + lz * s;
    const sz = place.z - lx * s + lz * c;
    pos.setZ(i, heightAt(sx, -sz) - place.y - place.meshY);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
