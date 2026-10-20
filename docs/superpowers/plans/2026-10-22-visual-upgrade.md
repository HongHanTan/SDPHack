# Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three.js township look presentation-ready while keeping it light. The work covers:
- an "architectural model" day look;
- a "digital twin" x-ray look with underground pipes and flow arrows;
- a map-style plan view;
- better water, lighting and pins.

**Architecture:**
- Pure helpers (theme blending, FPS guard, flow-arrow maths, depth smoothing, tree placement, ground colours) are unit-tested in Node.
- Rendering modules (ground texture, trees, skirt, water shader, flow ribbons, sky, cameras, post-FX) each own one visual.
- `scene.ts` stays the conductor. It blends the day and x-ray themes over 600 ms and exposes `setXray`, `setView` and `setQuality`.
- Only three.js 0.169 and its bundled addons are used. Simulation, worker and scenario code are untouched.

**Tech Stack:** TypeScript 5, Vite 5, three.js 0.169 (addons: OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, BufferGeometryUtils), Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-22-visual-upgrade-design.md`

## Global Constraints

- **No new npm dependencies and no downloaded assets.** All textures are generated in code.
- **Do not modify `src/sim/`, `src/worker/` or `src/scenario/`.** This is rendering and UI only.
- **Live and Compare modes keep working unchanged.** `SceneHandle` only gains members.
- **Day palette:**

  | Element | Values |
  |---|---|
  | Sky | `#f6f3ee` → `#dde9f2` |
  | Fog | `#e9eef2`, near 900, far 1800 |
  | Hemisphere light | `#ffffff` / `#d8d2c4`, 0.9 |
  | Sun | `#fff2df`, 1.6, from the SW at 40° |
  | Tone mapping | ACES filmic, exposure 1.0 |
  | Water | `#bfe3ec` (0 m) → `#2b7fb8` (≥ 1 m); opacity 0.25 → 0.85 (≥ 0.5 m); foam where 0.01 < d < 0.04 at 60% white |
  | Skirt | topsoil `#b9a887` (0.6 m), clay `#cbbfa8`, river face `#7fb8cf`; base at −4 m |
  | Trees | canopy `#9cc29a`, trunk `#b8a58a`; 400 trees, seed 42 |

- **Day ground fills:**

  | Land use | Colour |
  |---|---|
  | lawn | `#dfe6d3`, ±3% lightness noise |
  | road | `#f4f1ea`, kerb lines `#e2ddd2` |
  | roof | `#fbfaf7`, soft shadow to the SE |
  | park | `#cfdcc0` |
  | pond | `#cfe0e0` |
  | river | `#9fd0e0` |
  | bioswale | `#c7d9b5` |

- **X-ray palette:**

  | Element | Values |
  |---|---|
  | Ground | `#142033`; road outlines `#2e4a6e`; lot outlines `#22344f` |
  | Terrain opacity | 0.35 |
  | Trees | scale to 0 |
  | Skirt | `#1c2c44` |
  | Sky | `#0a111c` (top) → `#1b2a41` (horizon) |
  | Fog | off |
  | Water | `#19c3ff` → `#0d6fb5`, opacity 0.55, emissive |
  | Pipes | `#39ffb0` → `#ffd84d` → `#ff4d6d` |
  | Bloom | UnrealBloom strength 0.9, radius 0.4, threshold 0.6, only while x-ray t > 0 |

- **Transitions and pipe drawing:**
  - The x-ray transition takes 600 ms and the plan-view camera switch 500 ms.
  - Flow-arrow speed is `0.2 + 1.8·clamp(load, 0, 1)` ribbon-lengths per second, with no arrows when load < 0.02.
  - X-ray ribbons sit at the pipe's invert elevation, radius `max(1.2, d·3)`.
  - Plan ribbons sit at ground + 1 m.
  - The plan view uses an orthographic camera straight down, north at the top, a 16 px margin, and pan/zoom only.
- **Pins:** 28 px round badges with a 10 px stem.

  | State | Day | X-ray |
  |---|---|---|
  | installed | `#2b8a8a` fill | `#19c3ff` fill |
  | available | white fill, `#2b8a8a` ring | `#0f1b2c` fill, `#19c3ff` ring |

- **Quality:**

  | Setting | High | Low |
  |---|---|---|
  | Shadow map | 2048² | shadows off |
  | Bloom | on | off |
  | Water ripples | on | off |
  | Ground texture | 2048² | 1024² |
  | Pixel ratio | min(dpr, 2) | 1 |

  Auto-drop from High to Low happens at most once per session, after a 3-second average below 30 fps.
- **Error handling:**
  - If the water shader fails to compile, fall back to `MeshPhongMaterial` water.
  - On WebGL context loss, show a notice and rebuild when the context is restored.
- **No per-frame allocations** in the render loop.
- **Commits:** commit after every task, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

```
src/render/theme.ts          Theme, DAY, XRAY, lerpHex, blendTheme            (Task 1)
src/render/fpsGuard.ts       FpsGuard                                         (Task 1)
src/render/flowMath.ts       arrowSpeed, arrowsVisible, advancePhase          (Task 1)
src/render/smoothDepth.ts    smoothDepth, WET                                 (Task 1)
src/render/rng.ts            mulberry32                                       (Task 2)
src/render/groundTexture.ts  GROUND, landColor, isBioswale, paintGround       (Task 2)
src/render/trees.ts          treeCellAllowed, placeTrees, TreesView           (Task 2)
src/render/skirt.ts          SkirtView                                        (Task 2)
src/render/terrain.ts        createTerrain → TerrainView (+ compat wrapper)   (Task 2)
src/render/waterMaterial.ts  createWaterMaterial                              (Task 3)
src/render/water.ts          WaterSurface (shader, smoothing, theme, fallback) (Task 3)
src/render/flowRibbons.ts    FlowRibbons, loadColorBetween                    (Task 4)
src/render/network.ts        NetworkView modes day/xray/plan                  (Task 4)
src/render/sky.ts            createSky                                        (Task 5)
src/render/cameras.ts        CameraRig (3D orbit + plan ortho)                (Task 5)
src/render/postfx.ts         PostFx (bloom)                                   (Task 5)
src/render/scene.ts          conductor rewrite                                (Task 5)
index.html, src/ui/styles.css, src/main.ts   toolbar, plan overlay, pins      (Task 6)
docs/browser-checklist.md, README.md                                          (Task 7)
tests/render/helpers.test.ts, tests/render/ground.test.ts
```

---

### Task 1: Pure render helpers — theme, FPS guard, flow maths, depth smoothing

**Files:**
- Create: `src/render/theme.ts`, `src/render/fpsGuard.ts`, `src/render/flowMath.ts`, `src/render/smoothDepth.ts`
- Test: `tests/render/helpers.test.ts`

**Interfaces:**
- Produces:
  - `Theme` (keys below), `DAY`, `XRAY`, `lerpHex(a, b, t): string`, `blendTheme(t): Theme`;
  - `class FpsGuard(minFps = 30, windowS = 3, maxGapS = 0.5)` with `tick(dtS): boolean`;
  - `MIN_ARROW_LOAD`, `arrowSpeed(load)`, `arrowsVisible(load)`, `advancePhase(phase, dtS, load)`;
  - `WET = 0.01` and `smoothDepth(depth, nx, ny, out: Float32Array): Float32Array`.

- [ ] **Step 1: Write the failing tests**

