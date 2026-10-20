import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { displaceFlat } from '../displaceFlat';

describe('displaceFlat', () => {
  it('sets each vertex to the absolute height at its scene position', () => {
    const g = new THREE.PlaneGeometry(10, 10, 1, 1);
    displaceFlat(g, { x: 100, y: 11, z: -50, rotY: 0, meshY: 0.02 }, (tx, ty) => 11 + tx * 0.001 + ty * 0.01);
    const pos = g.getAttribute('position');
    // vertex 0 of PlaneGeometry is (-5, +5): scene (95, z = -50 - 5 = -55) -> team (95, 55)
    expect(pos.getZ(0)).toBeCloseTo(11 + 95 * 0.001 + 55 * 0.01 - 11 - 0.02, 9);
  });
});
