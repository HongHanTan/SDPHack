# Team UI, Part 4: X-ray View and the 2D / 3D Toggle

**Builds on:** Part 3, `2026-10-23-team-ui-engine-design.md` (apps/web driven by the engine).
**Date:** 2026-10-20

## 1. Goal

Bring two views from the legacy app (`apps/legacy`) back into `apps/web`, TEH JIA JIE's React + react-three-fiber UI:

- **X-ray:** the dark, glowing look that shows pipes and water through a faded surface.
- **2D / 3D toggle:** a top-down plan view with pan, zoom and a scale bar.

Jiajie's three twin views (Digital Twin, Realistic Surface, Underground Only) all stay.

## 2. Scope and state

- **Data modes:** Engine, Mock and SWMM API all get both toggles, because they are view-only. Both start **off** (X-ray off, 3D), so Jiajie's default scene is unchanged.
- **New code:** in `apps/web/src/view/`. Edits to his files are small and only take effect when a toggle is on.
- **State in `App.tsx`:**
  - `xray: boolean`
  - `viewDim: '3d' | '2d'`

  Both are independent of his `twinViewMode`.
- **`view/ViewLookContext.tsx`:** provides `{ lookRef, ghost, is2d }` to scene components (the provider sits inside the R3F `Canvas`).
  - `lookRef.current.xrayT` eases 0 → 1 (or back) over **0.6 s**, as in the legacy `XRAY_FADE_S`. Continuous effects (lights, fog, water colour, pipe colours) read it in `useFrame`, so the fade doesn't re-render React.
  - `ghost` is `xrayT >= 0.5`, a React state for the discrete switches (ghost materials, ribbons, bloom, hidden trees).
  - Components outside the provider get `xrayT = 0`, `ghost = false`, `is2d = false`, which is Jiajie's original look.

## 3. X-ray

- **Toggle:** a "🔬 X-ray" button in the SceneViewer top bar, beside his view buttons. It can be combined with any of his views.
- **Theme:** `view/xrayTheme.ts` ports the legacy `theme.ts`.
  - `DAY` holds this app's current values: background and fog `#f1f5f9` (fog 200 → 480), ambient 1.3, key light 2.4, fill light 0.8.
  - `XRAY` holds the legacy x-ray values: sky `#0a111c` / `#1b2a41`, fog pushed out, dim lights, water `#19c3ff` / `#0d6fb5` with glow, pipe colours `#39ffb0` / `#ffd84d` / `#ff4d6d`, bloom 1.
  - `blendTheme(t)` mixes colours per channel and numbers linearly.
- **Surface (`TownshipEnvironment`):**
  - Houses, roads, lawn, cul-de-sac, cars, lake and canal are drawn **ghosted**: dark blue `#1c2c44`, opacity about 0.35, no depth writes.
  - Trees are hidden.
  - Text labels stay as they are.
  - In practice, ghosting means one shared ghost material that replaces each mesh's material while `xrayT ≥ 0.5`; below 0.5 the original materials are used.
- **Water:**
  - Engine mode: `EngineWater` blends to the x-ray water colours and adds emissive glow.
  - Mock/API: `PondingWaterAnimation` keeps its own look (it is excluded from ghosting).
- **Pipes:** `view/FlowRibbons.tsx` ports the legacy `FlowRibbons`, with these behaviours:
  - one tube per conduit, at its true depth (inverts);
  - a chevron shader whose scroll speed comes from the frame's `capacity_fraction` (the legacy `flowMath` `advancePhase` / `arrowsVisible`);
  - colour from `capacity_fraction` (`low → mid → high`);
  - rendered while `xrayT ≥ 0.5`. Jiajie's solid `ConduitMesh` stays underneath for clicking.
  - Manholes (`NodeMesh`) get emissive glow in x-ray.
- **Bloom:** add the dependency `@react-three/postprocessing`. An `EffectComposer` with `Bloom` is mounted only while X-ray is on, with intensity from the theme.
- **X-ray + Underground Only:** his surface is already hidden, so the result is the x-ray theme with no surface.

## 4. 2D / 3D

- **Toggle:** a "3D | 2D" switch in the SceneViewer top bar.
- **`view/ViewRig.tsx`** ports the legacy `CameraRig`:
  - **3D → 2D:** save the current orbit pose, then animate the perspective camera to straight overhead over **0.5 s** with smoothstep easing. At the end, switch to an orthographic camera (drei `OrthographicCamera` `makeDefault`, `up = (0,0,-1)` so north is at the top) with `MapControls` (rotation off, pan + zoom).
  - **Frame size:** the ortho frame fits the site (the team lawn extent, 240 × 280 m centred at scene x 45, z −10) with a 16 px margin, as in the legacy `resize`.
  - **2D → 3D:** swap back to perspective at the overhead pose, then animate back to the saved pose.
  - **Camera presets:** Jiajie's presets (Overview, D07 Lowland, Outfall, Upstream) are disabled in 2D.
- **What 2D draws:**
  - trees are hidden;
  - 3D text labels are hidden;
  - `FlowRibbons` are drawn at ground level and on top (`depthTest: false`), in the current theme's pipe colours;
  - roofs, roads and water stay visible;
  - X-ray still works in 2D.
- **`view/ScaleBar.tsx`:**
  - an HTML overlay that appears in 2D;
  - picks the largest of 10/20/50/100/200 m that fits in 160 px, as in the legacy `updateScaleBar`;
  - reads metres per pixel from the rig.
- **Clicking:** pipes and manholes stay selectable in 2D. `ConduitMesh` and `NodeMesh` keep their pointer handlers.

## 5. Files

- **New:**
  - `apps/web/src/view/ViewLookContext.tsx`
  - `xrayTheme.ts`
  - `FlowRibbons.tsx`
  - `flowMath.ts` (ported)
  - `ViewRig.tsx`
  - `ScaleBar.tsx`
  - `scaleBar.ts` (pure step choice)
  - tests in `view/__tests__/`
- **Edited (gated):**
  - `SceneViewer.tsx`: the toggles, the provider, lights and fog from the theme, the rig, bloom, ribbons, node glow.
  - `TownshipEnvironment.tsx`: ghosting and hiding trees and labels, read from context.
  - `EngineWater.tsx`: x-ray colours.
  - `App.tsx`: state and props.
- `apps/legacy` is not changed.

## 6. Tests and verification

- **Unit tests (Vitest):**
  - `blendTheme` endpoints and midpoint;
  - `advancePhase` / `arrowsVisible` / the load colour;
  - scale-bar step choice;
  - ortho frame size for a given viewport.
- **Builds and tests:** `npm -w township-floodops-web test`, `npm -w township-floodops-web run build`, and root `npm test`.
- **`docs/browser-checklist.md`:** add a "Team UI: X-ray and 2D" section covering:
  - X-ray on/off with each of his three views;
  - the 0.6 s fade;
  - the chevron speed following load in engine mode;
  - 2D glide and return to the previous angle;
  - pan/zoom only in 2D;
  - the scale bar changing with zoom;
  - 2D + X-ray;
  - clicking a pipe in 2D opens his asset panel;
  - Mock and SWMM API modes with both toggles.

## 7. Credit

- Commits are by the user only, with no co-author lines.
- Commit bodies note "Ported from the legacy FloodOps viewer (apps/legacy)" and "SceneViewer/TownshipEnvironment by TEH JIA JIE; view toggles gated."