Create `tests/render/helpers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advancePhase, arrowSpeed, arrowsVisible } from '../../src/render/flowMath';
import { FpsGuard } from '../../src/render/fpsGuard';
import { smoothDepth } from '../../src/render/smoothDepth';
import { blendTheme, DAY, lerpHex, XRAY } from '../../src/render/theme';

describe('theme', () => {
  it('blends between day and x-ray', () => {
    expect(blendTheme(0)).toEqual(DAY);
    expect(blendTheme(1)).toEqual(XRAY);
    expect(blendTheme(-1)).toEqual(DAY);
    expect(blendTheme(2)).toEqual(XRAY);
    expect(blendTheme(0.5).terrainOpacity).toBeCloseTo((DAY.terrainOpacity + XRAY.terrainOpacity) / 2, 12);
  });
  it('interpolates hex colours per channel', () => {
    expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpHex('#102030', '#102030', 0.3)).toBe('#102030');
  });
});

describe('FpsGuard', () => {
  it('never fires at a steady 60 fps', () => {
    const g = new FpsGuard();
    for (let k = 0; k < 600; k++) expect(g.tick(1 / 60)).toBe(false);
  });
  it('fires once after a full 3 s window below 30 fps', () => {
    const g = new FpsGuard();
    const fired: boolean[] = [];
    for (let k = 0; k < 120; k++) fired.push(g.tick(1 / 20));
    expect(fired.filter(Boolean).length).toBe(1);
    expect(fired.indexOf(true)).toBe(59);
  });
  it('restarts its window after a long gap (hidden tab)', () => {
    const g = new FpsGuard();
    for (let k = 0; k < 40; k++) g.tick(1 / 20);
    expect(g.tick(5)).toBe(false);
    const fired: boolean[] = [];
    for (let k = 0; k < 60; k++) fired.push(g.tick(1 / 20));
    expect(fired.indexOf(true)).toBe(59);
  });
});

describe('flow maths', () => {
  it('maps load to arrow speed', () => {
    expect(arrowSpeed(0)).toBeCloseTo(0.2, 12);
    expect(arrowSpeed(1)).toBeCloseTo(2.0, 12);
    expect(arrowSpeed(5)).toBeCloseTo(2.0, 12);
    expect(arrowSpeed(0.5)).toBeGreaterThan(arrowSpeed(0.25));
    expect(arrowSpeed(Number.NaN)).toBeCloseTo(0.2, 12);
  });
  it('hides arrows below 2% load', () => {
    expect(arrowsVisible(0.019)).toBe(false);
    expect(arrowsVisible(0.02)).toBe(true);
  });
  it('advances and wraps the phase', () => {
    expect(advancePhase(0, 0.5, 1)).toBeCloseTo(0, 12);
    expect(advancePhase(0.9, 0.1, 0)).toBeCloseTo(0.92, 12);
    expect(advancePhase(0.3, -1, 1)).toBeCloseTo(0.3, 12);
  });
});

describe('smoothDepth', () => {
  it('leaves a uniform wet field unchanged and keeps dry cells dry', () => {
    const nx = 4;
    const ny = 3;
    const d = new Float32Array(nx * ny).fill(0.5);
    d[0] = 0;
    const out = smoothDepth(d, nx, ny, new Float32Array(nx * ny));
    expect(out[0]).toBe(0);
    expect(out[5]).toBeCloseTo(0.5, 6);
  });
  it('averages wet neighbours', () => {
    const nx = 3;
    const ny = 3;
    const d = new Float32Array([1, 0.5, 1, 0.5, 1, 0.5, 1, 0.5, 1]);
    const out = smoothDepth(d, nx, ny, new Float32Array(9));
    expect(out[4]).toBeCloseTo(7 / 9, 6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/helpers.test.ts`
Expected: FAIL. The modules cannot be resolved.

- [ ] **Step 3: Implement the theme**

Create `src/render/theme.ts`:

```ts
/** Every colour/number that differs between the day look and the x-ray look. Colours are lowercase #rrggbb. */
export interface Theme {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  terrainOpacity: number;
  treeScale: number;
  skirtTop: string;
  skirtBottom: string;
  skirtRiver: string;
  waterShallow: string;
  waterDeep: string;
  waterOpacityMin: number;
  waterOpacityMax: number;
  waterEmissive: number;
  pipeLow: string;
  pipeMid: string;
  pipeHigh: string;
  bloom: number;
}

export const DAY: Theme = {
  skyTop: '#f6f3ee',
  skyHorizon: '#dde9f2',
  fog: '#e9eef2',
  fogNear: 900,
  fogFar: 1800,
  hemiSky: '#ffffff',
  hemiGround: '#d8d2c4',
  hemiIntensity: 0.9,
  sunColor: '#fff2df',
  sunIntensity: 1.6,
  terrainOpacity: 1,
  treeScale: 1,
  skirtTop: '#b9a887',
  skirtBottom: '#cbbfa8',
  skirtRiver: '#7fb8cf',
  waterShallow: '#bfe3ec',
  waterDeep: '#2b7fb8',
  waterOpacityMin: 0.25,
  waterOpacityMax: 0.85,
  waterEmissive: 0,
  pipeLow: '#2ecc71',
  pipeMid: '#f1c40f',
  pipeHigh: '#e74c3c',
  bloom: 0,
};

export const XRAY: Theme = {
  skyTop: '#0a111c',
  skyHorizon: '#1b2a41',
  fog: '#0a111c',
  fogNear: 100000,
  fogFar: 200000,
  hemiSky: '#9fb4cc',
  hemiGround: '#0a111c',
  hemiIntensity: 0.6,
  sunColor: '#9fb4cc',
  sunIntensity: 0.3,
  terrainOpacity: 0.35,
  treeScale: 0,
  skirtTop: '#1c2c44',
  skirtBottom: '#1c2c44',
  skirtRiver: '#1c2c44',
  waterShallow: '#19c3ff',
  waterDeep: '#0d6fb5',
  waterOpacityMin: 0.55,
  waterOpacityMax: 0.55,
  waterEmissive: 1,
  pipeLow: '#39ffb0',
  pipeMid: '#ffd84d',
  pipeHigh: '#ff4d6d',
  bloom: 1,
};

export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const mix = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + [16, 8, 0].map((s) => mix(s).toString(16).padStart(2, '0')).join('');
}

/** t = 0 → DAY, t = 1 → XRAY; colours per channel, numbers linearly. */
export function blendTheme(t: number): Theme {
  if (!(t > 0)) return { ...DAY };
  if (t >= 1) return { ...XRAY };
  const out: Record<string, string | number> = {};
  for (const key of Object.keys(DAY) as Array<keyof Theme>) {
    const a = DAY[key];
    const b = XRAY[key];
    out[key] = typeof a === 'string' ? lerpHex(a, b as string, t) : a + ((b as number) - a) * t;
  }
  return out as unknown as Theme;
}
```

- [ ] **Step 4: Implement the FPS guard, flow maths and depth smoothing**

Create `src/render/fpsGuard.ts`:

```ts
/** Detects a sustained low frame rate. Fires at most once. */
export class FpsGuard {
  private elapsed = 0;
  private frames = 0;
  private fired = false;

  constructor(
    private readonly minFps = 30,
    private readonly windowS = 3,
    private readonly maxGapS = 0.5,
  ) {}

  /** Feed one rendered frame's dt (s). True exactly once: the first full window averaging below minFps. */
  tick(dtS: number): boolean {
    if (this.fired) return false;
    if (!(dtS > 0) || dtS > this.maxGapS) {
      // hidden tab or a one-off hitch: start a fresh window
      this.elapsed = 0;
      this.frames = 0;
      return false;
    }
    this.elapsed += dtS;
    this.frames++;
    if (this.elapsed < this.windowS - 1e-9) return false;
    const fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    if (fps < this.minFps) {
      this.fired = true;
      return true;
    }
    return false;
  }
}
```

Create `src/render/flowMath.ts`:

```ts
export const MIN_ARROW_LOAD = 0.02;

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Ribbon-lengths per second. */
export function arrowSpeed(load: number): number {
  return 0.2 + 1.8 * clamp01(load);
}

export function arrowsVisible(load: number): boolean {
  return load >= MIN_ARROW_LOAD;
}

/** Advances a chevron phase in [0, 1). */
export function advancePhase(phase: number, dtS: number, load: number): number {
  const p = (phase + arrowSpeed(load) * Math.max(0, dtS)) % 1;
  return p < 0 ? p + 1 : p;
}
```

