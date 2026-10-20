# Live Mode, Rain & Intervention UX — Design

**Builds on:** `2026-10-20-flood-sim-design.md` (simulator as built on branch `feat/flood-sim`)
**Date:** 2026-10-21

## 1. Goals

1. Show rain falling during a storm, its strength following the design-storm intensity.
2. Make the intervention controls understandable at a glance for non-engineers (judges, SDP staff).
3. Let users see the flood respond immediately when they add a pipe or switch an intervention on, without re-running the storm.

**Non-goals:** changing the hydraulics, retuning the township, mobile layout.

## 2. Modes

A **Live | Compare** tab switch at the top of the left panel. Both modes share one selection state: installed interventions and custom pipes. Switching modes keeps the selection.

### 2.1 Live (default on page load)
- The storm plays continuously. Speed: ½×, 1×, 2×, 4×, where 1× is one storm-minute per second. Default 1×.
- Controls: Pause/Resume, Restart, and jumps to **Start** (0 min), **Peak rain** (60 min) and **Rain stops** (120 min). A jump restarts from 0 and fast-forwards at full speed, without rendering, to the target minute.
- Toggling an intervention, drawing or removing a custom pipe, or changing the storm takes effect immediately:
  - intervention and pipe changes are applied as a patch (§3.2), so the water state is kept;
  - a storm change restarts the run from 0.
- At the end of the run (rain + recession = 180 min) the simulation pauses, showing "Storm over — Restart".
- **Live readouts** replace the before/after cards:
  - sag depth now, and the highest it has reached so far;
  - homes flooded now (any footprint cell ≥ the home threshold at the current frame);
  - storm clock and current rain (mm/hr);
  - installed cost, including custom pipes;
  - water balance;
  - a sag-depth-so-far chart with an annotation for each change, e.g. "+ valve @ 64 min".

### 2.2 Compare
Behaves as currently built: Run storm, fair baseline vs scenario cards, cost, sag chart, timeline player, both water balances. While a Compare run is in progress, the tab switch, selection and draw controls are disabled, as they are today.

### 2.3 Mode switching
- Entering Compare pauses the Live run without discarding it.
- Returning to Live resumes it if the selection is unchanged. If the selection changed, a patch is applied first.
- Only one simulation runs at a time:
  - Live and Compare use separate workers.
  - The Live worker is paused while a Compare run is in progress.

## 3. Live engine

### 3.1 Worker protocol (new live worker, `src/worker/live.worker.ts`)
Main → worker:
- `start{stormId, interventions, custom}`
- `patch{interventions, custom, label}`
- `setSpeed{speed}`
- `pause`
- `resume`
- `seek{minute}`
- `stop`

Worker → main:
- `frame{frame, rainMmHr, readouts}`, sent every 10 storm-seconds.
- `ended`
- `error{message, step}`
- `patched{label, t}`

The worker keeps one `EngineState`. A timer tick advances the simulation by `speed × elapsed wall seconds × 60` storm-seconds, capped per tick so a slow machine degrades to slower playback, never to a frozen UI. The simulation stays deterministic in storm time: wall clock affects only pacing, never the physics.

### 3.2 `patchEngine(state, newScenario)` (in `src/sim/engine.ts`)
- Keeps surface depths `h` and fluxes unchanged.
- Rebuilds `NetworkState` from the new network. Node volumes carry over by node id, clamped to the new `vmax`, with any excess spilled to the surface at that node's cell. Pipe flows reset to 0.
- Nodes absent from the new network spill their whole stored volume onto the surface at their cell.
- Grid changes (bioswales: `z`, `infil`, `land`) take effect from the new scenario; `h` is not adjusted.
- Volume is conserved, so `balanceError` stays meaningful across patches. `storage0` and the accumulators are unchanged.
- Implemented in `src/sim/` with no DOM or three imports, and unit-tested.

## 4. Intervention panel

### 4.1 Content
Each intervention gains display metadata — `label`, `short`, `icon`, `group`, `site {x, y}` — kept in `src/ui/catalog.ts` (a UI concern, so `src/scenario/` stays presentation-free); `costScale` (1–4) is derived from `costRM`.

| id | label | icon | group | site |
|---|---|---|---|---|
| flap-gate | One-way valve at the river | 🚪 | Stop the river coming back | outfall node O |
| detention-tank | Underground storage tank | 🛢️ | Store water for later | tank node TK position |
| relief-pond | Overflow pipe to pond | ↪️ | Store water for later | pond node P position |
| sag-inlets | More drain grates in the low area | 🕳️ | Get water into the drains | node S1 |
| bioswales | Rain gardens on the slope | 🌿 | Get water into the drains | centre of the bioswale strip |
| upsize-trunk | Bigger main drain | ⬇️ | Move water out faster | node T4 |
| pump | Pump station | ⚡ | Move water out faster | 12 m east of outfall node O |

Groups are shown in the order listed. `costScale` is set from `costRM`:

| costRM | costScale |
|---|---|
| < 0.5M | $ |
| < 2M | $$ |
| < 4M | $$$ |
| otherwise | $$$$ |

