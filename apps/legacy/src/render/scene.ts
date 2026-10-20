import * as THREE from 'three';
import type { InterventionId, Township } from '@floodops/engine/scenario/interventions';
import { cellAt } from '@floodops/engine/scenario/terrain';
import type { Frame } from '@floodops/engine/sim/types';
import { CameraRig, type ViewMode } from './cameras';
import { worldX, worldY, worldZ } from './coords';
import { FpsGuard } from './fpsGuard';
import { NetworkView, type NetworkMode } from './network';
import { PinLayer, type PinItem } from './pins';
import { PostFx } from './postfx';
import { Rain } from './rain';
import { SkirtView } from './skirt';
import { createSky } from './sky';
import { createTerrain, type TerrainView } from './terrain';
import { blendThemeInto, DAY, type Theme } from './theme';
import { placeTrees, TreesView } from './trees';
import { WaterSurface } from './water';

export type PinSpec = Omit<PinItem, 'position'> & { x: number; y: number };
export type Quality = 'high' | 'low';

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
  setXray(on: boolean): void;
  setView(view: ViewMode): void;
  setQuality(q: Quality): void;
  onQualityAutoDrop(fn: () => void): void;
  onNotice(fn: (text: string) => void): void;
  planMetresPerPixel(): number;
}

const PIN_LIFT = 14; // world units above ground
const XRAY_FADE_S = 0.6;
const SITE_SIZE = 290; // Taman Kyra grid: 145 cells × 2 m
const SUN_ELEV = THREE.MathUtils.degToRad(40);
// From the south-west: west = −X, south = +Z.
const SUN_DIR = new THREE.Vector3(-Math.cos(SUN_ELEV) * Math.SQRT1_2, Math.sin(SUN_ELEV), Math.cos(SUN_ELEV) * Math.SQRT1_2);