Create `src/render/smoothDepth.ts`:

```ts
export const WET = 0.01; // m

/** Display-only 3×3 smoothing of wet depths so the flood reads as one sheet; dry cells stay exactly 0. */
export function smoothDepth(depth: ArrayLike<number>, nx: number, ny: number, out: Float32Array): Float32Array {
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      if (!(depth[c] > WET)) {
        out[c] = 0;
        continue;
      }
      let s = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = j + dj;
        if (jj < 0 || jj >= ny) continue;
        for (let di = -1; di <= 1; di++) {
          const ii = i + di;
          if (ii < 0 || ii >= nx) continue;
          const v = depth[jj * nx + ii];
          if (v > WET) {
            s += v;
            n++;
          }
        }
      }
      out[c] = s / n;
    }
  }
  return out;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/render/helpers.test.ts`
Expected: PASS, 10 tests.

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass and tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/render/theme.ts src/render/fpsGuard.ts src/render/flowMath.ts src/render/smoothDepth.ts tests/render/helpers.test.ts
git commit -m "feat(render): theme blending, fps guard, flow-arrow maths, depth smoothing"
```

---

### Task 2: Ground texture, trees, soil skirt, textured terrain

**Files:**
- Create: `src/render/rng.ts`, `src/render/groundTexture.ts`, `src/render/trees.ts`, `src/render/skirt.ts`
- Modify: `src/render/terrain.ts` (full replacement)
- Test: `tests/render/ground.test.ts`

**Interfaces:**
- Consumes:
  - `LandUse`, `Grid` (`src/sim/types.ts`); `INFIL_BY_LAND`, `cellAt` (`src/scenario/terrain.ts`);
  - `BOULEVARD_I` (`src/scenario/config.ts`); `worldX`, `worldY`, `worldZ`, `VERT` (`src/render/coords.ts`);
  - `createGridGeometry` (`src/render/gridGeometry.ts`).
- Produces:
  - `mulberry32(seed): () => number`;
  - `type Look = 'day' | 'xray'`, `GROUND`, `landColor(code, look, bioswale?)`, `isBioswale(grid, c)`, `paintGround(grid, look, size): THREE.CanvasTexture`;
  - `TREE_COUNT = 400`, `NODE_CLEARANCE_M = 6`, `treeCellAllowed(grid, c)`, `placeTrees(grid, nodes, seed?, count?)` returning `TreeSpot[] { x, y, scale }`;
  - `class TreesView(grid, spots)` with `mesh` and `setScale(s)`;
  - `class SkirtView(grid)` with `mesh` and `setColors(top, bottom, river)`;
  - `TerrainView { mesh; setLook(look); setOpacity(o); dispose() }` and `createTerrain(grid, textureSize)`;
  - the compatibility wrapper `createTerrainMesh(grid): THREE.Mesh`.

- [ ] **Step 1: Write the failing tests**

Create `tests/render/ground.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GROUND, isBioswale, landColor } from '../../src/render/groundTexture';
import { NODE_CLEARANCE_M, placeTrees, TREE_COUNT, treeCellAllowed } from '../../src/render/trees';
import { buildTownship } from '../../src/scenario/index';
import { LandUse } from '../../src/sim/types';

describe('ground colours', () => {
  it('uses the spec day palette', () => {
    expect(landColor(LandUse.LAWN, 'day')).toBe('#dfe6d3');
    expect(landColor(LandUse.ROAD, 'day')).toBe('#f4f1ea');
    expect(landColor(LandUse.ROOF, 'day')).toBe('#fbfaf7');
    expect(landColor(LandUse.PARK, 'day')).toBe('#cfdcc0');
    expect(landColor(LandUse.POND, 'day')).toBe('#cfe0e0');
    expect(landColor(LandUse.RIVER, 'day')).toBe('#9fd0e0');
    expect(landColor(LandUse.PARK, 'day', true)).toBe('#c7d9b5');
    expect(GROUND.day.roadEdge).toBe('#e2ddd2');
  });
  it('uses the spec x-ray palette', () => {
    expect(landColor(LandUse.LAWN, 'xray')).toBe('#142033');
    expect(GROUND.xray.roadEdge).toBe('#2e4a6e');
    expect(GROUND.xray.lotEdge).toBe('#22344f');
  });
  it('detects bioswale cells only when the preset is applied', () => {
    const base = buildTownship([]).grid;
    const swale = buildTownship(['bioswales']).grid;
    const count = (g: typeof base) => Array.from(g.land).filter((_l, c) => isBioswale(g, c)).length;
    expect(count(base)).toBe(0);
    expect(count(swale)).toBeGreaterThan(0);
  });
});

