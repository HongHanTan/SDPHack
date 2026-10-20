import * as THREE from 'three';

export const RAIN_FULL_MMHR = 150;
const FALL_SPEED = 220; // world units per second
const STREAK = 7;

/** Number of streaks to draw: linear in intensity, all of them at RAIN_FULL_MMHR, none at 0. */
export function visibleStreaks(mmHr: number, count: number): number {
  return Math.round((Math.min(RAIN_FULL_MMHR, Math.max(0, mmHr)) / RAIN_FULL_MMHR) * count);
}

/** Falling rain streaks in a box over the township. Purely visual. */
export class Rain {
  readonly object: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly geom = new THREE.BufferGeometry();
  private visible = 0;

  constructor(
    private readonly width: number,
    private readonly depth: number,
    private readonly top = 250,
    private readonly count = 6000,
  ) {
    this.pos = new Float32Array(count * 6);
    for (let k = 0; k < count; k++) this.respawn(k, Math.random() * top);
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geom.setDrawRange(0, 0);
    this.object = new THREE.LineSegments(this.geom, new THREE.LineBasicMaterial({ color: '#9ec3e6', transparent: true, opacity: 0.55 }));
    this.object.frustumCulled = false;
  }

  setIntensity(mmHr: number): void {
    this.visible = visibleStreaks(mmHr, this.count);
    this.geom.setDrawRange(0, this.visible * 2);
  }

  update(dtS: number): void {
    if (this.visible === 0) return;
    const dy = FALL_SPEED * Math.min(dtS, 0.1);
    for (let k = 0; k < this.visible; k++) {
      const o = k * 6;
      this.pos[o + 1] -= dy;
      this.pos[o + 4] -= dy;
      if (this.pos[o + 4] < 0) this.respawn(k, this.top);
    }
    (this.geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private respawn(k: number, y: number): void {
    const x = (Math.random() - 0.5) * this.width;
    const z = (Math.random() - 0.5) * this.depth;
    const o = k * 6;
    this.pos[o] = x;
    this.pos[o + 1] = y + STREAK;
    this.pos[o + 2] = z;
    this.pos[o + 3] = x - 0.6;
    this.pos[o + 4] = y;
    this.pos[o + 5] = z;
  }
}