export function createScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(DAY.skyHorizon);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  scene.fog = new THREE.Fog(DAY.fog, DAY.fogNear, DAY.fogFar);

  const rig = new CameraRig(renderer.domElement, SITE_SIZE);

  const hemi = new THREE.HemisphereLight('#ffffff', '#d8d2c4', 0.9);
  const sun = new THREE.DirectionalLight('#fff2df', 1.6);
  sun.position.copy(SUN_DIR).multiplyScalar(800);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -380;
  sc.right = 380;
  sc.top = 380;
  sc.bottom = -380;
  sc.near = 1;
  sc.far = 2000;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0005;
  scene.add(hemi, sun, sun.target);

  const pins = new PinLayer(container);
  scene.add(pins.group);
  rig.onStart(() => pins.closePopover());
  const post = new PostFx(renderer, scene, rig.active);

  let township: Township | null = null;
  let terrain: TerrainView | null = null;
  let water: WaterSurface | null = null;
  let network: NetworkView | null = null;
  let rain: Rain | null = null;
  let trees: TreesView | null = null;
  let skirt: SkirtView | null = null;
  let frame: Frame | null = null;
  let pinSpecs: PinSpec[] | null = null;
  let pinsBuilt = false;
  let quality: Quality = 'high';
  let xrayOn = false;
  let xrayT = 0;
  let view: ViewMode = '3d';
  let waterFallback = false;
  let prewarmed = false;
  let notice: (text: string) => void = () => {};
  let autoDrop: () => void = () => {};
  const guard = new FpsGuard();

  const networkMode = (): NetworkMode => (view === 'plan' ? 'plan' : xrayT >= 0.5 ? 'xray' : 'day');

  const themeScratch: Theme = blendThemeInto(0, { ...DAY });
  const currentTheme = () => blendThemeInto(xrayT, themeScratch);

  const applyTheme = (th: Theme) => {
    sky.setColors(th.skyTop, th.skyHorizon);
    const fog = scene.fog as THREE.Fog;
    fog.color.set(th.fog);
    // Plan camera sits ~2000 units up; keep the fog out of the way so the terrain is not flattened to fog colour.
    fog.near = view === 'plan' ? 1e5 : th.fogNear;
    fog.far = view === 'plan' ? 2e5 : th.fogFar;
    renderer.setClearColor(th.skyHorizon);
    hemi.color.set(th.hemiSky);
    hemi.groundColor.set(th.hemiGround);
    hemi.intensity = th.hemiIntensity;
    sun.color.set(th.sunColor);
    sun.intensity = th.sunIntensity;
    terrain?.setOpacity(th.terrainOpacity);
    terrain?.setLook(xrayT >= 0.5 ? 'xray' : 'day');
    trees?.setScale(view === 'plan' ? 0 : th.treeScale);
    skirt?.setColors(th.skirtTop, th.skirtBottom, th.skirtRiver);
    water?.setTheme(th);
    network?.setPipeColors(th.pipeLow, th.pipeMid, th.pipeHigh);
    network?.setMode(networkMode());
    post.setBloom(quality === 'high' ? th.bloom : 0);
    container.classList.toggle('xray', xrayT >= 0.5);
  };

  const rebuildTerrain = () => {
    if (!township) return;
    if (terrain) {
      scene.remove(terrain.mesh);
      terrain.dispose();
    }
    terrain = createTerrain(township.grid, quality === 'high' ? 2048 : 1024);
    scene.add(terrain.mesh);
  };

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
    pins.closePopover();
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    pins.setSize(w, h);
    post.setSize(w, h);
    rig.resize(w, h);
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const setQuality = (q: Quality) => {
    if (q === quality) return;
    quality = q;
    const ratio = q === 'high' ? Math.min(window.devicePixelRatio, 2) : 1;
    renderer.setPixelRatio(ratio);
    post.setPixelRatio(ratio);
    renderer.shadowMap.enabled = q === 'high';
    sun.castShadow = q === 'high' && view === '3d';
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) (Array.isArray(m) ? m : [m]).forEach((x) => (x.needsUpdate = true));
    });
    water?.setRipples(q === 'high');
    rebuildTerrain();
    applyTheme(currentTheme());
    resize();
  };

  let genericShaderNotice = false;
  renderer.debug.onShaderError = (gl, _program, vs, fs) => {
    console.error('Shader compile failed', gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
    const src = (sh: WebGLShader) => gl.getShaderSource(sh) ?? '';
    if (src(vs).includes('aDepth') || src(fs).includes('aDepth')) {
      if (!waterFallback) {
        waterFallback = true;
        water?.useFallback();
        applyTheme(currentTheme());
        notice('Using simplified water shading (the graphics driver could not compile the water shader).');
      }
    } else if (!genericShaderNotice) {
      genericShaderNotice = true;
      notice('Some graphics effects could not be compiled on this device and may look wrong.');
    }
  };

  renderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    notice('Graphics reset — reloading view…');
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    const now = clock.elapsedTime;
    const target = xrayOn ? 1 : 0;
    if (xrayT !== target) {
      xrayT = target > xrayT ? Math.min(1, xrayT + dt / XRAY_FADE_S) : Math.max(0, xrayT - dt / XRAY_FADE_S);
      applyTheme(currentTheme());
    }
    rig.update(now);
    rain?.update(dt);
    water?.tick(now);
    network?.update(frame, now);
    const cam = rig.active;
    if (post.active) {
      post.setCamera(cam);
      post.render();
    } else {
      renderer.render(scene, cam);
    }
    pins.render(scene, cam);
    if (quality === 'high' && guard.tick(dt)) {
      setQuality('low');
      autoDrop();
      notice('Switched to Low quality for smoother playback — change it in the toolbar.');
    }
  });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const handle: SceneHandle = {
    canvas: renderer.domElement,
    setTownship(t) {
      township = t;
      rebuildTerrain();
      if (water) {
        scene.remove(water.mesh);
        water.dispose();
      }
      if (network) {
        scene.remove(network.group);
        network.dispose();
      }
      water = new WaterSurface(t.grid);
      water.setRipples(quality === 'high');
      if (waterFallback) water.useFallback();
      network = new NetworkView(t.grid, t.network);
      scene.add(water.mesh, network.group);
      if (!rain) {
        rain = new Rain(t.grid.nx * t.grid.dx, t.grid.ny * t.grid.dx);
        scene.add(rain.object);
      }
      if (!trees) {
        trees = new TreesView(t.grid, placeTrees(t.grid, t.network.nodes));
        scene.add(trees.mesh);
      }
      if (!skirt) {
        skirt = new SkirtView(t.grid);
        scene.add(skirt.mesh);
      }
      if (!pinsBuilt) buildPins();
      frame = null;
      applyTheme(currentTheme());
      if (!prewarmed) {
        prewarmed = true;
        renderer.compile(scene, rig.active);
        const warm = () => terrain?.warm('xray');
        if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 3000 });
        else setTimeout(warm, 1500);
      }
    },
    showFrame(f) {
      frame = f;
      if (water && township) water.update(f ? f.depth : township.grid.h0);
    },
    pickNode(ndcX, ndcY) {
      if (!network) return null;
      raycaster.setFromCamera(ndc.set(ndcX, ndcY), rig.active);
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
    setXray(on) {
      pins.closePopover();
      xrayOn = on;
    },
    setView(v) {
      pins.closePopover();
      view = v;
      rig.setView(v);
      sun.castShadow = quality === 'high' && v === '3d';
      applyTheme(currentTheme());
    },
    setQuality,
    onQualityAutoDrop(fn) {
      autoDrop = fn;
    },
    onNotice(fn) {
      notice = fn;
    },
    planMetresPerPixel() {
      return rig.metresPerPixel();
    },
  };

  renderer.domElement.addEventListener('webglcontextrestored', () => {
    if (township) handle.setTownship(township);
    notice('Graphics restored.');
  });

  return handle;
}
