# Township Flash-Flood Drainage Simulator — Design

**Hackathon:** Sime Darby Property University Hackathon 2026 — Theme 2: PLANET (Climate Resilience / Water)
**Build window:** 72 hours
**Date:** 2026-10-20

## 1. Problem & Goal

Flash floods hit low-lying pockets of SDP townships when stormwater drains are overwhelmed or backed up by high river levels. Choosing where and how to upgrade drainage is expensive to get wrong.

**Goal:** a lightweight browser-based 3D simulator that lets a planner apply candidate drainage interventions to a township, run a design storm, and compare flood outcomes against a baseline and against cost — before any digging starts.

**Users:** SDP engineering / township planning departments shortlisting drainage upgrades.

**Non-goals (MVP):** real SDP site data, full SWMM dynamic-wave hydraulics, multi-user features, mobile layout.

## 2. Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Site | Synthetic, representative township | Controlled demo story; real terrain pluggable later |
| Interaction | Preset interventions (MVP) + draw-a-pipe (stretch) | Demo-safe; shows extensibility |
| Simulation | Live, CPU, TypeScript, in a Web Worker | Interactive, deterministic, no GPU risk |
| Physics engine | **None** (no cannon/Rapier/Ammo) | Rigid-body engines don't model hydraulics |
| Rendering | three.js | 3D visualisation only |

## 3. Architecture

**Stack:** Vite + TypeScript + three.js, plain HTML/CSS panels, uPlot for time-series charts, Vitest for tests. Ships as a static site.

```
src/
  scenario/   pure data: township definition
    terrain.ts        procedural, deterministic heightmap + land-use grid
    network.ts        baseline drainage network (manholes, pipes, inlets, outfalls)
    interventions.ts  7 presets, each a patch applied to terrain/network
    storms.ts         MSMA-based design storms (10-yr, 100-yr ARI)
  sim/        pure TS — no three.js, no DOM imports
    surface.ts        virtual-pipes shallow-water grid
    pipes.ts          Manning capacity, node storage, surcharge
    coupling.ts       inlet capture / overflow / outfall exchange
    engine.ts         fixed-timestep loop; run(scenario) -> frames + metrics
    metrics.ts        flood metrics + water balance
  worker/     sim.worker.ts — runs engine off main thread
  render/     three.js scene: terrain, water surface, pipes, buildings, camera
  ui/         toggles, A/B cards, chart, assumptions drawer, result cache
```

**Data flow:**
1. UI toggles interventions + storm.
2. `scenario` builds an immutable `Scenario` (baseline + patches).
3. Main thread posts `Scenario` to worker.
4. Worker streams depth frames (`Float32Array`, transferable) every 30 sim-seconds, then final `Metrics`.
5. Renderer animates frames; UI shows metrics vs. baseline.
6. Result cached keyed by `storm + sorted intervention ids`; re-selection replays instantly.

**Boundary rule:** `sim/` must never import three.js or DOM APIs, so it is unit-testable and replaceable (e.g. by SWMM output or real terrain).

## 4. Simulation Model

