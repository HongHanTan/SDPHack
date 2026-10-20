# X-ray View and 2D / 3D Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the legacy app's X-ray look and its 2D plan / 3D toggle into `apps/web` (TEH JIA JIE's React + R3F UI), as view toggles that combine with his three twin views.

**Architecture:**
- Pure helpers live in `apps/web/src/view/`: theme blend, flow math, scale bar and camera fit, surface ghosting.
- A `ViewLookProvider` inside the R3F `Canvas` holds the eased x-ray blend in a ref (read per frame) plus `ghost` / `is2d` flags (React state).
- Scene parts read the context:
  - `SceneLook` sets the lights and fog;
  - `TownshipEnvironment` ghosts its meshes;
  - `FlowRibbons` draws glowing or plan pipes;
  - `XrayBloom` adds bloom;
  - `ViewRig` animates between the orbit camera and an orthographic map camera.

**Tech Stack:** React 19, @react-three/fiber 9, @react-three/drei 10, three 0.170, @react-three/postprocessing 3 (new), Vitest 2, Tailwind 4.

## Global Constraints

- Both toggles start **off** (X-ray off, 3D), so Jiajie's default scene is unchanged. They work in all three data modes (Engine, Mock, SWMM API).
- Jiajie's three twin views (Digital Twin, Realistic Surface, Underground Only) all stay. X-ray is a separate toggle that can be combined with any of them.
- **X-ray fade:** 0.6 s (`XRAY_FADE_S`).
- **2D glide:** 0.5 s with smoothstep easing (`SWITCH_S`). In 2D, north is up, and you can pan and zoom but not rotate.
- **XRAY theme values:**
  - background and fog `#0a111c`; fog near 100000, far 200000;
  - ambient 0.6 `#9fb4cc`; key light 0.3 `#9fb4cc`; fill 0.3;
  - water `#19c3ff` / `#0d6fb5`, opacity 0.55 / 0.55, emissive 1;
  - pipes `#39ffb0` / `#ffd84d` / `#ff4d6d`.
- **DAY theme values:**
  - background and fog `#f1f5f9`; fog 200 / 480;
  - ambient 1.3 `#ffffff`; key light 2.4 `#ffffff`; fill 0.8;
  - water `#bfe3ec` / `#2b7fb8`, opacity 0.25 / 0.85, emissive 0;
  - pipes `#0284c7` / `#f59e0b` / `#ef4444`.
- **Ghost material:** `#1c2c44`, opacity 0.35, no depth writes.
  - Trees are hidden in X-ray and in 2D.
  - Text labels are hidden in 2D.
  - Jiajie's `PondingWaterAnimation` is excluded from ghosting.
- **Scale bar:** steps 10/20/50/100/200 m; the largest that fits in 160 px.
- **2D framing:** the site is the team lawn extent, centre (x 45, z −10), 240 × 280 m, with a 16 px margin.
- Pipes and manholes stay clickable in both views.
- **Edits to Jiajie's files** (`SceneViewer.tsx`, `TownshipEnvironment.tsx`, `App.tsx`) are small and only take effect when a toggle is on. New code goes in `apps/web/src/view/`. `apps/legacy` is not changed.
- **Commits:**
  - commits by the user only;
  - NEVER add `Co-Authored-By` or any co-author line;
  - do not push;
  - never stage `md/progress/honghan.md`.
- **Commit body credits:** "Ported from the legacy FloodOps viewer (apps/legacy)." and, when his files change, "SceneViewer/TownshipEnvironment by TEH JIA JIE; view toggles gated."
- **Verification commands:**
  - `npm -w township-floodops-web test`
  - `npm -w township-floodops-web run build` (runs `tsc -b`)
  - root `npm test`
  - Delete `apps/web/dist` afterwards.

---

### Task 1: Pure view helpers (theme, flow math, scale bar and camera fit, surface ghosting)

**Files:**
- Create:
  - `apps/web/src/view/xrayTheme.ts`
  - `apps/web/src/view/flowMath.ts`
  - `apps/web/src/view/scaleBar.ts`
  - `apps/web/src/view/surfaceLook.ts`
- Test:
  - `apps/web/src/view/__tests__/xrayTheme.test.ts`
  - `flowMath.test.ts`
  - `scaleBar.test.ts`
  - `surfaceLook.test.ts`

**Interfaces:**
- Produces:
  - `xrayTheme.ts`:
    - `Theme`, `DAY`, `XRAY`
    - `lerpHex(a, b, t)`
    - `blendThemeInto(t, out): Theme`
    - `blendTheme(t): Theme`
    - `XRAY_FADE_S = 0.6`
    - `stepXray(t, target, dtS): number`
  - `flowMath.ts`:
    - `MIN_ARROW_LOAD`
    - `arrowSpeed(load)`
    - `arrowsVisible(load)`
    - `advancePhase(phase, dtS, load, scale?)`
    - `loadColorBetween(load, low, mid, high, out: THREE.Color)`
    - `pipeLoad(frame, conduitId): number`
  - `scaleBar.ts`:
    - `SCALE_STEPS_M`, `SCALE_MAX_PX = 160`
    - `SITE = { cx: 45, cz: -10, w: 240, h: 280 }`
    - `GROUND_Y = 11`
    - `MARGIN_PX = 16`
    - `pickScaleStep(mpp): { metres, px }`
    - `orthoZoomFor(viewW, viewH, siteW?, siteH?): number`
    - `topHeightFor(viewH, zoom, fovDeg): number`
  - `surfaceLook.ts`:
    - `GHOST_MATERIAL`
    - `isTextObject(o)`
    - `applySurfaceLook(root, ghost, is2d)`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/view/__tests__/xrayTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { blendTheme, DAY, lerpHex, stepXray, XRAY, XRAY_FADE_S } from '../xrayTheme';

