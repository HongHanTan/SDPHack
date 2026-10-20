# Team Integration, Part 2: Engine Township on Taman Kyra

**Builds on:**
- `2026-10-23-team-merge-design.md`, part 1 (done: monorepo with `packages/engine`, `apps/legacy`, `apps/web`).
- The flood-sim, live-mode and visual-upgrade specs.

**Date:** 2026-10-23

## 1. Goal

Replace the engine's synthetic "classic" township with the team's **Taman Kyra** town, so the physics and the team's 3D scene describe the same place:
- **Network:** Tay's network data (`data/synthetic/taman_kyra_assets.json`).
- **Layout:** Jiajie's scene layout (`apps/web/src/components/TownshipEnvironment.tsx`).

Then retune the demo story around the team's options plus ours, and cross-check our pipe flows against Tay's EPA SWMM 5.2 runs.

**Out of scope:**
- React UI changes. That's part 3.
- Physics-core changes (`src/sim/` solver, coupling and engine loop). The only exception is new *scenario* parameters, such as grate blockage, which are applied when the township is built.

## 2. Layout data (single source of truth)

### 2.1 `data/synthetic/taman_kyra_layout.json` (new)
- Derived from `TownshipEnvironment.tsx` by TEH JIA JIE. The file's `source` field and the commit message credit him.
- In part 3 his component is changed to read this file, so the scene and the physics share one layout.
- Coordinates are in Tay's local datum (metres east `x`, north `y`). The 3D scene uses `(x, elevation, −y)`.
- **Contents:**

| Key | Contents |
|---|---|
| `roads` | `[{ id, kind: 'straight', x, y, width, length, angleDeg }]` and `{ id: 'cul-de-sac', kind: 'circle', x, y, radius }`. Values from his `DetailedRoadSegment`/`CulDeSac` props, converted with `y = −sceneZ`. |
| `north_street` | centre (45, 120), width 13, length 145, east–west |
| `mid_street` | centre (65, 80), width 11, length 105, east–west |
| `main_avenue` | centre (45, 0), width 15, length 155, east–west |
| `drainage_boulevard` | centre (40, 35), width 13, length 195, north–south |
| `east_connector` | centre (85, 40), width 10, length 95, 45° |
| `cul-de-sac` | centre (120, 80), radius 10.5 |
| `houses` | `[{ id, x, y, rotationDeg, scale }]`, generated **once** by running his six placement loops (same ranges, skips and rotations) and written out as data. Each house footprint is 12 × 13 m (× scale), centred on (x, y) and rotated. |
| `lake` | `{ id: 'maple_grove_pond', x: 130, y: 30, radius: 20 }` |
| `canal` | `{ id: 'east_outfall_canal', x: 40, yFrom: −127.5, yTo: −52.5, width: 15.6, wallHeight: 2.0 }` |
| `trees` | his tree positions, written out as data (used by part 3 rendering; the physics ignores them) |

### 2.2 Generator
- `packages/engine/scripts/extractLayout.ts` reproduces his loops in one place and writes the JSON. It is run once, and the output is committed.
- The JSON is the source of truth. The script is kept only for traceability. A test checks that the house count and the first and last positions match his loops.

## 3. Terrain grid (`packages/engine/src/scenario/terrain.ts`, rewritten)

- **Extent:** x ∈ [−80, 170], y ∈ [−140, 150] in the team datum. `dx = 2 m`, so `nx = 125` and `ny = 145`.
- **Origin:** `DATUM = { x0: −80, y0: −140 }`. Grid-local metres are `(x − x0, y − y0)`. `toLocal` and `toTeam` converters are exported for part 3.

### 3.1 Ground surface
- Inverse-distance-weighted (power 2) interpolation of the 9 node `ground_elevation_m` values from the assets.
- **Roads:** cells whose centre lies inside a road shape are ROAD and sit 0.10 m below the interpolated ground (kerb).
- **Houses:** cells inside a house footprint are ROOF and carry a building id.
- **Lake:** cells within the radius are POND. Ground is a bowl down to `LAKE.bedZ` (default 9.2). The initial water level is `LAKE.waterLevel` (default 9.8). It must stay below NODE-J04's invert of 10.0, so that a relief pipe from J04 can discharge by gravity.
- **Park:** cells within the lake radius plus 12 m are PARK.
- **Canal:** cells inside the canal rectangle are RIVER, with bed `CANAL.bedZ` (default 7.6). The wall cells along both long edges are raised to `ground + CANAL.wallHeight`.
- **J07 dip:** a bowl centred on NODE-J07 (40, 0), radius `DIP.radius` (default 30 m) and depth `DIP.depth` (default 0.5 m). It is applied to non-canal cells, so water gathers at the junction. All three values are tunable.
- **Other cells:** LAWN.
- **Infiltration:** unchanged per land use.

