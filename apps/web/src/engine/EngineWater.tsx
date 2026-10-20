import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { smoothDepth, WET } from '@floodops/engine/client/smoothDepth';
import { baseTownship } from '@floodops/engine/scenario/index';
import { toTeam } from '@floodops/engine/scenario/layout';
import { LandUse } from '@floodops/engine/sim/types';
import { visualGround } from './visualGround';
import { createWaterMaterial } from './waterMaterial';

/** Engine water surface over Jiajie's scene: height = visual ground + simulated depth (pond and canal excluded). */
export function EngineWater({ depth }: { depth: Float32Array | null }) {
  const grid = useMemo(() => baseTownship().grid, []);
  const { nx, ny, dx } = grid;
  const n = nx * ny;
  const { geom, base, mask, depthAttr } = useMemo(() => {
    const pos = new Float32Array(n * 3);
    const base = new Float32Array(n);
    const mask = new Uint8Array(n);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        const t = toTeam((i + 0.5) * dx, (j + 0.5) * dx);
        base[c] = visualGround(t.x, t.y);
        mask[c] = grid.land[c] === LandUse.POND || grid.land[c] === LandUse.RIVER ? 0 : 1;
        pos[3 * c] = t.x;
        pos[3 * c + 1] = base[c] - 0.5;
        pos[3 * c + 2] = -t.y;
      }
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
    return { geom: g, base, mask, depthAttr };
  }, [grid, n, nx, ny, dx]);
  const smoothed = useMemo(() => new Float32Array(n), [n]);
  const material = useMemo(() => {
    const m = createWaterMaterial();
    (m.uniforms.uShallow.value as THREE.Color).set('#bfe3ec');
    (m.uniforms.uDeep.value as THREE.Color).set('#2b7fb8');
    return m;
  }, []);

  useEffect(() => () => geom.dispose(), [geom]);
  useEffect(() => () => material.dispose(), [material]);

  // Normals only shade the ripples; recomputing them every 3rd update keeps Live cheap.
  const updates = useRef(0);
  useEffect(() => {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    if (depth) smoothDepth(depth, nx, ny, smoothed);
    else smoothed.fill(0);
    for (let c = 0; c < n; c++) {
      const v = mask[c] ? smoothed[c] : 0;
      pos.setY(c, v > WET ? base[c] + v + 0.03 : base[c] - 0.5);
      depthAttr.setX(c, v);
    }
    pos.needsUpdate = true;
    depthAttr.needsUpdate = true;
    if (updates.current++ % 3 === 0) geom.computeVertexNormals();
  }, [depth, geom, base, mask, depthAttr, smoothed, n, nx, ny]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return <mesh geometry={geom} material={material} renderOrder={2} />;
}