describe('xrayTheme', () => {
  it('returns the end themes at t = 0 and t = 1', () => {
    expect(blendTheme(0)).toEqual(DAY);
    expect(blendTheme(1)).toEqual(XRAY);
  });
  it('blends colours per channel and numbers linearly at the midpoint', () => {
    const mid = blendTheme(0.5);
    expect(mid.background).toBe(lerpHex(DAY.background, XRAY.background, 0.5));
    expect(mid.ambient).toBeCloseTo((DAY.ambient + XRAY.ambient) / 2, 6);
    expect(lerpHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
  it('steps the fade toward the target over XRAY_FADE_S and clamps', () => {
    expect(stepXray(0, 1, XRAY_FADE_S / 2)).toBeCloseTo(0.5, 6);
    expect(stepXray(0.9, 1, 1)).toBe(1);
    expect(stepXray(0.2, 0, 1)).toBe(0);
    expect(stepXray(1, 1, 0.1)).toBe(1);
  });
});
```

`apps/web/src/view/__tests__/flowMath.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SimulationFrame } from '../../types';
import { advancePhase, arrowSpeed, arrowsVisible, loadColorBetween, pipeLoad } from '../flowMath';

const frame = (states: Array<Record<string, unknown>>) => ({ timestamp_s: 0, pipe_states: states, node_states: [], inlet_states: [] }) as unknown as SimulationFrame;

describe('flowMath', () => {
  it('speeds up with load and hides arrows on dry pipes', () => {
    expect(arrowSpeed(0)).toBeCloseTo(0.2);
    expect(arrowSpeed(1)).toBeCloseTo(2.0);
    expect(arrowsVisible(0.01)).toBe(false);
    expect(arrowsVisible(0.5)).toBe(true);
  });
  it('advances the phase and wraps into [0, 1)', () => {
    const p = advancePhase(0.9, 1, 1, 1);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
    expect(p).toBeCloseTo((0.9 + 2.0) % 1, 6);
  });
  it('colours low → mid → high', () => {
    const low = new THREE.Color('#00ff00');
    const mid = new THREE.Color('#ffff00');
    const high = new THREE.Color('#ff0000');
    const out = new THREE.Color();
    expect(loadColorBetween(0, low, mid, high, out).getHexString()).toBe('00ff00');
    expect(loadColorBetween(0.5, low, mid, high, out).getHexString()).toBe('ffff00');
    expect(loadColorBetween(1, low, mid, high, out).getHexString()).toBe('ff0000');
  });
  it('reads capacity_fraction, falls back to status, and is 0 for unknown pipes', () => {
    const f = frame([
      { conduit_id: 'A', flow_m3s: 0, depth_m: 0, status: 'normal', capacity_fraction: 0.3 },
      { conduit_id: 'B', flow_m3s: 0, depth_m: 0, status: 'surcharged' },
      { conduit_id: 'C', flow_m3s: 0, depth_m: 0, status: 'near_capacity' },
      { conduit_id: 'D', flow_m3s: 0, depth_m: 0, status: 'normal' },
    ]);
    expect(pipeLoad(f, 'A')).toBe(0.3);
    expect(pipeLoad(f, 'B')).toBe(1);
    expect(pipeLoad(f, 'C')).toBe(0.85);
    expect(pipeLoad(f, 'D')).toBe(0.4);
    expect(pipeLoad(f, 'Z')).toBe(0);
    expect(pipeLoad(null, 'A')).toBe(0);
  });
});
```

`apps/web/src/view/__tests__/scaleBar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { orthoZoomFor, pickScaleStep, topHeightFor } from '../scaleBar';

describe('scaleBar', () => {
  it('picks the largest step that fits in 160 px', () => {
    expect(pickScaleStep(0.5)).toEqual({ metres: 50, px: 100 });
    expect(pickScaleStep(10)).toEqual({ metres: 200, px: 20 });
    expect(pickScaleStep(0.01)).toEqual({ metres: 10, px: 1000 });
  });
  it('fits the 240 × 280 m site inside the viewport with a 16 px margin', () => {
    expect(orthoZoomFor(1000, 800)).toBeCloseTo(768 / 280, 6);
    expect(orthoZoomFor(400, 2000)).toBeCloseTo(368 / 240, 6);
  });
  it('places the perspective camera so its frame matches the ortho frame', () => {
    expect(topHeightFor(800, 2, 45)).toBeCloseTo(200 / Math.tan((22.5 * Math.PI) / 180), 6);
  });
});
```

`apps/web/src/view/__tests__/surfaceLook.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applySurfaceLook, GHOST_MATERIAL } from '../surfaceLook';

function scene() {
  const root = new THREE.Group();
  const house = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const water = new THREE.Group();
  water.userData.noGhost = true;
  const pond = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  water.add(pond);
  // Duck-typed troika text: a mesh with `text` and `sync()`.
  const label = Object.assign(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()), { text: 'J07', sync: () => {} });
  root.add(house, water, label);
  return { root, house, pond, label };
}

