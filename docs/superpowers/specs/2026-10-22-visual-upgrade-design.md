# Visual Upgrade — Design

**Builds on:**
- `2026-10-20-flood-sim-design.md`
- `2026-10-21-live-mode-ux-design.md`

The simulator as built on `feat/flood-sim`.

**Date:** 2026-10-22

## 1. Goal

Make the 3D simulation attractive and presentation-ready while keeping it light. There are six upgrades:

1. water shader
2. x-ray underground pipe view with flow arrows
3. lighting and post-processing
4. friendlier ground, with trees and a soil cross-section
5. a 2D plan view
6. restyled pins

**Constraints:**
- Stay on three.js 0.169 and use only its bundled addons.
- Add no npm dependencies and no downloaded assets; all textures are generated in code.
- Nothing in `src/sim/`, `src/worker/` or `src/scenario/` changes. This is rendering only, so physics, tuning and `effects.json` stay valid.
- Live and Compare modes keep working unchanged.

## 2. Looks

### 2.1 Day look (default) — "architectural model"
- **Ground:** one generated `CanvasTexture`, 2048² on high quality and 1024² on low. The map space it is drawn in is the full grid: 128 cells × 4 m = 512 m.

  | Land use | Colour |
  |---|---|
  | lawn | sage `#dfe6d3`, with ±3% per-cell lightness noise from a seeded RNG |
  | road | `#f4f1ea`, with 1 px kerb lines in `#e2ddd2` at road/non-road boundaries |
  | roof (lot) | `#fbfaf7`, with a 2 px soft shadow offset to the south-east |
  | park | `#cfdcc0` |
  | pond | `#cfe0e0` (pond bed) |
  | river | `#9fd0e0` |
  | bioswale | `#c7d9b5` |

- **Trees:** about 400 low-poly trees drawn as one `InstancedMesh`: a cone canopy on a cylinder trunk, canopy `#9cc29a`, trunk `#b8a58a`.
  - Placement is deterministic from seed 42.
  - Trees go on park and hill cells, and on lawn cells within 12 m of the boulevard.
  - Never on road, roof, pond or river cells. Never within 6 m of a drain node.
  - Scale varies 0.8–1.2.
- **Skirt (soil cross-section):** the side walls of the terrain from its edge down to elevation −4 m.
  - topsoil band `#b9a887`, 0.6 m thick;
  - sandy clay below `#cbbfa8`;
  - the river face on the south side is `#7fb8cf`.
- **Lighting:**
  - `HemisphereLight` (sky `#ffffff`, ground `#d8d2c4`, 0.9);
  - a warm `DirectionalLight` (`#fff2df`, 1.6) from the south-west at 40° elevation, with PCF soft shadows from a 2048² map (1024² on low) and a shadow frustum fitted to the site;
  - `ACESFilmicToneMapping` at exposure 1.0;
  - a sky gradient background from `#f6f3ee` (top) to `#dde9f2` (horizon);
  - `Fog` in `#e9eef2`, from 900 to 1800 world units.
- **Water (day):**
  - colour runs from `#bfe3ec` at 0 m depth to `#2b7fb8` at 1 m or more;
  - opacity runs from 0.25 at the waterline to 0.85 at 0.5 m or more;
  - a Fresnel highlight;
  - slow animated ripples, as normal perturbation from two scrolling sine fields;
  - a shallow-edge foam band where 0.01 < depth < 0.04 m, colour `#ffffff` at 60%;
  - the water surface uses bilinear-smoothed depths, and the wet/dry threshold stays at 0.01 m.

### 2.2 X-ray look — "digital twin"
- **Toggle:** the 🩻 X-ray button. The look transitions over 600 ms by blending the theme from t = 0 to t = 1, or back.
- **Ground:**
  - the texture switches to an x-ray variant: background `#142033`, road outlines `#2e4a6e`, lot outlines `#22344f`;
  - terrain opacity eases to 0.35, so underground pipes show through;
  - trees scale to 0 and are hidden at t = 1;
  - the skirt turns `#1c2c44`.
- **Background:** a radial gradient from `#1b2a41` to `#0a111c`. Fog is off.
- **Water:** `#19c3ff` at 0 m to `#0d6fb5` at 1 m, opacity 0.55, emissive so it blooms.
- **Pipes:**
  - the above-ground pipe meshes are hidden;
  - ribbon tubes are shown at each pipe's real invert elevation (vertical scale `VERT`), radius `max(1.2, d·3)`;
  - colour by load, the same thresholds as today but glowing: green `#39ffb0` → yellow `#ffd84d` → red `#ff4d6d`.
- **Flow arrows:**
  - chevrons scroll along each ribbon in the direction from → to;
  - speed = `0.2 + 1.8·clamp(load, 0, 1)` ribbon-lengths per second;
  - a pipe with load < 0.02 shows no arrows.
- **Manholes:** overflowing manholes (fill ≥ 0.999) pulse red with bloom.
- **Bloom:** `UnrealBloomPass` (strength 0.9, radius 0.4, threshold 0.6), active only while x-ray t > 0.