## 4. Network and inlets (`packages/engine/src/scenario/network.ts`, rewritten)

- **Nodes:**
  - one per asset node, with `id = node_id`;
  - grid-local position;
  - `invert = invert_elevation_m`;
  - `maxDepth = max_depth_m`;
  - `area = MANHOLE.area` (1 m²).
- **Pipes:** one per conduit, with `id = conduit_id`, and `diameter_m`, `length_m` and `manning_n` as given. Slope comes from the inverts, as now.
- **Outfall:** NODE-OUT01 discharges to the nearest canal cell. The orifice area is that of PIPE-P08, Ø750.
- **Inlets:**
  - For each asset inlet, its node gets `inletPerimeter = 4·√grate_area_m2·(1 − blockage)`, where `blockage` comes from the scenario (default 0).
  - Nodes without an asset inlet get `inletPerimeter = 0`.
  - `INLET_SUMP` (gully sump depth) is kept as a tunable.
- **Baseline blockage:** `{ 'INLET-D07': 0.4 }`.

## 5. Storms and river cases (`packages/engine/src/scenario/storms.ts`)

**Storms** (the type is `StormId`):

| Storm ID | Shape | Rain | Recession |
|---|---|---|---|
| `synthetic_80mmh_60min` | constant 80 mm/h | 12 blocks of 5 min | 3600 s |
| `synthetic_120mmh_60min` | constant 120 mm/h | 12 blocks of 5 min | 3600 s |
| `10yr` | MSMA 10-year (existing) | — | 3600 s |
| `100yr` | MSMA 100-year (existing) | — | 3600 s |

- The default storm is `synthetic_80mmh_60min`.
- `Storm` gains `peakMinute`, so live-mode jump targets work per storm: 30 for the constant storms, 60 for MSMA.

**River cases** (`TailwaterCase = 'normal' | 'high'`), giving a constant canal stage:
- `normal`: 8.2 m (the OUT01 invert);
- `high`: 9.4 m (invert + 1.2 m).

**Scenario options:** `buildScenario(ids, stormId, custom?, opts?: { tailwater?: TailwaterCase })`. The tailwater default is `normal`. The tailwater case is included in `scenarioKey`.

## 6. Interventions (`packages/engine/src/scenario/interventions.ts`, rewritten)

| id | Name | Model change | costRM (placeholder) | Disruption | Team cost rating / timeframe |
|---|---|---|---|---|---|
| `desilt-d07` | Emergency desilting of INLET-D07 | D07 blockage → 0 | 15 000 | Low | LOW / < 24 h |
| `upsize-p07` | Upsize PIPE-P07 to Ø750 | P07 diameter 0.6 → 0.75 | 1 200 000 | High | HIGH / 3–6 months |
| `flap-gate` | One-way valve at OUT01 | outfall flapGate = true | 150 000 | Low | — |
| `storage-tank` | Underground storage tank near J07 | node TK (area 1500 m², depth 3 m), pipe J05→TK Ø900, TK→J08 Ø150 | 2 500 000 | Medium | — |
| `lake-overflow` | Overflow from J04 to Maple Grove pond | node LK at the lake centre, with storage equal to the lake's live volume (waterLevel → waterLevel + 1.0 m); pipe J04→LK Ø600 | 1 800 000 | Medium | — |
| `pump` | Pump station at J08 | pump at J08, 0.5 m³/s → canal | 3 000 000 | Medium | — |