describe('applySurfaceLook', () => {
  it('ghosts meshes, skips noGhost subtrees and text, and restores the originals', () => {
    const { root, house, pond, label } = scene();
    const houseMat = house.material;
    const pondMat = pond.material;
    const labelMat = label.material;
    applySurfaceLook(root, true, false);
    expect(house.material).toBe(GHOST_MATERIAL);
    expect(pond.material).toBe(pondMat);
    expect(label.material).toBe(labelMat);
    expect(label.visible).toBe(true);
    applySurfaceLook(root, true, false); // idempotent
    applySurfaceLook(root, false, false);
    expect(house.material).toBe(houseMat);
  });
  it('re-ghosts a mesh whose material was replaced while ghosted', () => {
    const { root, house } = scene();
    applySurfaceLook(root, true, false);
    const fresh = new THREE.MeshStandardMaterial();
    house.material = fresh;
    applySurfaceLook(root, true, false);
    expect(house.material).toBe(GHOST_MATERIAL);
    applySurfaceLook(root, false, false);
    expect(house.material).toBe(fresh);
  });
  it('hides text labels in 2D and shows them again in 3D', () => {
    const { root, label } = scene();
    applySurfaceLook(root, false, true);
    expect(label.visible).toBe(false);
    applySurfaceLook(root, false, false);
    expect(label.visible).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail.**
  - Run: `npm -w township-floodops-web exec vitest run src/view`
  - Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

`apps/web/src/view/xrayTheme.ts`:

```ts
// Ported from apps/legacy/src/render/theme.ts (Hong Han): the day ↔ x-ray look, re-based on the team scene's day values.

/** Every colour/number that differs between the day look and the x-ray look. Colours are lowercase #rrggbb. */
export interface Theme {
  background: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ambient: number;
  ambientColor: string;
  key: number;
  keyColor: string;
  fill: number;
  waterShallow: string;
  waterDeep: string;
  waterOpMin: number;
  waterOpMax: number;
  waterEmissive: number;
  pipeLow: string;
  pipeMid: string;
  pipeHigh: string;
}

/** The team scene as TEH JIA JIE built it (SceneViewer lights/fog, EngineWater colours, ConduitMesh status colours). */
export const DAY: Theme = {
  background: '#f1f5f9',
  fog: '#f1f5f9',
  fogNear: 200,
  fogFar: 480,
  ambient: 1.3,
  ambientColor: '#ffffff',
  key: 2.4,
  keyColor: '#ffffff',
  fill: 0.8,
  waterShallow: '#bfe3ec',
  waterDeep: '#2b7fb8',
  waterOpMin: 0.25,
  waterOpMax: 0.85,
  waterEmissive: 0,
  pipeLow: '#0284c7',
  pipeMid: '#f59e0b',
  pipeHigh: '#ef4444',
};

export const XRAY: Theme = {
  background: '#0a111c',
  fog: '#0a111c',
  fogNear: 100000,
  fogFar: 200000,
  ambient: 0.6,
  ambientColor: '#9fb4cc',
  key: 0.3,
  keyColor: '#9fb4cc',
  fill: 0.3,
  waterShallow: '#19c3ff',
  waterDeep: '#0d6fb5',
  waterOpMin: 0.55,
  waterOpMax: 0.55,
  waterEmissive: 1,
  pipeLow: '#39ffb0',
  pipeMid: '#ffd84d',
  pipeHigh: '#ff4d6d',
};

export const XRAY_FADE_S = 0.6;

export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const mix = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + [16, 8, 0].map((s) => mix(s).toString(16).padStart(2, '0')).join('');
}

/** t = 0 → DAY, t = 1 → XRAY; colours per channel, numbers linearly. */
export function blendThemeInto(t: number, out: Theme): Theme {
  const o = out as unknown as Record<string, string | number>;
  const k = !(t > 0) ? 0 : t >= 1 ? 1 : t;
  for (const key of Object.keys(DAY) as Array<keyof Theme>) {
    const a = DAY[key];
    const b = XRAY[key];
    o[key] = k === 0 ? a : k === 1 ? b : typeof a === 'string' ? lerpHex(a, b as string, k) : a + ((b as number) - a) * k;
  }
  return out;
}

export function blendTheme(t: number): Theme {
  return blendThemeInto(t, { ...DAY });
}

/** Moves the x-ray blend toward `target` (0 or 1) by dtS / XRAY_FADE_S, clamped. */
export function stepXray(t: number, target: number, dtS: number): number {
  if (t === target) return t;
  const d = Math.max(0, dtS) / XRAY_FADE_S;
  return target > t ? Math.min(target, t + d) : Math.max(target, t - d);
}
```

`apps/web/src/view/flowMath.ts`:

```ts
// Ported from apps/legacy/src/render/flowMath.ts and flowRibbons.ts (Hong Han).
import * as THREE from 'three';
import type { SimulationFrame } from '../types';

export const MIN_ARROW_LOAD = 0.02;

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Ribbon-lengths per second. */
export function arrowSpeed(load: number): number {
  return 0.2 + 1.8 * clamp01(load);
}

export function arrowsVisible(load: number): boolean {
  return load >= MIN_ARROW_LOAD;
}

/** Advances a chevron phase in [0, 1), in chevron units: `scale` = ribbon length / chevron spacing. */
export function advancePhase(phase: number, dtS: number, load: number, scale = 1): number {
  const p = (phase + arrowSpeed(load) * Math.max(0, dtS) * scale) % 1;
  return p < 0 ? p + 1 : p;
}

export function loadColorBetween(load: number, low: THREE.Color, mid: THREE.Color, high: THREE.Color, out: THREE.Color): THREE.Color {
  const t = clamp01(load);
  return t < 0.5 ? out.copy(low).lerp(mid, t * 2) : out.copy(mid).lerp(high, (t - 0.5) * 2);
}

/** Pipe load (0..1+) for a conduit in a team frame: capacity_fraction, else a value from its status. */
export function pipeLoad(frame: SimulationFrame | null | undefined, conduitId: string): number {
  const p = frame?.pipe_states?.find((s) => s.conduit_id === conduitId);
  if (!p) return 0;
  if (typeof p.capacity_fraction === 'number' && Number.isFinite(p.capacity_fraction)) return p.capacity_fraction;
  return p.status === 'surcharged' ? 1 : p.status === 'near_capacity' ? 0.85 : 0.4;
}
```

`apps/web/src/view/scaleBar.ts`:

```ts
// Ported from apps/legacy (Hong Han): the plan view's scale bar steps and camera fit.

export const SCALE_STEPS_M = [10, 20, 50, 100, 200] as const;
export const SCALE_MAX_PX = 160;
export const MARGIN_PX = 16;
/** The team scene's lawn extent (scene x/z, metres): the area 2D frames. */
export const SITE = { cx: 45, cz: -10, w: 240, h: 280 } as const;
/** Approximate ground level of the team scene (scene y). */
export const GROUND_Y = 11;

/** The largest step whose bar fits in SCALE_MAX_PX at `mpp` metres per pixel (the smallest step if none fits). */
export function pickScaleStep(mpp: number): { metres: number; px: number } {
  const m = Math.max(1e-6, mpp);
  let metres: number = SCALE_STEPS_M[0];
  for (const s of SCALE_STEPS_M) if (s / m <= SCALE_MAX_PX) metres = s;
  return { metres, px: Math.round(metres / m) };
}

/** Orthographic zoom (pixels per metre) that fits the site in the viewport with MARGIN_PX on every side. */
export function orthoZoomFor(viewW: number, viewH: number, siteW: number = SITE.w, siteH: number = SITE.h): number {
  const mpp = Math.max(siteW / Math.max(1, viewW - 2 * MARGIN_PX), siteH / Math.max(1, viewH - 2 * MARGIN_PX));
  return 1 / mpp;
}

/** Height above the target at which a perspective camera of `fovDeg` sees the same frame as the ortho camera. */
export function topHeightFor(viewH: number, zoom: number, fovDeg: number): number {
  return viewH / 2 / zoom / Math.tan((fovDeg * Math.PI) / 360);
}
```

`apps/web/src/view/surfaceLook.ts`:

```ts
import * as THREE from 'three';

/** X-ray ghost for the team surface (legacy x-ray terrain look: dark blue, 35%). */
export const GHOST_MATERIAL = new THREE.MeshBasicMaterial({ color: '#1c2c44', transparent: true, opacity: 0.35, depthWrite: false });

const ORIG = '__origMaterial';

/** drei <Text> renders troika-three-text meshes, recognised by their `text` field and `sync()` method. */
export function isTextObject(o: THREE.Object3D): boolean {
  const t = o as unknown as { text?: unknown; sync?: unknown };
  return typeof t.sync === 'function' && 'text' in t;
}

/**
 * Ghosts every mesh under `root` (keeping the original material in userData to restore later) and hides text
 * labels in 2D. Subtrees with `userData.noGhost` are left alone. Safe to call repeatedly.
 */
export function applySurfaceLook(root: THREE.Object3D, ghost: boolean, is2d: boolean): void {
  const walk = (o: THREE.Object3D) => {
    if (o.userData.noGhost) return;
    if (isTextObject(o)) {
      o.visible = !is2d;
      return;
    }
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      if (ghost) {
        if (mesh.material !== GHOST_MATERIAL) {
          mesh.userData[ORIG] = mesh.material;
          mesh.material = GHOST_MATERIAL;
        }
      } else if (mesh.userData[ORIG]) {
        mesh.material = mesh.userData[ORIG] as THREE.Material;
        delete mesh.userData[ORIG];
      }
    }
    o.children.forEach(walk);
  };
  walk(root);
}
```

- [ ] **Step 4: Run the tests and confirm they pass.**
  - Run: `npm -w township-floodops-web exec vitest run src/view`
  - Expected: PASS, 13 tests.
  - Then run `npm -w township-floodops-web test`; everything should be green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/view
git commit -m "feat(web): view helpers for the x-ray look and plan view" -m "Ported from the legacy FloodOps viewer (apps/legacy)."
```

---

### Task 2: X-ray toggle, scene look and ghosted surface

**Files:**
- Create: `apps/web/src/view/ViewLookContext.tsx`, `apps/web/src/view/SceneLook.tsx`
- Modify:
  - `apps/web/src/components/SceneViewer.tsx`
  - `apps/web/src/components/TownshipEnvironment.tsx`
  - `apps/web/src/engine/EngineWater.tsx`
  - `apps/web/src/App.tsx`

**Interfaces:**
- Consumes (Task 1): `stepXray`, `blendTheme`, `blendThemeInto`, `applySurfaceLook`.
- Produces:
  - `ViewLookProvider({ xray: boolean; is2d: boolean; children })`, which must be rendered inside `<Canvas>`;
  - `useViewLook(): { lookRef: MutableRefObject<{ xrayT: number }>; ghost: boolean; is2d: boolean }`;
  - `SceneLook({ ambient, keyLight, fill })`, which takes light refs;
  - new optional SceneViewer props `xray?: boolean` and `onToggleXray?: () => void`;
  - App state `xray`.

- [ ] **Step 1: `apps/web/src/view/ViewLookContext.tsx`**

```tsx
import { createContext, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { stepXray } from './xrayTheme';

export interface LookState {
  /** 0 = day look, 1 = x-ray look; eased over XRAY_FADE_S. Read it in useFrame, not render. */
  xrayT: number;
}

export interface ViewLook {
  lookRef: MutableRefObject<LookState>;
  /** xrayT >= 0.5: ghosted surface, glowing pipes, bloom. */
  ghost: boolean;
  /** Plan (2D) view requested. */
  is2d: boolean;
}

const ViewLookContext = createContext<ViewLook>({ lookRef: { current: { xrayT: 0 } }, ghost: false, is2d: false });

export const useViewLook = () => useContext(ViewLookContext);

/** Inside the Canvas: eases the x-ray blend toward the toggle and flips `ghost` at the halfway point. */
export function ViewLookProvider({ xray, is2d, children }: { xray: boolean; is2d: boolean; children: ReactNode }) {
  const lookRef = useRef<LookState>({ xrayT: 0 });
  const [ghost, setGhost] = useState(false);
  useFrame((_, dt) => {
    const next = stepXray(lookRef.current.xrayT, xray ? 1 : 0, dt);
    if (next === lookRef.current.xrayT) return;
    lookRef.current.xrayT = next;
    const g = next >= 0.5;
    if (g !== ghost) setGhost(g);
  });
  const value = useMemo(() => ({ lookRef, ghost, is2d }), [ghost, is2d]);
  return <ViewLookContext.Provider value={value}>{children}</ViewLookContext.Provider>;
}
```

- [ ] **Step 2: `apps/web/src/view/SceneLook.tsx`**

```tsx
import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewLook } from './ViewLookContext';
import { blendTheme, blendThemeInto } from './xrayTheme';

/** Applies the blended day/x-ray theme to the background, fog and lights each frame it changes. */
export function SceneLook({
  ambient,
  keyLight,
  fill,
}: {
  ambient: RefObject<THREE.AmbientLight | null>;
  keyLight: RefObject<THREE.DirectionalLight | null>;
  fill: RefObject<THREE.DirectionalLight | null>;
}) {
  const { lookRef, is2d } = useViewLook();
  const scene = useThree((s) => s.scene);
  const theme = useMemo(() => blendTheme(0), []);
  const last = useRef('');
  useFrame(() => {
    const t = lookRef.current.xrayT;
    const key = `${t}|${is2d}`;
    if (key === last.current) return;
    last.current = key;
    blendThemeInto(t, theme);
    if (scene.background instanceof THREE.Color) scene.background.set(theme.background);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(theme.fog);
      // The plan camera sits high above the site: keep the fog out of the way there (legacy plan view did the same).
      scene.fog.near = is2d ? 1e5 : theme.fogNear;
      scene.fog.far = is2d ? 2e5 : theme.fogFar;
    }
    if (ambient.current) {
      ambient.current.intensity = theme.ambient;
      ambient.current.color.set(theme.ambientColor);
    }
    if (keyLight.current) {
      keyLight.current.intensity = theme.key;
      keyLight.current.color.set(theme.keyColor);
    }
    if (fill.current) fill.current.intensity = theme.fill;
  });
  return null;
}
```

- [ ] **Step 3: SceneViewer.**

  - **Imports:**
    - `import { ViewLookProvider } from '../view/ViewLookContext';`
    - `import { SceneLook } from '../view/SceneLook';`
    - add `useRef` to the React import if it isn't there yet.
  - **Props:** add these to `SceneViewerProps`:

```ts
  /** X-ray look toggle (legacy viewer port). Absent handler: no X-ray button. */
  xray?: boolean;
  onToggleXray?: () => void;
```

  Destructure them as `xray = false, onToggleXray`.

  - **Toggle button:** in the top bar, right after the closing `</div>` of the twin-view button group (the one ending with "🚇 Underground Only"), add:

```tsx
        {/* X-ray look (legacy viewer port): combines with any twin view */}
        {onToggleXray && (
          <button
            onClick={onToggleXray}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium transition cursor-pointer ${
              xray ? 'bg-slate-900 text-cyan-300 border-slate-700 shadow-xs' : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
            title="X-ray: fade the surface and show glowing pipes and water"
          >
            🔬 X-ray
          </button>
        )}
```

  - **Light refs:** in the component body add:

```ts
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);
```

  - **Canvas contents:**
    - Wrap everything inside `<Canvas ...>` (from `<color attach="background" .../>` down to the closing `</GizmoHelper>`) in `<ViewLookProvider xray={xray} is2d={false}>` … `</ViewLookProvider>`.
    - Attach the refs: `<ambientLight ref={ambientRef} …/>`, the first `<directionalLight ref={keyLightRef} …/>` and the second `<directionalLight ref={fillLightRef} …/>`. Keep their existing props.
    - Add `<SceneLook ambient={ambientRef} keyLight={keyLightRef} fill={fillLightRef} />` right after the lights.
    - Give the `<Grid …>` the prop `visible={!xray}`.

- [ ] **Step 4: TownshipEnvironment (ghosting, trees).**

  - **Imports:**
    - `import { useLayoutEffect, useRef } from 'react';` (merge into the existing React import)
    - `import { useViewLook } from '../view/ViewLookContext';`
    - `import { applySurfaceLook } from '../view/surfaceLook';`
  - **Hooks:** at the top of `TownshipEnvironmentInner` (before the `houses` memo), add:

```ts
  // X-ray / plan view (legacy viewer port): ghost the surface, hide trees and (in 2D) labels.
  const { ghost, is2d } = useViewLook();
  const rootRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (rootRef.current) applySurfaceLook(rootRef.current, ghost, is2d);
  });
```

  - **Root groups:** add `ref={rootRef}` to both returned root groups (the `showUndergroundOnly` early-return group and the main `<group position={[0, 0, 0]}>`).
  - **Underground Only wireframe:** in the `showUndergroundOnly` branch, give the wireframe `<mesh>` the prop `userData={{ noGhost: true }}`.
  - **Trees:** replace `{trees.map((t, idx) => (` … `))}` with:

```tsx
      {!(ghost || is2d) &&
        trees.map((t, idx) => (
          <LushTree
            key={`tree-${idx}`}
            position={t.pos}
            scale={t.scale}
            color={t.color}
          />
        ))}
```

  - **Ponding water:** wrap the non-engine `<PondingWaterAnimation … />` in `<group userData={{ noGhost: true }}>` … `</group>`.

- [ ] **Step 5: EngineWater x-ray colours.**

  In `apps/web/src/engine/EngineWater.tsx`:
  - **Imports:**
    - `import { useViewLook } from '../view/ViewLookContext';`
    - `import { blendTheme, blendThemeInto } from '../view/xrayTheme';`
  - **Material:** replace the `material` memo with:

```ts
  const material = useMemo(() => createWaterMaterial(), []);
  const { lookRef } = useViewLook();
  const theme = useMemo(() => blendTheme(0), []);
  const lastT = useRef(-1);
```

  - **Frame loop:** change the `useFrame` body to:

```ts
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    const t = lookRef.current.xrayT;
    if (t === lastT.current) return;
    lastT.current = t;
    blendThemeInto(t, theme);
    (material.uniforms.uShallow.value as THREE.Color).set(theme.waterShallow);
    (material.uniforms.uDeep.value as THREE.Color).set(theme.waterDeep);
    material.uniforms.uOpMin.value = theme.waterOpMin;
    material.uniforms.uOpMax.value = theme.waterOpMax;
    material.uniforms.uEmissive.value = theme.waterEmissive;
  });