### 2.3 Plan view
- **Toggle:** **3D | Plan**. It switches to an `OrthographicCamera` looking straight down, framing the whole site with a 16 px margin. The switch animates over 500 ms by interpolating the camera position and up vector.
- **Controls:** pan (drag) and zoom (wheel/pinch) only. Rotation is disabled.
- **Drawing:** day look with shadows and trees off. Pipes are drawn as flat ribbons 1 m above the ground, coloured by load, with flow arrows (the same component as x-ray, flattened). X-ray also works in plan view.
- **Overlay:** "N ↑" and a 50 m scale bar in the lower-left corner, sized from the camera zoom.
- **Picking:** drawing pipes and pins keep working. Raycasting uses the active camera.

### 2.4 Pins
- 28 px round badges with a 10 px stem down to the anchor:

  | State | Look |
  |---|---|
  | installed | solid `#2b8a8a`, white icon |
  | available | white, `#2b8a8a` 2 px ring |

  Both have a soft shadow `0 2px 6px #0003`.
- In x-ray, pins get a `#0f1b2c` fill with a `#19c3ff` ring and a white icon. Installed pins have a cyan fill.
- Implemented with CSS classes on the existing `PinLayer`; the shell sets an `xray` class on the viewport.

## 3. Architecture

New files in `src/render/`:

| File | Responsibility |
|---|---|
| `theme.ts` | `DAY` and `XRAY` palettes (all colours above) and `blendTheme(t)`, which linearly interpolates colours and numbers. Pure. |
| `groundTexture.ts` | `landColor(code, theme)`, which is pure; and `paintGround(grid, theme, size)`, which returns a canvas texture. Regenerated only when the grid changes (bioswales) or the quality changes. |
| `waterMaterial.ts` | `ShaderMaterial` for water, with uniforms for theme colours, time and opacity. The depth comes from a vertex attribute. |
| `trees.ts` | `placeTrees(grid, nodes, seed): Array<{x, y, scale}>`, which is pure; and `createTrees(positions)`, which builds the `InstancedMesh`. |
| `skirt.ts` | Soil cross-section meshes around the terrain edge. |
| `flowArrows.ts` | Pure `arrowSpeed(load)` and `arrowOffset(t, load)`; plus the ribbon tube meshes with a scrolling chevron shader, updated from `Frame.pipeLoad`. |
| `postfx.ts` | `EffectComposer` → `RenderPass` → `UnrealBloomPass` (enabled while x-ray) → `OutputPass`. |
| `cameras.ts` | Perspective camera + `OrbitControls`, orthographic camera + pan/zoom controls, and the animated switch. |
| `fpsGuard.ts` | Pure `FpsGuard`: a rolling 3 s average that reports when the frame rate stays below 30 fps. |

`scene.ts` stays the conductor. `SceneHandle` gains:
- `setXray(on: boolean)`
- `setView(view: '3d' | 'plan')`
- `setQuality(q: 'high' | 'low')`
- `onQualityAutoDrop(fn)`

Changes to existing files:
- `terrain.ts`: uses the ground texture plus the skirt.
- `water.ts`: uses `waterMaterial`, with a per-vertex depth attribute and smoothing.
- `network.ts`: keeps the surface pipes for the day look; hands x-ray and plan over to `flowArrows`.
- `pins.ts`: x-ray CSS class support.
- `index.html`: viewport toolbar with 🩻 X-ray, 3D | Plan and Quality (High/Low).
- `main.ts`: wires the toolbar.

## 4. Quality and performance

| Setting | High | Low |
|---|---|---|
| Shadows | on | off |
| Bloom (x-ray only) | on | off |
| Water ripples | on | off |
| Ground texture | 2048² | 1024² |
| Shadow map | 2048² | — |
| Pixel ratio | min(dpr, 2) | 1 |

- **Auto-drop:** if the 3-second average is below 30 fps while on High, the app switches to Low once and shows a status line: "Switched to Low quality for smoother playback — change in the toolbar." It never switches back automatically.
- No per-frame allocations in the render loop (reuse vectors and colours). Instanced trees use one draw call.

## 5. Error handling

| Situation | Behaviour |
|---|---|
| WebGL context lost | Show a status "Graphics reset — reloading view" and rebuild the scene on `webglcontextrestored`. |
| Shader compile failure | Fall back to the existing `MeshPhongMaterial` water and log the error. The app keeps working. |

## 6. Testing

**Unit tests (`npm test`, node environment):**
- `blendTheme`: t = 0 equals `DAY`, t = 1 equals `XRAY`, t = 0.5 is the midpoint for a sample colour and number.
- `landColor`: each land-use code maps to its spec colour in each theme.
- `placeTrees`: deterministic for the same seed; every tree is on an allowed cell, away from drain nodes; the count is between 300 and 500.
- `arrowSpeed`: 0.2 at load 0, 2.0 at load ≥ 1, monotonic. Loads below 0.02 mean no arrows.
- `FpsGuard`: no trigger at a steady 60 fps; triggers after 3 s at 20 fps; triggers only once.

**Browser checklist additions (`docs/browser-checklist.md`):**
- day look;
- x-ray transition and arrows;
- plan view pan/zoom, overlay and picking;
- pins in both looks;
- the Low quality toggle;
- the auto-drop (simulate by throttling the CPU in DevTools);
- Live and Compare unchanged.