- The scenario-level blockage is set before interventions are applied, so `desilt-d07` overrides it.
- **Combos** (UI data, kept in `apps/legacy` catalog now and used in part 3):
  - "Combined desilt + upsize" = `desilt-d07` + `upsize-p07` (the team's Option 3);
  - "High-river defence" = `flap-gate` + `pump`.

## 7. Metrics
- `sagCell` becomes the J07 junction cell. The legacy UI relabels "sag" as "J07 junction".
- "Homes flooded" uses the house footprints from the layout file.
- The other metrics are unchanged.

## 8. Story test (`packages/engine/tests/story.test.ts`, rewritten)

All results come from the physics; nothing is hard-coded. Storm `synthetic_80mmh_60min`.

| # | Scenario | Assertion |
|---|---|---|
| 1 | Baseline (D07 40%, normal tailwater) | peak J07 depth ≥ 0.15 m and homes flooded ≥ 2 |
| 2 | `desilt-d07` | J07 peak < baseline, and P07 still reaches full load (max pipeLoad ≥ 0.99) |
| 3 | `upsize-p07` | J07 peak < baseline |
| 4 | `desilt-d07` + `upsize-p07` | J07 peak < both #2 and #3 |
| 5 | High tailwater | `flap-gate` and `pump` each give a lower J07 peak than the high-tailwater baseline |
| 6 | `storage-tank`, `lake-overflow` (normal) | each changes the J07 peak by ≥ 0.03 m against baseline |
| 7 | Every run | water balance error < 1% |

- **Tunables:** `DIP`, `LAKE`, `CANAL`, `INLET_SUMP`, `WEIR_C` (in scenario config), the tank and pump sizes, and the relief-pipe diameter.
- **Out of bounds:** physics-core changes, and values outside physical sense (pipe diameters outside 0.3–1.5 m, dip depth > 1 m).
- If a criterion can't be met honestly, remove it from the test, record why in `docs/tuning.md`, and adjust the story text.

## 9. SWMM cross-check (`packages/engine/tests/swmm.crosscheck.test.ts`, new; slow suite)

- **Our run:** storm `synthetic_80mmh_60min`, blockage `{}` (D07 clean), normal tailwater.
- **Reference:** `data/validation/t1/baseline/frames.json` (EPA SWMM 5.2.4, run by Tay Zheheng). Use per-pipe `flow_m3s` at each `timestamp_s`.
- **Sampling:** our per-pipe flow uses `pipeLoad × qFull` from the frames, resampled to 60 s.
- **Assertion:** for PIPE-P03, P05, P07 and P08:
  - |ourPeak − swmmPeak| / swmmPeak ≤ 0.30;
  - |ourPeakTime − swmmPeakTime| ≤ 600 s.
- **Report:** the test writes `docs/swmm-crosscheck.md`, a table of all 8 pipes (SWMM peak, our peak, % difference, peak-time difference) plus a caveats paragraph:
  - SWMM routes runoff straight into the nodes, while ours routes overland through capacity-limited grates;
  - SWMM uses dynamic-wave pressure flow, while ours caps at full-bore capacity.
- **Fallback:** if ±30% / 10 min can't be met with the tunables in §8, change the test to report-only (always passes, still writes the table) and record the gap in `docs/tuning.md`.
- **Scripts:** add the test to the `story` npm script, and exclude it from `test`.

## 10. Effect badges
- `computeEffects` covers the 6 interventions × 4 storms with normal tailwater, plus `flap-gate` and `pump` × the 2 constant storms with high tailwater.
- `effects.json` gains a `tailwater` level: `{ [tailwater]: { [stormId]: { [interventionId]: { dSag, dHomes } } } }`. `effectOf(storm, id, tailwater = 'normal')` is updated accordingly.
- The drift test covers the same matrix.

## 11. Legacy UI (minimal)
- `apps/legacy/src/ui/catalog.ts`:
  - labels, icons and groups for the 6 new interventions;
  - sites taken from the asset node positions (TK from its config, LK at the lake);
  - the two combos above.
- Wherever the legacy UI lists storms, it uses the four storms.
- There is no tailwater selector in legacy; it uses `normal`.
- Fix compile errors from the removed classic constants: BIOSWALE, TANK, POND, NODE_LAYOUT, SAG_CHART_POINT, BUND, RIVER_ROWS and others.
- Rendering adapts automatically, because terrain, trees and the skirt are grid-driven. If the tree placer depends on classic-only constants, give it Taman Kyra equivalents (allowed cells: PARK, plus LAWN within 8 m of roads).
- Update `apps/legacy/tests/**` expectations for the new ids and sites. No new legacy features.

## 12. Tests and docs
- **`packages/engine/tests/scenario/township.test.ts`, rewritten:**
  - grid size 125×145;
  - every asset node and pipe present with exact ids and values;
  - D07 blockage applied;
  - roads, houses, lake and canal land types at known cells;
  - the J07 dip is lower than the cell 40 m east;
  - each intervention applies;
  - water balance < 1% per intervention on a short storm.
- **Layout test:** the house count and the first and last house match his loops.
- **Docs:**
  - `docs/tuning.md` rewritten for Taman Kyra;
  - `docs/swmm-crosscheck.md` generated;
  - the assumptions panel gets rows for the datum, the layout source (Jiajie) and the SWMM cross-check (Tay).
- **Commits:** authored by the user only, no co-author lines. Commit messages that add derived team content credit the source author in the message body, e.g. "Layout derived from TownshipEnvironment.tsx by TEH JIA JIE".