```

  At t = 0 these are exactly the previous colours, `#bfe3ec` / `#2b7fb8`.

- [ ] **Step 6: App.**

  In `apps/web/src/App.tsx`:
  - add `const [xray, setXray] = useState<boolean>(false);` beside `twinViewMode`;
  - pass these to `<SceneViewer>`:

```tsx
        xray={xray}
        onToggleXray={() => setXray((v) => !v)}
```

- [ ] **Step 7: Verify.**
  - Run `npm -w township-floodops-web test` and `npm -w township-floodops-web run build`. Both must PASS.
  - Delete `apps/web/dist`.
  - Reason through Mock mode with X-ray off: provider `xrayT` stays 0, `SceneLook` sets the same DAY values, `ghost` is false, and the trees render. The scene is unchanged.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): X-ray toggle — day/x-ray theme fade and ghosted township surface" -m "Ported from the legacy FloodOps viewer (apps/legacy)." -m "SceneViewer/TownshipEnvironment by TEH JIA JIE; view toggles gated."
```

---

### Task 3: Glowing flow ribbons, bloom and manhole glow

**Files:**
- Create: `apps/web/src/view/FlowRibbons.tsx`, `apps/web/src/view/XrayBloom.tsx`
- Modify: `apps/web/package.json` (dependency), `apps/web/src/components/SceneViewer.tsx`

**Interfaces:**
- Consumes:
  - `useViewLook()` (Task 2);
  - `advancePhase`, `arrowsVisible`, `loadColorBetween`, `pipeLoad` (Task 1);
  - `blendTheme`, `blendThemeInto` (Task 1).
- Produces:
  - `FlowRibbons({ nodes: AssetNode[]; conduits: AssetConduit[]; frame: SimulationFrame | null | undefined; onSelect?: (c: AssetConduit) => void })`;
  - it renders nothing unless `ghost || is2d`;
  - mode `'plan'` when `is2d`, otherwise `'xray'`. Task 4 relies on plan mode.

- [ ] **Step 1: Dependency.**
  - Run: `npm i -w township-floodops-web @react-three/postprocessing@^3.0.4`
  - Expected: it installs and `apps/web/package.json` lists it.
  - If npm reports a peer conflict, pick the newest 3.x that accepts `@react-three/fiber@^9` and `three@0.170`, and record the version in the report.

- [ ] **Step 2: `apps/web/src/view/FlowRibbons.tsx`**

```tsx
// Ported from apps/legacy/src/render/flowRibbons.ts (Hong Han): pipe ribbons with chevrons scrolling with the flow.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssetConduit, AssetNode, SimulationFrame } from '../types';
import { advancePhase, arrowsVisible, loadColorBetween, pipeLoad } from './flowMath';
import { useViewLook } from './ViewLookContext';
import { blendTheme, blendThemeInto } from './xrayTheme';

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

