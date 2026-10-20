import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export type ViewMode = '3d' | 'plan';

const SWITCH_S = 0.5;
const MARGIN_PX = 16;

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

/** 3D orbit camera + top-down orthographic plan camera (north up, pan/zoom only) with an animated switch. */
export class CameraRig {
  readonly persp = new THREE.PerspectiveCamera(50, 1, 1, 6000);
  readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 5000);
  readonly orbit: OrbitControls;
  readonly pan: OrbitControls;
  private view: ViewMode = '3d';
  private usingOrtho = false;
  private saved: Pose = { pos: new THREE.Vector3(-120, 380, 520), target: new THREE.Vector3(0, 20, 0) };
  private anim: { from: Pose; to: Pose; start: number | null; then: () => void } | null = null;
  private w = 1;
  private h = 1;
  private readonly scratch = new THREE.Vector3();

  constructor(dom: HTMLElement, private readonly siteSize: number) {
    this.persp.position.copy(this.saved.pos);
    this.orbit = new OrbitControls(this.persp, dom);
    this.orbit.target.copy(this.saved.target);
    this.orbit.enableDamping = true;
    this.orbit.maxDistance = 1300;
    this.orbit.maxPolarAngle = Math.PI * 0.48;

    this.ortho.position.set(0, 2000, 0);
    this.ortho.up.set(0, 0, -1); // north (−Z) at the top of the screen
    this.ortho.lookAt(0, 0, 0);
    this.pan = new OrbitControls(this.ortho, dom);
    this.pan.enableRotate = false;
    this.pan.screenSpacePanning = true;
    this.pan.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.pan.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.pan.enabled = false;
  }

  get active(): THREE.Camera {
    return this.usingOrtho ? this.ortho : this.persp;
  }

  get mode(): ViewMode {
    return this.view;
  }

  onStart(fn: () => void): void {
    this.orbit.addEventListener('start', fn);
    this.pan.addEventListener('start', fn);
  }

  resize(w: number, h: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.persp.aspect = this.w / this.h;
    this.persp.updateProjectionMatrix();
    const mpp = Math.max(this.siteSize / Math.max(1, this.w - 2 * MARGIN_PX), this.siteSize / Math.max(1, this.h - 2 * MARGIN_PX));
    this.ortho.left = (-this.w * mpp) / 2;
    this.ortho.right = (this.w * mpp) / 2;
    this.ortho.top = (this.h * mpp) / 2;
    this.ortho.bottom = (-this.h * mpp) / 2;
    this.ortho.updateProjectionMatrix();
  }

  /** World metres per screen pixel in plan view (for the scale bar). */
  metresPerPixel(): number {
    return (this.ortho.right - this.ortho.left) / this.ortho.zoom / this.w;
  }

  setView(v: ViewMode): void {
    if (v === this.view) return;
    this.view = v;
    // Perspective height whose frame matches the ortho frame (half-height = ortho.top / zoom).
    const topHeight = this.ortho.top / Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2));
    const top: Pose = { pos: new THREE.Vector3(0, topHeight, 0.01), target: new THREE.Vector3(0, 0, 0) };
    if (v === 'plan') {
      this.saved = { pos: this.persp.position.clone(), target: this.orbit.target.clone() };
      this.orbit.enabled = false;
      this.animate({ pos: this.persp.position.clone(), target: this.orbit.target.clone() }, top, () => {
        this.usingOrtho = true;
        this.ortho.zoom = 1;
        this.ortho.position.set(0, 2000, 0);
        this.pan.target.set(0, 0, 0);
        this.ortho.updateProjectionMatrix();
        this.pan.enabled = true;
      });
    } else {
      this.pan.enabled = false;
      this.usingOrtho = false;
      this.persp.position.copy(top.pos);
      this.animate(top, this.saved, () => {
        this.orbit.target.copy(this.saved.target);
        this.orbit.enabled = true;
      });
    }
  }

  update(nowS: number): void {
    if (this.anim) {
      const a = this.anim;
      if (a.start === null) a.start = nowS;
      const k = Math.min(1, (nowS - a.start) / SWITCH_S);
      const e = k * k * (3 - 2 * k);
      this.persp.position.lerpVectors(a.from.pos, a.to.pos, e);
      const target = this.scratch.lerpVectors(a.from.target, a.to.target, e);
      this.persp.lookAt(target);
      if (k >= 1) {
        this.anim = null;
        a.then();
      }
      return;
    }
    if (this.usingOrtho) this.pan.update();
    else this.orbit.update();
  }

  private animate(from: Pose, to: Pose, then: () => void): void {
    this.anim = { from, to, start: null, then };
  }
}
