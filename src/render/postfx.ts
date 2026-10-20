import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

/** Bloom chain, used only while bloom strength > 0 (x-ray on High quality). */
export class PostFx {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
    this.renderPass = new RenderPass(scene, camera);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0, 0.4, 0.6);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  get active(): boolean {
    return this.bloom.strength > 0.001;
  }

  setBloom(k: number): void {
    this.bloom.strength = 0.9 * Math.max(0, k);
  }

  setCamera(cam: THREE.Camera): void {
    this.renderPass.camera = cam;
  }

  setSize(w: number, h: number): void {
    this.composer.setSize(w, h);
  }

  setPixelRatio(r: number): void {
    this.composer.setPixelRatio(r);
  }

  render(): void {
    this.composer.render();
  }
}