type Mode = 'xray' | 'plan';

interface Ribbon {
  conduit: AssetConduit;
  geometry: THREE.TubeGeometry;
  material: THREE.ShaderMaterial;
  phase: number;
}

const groundOf = (n: AssetNode) => n.ground_elevation_m ?? n.position_m.z + n.max_depth_m;

function buildRibbons(nodes: AssetNode[], conduits: AssetConduit[], mode: Mode): Ribbon[] {
  const byId = new Map(nodes.map((n) => [n.node_id, n]));
  const out: Ribbon[] = [];
  for (const c of conduits) {
    const from = byId.get(c.from_node_id || c.from_node!);
    const to = byId.get(c.to_node_id || c.to_node!);
    if (!from || !to) continue;
    const d = c.diameter_m || 0.45;
    const at = (n: AssetNode) => {
      // Team coordinates {x east, y north, z elevation} → scene [x, z, −y] (as SceneViewer.toThreeCoords).
      const p = new THREE.Vector3(n.position_m.x, 0, -n.position_m.y);
      // X-ray: on the pipe's true centreline; plan: just above the ground.
      p.y = mode === 'xray' ? n.position_m.z + d / 2 : groundOf(n) + 0.6;
      return p;
    };
    const a = at(from);
    const b = at(to);
    if (a.distanceTo(b) <= 0) continue;
    const radius = mode === 'xray' ? Math.max(0.6, d * 1.2) : Math.max(1.0, d * 2.5);
    const geometry = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 8, radius, 8, false);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() },
        uPhase: { value: 0 },
        uLen: { value: a.distanceTo(b) },
        uArrows: { value: 0 },
        uGlow: { value: mode === 'xray' ? 1 : 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: mode === 'xray',
    });
    out.push({ conduit: c, geometry, material, phase: 0 });
  }
  return out;
}

