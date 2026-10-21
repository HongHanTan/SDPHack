import * as THREE from 'three';
import type { SiteFrame } from './siteFrame';

/** Flat ground plane over the site frame in scene coordinates (x east, z = −north), one vertex per grid cell corner row/column. */
export function groundPlane(f: SiteFrame, nx: number, ny: number): THREE.PlaneGeometry {
  const geom = new THREE.PlaneGeometry(f.w, f.h, Math.max(1, nx - 1), Math.max(1, ny - 1));
  geom.rotateX(-Math.PI / 2); // local (x, y=north) → scene (x, z=−north)
  geom.translate(f.cx, 0, f.cz); // PlaneGeometry is centred at the origin; move it onto the site
  return geom;
}

/** Team (east, north) metres of vertex k of a scene-space ground geometry. */
export function vertexTeam(pos: THREE.BufferAttribute, k: number): { tx: number; ty: number } {
  return { tx: pos.getX(k), ty: -pos.getZ(k) };
}
