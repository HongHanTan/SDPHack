# Team Integration, Part 3: The Team React UI Driven by the Engine

**Builds on:**
- Part 1, `2026-10-23-team-merge-design.md` (monorepo);
- Part 2, `2026-10-23-taman-kyra-engine-design.md`, including amendments §13–§15 (the Taman Kyra engine).

**Date:** 2026-10-23

## 1. Goal

Make `apps/web`, TEH JIA JIE's React + react-three-fiber + Tailwind app, the product UI, driven by `@floodops/engine`. The engine supplies:
- the real water surface rising over time;
- rain;
- pipe and manhole colours from the physics;
- live mid-storm changes.

His houses, trees, roads, header, HUD, dashboard and ticker stay, and his and Tay's original Mock and SWMM-API modes keep working.

**Credit and authorship:**
- Commits are by the user only, with no co-author lines.
- Changes to teammates' files are small and targeted. New integration code lives in `apps/web/src/engine/`.
- Commit bodies credit the reused work where relevant.

## 2. Data source

- `apps/web/src/api/client.ts`: `DataMode` becomes `'engine' | 'mock' | 'api'`.
  - The default is `'engine'` when neither `localStorage` nor `VITE_DATA_MODE` sets one.
  - In `'engine'` mode, every method delegates to `engineSource`. The other modes are unchanged.
- **`apps/web/src/engine/engineSource.ts`:**