/** Glowing pipes in X-ray (at depth) and map pipes in 2D (on top of everything). Hidden otherwise. */
export function FlowRibbons({
  nodes,
  conduits,
  frame,
  onSelect,
}: {
  nodes: AssetNode[];
  conduits: AssetConduit[];
  frame: SimulationFrame | null | undefined;
  onSelect?: (c: AssetConduit) => void;
}) {
  const { lookRef, ghost, is2d } = useViewLook();
  const mode: Mode | null = is2d ? 'plan' : ghost ? 'xray' : null;
  const ribbons = useMemo(() => (mode ? buildRibbons(nodes, conduits, mode) : []), [nodes, conduits, mode]);
  useEffect(
    () => () =>
      ribbons.forEach((r) => {
        r.geometry.dispose();
        r.material.dispose();
      }),
    [ribbons],
  );
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const theme = useMemo(() => blendTheme(0), []);
  const low = useMemo(() => new THREE.Color(), []);
  const mid = useMemo(() => new THREE.Color(), []);
  const high = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    if (!ribbons.length) return;
    blendThemeInto(lookRef.current.xrayT, theme);
    low.set(theme.pipeLow);
    mid.set(theme.pipeMid);
    high.set(theme.pipeHigh);
    for (const r of ribbons) {
      const load = pipeLoad(frameRef.current, r.conduit.conduit_id);
      const u = r.material.uniforms;
      r.phase = advancePhase(r.phase, dt, load, (u.uLen.value as number) / CHEVRON_SPACING);
      u.uPhase.value = r.phase;
      u.uArrows.value = arrowsVisible(load) ? 1 : 0;
      loadColorBetween(load, low, mid, high, u.uColor.value as THREE.Color);
    }
  });

  if (!mode) return null;
  return (
    <group>
      {ribbons.map((r) => (
        <mesh
          key={r.conduit.conduit_id}
          geometry={r.geometry}
          material={r.material}
          renderOrder={11}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(r.conduit);
          }}
        />
      ))}
    </group>
  );
}
```

- [ ] **Step 3: `apps/web/src/view/XrayBloom.tsx`**

```tsx
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useViewLook } from './ViewLookContext';

