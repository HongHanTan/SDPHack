import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { smoothDepth, WET } from '@floodops/engine/client/smoothDepth';
import { baseTownship } from '@floodops/engine/scenario/index';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { createWaterMaterial } from '../engine/waterMaterial';
import { blendTheme } from '../view/xrayTheme';
import { siteWaterBase, type ScenePoint } from './siteWaterGrid';

/** Street water from the FloodOps engine on Tay's site map: engine ground + stored depth, placed through his `point`. */
export function SiteWater({ site, depth, point }: { site: SiteSpec; depth: Float32Array | null; point: ScenePoint }) {
  const grid = useMemo(() => baseTownship({}, site).grid, [site]);
  const base = useMemo(() => siteWaterBase(site, grid, point), [site, grid, point]);
  const { nx, ny } = base;
  const n = nx * ny;
  const { geom, depthAttr } = useMemo(() => {
    const pos = new Float32Array(n * 3);
    for (let c = 0; c < n; c++) {
      pos[3 * c] = base.sceneX[c];
      pos[3 * c + 1] = base.groundY[c] - 0.5;
      pos[3 * c + 2] = base.sceneZ[c];
    }
    const index: number[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        index.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(index);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const depthAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    g.setAttribute('aDepth', depthAttr);
    g.computeVertexNormals();
    return { geom: g, depthAttr };
  }, [base, n, nx, ny]);
  const material = useMemo(() => {
    const m = createWaterMaterial();
    const day = blendTheme(0);
    (m.uniforms.uShallow.value as THREE.Color).set(day.waterShallow);
    (m.uniforms.uDeep.value as THREE.Color).set(day.waterDeep);
    m.uniforms.uOpMin.value = day.waterOpMin;
    m.uniforms.uOpMax.value = day.waterOpMax;
    m.uniforms.uEmissive.value = day.waterEmissive;
    return m;
  }, []);
  const smoothed = useMemo(() => new Float32Array(n), [n]);

  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    // A grid of another size is not this site's water; draw nothing rather than misplace it.
    if (depth && depth.length === n) smoothDepth(depth, nx, ny, smoothed);
    else smoothed.fill(0);
    for (let c = 0; c < n; c++) {
      const v = base.mask[c] ? smoothed[c] : 0;
      pos.setY(c, v > WET ? base.groundY[c] + v + 0.03 : base.groundY[c] - 0.5);
      depthAttr.setX(c, v);
    }
    pos.needsUpdate = true;
    depthAttr.needsUpdate = true;
    geom.computeVertexNormals();
    geom.computeBoundingSphere();
  }, [depth, geom, base, depthAttr, smoothed, n, nx, ny]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return <mesh geometry={geom} material={material} renderOrder={2} />;
}