### 4.2 Row
- Icon, label, cost scale + disruption, effect badge, toggle switch.
- The ⓘ tooltip shows the technical description, RM cost and the homes-flooded change.
- **Badge:** sag peak-depth change vs baseline for the currently selected storm, formatted `−0.11 m`. Green if < −0.005, red if > +0.005, grey otherwise.

### 4.3 Combos
Chips at the top of the panel:

| Chip | Interventions |
|---|---|
| Cheapest fix | flap-gate + detention-tank |
| Clear the roads | sag-inlets + pump |

A click replaces the current selection with the combo's interventions and keeps custom pipes.

### 4.4 Footer
"N installed · RM X.XXM" — interventions plus active custom pipes.

## 5. Map pins

- Built with three.js `CSS2DRenderer` (`three/addons/renderers/CSS2DRenderer.js`). One pin per intervention at `site`, lifted above the ground.
- **Installed:** solid blue with a white icon. **Available:** hollow grey.
- **Click:** opens a popover containing label, description, cost and disruption chips, and an Install switch bound to the same selection state as the panel. Only one popover is open at a time; it closes on outside click or Esc.
- A "Pins" toggle in the viewport corner shows or hides them. Pins are hidden during Draw-pipe mode so they don't intercept manhole clicks.
- The pin layer must not block OrbitControls: only the pin elements themselves receive pointer events.

## 6. Rain

### 6.1 Streaks
`src/render/rain.ts`:
- ~6000 `LineSegments` in a box covering the site, from 0 to 250 world units above the terrain.
- Updated each animation frame:
  - the visible count scales linearly with intensity, up to all 6000 at 150 mm/hr;
  - fall speed is fixed;
  - streaks that leave the box are recycled to the top.
- No streaks when the intensity is 0.
- Driven by `setIntensity(mmHr)`, called from:
  - Live: the latest frame's `rainMmHr`;
  - Compare: the playback frame's `t`.

### 6.2 Intensity lookup
`rainIntensityAt(storm, t)` returns mm/hr. It lives in `src/scenario/storms.ts`, is pure and is tested.

### 6.3 Gauge
- Viewport overlay showing "🌧 NN mm/hr".
- A 24-bar mini hyetograph of the storm with the current block highlighted.

## 7. Pre-computed effects

- **Script:** `scripts/effects.ts` (`npm run effects`) runs the baseline and each single intervention for both storms (16 runs).
- **Output:** `src/scenario/effects.json`:

  ```
  { "<stormId>": { "<interventionId>": { "dSag": number, "dHomes": number } } }
  ```

  Values are rounded to 0.001 m.
- **Drift check:** `tests/effects.drift.test.ts` re-runs the 16 scenarios and asserts each `dSag` is within 0.005 m of the stored value and each `dHomes` matches exactly.
  - It is slow, so it runs under `npm run story`, not `npm test`.
  - Add it to the `test` script's excludes and the `story` script's includes.

## 8. Code layout

| File | Responsibility |
|---|---|
| `src/main.ts` | Creates scene, both workers and the shared selection store; mounts the tabs |
| `src/ui/selection.ts` | Selection store (interventions + custom pipes) with change subscribers |
| `src/ui/liveMode.ts` | Live controls, readouts, live chart; drives the live worker |
| `src/ui/compareMode.ts` | Existing compare flow moved out of `main.ts` |
| `src/ui/interventionPanel.ts` | Grouped panel, badges, combos, footer |
| `src/ui/drawPipes.ts` | Existing draw-a-pipe logic moved out of `main.ts`; works in both modes |
| `src/render/pins.ts` | CSS2D pins + popover |
| `src/render/rain.ts` | Rain streaks |
| `src/ui/rainGauge.ts` | Gauge overlay |
| `src/worker/live.worker.ts`, `src/worker/liveProtocol.ts` | Live worker |
| `src/scenario/effects.json`, `scripts/effects.ts` | Pre-computed badges |

The existing demo-safety behaviour carries over:
- custom pipe validation (uphill, duplicate, reverse, self, missing node);
- drag-click filtering;
- disabling controls during Compare runs.

## 9. Error handling

| Situation | Behaviour |
|---|---|
| Live worker posts `error` | Pause, show "Simulation stopped at step N: …" with a Restart button. The selection is kept. |
| Live worker crashes | Recreate it, show an error, wait for Restart. |
| `effects.json` lacks the selected storm or an intervention | Hide that badge; never crash. |
| Patch fails, e.g. a custom pipe refers to a missing node | The pipe is filtered out as today; the patch still applies. |

## 10. Testing

**Unit tests (`npm test`):**
- `patchEngine`: keeps `h`; carries over node volumes; spills removed nodes; water balance < 1% after a patch mid-storm; deterministic.
- `rainIntensityAt`: block boundaries, 0 after the storm ends.
- Panel grouping: every intervention appears exactly once; the combos reference valid ids.
- Selection store: applying a combo replaces the interventions and keeps custom pipes.
- Live worker pacing logic: extracted as a pure function `advanceBy(speed, wallDtS, cap)` and tested.

**Slow tests (`npm run story`):** the existing story test plus the effects drift test.

**Browser checklist (manual):**
- rain density follows the storm and stops at 120 min;
- toggling the valve mid-storm in Live visibly changes the sag within a few seconds;
- pins and the panel stay in sync;
- the tabs pause and resume correctly;
- Compare is unchanged.