/** Bloom for the x-ray look only (legacy viewer had bloom 1 in x-ray, 0 by day). */
export function XrayBloom() {
  const { ghost } = useViewLook();
  if (!ghost) return null;
  return (
    <EffectComposer>
      <Bloom intensity={1} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />
    </EffectComposer>
  );
}
```

- [ ] **Step 4: SceneViewer wiring.**
  - **Imports:**
    - `import { FlowRibbons } from '../view/FlowRibbons';`
    - `import { XrayBloom } from '../view/XrayBloom';`
    - `import { useViewLook } from '../view/ViewLookContext';`
  - **Ribbons:** after the conduits `.map(...)` block, add:

```tsx
        {/* X-ray / plan pipes (legacy viewer port) */}
        <FlowRibbons
          nodes={nodes}
          conduits={conduits}
          frame={currentFrame}
          onSelect={(c) => onSelectAsset({ type: 'conduit', id: c.conduit_id, data: c })}
        />
```

  - **Bloom:** add `<XrayBloom />` as the last child inside `<ViewLookProvider>`, after `</GizmoHelper>`.
  - **NodeMesh glow:** at the top of the `NodeMesh` component body add `const { ghost } = useViewLook();`. Change the chamber material's props to:

```tsx
              emissive={ghost || isSelected || hovered ? color : isTwinHighlight ? color : '#000000'}
              emissiveIntensity={ghost ? 0.8 : isSelected ? 0.7 : hovered ? 0.35 : isTwinHighlight ? 0.45 : 0}
```

- [ ] **Step 5: Verify.**
  - Run `npm -w township-floodops-web test`, `npm -w township-floodops-web run build` and root `npm test`. All must PASS.
  - Delete `apps/web/dist`.
  - Confirm `FlowRibbons` returns `null` when both toggles are off, so the default scene is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json package-lock.json apps/web/src
git commit -m "feat(web): X-ray flow ribbons, bloom and manhole glow" -m "Ported from the legacy FloodOps viewer (apps/legacy)." -m "SceneViewer by TEH JIA JIE; view toggles gated."
```

---

### Task 4: 2D plan view, scale bar and checklist

**Files:**
- Create: `apps/web/src/view/ViewRig.tsx`, `apps/web/src/view/ScaleBar.tsx`
- Modify:
  - `apps/web/src/components/SceneViewer.tsx`
  - `apps/web/src/App.tsx`
  - `docs/browser-checklist.md`

**Interfaces:**
- Consumes:
  - `SITE`, `GROUND_Y`, `orthoZoomFor`, `topHeightFor`, `pickScaleStep` (Task 1);
  - `useViewLook()` and `ViewLookProvider` (Task 2);
  - `FlowRibbons` plan mode (Task 3).
- Produces:
  - SceneViewer props `viewDim?: '3d' | '2d'` and `onChangeViewDim?: (d: '3d' | '2d') => void`;
  - App state `viewDim`.

- [ ] **Step 1: `apps/web/src/view/ViewRig.tsx`**

```tsx
// Ported from apps/legacy/src/render/cameras.ts (Hong Han): orbit camera ↔ top-down orthographic plan camera.
import { MapControls, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { GROUND_Y, orthoZoomFor, SITE, topHeightFor } from './scaleBar';

export const SWITCH_S = 0.5;

type Phase = '3d' | 'to2d' | '2d' | 'to3d';
interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

const DEFAULT_POSE: Pose = { pos: new THREE.Vector3(60, 90, 130), target: new THREE.Vector3(50, 10, 0) };

/**
 * Owns the scene's camera controls. 3D: TEH JIA JIE's OrbitControls (same settings, exposed via `controlsRef` for
 * his presets). 2D: glide overhead, then an orthographic camera (north up) with pan/zoom only.
 */
export function ViewRig({
  is2d,
  controlsRef,
  onMetresPerPixel,
}: {
  is2d: boolean;
  controlsRef: MutableRefObject<any>;
  onMetresPerPixel: (mpp: number) => void;
}) {
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  const perspRef = useRef<THREE.PerspectiveCamera | null>(null);
  if (!perspRef.current) perspRef.current = get().camera as THREE.PerspectiveCamera;
  const [phase, setPhase] = useState<Phase>('3d');
  const phaseRef = useRef<Phase>('3d');
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const saved = useRef<Pose | null>(null);
  const anim = useRef<{ from: Pose; to: Pose; start: number | null; then: () => void } | null>(null);
  const zoom = orthoZoomFor(size.width, size.height);
  const scratch = useRef(new THREE.Vector3());

  const topPose = (): Pose => {
    const h = topHeightFor(size.height, zoom, perspRef.current!.fov);
    return { pos: new THREE.Vector3(SITE.cx, GROUND_Y + h, SITE.cz + 0.01), target: new THREE.Vector3(SITE.cx, GROUND_Y, SITE.cz) };
  };

  useEffect(() => {
    const persp = perspRef.current!;
    const p = phaseRef.current;
    if (is2d && (p === '3d' || p === 'to3d')) {
      const ctl = controlsRef.current;
      const from: Pose = { pos: persp.position.clone(), target: ctl ? ctl.target.clone() : DEFAULT_POSE.target.clone() };
      if (p === '3d') saved.current = from;
      anim.current = { from, to: topPose(), start: null, then: () => go('2d') };
      go('to2d');
    } else if (!is2d && (p === '2d' || p === 'to2d')) {
      const top = topPose();
      persp.position.copy(top.pos);
      persp.lookAt(top.target);
      const to = saved.current ?? DEFAULT_POSE;
      anim.current = {
        from: top,
        to,
        start: null,
        then: () => {
          go('3d');
          const c = controlsRef.current;
          if (c) {
            c.target.copy(to.target);
            c.update();
          }
        },
      };
      go('to3d');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is2d]);

  useFrame(({ clock }) => {
    const a = anim.current;
    if (!a) return;
    const persp = perspRef.current!;
    if (a.start === null) a.start = clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - a.start) / SWITCH_S);
    const e = k * k * (3 - 2 * k);
    persp.position.lerpVectors(a.from.pos, a.to.pos, e);
    persp.lookAt(scratch.current.lerpVectors(a.from.target, a.to.target, e));
    if (k >= 1) {
      anim.current = null;
      a.then();
    }
  });

  useEffect(() => {
    if (phase === '2d') onMetresPerPixel(1 / zoom);
  }, [phase, zoom, onMetresPerPixel]);

  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  useLayoutEffect(() => {
    const cam = orthoRef.current;
    if (phase !== '2d' || !cam) return;
    cam.up.set(0, 0, -1); // north (−Z) at the top of the screen
    cam.position.set(SITE.cx, GROUND_Y + 600, SITE.cz);
    cam.lookAt(SITE.cx, GROUND_Y, SITE.cz);
    cam.zoom = zoom;
    cam.updateProjectionMatrix();
  }, [phase, zoom]);

  if (phase === '2d') {
    return (
      <>
        <OrthographicCamera ref={orthoRef} makeDefault near={0.1} far={2000} />
        <MapControls
          makeDefault
          enableRotate={false}
          screenSpacePanning
          target={[SITE.cx, GROUND_Y, SITE.cz]}
          onChange={(e) => {
            const cam = (e?.target as unknown as { object?: THREE.OrthographicCamera })?.object;
            if (cam?.zoom) onMetresPerPixel(1 / cam.zoom);
          }}
        />
      </>
    );
  }
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={phase === '3d'}
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={10}
      maxDistance={350}
    />
  );
}
```

