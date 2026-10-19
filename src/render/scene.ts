import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Township } from '../scenario/interventions';
import type { Frame } from '../sim/types';
import { NetworkView } from './network';
import { createTerrainMesh } from './terrain';
import { WaterSurface } from './water';

export interface SceneHandle {
  canvas: HTMLCanvasElement;
  setTownship(t: Township): void;
  showFrame(f: Frame | null): void;
  /** ndc in [-1, 1]; returns the id of the drain node under the pointer, if any. */
  pickNode(ndcX: number, ndcY: number): string | null;
}

export function createScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe3f3');
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  camera.position.set(-120, 380, 520);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 20, 0);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(200, 400, 100);
  scene.add(sun);

  let township: Township | null = null;
  let terrain: THREE.Mesh | null = null;
  let water: WaterSurface | null = null;
  let network: NetworkView | null = null;
  let frame: Frame | null = null;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    controls.update();
    network?.update(frame, clock.getElapsedTime());
    renderer.render(scene, camera);
  });

  const raycaster = new THREE.Raycaster();

  return {
    canvas: renderer.domElement,
    setTownship(t) {
      for (const obj of [terrain]) {
        if (!obj) continue;
        scene.remove(obj);
        obj.geometry.dispose();
      }
      if (water) {
        scene.remove(water.mesh);
        water.dispose();
      }
      if (network) {
        scene.remove(network.group);
        network.dispose();
      }
      township = t;
      terrain = createTerrainMesh(t.grid);
      water = new WaterSurface(t.grid);
      network = new NetworkView(t.grid, t.network);
      scene.add(terrain, water.mesh, network.group);
      frame = null;
    },
    showFrame(f) {
      frame = f;
      if (water && township) water.update(f ? f.depth : township.grid.h0);
    },
    pickNode(ndcX, ndcY) {
      if (!network) return null;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hit = raycaster.intersectObjects(network.nodeMeshes, false)[0];
      return hit ? (hit.object.userData.nodeId as string) : null;
    },
  };
}
