import * as THREE from 'three';
import type { DrainNode, Frame, Grid, Network } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';
import { advancePhase, arrowsVisible } from './flowMath';

export type RibbonKind = 'xray' | 'plan';

const CHEVRON_SPACING = 12; // world units between chevrons

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uPhase;
uniform float uLen;
uniform float uArrows;
uniform float uGlow;
varying vec2 vUv;
void main() {
  float s = fract(vUv.x * uLen / ${CHEVRON_SPACING.toFixed(1)} - uPhase);
  float v = abs(fract(vUv.y * 2.0) - 0.5);
  float d = s - v * 0.6;
  float chevron = smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(0.16, 0.24, d));
  vec3 col = uColor * (0.75 + 0.25 * uGlow) + vec3(1.0) * chevron * uArrows * 0.55;
  gl_FragColor = vec4(col * (1.0 + uGlow * 0.6), 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function loadColorBetween(load: number, low: THREE.Color, mid: THREE.Color, high: THREE.Color, out: THREE.Color): THREE.Color {
  const t = Number.isFinite(load) ? Math.min(1, Math.max(0, load)) : 0;
  return t < 0.5 ? out.copy(low).lerp(mid, t * 2) : out.copy(mid).lerp(high, (t - 0.5) * 2);
}

/** Pipe ribbons with chevrons scrolling from → to at a speed set by load. */
export class FlowRibbons {
  readonly group = new THREE.Group();
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly phases: Float32Array;
  private readonly low = new THREE.Color('#39ffb0');
  private readonly mid = new THREE.Color('#ffd84d');
  private readonly high = new THREE.Color('#ff4d6d');

  constructor(grid: Grid, net: Network, kind: RibbonKind) {
    const byId = new Map(net.nodes.map((n) => [n.id, n]));
    const at = (n: DrainNode) =>
      new THREE.Vector3(worldX(grid, n.x), kind === 'xray' ? worldY(n.invert) : worldY(grid.z[n.cell] + 1), worldZ(grid, n.y));
    for (const p of net.pipes) {
      const a = at(byId.get(p.from)!);
      const b = at(byId.get(p.to)!);
      const radius = kind === 'xray' ? Math.max(1.2, p.diameter * 3) : Math.max(1.0, p.diameter * 2.5);
      const geom = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 8, radius, 8, false);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color() },
          uPhase: { value: 0 },
          uLen: { value: a.distanceTo(b) },
          uArrows: { value: 0 },
          uGlow: { value: kind === 'xray' ? 1 : 0 },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: kind === 'xray',
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.renderOrder = 11;
      this.mats.push(mat);
      this.group.add(mesh);
    }
    this.phases = new Float32Array(net.pipes.length);
  }

  setColors(low: string, mid: string, high: string): void {
    this.low.set(low);
    this.mid.set(mid);
    this.high.set(high);
  }

  update(frame: Frame | null, dtS: number): void {
    const f = frame && frame.pipeLoad.length === this.mats.length ? frame : null;
    for (let p = 0; p < this.mats.length; p++) {
      const load = f ? f.pipeLoad[p] : 0;
      const u = this.mats[p].uniforms;
      this.phases[p] = advancePhase(this.phases[p], dtS, load, (u.uLen.value as number) / CHEVRON_SPACING);
      u.uPhase.value = this.phases[p];
      u.uArrows.value = arrowsVisible(load) ? 1 : 0;
      loadColorBetween(load, this.low, this.mid, this.high, u.uColor.value as THREE.Color);
    }
  }

  dispose(): void {
    this.group.children.forEach((m) => (m as THREE.Mesh).geometry.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}