- [ ] **Step 2: `apps/web/src/view/ScaleBar.tsx`**

```tsx
import { pickScaleStep } from './scaleBar';

/** Plan-view scale bar and north arrow (legacy viewer port). */
export function ScaleBar({ metresPerPixel }: { metresPerPixel: number }) {
  const { metres, px } = pickScaleStep(metresPerPixel);
  return (
    <div className="absolute top-32 right-4 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/95 border border-slate-200 shadow-md text-[11px] text-slate-700 pointer-events-none">
      <span className="font-bold">N ↑</span>
      <div className="flex flex-col items-start">
        <div style={{ width: `${px}px` }} className="h-1.5 border-x-2 border-b-2 border-slate-800" />
        <span className="font-mono">{metres} m</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: SceneViewer wiring.**
  - **Imports:**
    - `import { ViewRig } from '../view/ViewRig';`
    - `import { ScaleBar } from '../view/ScaleBar';`
    - remove `OrbitControls` from the drei import if it's now unused.
  - **Props:** add these to `SceneViewerProps`:

```ts
  /** 2D plan / 3D view (legacy viewer port). Absent handler: no switch. */
  viewDim?: '3d' | '2d';
  onChangeViewDim?: (d: '3d' | '2d') => void;
```

  - **Component body:** destructure `viewDim = '3d', onChangeViewDim` and add:

```ts
  const is2d = viewDim === '2d';
  const [metresPerPixel, setMetresPerPixel] = useState<number>(1);
```

  - **3D | 2D switch:** add it to the top bar, right after the X-ray button:

```tsx
        {onChangeViewDim && (
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200" title="3D view or 2D plan (north up)">
            {(['3d', '2d'] as const).map((d) => (
              <button
                key={d}
                onClick={() => onChangeViewDim(d)}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
                  viewDim === d ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d.toUpperCase()}
              </button>
            ))}
          </div>
        )}
```

  - **Presets:** give each of the four camera preset buttons (Overview, D07 Lowland, Outfall, Upstream) `disabled={is2d}`, and add ` disabled:opacity-40 disabled:cursor-not-allowed` to their className.
  - **Provider:** change it to `<ViewLookProvider xray={xray} is2d={is2d}>`.
  - **Controls:** replace the `<OrbitControls ref={controlsRef} … />` element with:

```tsx
        <ViewRig is2d={is2d} controlsRef={controlsRef} onMetresPerPixel={setMetresPerPixel} />
```

  - **Scale bar:** after `</Canvas>`, before the closing outer `</div>`, add `{is2d && <ScaleBar metresPerPixel={metresPerPixel} />}`.
  - **Labels hidden in 2D:**
    - `NodeMesh`: change `const { ghost } = useViewLook();` to `const { ghost, is2d } = useViewLook();`, then wrap its node ID `<Text …>` in `{!is2d && ( … )}`.
    - `ConduitMesh`: add `const { is2d } = useViewLook();`, then change the P07 label condition to `{conduit.conduit_id === 'PIPE-P07' && !is2d && (`.
    - `InletMesh`: add `const { is2d } = useViewLook();`, then change the focus tag condition to `{isFocusInlet && !is2d && (`.

- [ ] **Step 4: App.**

  In `apps/web/src/App.tsx`:
  - add `const [viewDim, setViewDim] = useState<'3d' | '2d'>('3d');` beside `xray`;
  - pass these to `<SceneViewer>`:

```tsx
        viewDim={viewDim}
        onChangeViewDim={setViewDim}
```

- [ ] **Step 5: Checklist.**

  Append to `docs/browser-checklist.md`:

```markdown

## Team UI: X-ray and 2D — `npm run dev:web`
35. 🔬 X-ray off by default; the scene looks exactly as before. Turning it on fades (≈0.6 s) to a dark navy scene: houses/roads ghosted, trees gone, pipes glowing with chevrons, manholes glowing, bloom.
36. X-ray works with each of Digital Twin, Realistic Surface and Underground Only (Underground + X-ray: no surface, glowing network).
37. Engine mode, 80 mm/h storm with X-ray on: chevrons speed up as pipes load; P07 turns red; flood water is bright cyan.
38. 3D | 2D: 2D glides overhead (≈0.5 s), north up; drag pans, wheel zooms, no rotation; camera presets are disabled; the scale bar changes step as you zoom.
39. In 2D: trees and 3D labels hidden; pipes drawn on top of roofs; clicking a pipe opens the asset panel. Back to 3D returns to the previous angle.
40. 2D + X-ray: dark map with glowing pipes.
41. Mock and SWMM API modes: both toggles work; with both off the team's original views are unchanged.
```

- [ ] **Step 6: Verify.**
  - Run `npm -w township-floodops-web test`, `npm -w township-floodops-web run build` and root `npm test`. All must PASS.
  - Delete `apps/web/dist`.
  - Reason through the 3D path: `phase` is '3d', so `<OrbitControls>` has the same props as before. `controlsRef` presets still work.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src docs/browser-checklist.md
git commit -m "feat(web): 2D plan / 3D toggle with scale bar" -m "Ported from the legacy FloodOps viewer (apps/legacy)." -m "SceneViewer by TEH JIA JIE; view toggles gated."
```