| Call | Engine mode returns |
|---|---|
| `getHealth()` | `{ status: 'ok', engine: 'floodops-ts' }` in his `HealthResponse` shape |
| `getBootstrap()` | his `BootstrapResponse` with the 4 storms (IDs `synthetic_80mmh_60min`, `synthetic_120mmh_60min`, `10yr`, `100yr`), debris scenarios for D07 blockage 0/20/40/60%, tailwater cases `normal`/`high`, and the model version |
| `getTownshipAssets()` | Tay's assets in his format (team datum), plus nodes and conduits added by the active interventions (TK, LK, PIPE-TK-IN/OUT, PIPE-LK) |
| `createSimulation(req)` | maps the storm, blockage and tailwater from his request, plus the selected interventions, to `buildScenario(...)`, and runs it on the engine compare worker (via the engine's `SimRunner`). Returns a run id. |
| `getSimulation(runId)`, `getSimulationFrames(runId)`, `getSimulationMetrics(runId)` | the run's adapted results |

- **Interventions:** selected through `engineSource.setInterventions(ids: InterventionId[])`, which `App.tsx` calls from the dashboard's Apply action.
- **Pure functions (`apps/web/src/engine/frameAdapter.ts`):**
  - `toTeamFrame(frame, network, grid, opts) → SimulationFrame`. It produces:
    - `pipe_states`, each with `flow_m3s = pipeLoad × qFull`, `depth_m = diameter × min(1, pipeLoad)`, `capacity_fraction = pipeLoad`, and `status` = `surcharged` if ≥ 0.999, `near_capacity` if ≥ 0.8, else `normal`;
    - `node_states`, each with `depth_m = fill × maxDepth`, `surcharge_flag = fill ≥ 0.999`, `status` = `flooding` if surcharged and the surface depth at the node cell is > 0.01 m, `surcharged` if surcharged, else `normal`, and `flooding_rate_m3s = 0`;
    - `inlet_states`, one per asset inlet, with the fields his type requires set from node fill and blockage;
    - a non-enumerable side field `surface_depth: Float32Array`, the engine depth grid.
  - `toTeamMetrics(metrics, framesTeam, opts) → SimulationMetricsResponse`:
    - `total_flooding_volume_m3`: the surface volume above the 0.15 m road threshold at peak;
    - `flooded_node_count`: nodes ever flooding;
    - `surcharge_duration_s`: seconds any trunk pipe is surcharged;
    - `peak_flow_m3s`: the P07 peak;
    - plus extra fields `j07_peak_depth_m` and `homes_flooded`.
  - `assumptions`, `status_definitions` and `engine: 'FloodOps TS engine'` are filled honestly. `result_type` stays `'simulated'`.

## 3. Scene

- **Layout:**
  - `TownshipEnvironment.tsx` builds its houses, trees, roads, cul-de-sac, lake and canal from `data/synthetic/taman_kyra_layout.json`, using the same values its loops produced.
  - The layout JSON gains `surfaceZ` per road, from his component: north 12.15, mid 11.85, main avenue 10.98, boulevard 11.2, east connector 11.5, cul-de-sac 11.86.
  - The extractor script is updated to emit `surfaceZ`, and its test checks the values.
- **Visual ground** (`apps/web/src/engine/visualGround.ts`): `visualGround(xTeam, yTeam)` returns the road `surfaceZ` where the point is on a road, otherwise the lawn 10.8, minus the engine's DIP and FUNNEL bowls (same centres, radii and depths, imported from `@floodops/engine/scenario/config`).
  - His lawn plane becomes a 2 m-segmented plane displaced by `visualGround`.
  - His `DetailedRoadSegment` and `CulDeSac` get an optional `heightAt(x, y)` prop. When it's given, their top surface, curb and marking meshes are subdivided and displaced. Without it, they render exactly as before.
- **Water** (`apps/web/src/engine/EngineWater.tsx`):
  - An R3F mesh over the engine grid (125 × 145, 2 m), placed through `toTeam`.
  - Vertex height `visualGround + depth`, with depth from the current frame's `surface_depth`, smoothed with the engine's 3×3 wet-cell smoothing.
  - Cells under 0.01 m are hidden.
  - Material: the teal → deep-blue shader with foam and ripples, ported from `apps/legacy/src/render/waterMaterial.ts`.
  - Rendered only in engine mode, replacing `PondingWaterAnimation`.
- **Pipes and manholes:** his `SceneViewer` colouring is used unchanged, from the adapted statuses.
- **Rain:** in engine mode, `stormIntensityMmh` and `isRainActive` come from `rainIntensityAt(storm, t)` at the current frame time.

## 4. Live

- `apps/web/src/engine/useLiveEngine.ts` is a React hook over the engine's live worker. It exposes:
  - `start(storm, ids, opts)`, `pause`, `resume`, `setSpeed(0.5|1|2|4)`, `seek('start'|'peak'|'end')`, `patch(ids, label)`;
  - the latest adapted frame, `t`, and readouts;
  - session-id filtering, as in the legacy fix.
- His `SimulationHUD` gets a **Playback | Live** switch, shown in engine mode only.
  - **Live:** the scrubber is hidden; the speed and jump controls are shown; Apply in the dashboard or an asset popup patches.
  - **Playback:** his existing flow.

## 5. Dashboard, header, HUD

- **`InterventionDashboard.tsx`:** the hard-coded `options` array is replaced by props built in `apps/web/src/engine/dashboardOptions.ts`, from the engine catalog, `effects.json` and our metrics. There are 7 cards (spec §15 of part 2):
  - Baseline;
  - Desilt D07;
  - Upsize P07 Ø750;
  - Storage tank;
  - Lake overflow;
  - Combined desilt + upsize (tag "Optimal Holistic Solution");
  - Store the peak.

  Each has a finding line. The Desilt finding is: "No effect on its own while P07 runs full; adds benefit once P07 is upsized." His action-plan and crew sections read the selected option's fields. His "120 mm/h" heading uses the selected storm label.
- **`StatusHeader.tsx`:** a three-way Engine | Mock | SWMM API switch, calling his existing `onToggleMode`.
- **`SimulationHUD.tsx`:**
  - storms from the engine bootstrap;
  - the debris selector maps to the D07 blockage;
  - tailwater maps to the canal level;
  - the metrics panel shows `j07_peak_depth_m` and `homes_flooded` when present.
- **`App.tsx`:** in engine mode, it doesn't render `FieldInspectorsManager`, inspector avatars, `InspectionModal` or `VirtualDebrisLab`, and hides "load verified run". Mock and API modes are unchanged.

## 6. Error handling

| Situation | Behaviour |
|---|---|
| A worker error or crash in engine mode | Surfaces through his existing `apiError` path with the engine message. It never falls back to mock silently (his core principle 3). |
| The adapter meets a frame whose sizes don't match the current network | It returns null statuses for the mismatched entries, rather than throwing. |

## 7. Tests and verification

- **`apps/web`:** add `vitest` and a `test` script. Unit tests:

| Test | Checks |
|---|---|
| `frameAdapter` | status thresholds; flow equals load × qFull; node flooding rule; metrics mapping; size-mismatch safety |
| `visualGround` | road vs lawn heights, J07 dip depth at the centre, funnel effect at the D01 node |
| `dashboardOptions` | 7 cards, desilt finding text present, combined card tagged "Optimal Holistic Solution", numbers taken from `effects.json` |
| layout extractor test | the `surfaceZ` values |

- **Root `npm test`:** includes `apps/web` tests.
- **Builds:** `npm -w township-floodops-web run build` passes.
- **Browser checklist:** `docs/browser-checklist.md` gets a new "Team UI (engine mode)" section covering:
  - water rising at J07 over time on the 80 mm/h storm;
  - pipes turning red;
  - rain stopping at 60 min;
  - the Live toggle patching;
  - dashboard cards and Apply;
  - Mock and SWMM API modes unchanged.
- **Legacy:** `apps/legacy` is kept until the user signs off the browser checklist. Removing it is a separate, user-approved step.