### 4.1 Surface grid
- 128 × 128 cells, 4 m each (~512 m × 512 m, ~26 ha).
- Per-cell state: ground elevation `z`, water depth `h`, land-use class (roof / road / lawn / park / pond / river).
- Flow: virtual-pipes shallow-water scheme (Mei et al. 2007): per-cell outflow fluxes to 4 neighbours driven by water-surface height difference, scaled so a cell never sends more water than it holds.
- Coupling timestep `dt = 0.5 s`; the surface is sub-stepped `n = ceil(dt / maxStableDt)` times with `maxStableDt = 0.8·√(dx/4g)` (0.255 s at dx = 4 m; the scheme's limit is √(dx/4g) when opposing face fluxes are both active). The river stage is re-imposed every sub-step.
- Run length: 2 h storm + 1 h recession = 21,600 coupling steps (43,200 surface sub-steps).

### 4.2 Rainfall
- Design storm intensity from MSMA 2nd Edition IDF relationship for a Klang Valley station; coefficients must be copied from the manual (do not invent).
- Temporal pattern: MSMA design temporal pattern for the chosen duration.
- Rainfall excess: roof/road 100% runoff; lawn/park lose a constant infiltration rate (tunable, default shown in assumptions drawer).

### 4.3 Pipe network (capacity-based routing)
- Pipe: diameter `D`, length `L`, slope `S`, Manning `n = 0.013` (concrete).
- Full-bore capacity: `Q_full = (1/n) · A · R^(2/3) · S^(1/2)`.
- Per step, link flow `Q = min(Q_full, upstream node volume / dt)`, reduced when downstream node is surcharged.
- Nodes (manholes) have finite storage; overflow returns to the surface at the node's grid cell.
- Inlets capture `min(weir capacity C·P·h^1.5, surface water available / dt, node free storage / dt)`.
- Outfalls discharge into river cells; outfall flow reduces as river stage approaches outfall invert and **reverses** when river stage exceeds node head (backflow), unless a flap gate is fitted.
- This is explicitly a simplified capacity-routing model, not SWMM dynamic wave; stated on a slide and in the assumptions drawer.

### 4.4 River
- River cells along the south edge with a prescribed stage hydrograph that rises during the storm (tailwater condition driving backflow).

### 4.5 Water balance
`rain_in = surface_storage + pipe_storage + infiltrated + outflow (river exits + pump)` — checked every run; tolerance 1%. Displayed as a UI badge.

### 4.6 Metrics
- Peak depth per cell (map).
- Flooded road area: road cells with peak `h > 0.15 m`.
- Homes flooded: building footprints with peak `h > 0.30 m`.
- Time to passable: minutes after rain stops until all road cells `< 0.15 m`.
- Peak outfall flow.
- Depth-over-time at the sag (chart).
All thresholds are configurable and listed in the assumptions drawer.

## 5. Township & Interventions

### 5.1 Layout (deterministic procedural generation)
- **North:** forested hill (steep, pervious but fast runoff).
- **Centre:** terrace-housing rows on a street grid sloping south (high imperviousness).
- **South-west "the sag":** low residential pocket beside the river (floor ≈ 2.8 m, below the 3.2 m river peak) — flood hotspot. It is a polder: a riverside bund (4.0 m) and a graded diversion ridge with a grassed swale on its upslope side enclose its catchment, so upslope runoff passes east of it to the river and the sag drains only through its pipes. Its low-point manholes (collector S2/S3, outfall chamber O) have solid covers; its gullies are on the rim streets.
- **South-east:** existing retention pond in a park, set lower than the sag so a relief pipe can run downhill to it.
- **South edge:** river with rising stage.
- **Baseline network:** 22 manholes with gully sumps (inlet cells 0.1 m below the street), one 600 mm trunk down the boulevard that turns west through the sag's collector to a single outfall chamber (graded 0.3 m below cover) at the sag; trunk sized for older, less-urbanised conditions. When the river throttles the outfall, trunk flow surcharges into the sag.

### 5.2 Preset interventions
| # | Intervention | Model change |
|---|---|---|
| 1 | Upsize trunk drain 600 → 900 mm | Pipe `D` change |
| 2 | Relief pipe: sag → retention pond | New link; the pond's live storage is modelled as storage at the pond node |
| 3 | Underground detention tank (fed from the last trunk manhole before the sag) | Node with large storage + orifice-limited outlet |
| 4 | Bioswales on the verges of the sag approach street (across the slope, inside the sag's catchment) | Higher infiltration + slightly lowered cells |
| 5 | Flap gate on outfall | Blocks reverse outfall flow |
| 6 | Extra inlets in the sag | Additional grates at every sag manhole, including the low point |
| 7 | Pump station at sag | Fixed-rate pump node → river |

Each preset carries an **indicative cost (RM)** and **disruption level**, clearly labelled as placeholders to be replaced with SDP quantity-surveyor rates. UI plots flood reduction vs. cost.

### 5.3 Demo story (must emerge from the physics, not be scripted)
1. Baseline 100-yr storm → sag floods, homes-flooded counter rises.
2. Upsize trunk (#1) → only modest improvement because high river backflows into the network.
3. Flap gate (#5) + detention tank (#3) → lower sag peak depth and fewer homes flooded than #1, at lower cost (required), and strictly better than the flap alone (the tank must contribute). Passable roads within 60 min (target) are reached by extra inlets + pump or relief + extra inlets, not by tank + flap.
   Also required: baseline sag peak 0.4–1.2 m with ≥ 5 homes flooded, and no dead toggles (each preset alone moves the sag peak ≥ 0.03 m or homes by ≥ 1). Encoded in `tests/story.test.ts`.
4. Message: the tool reveals that the cheapest effective fix is not the obvious one.

Terrain, river stage and pipe sizes are tuned so the model genuinely produces this; the tuned parameters are committed and documented.

### 5.4 Stretch: draw-a-pipe
Click two manholes, choose a diameter → custom link added to the scenario and simulated like any preset.

## 6. UI

- **Centre:** three.js scene — terrain, buildings, water surface coloured by depth, translucent pipes coloured by fill ratio (green → red), pulsing markers on surcharging manholes. Orbit camera.
- **Left panel:** storm selector (10-yr / 100-yr), intervention toggles with cost tags, Run button, timeline scrubber.
- **Right panel:** baseline vs. scenario metric cards (peak depth, homes flooded, time-to-passable, cost), uPlot depth-over-time at the sag, water-balance badge.
- **Assumptions drawer:** every threshold, coefficient and placeholder cost.

## 7. Error Handling

- Simulation checks for NaN / Infinity / negative depth after each step; on failure, halts and reports the step number — never animates invalid state.
- Water-balance error > 1% → badge turns amber with the error value.
- Worker crash → UI shows a retry option; cached results remain playable.
- Grid size capped at 128 × 128 for the demo.

## 8. Testing (Vitest, `sim/` only)

- Single-pipe Manning capacity matches hand calculation within 1%.
- Lake-at-rest: still water on flat terrain stays still; depth never negative.
- Water balance within 1% for each intervention alone and all combined (short storm, for test speed); every live run also reports its balance in the UI.
- Monotonicity: increasing a pipe diameter never increases peak depth at nodes upstream of that pipe (downstream areas may legitimately worsen).
- Flap gate: zero reverse flow at the outfall.
- Determinism: identical inputs → identical outputs.
- Rendering verified manually.

## 9. 72-Hour Schedule

| Hours | Simulation track | Visuals / UI track |
|---|---|---|
| 0–12 | Surface grid + water balance + tests | Vite scaffold, terrain mesh, camera, buildings |
| 12–24 | Pipe network + coupling + Manning test | Water surface from frames, pipe rendering |
| 24–36 | MSMA storms, interventions, metrics | Panels, toggles, comparison cards, chart |
| 36–48 | Tune township until demo story is real | Result cache, assumptions drawer, polish |
| 48–60 | Feature freeze; stretch draw-a-pipe | Pitch deck, backup demo video |
| 60–72 | Rehearsal, bug fixes, buffer | — |

**Cut rule:** if end-to-end simulation is not working by hour 36, drop the stretch goal and reduce to presets #1, #3, #5, #6.

## 10. Judging Criteria Mapping

- **Relevant:** flash floods are a real township climate-resilience problem.
- **Impactful:** quantified outcomes — homes flooded, time-to-passable, flooded area.
- **Innovative:** interactive what-if comparison with cost, revealing non-obvious fixes.
- **Feasible:** static web app; interventions are standard drainage engineering measures.
- **Scalable:** `sim/` boundary allows real terrain (DEM) and network data for any SDP township.
- **Evidence-based:** MSMA storms, Manning validation test, visible water balance; SWMM validation as next step.