describe('placeTrees', () => {
  const t = buildTownship([]);
  const a = placeTrees(t.grid, t.network.nodes);

  it('is deterministic and places TREE_COUNT trees', () => {
    expect(placeTrees(t.grid, t.network.nodes)).toEqual(a);
    expect(a.length).toBe(TREE_COUNT);
    expect(a.length).toBeGreaterThanOrEqual(300);
    expect(a.length).toBeLessThanOrEqual(500);
  });

  it('only uses allowed cells, away from drain nodes, scale 0.8–1.2', () => {
    const { nx, dx } = t.grid;
    for (const s of a) {
      const c = Math.floor(s.y / dx) * nx + Math.floor(s.x / dx);
      expect(treeCellAllowed(t.grid, c)).toBe(true);
      for (const n of t.network.nodes) expect(Math.hypot(n.x - s.x, n.y - s.y)).toBeGreaterThanOrEqual(NODE_CLEARANCE_M);
      expect(s.scale).toBeGreaterThanOrEqual(0.8);
      expect(s.scale).toBeLessThanOrEqual(1.2);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/ground.test.ts`
Expected: FAIL. The modules cannot be resolved.

- [ ] **Step 3: RNG and ground texture**

Create `src/render/rng.ts`:

```ts
/** Small deterministic PRNG in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Create `src/render/groundTexture.ts`:

```ts
import * as THREE from 'three';
import { INFIL_BY_LAND } from '../scenario/terrain';
import { LandUse, type Grid } from '../sim/types';
import { mulberry32 } from './rng';

export type Look = 'day' | 'xray';

// fills indexed by LandUse code: ROOF, ROAD, LAWN, PARK, POND, RIVER
export const GROUND = {
  day: {
    fills: ['#fbfaf7', '#f4f1ea', '#dfe6d3', '#cfdcc0', '#cfe0e0', '#9fd0e0'],
    bioswale: '#c7d9b5',
    roadEdge: '#e2ddd2',
    lotEdge: null as string | null,
    lotShadow: 'rgba(60, 50, 30, 0.12)' as string | null,
  },
  xray: {
    fills: ['#142033', '#1d2d45', '#142033', '#142033', '#10283f', '#10283f'],
    bioswale: '#142033',
    roadEdge: '#2e4a6e',
    lotEdge: '#22344f' as string | null,
    lotShadow: null as string | null,
  },
};

/** Bioswale cells are PARK cells whose infiltration was raised by the bioswales preset. */
export function isBioswale(grid: Grid, c: number): boolean {
  return grid.land[c] === LandUse.PARK && grid.infil[c] > INFIL_BY_LAND[LandUse.PARK] + 1e-12;
}

export function landColor(code: number, look: Look, bioswale = false): string {
  const p = GROUND[look];
  return bioswale ? p.bioswale : p.fills[code];
}

/** Paints the land-use grid into a square texture (north at the top), matching the terrain's cell-centre UVs. */
export function paintGround(grid: Grid, look: Look, size: number): THREE.CanvasTexture {
  const { nx, ny, land } = grid;
  const s = size / nx;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const pal = GROUND[look];
  const rnd = mulberry32(7);
  const tmp = new THREE.Color();
  const px = (i: number) => i * s;
  const py = (j: number) => (ny - 1 - j) * s;

  for (let c = 0; c < nx * ny; c++) {
    if (land[c] === LandUse.ROOF) continue;
    const i = c % nx;
    const j = Math.floor(c / nx);
    let col = landColor(land[c], look, isBioswale(grid, c));
    if (look === 'day' && land[c] === LandUse.LAWN) col = tmp.set(col).offsetHSL(0, 0, (rnd() - 0.5) * 0.06).getStyle();
    ctx.fillStyle = col;
    ctx.fillRect(px(i), py(j), s + 0.5, s + 0.5);
  }

  const off = Math.max(1, s * 0.15);
  if (pal.lotShadow) {
    ctx.fillStyle = pal.lotShadow;
    for (let c = 0; c < nx * ny; c++) {
      if (land[c] !== LandUse.ROOF) continue;
      ctx.fillRect(px(c % nx) + off, py(Math.floor(c / nx)) + off, s, s);
    }
  }
  ctx.fillStyle = pal.fills[LandUse.ROOF];
  for (let c = 0; c < nx * ny; c++) {
    if (land[c] !== LandUse.ROOF) continue;
    ctx.fillRect(px(c % nx), py(Math.floor(c / nx)), s + 0.5, s + 0.5);
  }

  const edges = (pred: (c: number) => boolean, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        const here = pred(c);
        if (i < nx - 1 && here !== pred(c + 1)) {
          ctx.moveTo(px(i + 1), py(j));
          ctx.lineTo(px(i + 1), py(j) + s);
        }
        if (j < ny - 1 && here !== pred(c + nx)) {
          ctx.moveTo(px(i), py(j));
          ctx.lineTo(px(i) + s, py(j));
        }
      }
    }
    ctx.stroke();
  };
  edges((c) => land[c] === LandUse.ROAD, pal.roadEdge);
  if (pal.lotEdge) edges((c) => land[c] === LandUse.ROOF, pal.lotEdge);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
```

- [ ] **Step 4: Trees**

Create `src/render/trees.ts`:

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BOULEVARD_I } from '../scenario/config';
import { cellAt } from '../scenario/terrain';
import { LandUse, type Grid } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';
import { isBioswale } from './groundTexture';
import { mulberry32 } from './rng';

export interface TreeSpot {
  x: number;
  y: number;
  scale: number;
}

export const TREE_COUNT = 400;
export const NODE_CLEARANCE_M = 6;
const BOULEVARD_BAND_M = 12;
const JITTER_M = 1.5;

/** Park/hill cells (not bioswales), or lawn within 12 m of the boulevard. */
export function treeCellAllowed(grid: Grid, c: number): boolean {
  const land = grid.land[c];
  if (land === LandUse.PARK) return !isBioswale(grid, c);
  if (land !== LandUse.LAWN) return false;
  const x = ((c % grid.nx) + 0.5) * grid.dx;
  return Math.abs(x - (BOULEVARD_I + 0.5) * grid.dx) <= BOULEVARD_BAND_M;
}

/** Deterministic tree positions (township metres), kept clear of drain nodes. */
export function placeTrees(
  grid: Grid,
  nodes: ReadonlyArray<{ x: number; y: number }>,
  seed = 42,
  count = TREE_COUNT,
): TreeSpot[] {
  const { nx, ny, dx } = grid;
  const clearance = NODE_CLEARANCE_M + JITTER_M * Math.SQRT2 + 0.01;
  const candidates: number[] = [];
  for (let c = 0; c < nx * ny; c++) {
    if (!treeCellAllowed(grid, c)) continue;
    const x = ((c % nx) + 0.5) * dx;
    const y = (Math.floor(c / nx) + 0.5) * dx;
    if (nodes.some((n) => Math.hypot(n.x - x, n.y - y) < clearance)) continue;
    candidates.push(c);
  }
  const rnd = mulberry32(seed);
  const n = Math.min(count, candidates.length);
  for (let k = 0; k < n; k++) {
    const r = k + Math.floor(rnd() * (candidates.length - k));
    [candidates[k], candidates[r]] = [candidates[r], candidates[k]];
  }
  return candidates
    .slice(0, n)
    .sort((a, b) => a - b)
    .map((c) => ({
      x: ((c % nx) + 0.5) * dx + (rnd() - 0.5) * 2 * JITTER_M,
      y: (Math.floor(c / nx) + 0.5) * dx + (rnd() - 0.5) * 2 * JITTER_M,
      scale: 0.8 + 0.4 * rnd(),
    }));
}

function colorize(geom: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const n = geom.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) arr.set([c.r, c.g, c.b], k * 3);
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geom;
}

/** All trees in one instanced draw call; setScale(0) hides them (x-ray / plan). */
export class TreesView {
  readonly mesh: THREE.InstancedMesh;
  private readonly base: THREE.Matrix4[] = [];
  private readonly tmp = new THREE.Matrix4();
  private readonly scaleM = new THREE.Matrix4();
  private scale = 1;

  constructor(grid: Grid, spots: TreeSpot[]) {
    const trunk = colorize(new THREE.CylinderGeometry(0.6, 0.8, 3, 5).translate(0, 1.5, 0), '#b8a58a');
    const canopy = colorize(new THREE.ConeGeometry(4, 10, 6).translate(0, 8, 0), '#9cc29a');
    const geom = mergeGeometries([trunk, canopy])!;
    this.mesh = new THREE.InstancedMesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true }), spots.length);
    this.mesh.castShadow = true;
    const q = new THREE.Quaternion();
    spots.forEach((s, k) => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(worldX(grid, s.x), worldY(grid.z[cellAt(s.x, s.y)]), worldZ(grid, s.y)),
        q,
        new THREE.Vector3(s.scale, s.scale, s.scale),
      );
      this.base.push(m);
      this.mesh.setMatrixAt(k, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  setScale(s: number): void {
    if (Math.abs(s - this.scale) < 1e-4) return;
    this.scale = s;
    this.mesh.visible = s > 0.001;
    this.scaleM.makeScale(s, s, s);
    this.base.forEach((b, k) => this.mesh.setMatrixAt(k, this.tmp.multiplyMatrices(b, this.scaleM)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/render/ground.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Soil skirt**

Create `src/render/skirt.ts`:

```ts
import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';

const TOPSOIL_M = 0.6;
const BASE_ELEV = -4;

/** Soil cross-section on the four sides: topsoil band over clay; the south (river) face in river colour. */
export class SkirtView {
  readonly mesh: THREE.Mesh;
  private readonly bands: Uint8Array; // per vertex: 0 topsoil, 1 clay, 2 river
  private readonly colors: Float32Array;

  constructor(grid: Grid) {
    const { nx, ny, dx, z } = grid;
    const ring: Array<{ c: number; south: boolean }> = [];
    for (let i = 0; i < nx; i++) ring.push({ c: i, south: true });
    for (let j = 1; j < ny; j++) ring.push({ c: j * nx + nx - 1, south: false });
    for (let i = nx - 2; i >= 0; i--) ring.push({ c: (ny - 1) * nx + i, south: false });
    for (let j = ny - 2; j >= 0; j--) ring.push({ c: j * nx, south: false });

    const pos: number[] = [];
    const band: number[] = [];
    const xy = (c: number) => ({ x: worldX(grid, ((c % nx) + 0.5) * dx), zz: worldZ(grid, (Math.floor(c / nx) + 0.5) * dx) });
    const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, tag: number) => {
      for (const v of [a, b, c, b, d, c]) {
        pos.push(v.x, v.y, v.z);
        band.push(tag);
      }
    };
    for (let k = 0; k < ring.length; k++) {
      const p = ring[k];
      const q = ring[(k + 1) % ring.length];
      const south = p.south && q.south;
      const A = xy(p.c);
      const B = xy(q.c);
      const yA = worldY(z[p.c]);
      const yB = worldY(z[q.c]);
      const mA = worldY(z[p.c] - TOPSOIL_M);
      const mB = worldY(z[q.c] - TOPSOIL_M);
      const base = worldY(BASE_ELEV);
      const v = (x: number, y: number, zz: number) => new THREE.Vector3(x, y, zz);
      quad(v(A.x, yA, A.zz), v(B.x, yB, B.zz), v(A.x, mA, A.zz), v(B.x, mB, B.zz), south ? 2 : 0);
      quad(v(A.x, mA, A.zz), v(B.x, mB, B.zz), v(A.x, base, A.zz), v(B.x, base, B.zz), south ? 2 : 1);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    this.colors = new Float32Array(pos.length);
    geom.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geom.computeVertexNormals();
    this.bands = Uint8Array.from(band);
    this.mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.setColors('#b9a887', '#cbbfa8', '#7fb8cf');
  }

  setColors(top: string, bottom: string, river: string): void {
    const cols = [new THREE.Color(top), new THREE.Color(bottom), new THREE.Color(river)];
    for (let k = 0; k < this.bands.length; k++) {
      const c = cols[this.bands[k]];
      this.colors[3 * k] = c.r;
      this.colors[3 * k + 1] = c.g;
      this.colors[3 * k + 2] = c.b;
    }
    (this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 7: Textured terrain**

Replace `src/render/terrain.ts` with:

```ts
import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldY } from './coords';
import { createGridGeometry } from './gridGeometry';
import { isBioswale, paintGround, type Look } from './groundTexture';

export interface TerrainView {
  mesh: THREE.Mesh;
  setLook(look: Look): void;
  setOpacity(o: number): void;
  dispose(): void;
}

// Townships differ only by the bioswale preset, so textures are cached by (look, size, bioswale cell count).
const cache = new Map<string, THREE.CanvasTexture>();

function groundTexture(grid: Grid, look: Look, size: number): THREE.CanvasTexture {
  let swales = 0;
  for (let c = 0; c < grid.land.length; c++) if (isBioswale(grid, c)) swales++;
  const key = `${look}|${size}|${swales}`;
  let tex = cache.get(key);
  if (!tex) {
    tex = paintGround(grid, look, size);
    cache.set(key, tex);
  }
  return tex;
}

export function createTerrain(grid: Grid, textureSize = 2048): TerrainView {
  const { nx, ny } = grid;
  const geom = createGridGeometry(grid);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const uv = new Float32Array(nx * ny * 2);
  for (let c = 0; c < nx * ny; c++) {
    pos.setY(c, worldY(grid.z[c]));
    uv[2 * c] = ((c % nx) + 0.5) / nx;
    uv[2 * c + 1] = (Math.floor(c / nx) + 0.5) / ny;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geom.deleteAttribute('color');
  geom.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ map: groundTexture(grid, 'day', textureSize) });
  const mesh = new THREE.Mesh(geom, material);
  mesh.receiveShadow = true;
  let look: Look = 'day';

  return {
    mesh,
    setLook(next) {
      if (next === look) return;
      look = next;
      material.map = groundTexture(grid, next, textureSize);
      material.needsUpdate = true;
    },
    setOpacity(o) {
      const transparent = o < 0.999;
      material.opacity = o;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.depthWrite = !transparent;
        material.needsUpdate = true;
      }
    },
    dispose() {
      geom.dispose();
      material.dispose(); // textures are cached and shared
    },
  };
}

/** Compatibility wrapper used by scene.ts until the conductor rewrite (Task 5). */
export function createTerrainMesh(grid: Grid): THREE.Mesh {
  return createTerrain(grid).mesh;
}
```

- [ ] **Step 8: Verify and commit**

Run: `npm test`, `npx tsc --noEmit` and `npx vite build` (then delete `dist/`).
Expected: all pass. The app still runs; the terrain is now textured in the day look.

```bash
git add src/render/rng.ts src/render/groundTexture.ts src/render/trees.ts src/render/skirt.ts src/render/terrain.ts tests/render/ground.test.ts
git commit -m "feat(render): painted ground texture, instanced trees, soil skirt"
```

---

### Task 3: Water shader with smoothing, theme and fallback

**Files:**
- Create: `src/render/waterMaterial.ts`
- Modify: `src/render/water.ts` (full replacement)

**Interfaces:**
- Consumes: `Theme`, `DAY` (Task 1); `smoothDepth`, `WET` (Task 1); `createGridGeometry`; `worldY`.
- Produces:
  - `createWaterMaterial(): THREE.ShaderMaterial`, with uniforms `uShallow`, `uDeep`, `uOpMin`, `uOpMax`, `uTime`, `uRipple`, `uEmissive`;
  - `WaterSurface` with `mesh`, `update(depth)`, `setTheme(theme)`, `setRipples(on)`, `tick(timeS)`, `useFallback()` and `dispose()`.

- [ ] **Step 1: Water material**

Create `src/render/waterMaterial.ts`:

```ts
import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aDepth;
varying float vDepth;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vDepth = aDepth;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uOpMin;
uniform float uOpMax;
uniform float uTime;
uniform float uRipple;
uniform float uEmissive;
varying float vDepth;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  if (vDepth <= 0.01) discard;
  vec3 col = mix(uShallow, uDeep, clamp(vDepth, 0.0, 1.0));
  float op = mix(uOpMin, uOpMax, clamp(vDepth / 0.5, 0.0, 1.0));
  vec3 n = normalize(vNormalW);
  if (uRipple > 0.5) {
    n.x += 0.06 * sin(vWorld.x * 0.15 + uTime * 1.3) + 0.04 * sin(vWorld.z * 0.23 + uTime * 0.7);
    n.z += 0.06 * sin(vWorld.z * 0.11 - uTime * 1.1) + 0.04 * sin(vWorld.x * 0.19 - uTime * 0.9);
    n = normalize(n);
  }
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  vec3 sunDir = normalize(vec3(-0.54, 0.64, 0.54));
  float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 60.0);
  col += (fres * 0.35 + spec * 0.6) * (1.0 - uEmissive);
  float foam = (1.0 - smoothstep(0.01, 0.04, vDepth)) * (1.0 - uEmissive);
  col = mix(col, vec3(1.0), foam * 0.6);
  op = max(op, foam * 0.6);
  col *= 1.0 + uEmissive * 0.8;
  gl_FragColor = vec4(col, op);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uShallow: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() },
      uOpMin: { value: 0.25 },
      uOpMax: { value: 0.85 },
      uTime: { value: 0 },
      uRipple: { value: 1 },
      uEmissive: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}
```

- [ ] **Step 2: Water surface**

Replace `src/render/water.ts` with:

```ts
import * as THREE from 'three';
import type { Grid } from '../sim/types';
import { worldY } from './coords';
import { createGridGeometry } from './gridGeometry';
import { smoothDepth, WET } from './smoothDepth';
import { DAY, type Theme } from './theme';
import { createWaterMaterial } from './waterMaterial';

/** Flood surface: smoothed display depths, shader water, Phong fallback if the shader cannot compile. */
export class WaterSurface {
  readonly mesh: THREE.Mesh;
  private readonly geom: THREE.BufferGeometry;
  private readonly depthAttr: THREE.BufferAttribute;
  private readonly smoothed: Float32Array;
  private readonly shader = createWaterMaterial();
  private fallback: THREE.MeshPhongMaterial | null = null;
  private readonly shallow = new THREE.Color();
  private readonly deep = new THREE.Color();
  private readonly tmp = new THREE.Color();

  constructor(private readonly grid: Grid) {
    const n = grid.nx * grid.ny;
    this.geom = createGridGeometry(grid);
    this.depthAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    this.geom.setAttribute('aDepth', this.depthAttr);
    this.smoothed = new Float32Array(n);
    this.mesh = new THREE.Mesh(this.geom, this.shader);
    this.mesh.renderOrder = 2;
    this.setTheme(DAY);
    this.update(grid.h0);
  }

  update(depth: ArrayLike<number>): void {
    const { nx, ny, z } = this.grid;
    smoothDepth(depth, nx, ny, this.smoothed);
    const pos = this.geom.getAttribute('position') as THREE.BufferAttribute;
    const col = this.geom.getAttribute('color') as THREE.BufferAttribute;
    for (let c = 0; c < this.smoothed.length; c++) {
      const d = this.smoothed[c];
      pos.setY(c, d > WET ? worldY(z[c] + d) + 0.05 : worldY(z[c]) - 1);
      this.depthAttr.setX(c, d);
      if (this.fallback) {
        this.tmp.copy(this.shallow).lerp(this.deep, Math.min(1, d));
        col.setXYZ(c, this.tmp.r, this.tmp.g, this.tmp.b);
      }
    }
    pos.needsUpdate = true;
    this.depthAttr.needsUpdate = true;
    if (this.fallback) col.needsUpdate = true;
    this.geom.computeVertexNormals();
  }

  setTheme(th: Theme): void {
    const u = this.shader.uniforms;
    (u.uShallow.value as THREE.Color).set(th.waterShallow);
    (u.uDeep.value as THREE.Color).set(th.waterDeep);
    u.uOpMin.value = th.waterOpacityMin;
    u.uOpMax.value = th.waterOpacityMax;
    u.uEmissive.value = th.waterEmissive;
    this.shallow.set(th.waterShallow);
    this.deep.set(th.waterDeep);
    if (this.fallback) this.fallback.opacity = (th.waterOpacityMin + th.waterOpacityMax) / 2;
  }

  setRipples(on: boolean): void {
    this.shader.uniforms.uRipple.value = on ? 1 : 0;
  }

  tick(timeS: number): void {
    this.shader.uniforms.uTime.value = timeS;
  }

  /** Switch to plain Phong water (used if the shader fails to compile). */
  useFallback(): void {
    if (this.fallback) return;
    this.fallback = new THREE.MeshPhongMaterial({ vertexColors: true, transparent: true, opacity: 0.6, shininess: 80, depthWrite: false });
    this.mesh.material = this.fallback;
    this.update(Array.from(this.smoothed));
  }

  dispose(): void {
    this.geom.dispose();
    this.shader.dispose();
    this.fallback?.dispose();
  }
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm test`, `npx tsc --noEmit` and `npx vite build` (then delete `dist/`).
Expected: all pass. `scene.ts` is unchanged; `WaterSurface`'s constructor and `update` keep their signatures.

```bash
git add src/render/waterMaterial.ts src/render/water.ts
git commit -m "feat(render): shader water with smoothing, foam, ripples and Phong fallback"
```

---

### Task 4: X-ray and plan pipe ribbons with flow arrows

**Files:**
- Create: `src/render/flowRibbons.ts`
- Modify: `src/render/network.ts` (full replacement)

**Interfaces:**
- Consumes: `advancePhase`, `arrowsVisible` (Task 1); `DrainNode`, `Frame`, `Grid`, `Network`; `worldX`, `worldY`, `worldZ`.
- Produces:
  - `type RibbonKind = 'xray' | 'plan'`, `loadColorBetween(load, low, mid, high, out)`;
  - `class FlowRibbons(grid, net, kind)` with `group`, `setColors(low, mid, high)`, `update(frame, dtS)` and `dispose()`;
  - `type NetworkMode = 'day' | 'xray' | 'plan'`;
  - `NetworkView` gains `setMode(mode)` and `setPipeColors(low, mid, high)`. Its `update(frame, time)` signature is unchanged and `nodeMeshes` is still exposed.

- [ ] **Step 1: Flow ribbons**

Create `src/render/flowRibbons.ts`:

```ts
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
  float s = fract((vUv.x - uPhase) * uLen / ${CHEVRON_SPACING.toFixed(1)});
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
      this.phases[p] = advancePhase(this.phases[p], dtS, load);
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
```

- [ ] **Step 2: Network view modes**

Replace `src/render/network.ts` with:

```ts
import * as THREE from 'three';
import type { DrainNode, Frame, Grid, Network } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';
import { FlowRibbons } from './flowRibbons';

const GREEN = new THREE.Color('#2ecc71');
const YELLOW = new THREE.Color('#f1c40f');
const RED = new THREE.Color('#e74c3c');
const NODE_OK = new THREE.Color('#34495e');
const NODE_XRAY = new THREE.Color('#e8f6ff');
const LIFT = 3; // day mode: draw the network 3 world units above ground so it is visible

export type NetworkMode = 'day' | 'xray' | 'plan';

export function loadColor(load: number, out = new THREE.Color()): THREE.Color {
  const t = Math.min(1, Math.max(0, load));
  return t < 0.5 ? out.copy(GREEN).lerp(YELLOW, t * 2) : out.copy(YELLOW).lerp(RED, (t - 0.5) * 2);
}

export class NetworkView {
  readonly group = new THREE.Group();
  readonly nodeMeshes: THREE.Mesh[] = [];
  private readonly pipeMeshes: THREE.Mesh[] = [];
  private readonly xray: FlowRibbons;
  private readonly plan: FlowRibbons;
  private readonly nodePos: Record<NetworkMode, THREE.Vector3[]> = { day: [], xray: [], plan: [] };
  private mode: NetworkMode = 'day';
  private lastTime: number | null = null;

  constructor(grid: Grid, net: Network) {
    const ground = (n: DrainNode, lift: number) => new THREE.Vector3(worldX(grid, n.x), worldY(grid.z[n.cell]) + lift, worldZ(grid, n.y));
    const byId = new Map(net.nodes.map((n) => [n.id, n]));
    const up = new THREE.Vector3(0, 1, 0);

    for (const p of net.pipes) {
      const a = ground(byId.get(p.from)!, LIFT);
      const b = ground(byId.get(p.to)!, LIFT);
      const dir = b.clone().sub(a);
      const r = Math.max(1.5, p.diameter * 4);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, dir.length(), 8),
        new THREE.MeshBasicMaterial({ color: GREEN.clone(), transparent: true, opacity: 0.95, depthTest: false }),
      );
      mesh.position.copy(a).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      mesh.renderOrder = 10;
      this.pipeMeshes.push(mesh);
      this.group.add(mesh);
    }

    for (const n of net.nodes) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 8),
        new THREE.MeshBasicMaterial({ color: NODE_OK.clone(), transparent: true, opacity: 0.95, depthTest: false }),
      );
      mesh.userData.nodeId = n.id;
      mesh.renderOrder = 12;
      this.nodeMeshes.push(mesh);
      this.group.add(mesh);
      this.nodePos.day.push(ground(n, LIFT));
      this.nodePos.xray.push(new THREE.Vector3(worldX(grid, n.x), worldY(n.invert), worldZ(grid, n.y)));
      this.nodePos.plan.push(new THREE.Vector3(worldX(grid, n.x), worldY(grid.z[n.cell] + 1), worldZ(grid, n.y)));
    }

    this.xray = new FlowRibbons(grid, net, 'xray');
    this.plan = new FlowRibbons(grid, net, 'plan');
    this.group.add(this.xray.group, this.plan.group);
    this.setMode('day');
  }

  setMode(mode: NetworkMode): void {
    this.mode = mode;
    for (const m of this.pipeMeshes) m.visible = mode === 'day';
    this.xray.group.visible = mode === 'xray';
    this.plan.group.visible = mode === 'plan';
    this.nodeMeshes.forEach((m, k) => m.position.copy(this.nodePos[mode][k]));
  }

  setPipeColors(low: string, mid: string, high: string): void {
    this.xray.setColors(low, mid, high);
    this.plan.setColors(low, mid, high);
  }

  update(frame: Frame | null, time: number): void {
    const dt = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    if (frame && (frame.pipeLoad.length !== this.pipeMeshes.length || frame.nodeFill.length !== this.nodeMeshes.length)) frame = null;
    if (this.mode === 'day') {
      this.pipeMeshes.forEach((m, p) => loadColor(frame ? frame.pipeLoad[p] : 0, (m.material as THREE.MeshBasicMaterial).color));
    } else {
      (this.mode === 'xray' ? this.xray : this.plan).update(frame, dt);
    }
    const okColor = this.mode === 'xray' ? NODE_XRAY : NODE_OK;
    this.nodeMeshes.forEach((m, k) => {
      const surcharged = frame !== null && frame.nodeFill[k] >= 0.999;
      (m.material as THREE.MeshBasicMaterial).color.copy(surcharged ? RED : okColor);
      m.scale.setScalar(surcharged ? 1 + 0.35 * Math.sin(time * 6) : 1);
    });
  }

  dispose(): void {
    for (const m of [...this.pipeMeshes, ...this.nodeMeshes]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.xray.dispose();
    this.plan.dispose();
  }
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm test`, `npx tsc --noEmit` and `npx vite build` (then delete `dist/`).
Expected: all pass. The scene still uses the day mode by default.

```bash
git add src/render/flowRibbons.ts src/render/network.ts
git commit -m "feat(render): x-ray and plan pipe ribbons with load-driven flow arrows"
```

---

### Task 5: Scene conductor — lighting, sky, themes, x-ray, plan view, bloom, quality

**Files:**
- Create: `src/render/sky.ts`, `src/render/cameras.ts`, `src/render/postfx.ts`
- Modify: `src/render/scene.ts` (full replacement)

**Interfaces:**
- Consumes: everything from Tasks 1–4; `PinLayer`, `PinItem` (`src/render/pins.ts`, which has `closePopover()`); `Rain`; `cellAt`.
- Produces:
  - `createSky(): { mesh; setColors(top, horizon) }`;
  - `type ViewMode = '3d' | 'plan'` and `class CameraRig(dom, siteSize)` with `active`, `mode`, `setView`, `resize`, `update(nowS)`, `onStart(fn)` and `metresPerPixel()`;
  - `class PostFx(renderer, scene, camera)` with `active`, `setBloom(k)`, `setCamera(cam)`, `setSize(w, h)`, `setPixelRatio(r)` and `render()`;
  - `type Quality = 'high' | 'low'`;
  - `SceneHandle` gains `setXray(on)`, `setView(v: ViewMode)`, `setQuality(q)`, `onQualityAutoDrop(fn)`, `onNotice(fn: (text) => void)` and `planMetresPerPixel()`;
  - the scene toggles the class `xray` on the container when x-ray t ≥ 0.5 (used by the Task 6 CSS).

- [ ] **Step 1: Sky**

Create `src/render/sky.ts`:

```ts
import * as THREE from 'three';

/** Gradient sky dome (horizon → top), blendable through setColors. */
export function createSky(): { mesh: THREE.Mesh; setColors(top: string, horizon: string): void } {
  const uniforms = { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    fragmentShader: /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  gl_FragColor = vec4(mix(uHorizon, uTop, pow(h, 0.6)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return {
    mesh,
    setColors(top, horizon) {
      uniforms.uTop.value.set(top);
      uniforms.uHorizon.value.set(horizon);
    },
  };
}
```

- [ ] **Step 2: Camera rig**

Create `src/render/cameras.ts`:

```ts
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
  private readonly topHeight: number;

  constructor(dom: HTMLElement, private readonly siteSize: number) {
    this.persp.position.copy(this.saved.pos);
    this.orbit = new OrbitControls(this.persp, dom);
    this.orbit.target.copy(this.saved.target);
    this.orbit.enableDamping = true;

    this.ortho.position.set(0, 2000, 0);
    this.ortho.up.set(0, 0, -1); // north (−Z) at the top of the screen
    this.ortho.lookAt(0, 0, 0);
    this.pan = new OrbitControls(this.ortho, dom);
    this.pan.enableRotate = false;
    this.pan.screenSpacePanning = true;
    this.pan.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.pan.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    this.pan.enabled = false;

    this.topHeight = (siteSize * 0.6) / Math.tan(THREE.MathUtils.degToRad(25));
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
    const top: Pose = { pos: new THREE.Vector3(0, this.topHeight, 0.01), target: new THREE.Vector3(0, 0, 0) };
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
      const target = new THREE.Vector3().lerpVectors(a.from.target, a.to.target, e);
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
```

- [ ] **Step 3: Post-processing**

Create `src/render/postfx.ts`:

```ts
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
    this.composer = new EffectComposer(renderer);
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
```

- [ ] **Step 4: Scene conductor**

Replace `src/render/scene.ts` with:

```ts
import * as THREE from 'three';
import type { InterventionId, Township } from '../scenario/interventions';
import { cellAt } from '../scenario/terrain';
import type { Frame } from '../sim/types';
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
import { blendTheme, type Theme } from './theme';
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
const SITE_SIZE = 512;
const SUN_ELEV = THREE.MathUtils.degToRad(40);
// From the south-west: west = −X, south = +Z.
const SUN_DIR = new THREE.Vector3(-Math.cos(SUN_ELEV) * Math.SQRT1_2, Math.sin(SUN_ELEV), Math.cos(SUN_ELEV) * Math.SQRT1_2);

export function createScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = createSky();
  scene.add(sky.mesh);
  scene.fog = new THREE.Fog('#e9eef2', 900, 1800);

  const rig = new CameraRig(renderer.domElement, SITE_SIZE);

  const hemi = new THREE.HemisphereLight('#ffffff', '#d8d2c4', 0.9);
  const sun = new THREE.DirectionalLight('#fff2df', 1.6);
  sun.position.copy(SUN_DIR).multiplyScalar(800);
  sun.castShadow = true;
  const sc = sun.shadow.camera;
  sc.left = -320;
  sc.right = 320;
  sc.top = 320;
  sc.bottom = -320;
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
  let notice: (text: string) => void = () => {};
  let autoDrop: () => void = () => {};
  const guard = new FpsGuard();

  const networkMode = (): NetworkMode => (view === 'plan' ? 'plan' : xrayT >= 0.5 ? 'xray' : 'day');

  const applyTheme = (th: Theme) => {
    sky.setColors(th.skyTop, th.skyHorizon);
    const fog = scene.fog as THREE.Fog;
    fog.color.set(th.fog);
    fog.near = th.fogNear;
    fog.far = th.fogFar;
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
    applyTheme(blendTheme(xrayT));
    resize();
  };

  renderer.debug.onShaderError = (gl, _program, vs, fs) => {
    console.error('Shader compile failed', gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
    if (!waterFallback) {
      waterFallback = true;
      water?.useFallback();
      notice('Using simplified water shading (the graphics driver could not compile the water shader).');
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
      applyTheme(blendTheme(xrayT));
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
      applyTheme(blendTheme(xrayT));
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
      xrayOn = on;
    },
    setView(v) {
      view = v;
      rig.setView(v);
      sun.castShadow = quality === 'high' && v === '3d';
      applyTheme(blendTheme(xrayT));
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
```

- [ ] **Step 5: Remove the compatibility wrapper**

In `src/render/terrain.ts`, delete the `createTerrainMesh` function and its comment, since nothing imports it any more. Confirm with `npx tsc --noEmit`.

- [ ] **Step 6: Verify and commit**

Run: `npm test`, `npx tsc --noEmit` and `npx vite build` (then delete `dist/`).
Expected: all pass. `main.ts` compiles unchanged, because `SceneHandle` only gained members.

Check by reading:
- the render loop allocates nothing per frame, apart from `CameraRig.update` during the 500 ms switch (acceptable);
- `applyTheme` runs only on a theme change or a township, view or quality change.

```bash
git add src/render/sky.ts src/render/cameras.ts src/render/postfx.ts src/render/scene.ts src/render/terrain.ts
git commit -m "feat(render): lighting, sky, x-ray theme blend, plan camera, bloom, quality and fps guard"
```

---

### Task 6: Toolbar, plan overlay, pin restyle, wiring

**Files:**
- Modify: `index.html` (viewport block), `src/ui/styles.css` (pin rules replaced, new rules appended), `src/main.ts` (wiring)

**Interfaces:**
- Consumes: `SceneHandle.setXray`, `setView`, `setQuality`, `onQualityAutoDrop`, `onNotice`, `planMetresPerPixel` (Task 5); the `#viewport.xray` class set by the scene.

- [ ] **Step 1: Viewport markup**

In `index.html`, add these elements inside `<div id="viewport">`, directly after its opening tag and before the legend:

```html
        <div class="view-toolbar">
          <button id="xray-toggle" class="tb">🩻 X-ray</button>
          <div id="view-toggle" class="tb-seg">
            <button data-view="3d" class="active">3D</button>
            <button data-view="plan">Plan</button>
          </div>
          <div id="quality-toggle" class="tb-seg" title="Graphics quality">
            <button data-q="high" class="active">High</button>
            <button data-q="low">Low</button>
          </div>
        </div>
        <div id="plan-overlay" class="plan-overlay" hidden>
          <span class="north">N ↑</span>
          <span class="scalebar"><i id="scalebar-bar"></i><b>50 m</b></span>
        </div>
```

- [ ] **Step 2: Styles**

In `src/ui/styles.css`, replace the four existing pin rules (`.pin-head`, `.pin-head > span` and `.pin.installed .pin-head`; keep `.pin` itself) with:

```css
.pin-head { width: 28px; height: 28px; border-radius: 50%; border: 2px solid #2b8a8a; background: #fff; display: grid; place-items: center; box-shadow: 0 2px 6px #0003; position: relative; }
.pin-head > span { font-size: 14px; line-height: 1; }
.pin-head::after { content: ''; position: absolute; left: 50%; top: 100%; width: 2px; height: 10px; margin-left: -1px; background: #2b8a8a; }
.pin.installed .pin-head { background: #2b8a8a; border-color: #2b8a8a; }
#viewport.xray .pin-head { background: #0f1b2c; border-color: #19c3ff; }
#viewport.xray .pin-head::after { background: #19c3ff; }
#viewport.xray .pin.installed .pin-head { background: #19c3ff; border-color: #19c3ff; }
```

Append:

```css
.view-toolbar { position: absolute; left: 12px; top: 12px; z-index: 4; display: flex; gap: 6px; align-items: center; }
.tb, .tb-seg button { font: inherit; font-size: 12.5px; padding: 6px 10px; border: 1px solid var(--line); background: #ffffffdd; cursor: pointer; }
.tb { border-radius: 8px; }
.tb.active { background: #0f1b2c; color: #9fe6ff; border-color: #19c3ff; }
.tb-seg { display: flex; }
.tb-seg button:first-child { border-radius: 8px 0 0 8px; }
.tb-seg button:last-child { border-radius: 0 8px 8px 0; border-left: 0; }
.tb-seg button.active { background: var(--navy); color: #fff; border-color: var(--navy); }
.plan-overlay { position: absolute; left: 12px; bottom: 96px; z-index: 4; display: flex; gap: 10px; align-items: center; background: #ffffffdd; border-radius: 8px; padding: 6px 10px; font-size: 12px; }
.plan-overlay .north { font-weight: 700; }
.scalebar { display: flex; align-items: center; gap: 6px; }
.scalebar i { display: inline-block; height: 6px; border: 2px solid #2f3b4a; border-top: 0; width: 60px; }
#viewport.xray .legend, #viewport.xray .rain-gauge, #viewport.xray .pins-toggle, #viewport.xray .plan-overlay, #viewport.xray .tb, #viewport.xray .tb-seg button:not(.active) { background: #0f1b2cdd; color: #cfe3f3; border-color: #2e4a6e; }
#viewport.xray .scalebar i { border-color: #cfe3f3; }
```

- [ ] **Step 3: Wiring**

In `src/main.ts`, add this block directly after the existing `pinsBtn.addEventListener(...)` block. It uses the existing `$`, `view`, `status` and `applyPinVisibility`.

```ts
const xrayBtn = $<HTMLButtonElement>('xray-toggle');
let xrayOn = false;
xrayBtn.addEventListener('click', () => {
  xrayOn = !xrayOn;
  xrayBtn.classList.toggle('active', xrayOn);
  view.setXray(xrayOn);
});

const planOverlay = $('plan-overlay');
const scaleBar = $('scalebar-bar');
let planOn = false;
const updateScaleBar = () => {
  if (!planOn) return;
  const px = 50 / Math.max(1e-6, view.planMetresPerPixel());
  scaleBar.style.width = `${Math.round(Math.min(240, px))}px`;
  requestAnimationFrame(updateScaleBar);
};
$('view-toggle').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
  if (!btn) return;
  const v = btn.dataset.view as '3d' | 'plan';
  $('view-toggle').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  view.setView(v);
  planOn = v === 'plan';
  planOverlay.hidden = !planOn;
  if (planOn) requestAnimationFrame(updateScaleBar);
});

const qualityToggle = $('quality-toggle');
const markQuality = (q: 'high' | 'low') =>
  qualityToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('active', b.dataset.q === q));
qualityToggle.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-q]');
  if (!btn) return;
  const q = btn.dataset.q as 'high' | 'low';
  markQuality(q);
  view.setQuality(q);
});
view.onQualityAutoDrop(() => markQuality('low'));
view.onNotice((text) => status(text));
```

If `applyPinVisibility` or `status` is declared later in the file than this insertion point, move the block below both declarations. `const` arrow functions must be declared before they are first used in top-level code. The listeners here only call them later, but keep the block below their declarations for clarity.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`, `npm test` and `npx vite build` (then delete `dist/`).
Expected: all pass.

Check that every new id (`xray-toggle`, `view-toggle`, `quality-toggle`, `plan-overlay`, `scalebar-bar`) is in `index.html`.

```bash
git add index.html src/ui/styles.css src/main.ts
git commit -m "feat(ui): x-ray / plan / quality toolbar, plan scale overlay, restyled pins"
```

---

### Task 7: Docs and browser checklist

**Files:**
- Modify: `docs/browser-checklist.md` (append), `README.md`

- [ ] **Step 1: Checklist**

Append to `docs/browser-checklist.md`:

```markdown

## Visual upgrade
20. Day look: pastel ground with soft lot shadows, trees on the hill/park/boulevard, soil cross-section on the sides, warm light with shadows, sky gradient; water is teal, glossy, with white shallow edges and gentle ripples.
21. 🩻 X-ray: ~0.6 s fade to the dark digital-twin look; ground semi-transparent; pipes glow underground at their real depth; chevrons flow from upstream to downstream, faster on fuller pipes; overflowing manholes glow red; pins switch to dark/cyan.
22. X-ray off: fades back to day.
23. Plan: camera eases to top-down (north up); drag pans, wheel zooms, no rotation; flat coloured pipe ribbons with arrows; "N ↑" and a 50 m scale bar that resizes with zoom; pins and Draw pipe still work.
24. Plan + X-ray together works.
25. Quality Low: shadows, bloom and ripples off; noticeably lighter. High restores them.
26. Auto-drop: DevTools → Performance → CPU 6× slowdown; within a few seconds quality switches to Low once with a status message.
27. Live and Compare behave exactly as before in every look.
```

- [ ] **Step 2: README**

In `README.md`, under the Modes section, add a **View** paragraph:
- 🩻 X-ray (an underground digital-twin view with flow arrows);
- 3D | Plan (a top-down map with a scale bar);
- Quality High/Low (drops to Low automatically if the frame rate stays below 30 fps).

- [ ] **Step 3: Verify and commit**

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass and tsc prints nothing.

```bash
git add docs/browser-checklist.md README.md
git commit -m "docs: visual upgrade checklist and README view controls"
```
