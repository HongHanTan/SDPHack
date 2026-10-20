import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { InterventionId, Township } from '../scenario/interventions';
import { cellAt } from '../scenario/terrain';
import type { Frame } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';
import { NetworkView } from './network';
import { PinLayer, type PinItem } from './pins';
import { Rain } from './rain';
import { createTerrainMesh } from './terrain';
import { WaterSurface } from './water';

export type PinSpec = Omit<PinItem, 'position'> & { x: number; y: number };

export interface SceneHandle {
  canvas: HTMLCanvasElement;
  setTownship(t: Township): void;
  showFrame(f: Frame | null): void;
  /** ndc in [-1, 1]; returns the id of the drain node under the pointer, if any. */
  pickNode(ndcX: number, ndcY: number): string | null;
  setRain(mmHr: number): void;
  setPins(specs: PinSpec[]): void;
  setInstalled(ids: ReadonlySet<InterventionId>): void;
  setPinsVisible(visible: boolean): void;
  setPinsDisabled(disabled: boolean): void;
  onPinToggle(fn: (id: InterventionId, on: boolean) => void): void;
}

const PIN_LIFT = 14; // world units above ground

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

  const pins = new PinLayer(container);
  scene.add(pins.group);

  let township: Township | null = null;
  let terrain: THREE.Mesh | null = null;
  let water: WaterSurface | null = null;
  let network: NetworkView | null = null;
  let rain: Rain | null = null;
  let frame: Frame | null = null;
  let pinSpecs: PinSpec[] | null = null;
  let pinsBuilt = false;

  const buildPins = () => {
    if (!township || !pinSpecs) return;
    const g = township.grid;
    pins.setItems(
      pinSpecs.map(({ x, y, ...rest }) => ({
        ...rest,
        position: new THREE.Vector3(worldX(g, x), worldY(g.z[cellAt(x, y)]) + PIN_LIFT, worldZ(g, y)),
      })),
    );
    pinsBuilt = true;
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    pins.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    controls.update();
    rain?.update(dt);
    network?.update(frame, clock.elapsedTime);
    renderer.render(scene, camera);
    pins.render(scene, camera);
  });

  const raycaster = new THREE.Raycaster();

  return {
    canvas: renderer.domElement,
    setTownship(t) {
      if (terrain) {
        scene.remove(terrain);
        terrain.geometry.dispose();
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
      if (!rain) {
        rain = new Rain(t.grid.nx * t.grid.dx, t.grid.ny * t.grid.dx);
        scene.add(rain.object);
      }
      if (!pinsBuilt) buildPins();
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
    setRain(mmHr) {
      rain?.setIntensity(mmHr);
    },
    setPins(specs) {
      pinSpecs = specs;
      buildPins();
    },
    setInstalled(ids) {
      pins.setInstalled(ids);
    },
    setPinsVisible(v) {
      pins.setVisible(v);
    },
    setPinsDisabled(b) {
      pins.setDisabled(b);
    },
    onPinToggle(fn) {
      pins.setOnToggle(fn);
    },
  };
}
