# Township tuning log (pass 2)

Date: 2026-10-20. Storm: 100-yr ARI, 2 h alternating block (136 mm total, peak 316 mm/hr block), + 1 h recession.
Pass 1 (`7bba4fa`) is superseded. Its problems were (a) checkerboard instability at dt = 0.5 s, so the workaround
was dt = 0.25 s; (b) presets #2, #3, #4 and #6 gave exactly the baseline; (c) a 2.09 m baseline sag with nothing passable.

## Final `npm run tune` table

| scenario | sag peak (m) | homes | road area (m²) | passable (min) | cost (RM M) | balance % | run (s) |
|---|---|---|---|---|---|---|---|
| baseline | 1.131 | 8 | 2256 | > 60 | 0.00 | 0.000 | 33.3 |
| #1 Upsize trunk drain | 1.191 | 10 | 2336 | > 60 | 4.50 | 0.000 | 32.8 |
| #2 Relief pipe to pond | 1.068 | 7 | 1712 | > 60 | 1.80 | 0.000 | 32.5 |
| #3 Underground detention tank | 1.037 | 7 | 1536 | > 60 | 2.50 | 0.000 | 34.4 |
| #4 Bioswales on the sag approach street | 1.077 | 8 | 1712 | > 60 | 0.80 | 0.000 | 33.3 |
| #5 Flap gate on outfall | 1.021 | 7 | 1472 | > 60 | 0.15 | 0.000 | 32.8 |
| #6 Extra inlets in the sag | 0.984 | 6 | 1408 | > 60 | 0.30 | 0.000 | 32.9 |
| #7 Pump station at the sag | 0.975 | 6 | 1360 | > 60 | 3.00 | 0.000 | 33.1 |
| #3 + #5 tank + flap | 0.950 | 6 | 1152 | > 60 | 2.65 | 0.000 | 32.3 |
| #2 + #6 relief + inlets | 0.548 | 4 | 704 | 46 | 2.10 | 0.000 | 32.2 |
| #6 + #7 inlets + pump | 0.369 | 1 | 496 | 0 | 3.30 | 0.000 | 32.3 |

`npm run story`: all 13 assertions pass (5.4 min).

| criterion (`tests/story.test.ts`) | result |
|---|---|
| Baseline sag peak 0.4–1.2 m, homes ≥ 5 | 1.131 m, 8 homes |
| No dead toggles (each preset alone: Δsag ≥ 0.03 m or Δhomes ≥ 1) | smallest is bioswales (−0.054 m); all 7 pass |
| Upsize alone is only modest: homes ≥ 70 % of baseline | 10 ≥ 6 (upsizing makes it worse) |
| Tank + flap beats upsize on sag and homes, at lower cost | 0.950 m / 6 vs 1.191 m / 10; RM 2.65M vs 4.5M |
| Tank + flap strictly better than flap alone on sag | 0.950 vs 1.021 m |
| Water balance < 1 % in every run | 0.000 % |
| Target: some scenario passable within 60 min | inlets + pump: 0 min; relief + inlets: 46 min (asserted for inlets + pump) |

## Runtime per run

About **33 s per run** on this laptop today. That is not comparable with pass 1's 18.5 s: the CPU is currently
held at 1.4 GHz. Measured back-to-back on the same machine, a baseline run at the pass-1 setting (dt = 0.25, 1
surface step per coupling step) takes 44.2 s, and the guarded dt = 0.5 run (2 sub-steps) takes 37.7 s, about 15 %
faster. Results agree to 3 mm (sag 1.128 m vs 1.131 m, same homes). On pass-1 machine speed that ratio puts a run at
about 15.8 s. The ≤ ~15 s aim is **not met on this machine in its current power state**. The surface step is
~85 % of the run time and sub-stepping cannot drop below 0.255 s, so further speed needs a faster stepSurface (only a
bit-identical dry-cell skip was added here) or a smaller grid.

## Timestep guard (`src/sim/surface.ts`, `src/sim/engine.ts`)

- `maxStableDt(dx) = 0.8 · √(dx / 4g)`, which is 0.255 s at dx = 4 m. The engine sub-steps the surface
  `n = ceil(dt / maxStableDt)` times per coupling step, so SIM.dt is back to 0.5 s (n = 2).
- Derivation (comment in `surface.ts`). The scheme is symplectic Euler with a depth-independent wave speed
  (pipe section dx²). One-way flux on a face gives dt ≤ √(dx/2g) ≈ 0.45 s, and a flat dam-break is indeed smooth up
  to 0.45 s. While both opposing fluxes on a face are positive the gain doubles, giving dt ≤ √(dx/4g) ≈ 0.319 s.
  Empirically the township under 300 mm/hr rain is smooth at 0.30 s and blows up (5.9 m checkerboard) at 0.33 s.
- **The river stage is re-imposed every sub-step.** Forcing it only once per 0.5 s coupling step pumped a
  near-resonant checkerboard into the river-connected pond (0.7 m neighbour jumps, 4 m depths), even with stable
  sub-steps.
- Tests (`tests/sim/surface.test.ts`): a raw 0.5 s step checkerboards a flat dam-break (> 1 m jumps); the guarded
  0.5 s run stays smooth (< 0.3 m), conserves volume to 1e-9, and is deterministic.

## Why pass 1's presets did nothing (diagnosis)

1. **The trunk was empty.** The virtual-pipes surface conveys water so fast that overland flow is a 1–3 mm sheet
   at the storm peak. Weir inlets on sloping streets therefore captured about **1 m³ each over the whole storm**.
   Only ponded water (in the sag) was ever captured, so the trunk, tank, upsize and bioswales could not matter.
2. **The sag's catchment was the whole western strip** (~9,000 m³ overland), plus 5,500 m³ of river backflow. Pipe
   capacity was irrelevant.
3. **The relief pipe was dead by construction.** Its pond node P had no outlet, so after its first 0.5 m³
   `routePipes` allowed it zero inflow.

## Layout / config changes (`src/scenario/`)

| change | old | new | reason |
|---|---|---|---|
| Diversion ridge `RIDGE` | – | crest +0.5 m along (0,150)→(280,90)→(280,32), 8 m grassed swale (−0.2 m, no houses) on its upslope side | With the bund and the west boundary it encloses the sag's catchment (a polder). Upslope runoff runs along the ridge to the open bank east of x = 280, so the sag drains only through its pipes. The swale stops flow along the ridge flooding houses (pass 2 iteration 3 flooded a block behind it). |
| `BUND.xMin/xMax` | 20 / 180 | 0 / 282 | Bund closes the polder's river side. Peak river 3.2 m < bund 4.0 m; no run overtops it. |
| `INLET_SUMP` | – | 0.1 m | Gully sumps: inlet cells sit 0.1 m below the street, so grates see ponded rather than sheet flow. Trunk inlets now capture 50–75 m³ each, and T8/S0 ~1,000 m³. |
| `SAG` | r 80, depth 2.5 | r 80, depth 1.0 | Shallower: bowl floor ≈ 2.8 m, just below the 3.2 m river peak, so backflow matters (~950 m³) without dominating. A wide bowl spreads the flood over 6–10 houses, so better/worse shows up in the home count. |
| `NODE_INLETS` | all 2 m grates | S2, S3, O solid covers | The collector and outfall manholes at the sag's low point have no grates. The gullies are on the rim streets (S1, SL0, SL1), so water pooled at the low point cannot drain until #6 adds grates. |
| `OUTFALL_DROP` | – | 0.3 m | The outfall chamber is graded below cover depth. Before, the 8 m S3→O pipe had a 0.01 m fall (0.22 m³/s), which made it the bottleneck. Now the tailwater-controlled orifice is. |
| `TANK` | fed from T6 at (162,122) | fed from T8 at (242,62) | Fed from the last trunk manhole before the sag collector, so it intercepts the trunk flow that surcharges into the sag. From T6 it gave only −0.04 m. |
| `INFILTRATION_MMHR.BIOSWALE` | 60 | 100 | Upper end of bioretention media rates. |
| `POND.reliefRise` | – | 1.5 m | The relief pipe's node P holds the pond's live storage between normal level and +1.5 m, measured on the grid (~3,600 m³). |
| `SIM.dt` | 0.25 | 0.5 | Coupling step. The surface is now sub-stepped by the guard. |

Preset meaning changes (descriptions updated, costs unchanged placeholders):
- **#3 tank:** now fed from T8 (was T6).
- **#4 bioswales:** moved from the boulevard to the verges either side of the sag approach street (road row j = 20,
  x ≤ 276), across the slope inside the sag's catchment. On the boulevard they run parallel to the flow and removed
  at most 0.03 m.
- **#6 extra inlets:** "+4 m of grate at every sag manhole, including the low point" (was "triple the grate
  capacity", which is ×3 of zero at solid covers).
- **#2 relief:** unchanged in intent; P now has the pond's live storage, so the pipe actually flows (S3 no longer spills).

`tests/scenario/township.test.ts` expectations updated for these deliberate changes:
- sag-vs-surroundings margin 1 → 0.9 m (sag depth 2.5 → 1.0);
- tank pipe `T6-TK` → `T8-TK`;
- bioswale probe cell moved to the street verge;
- sag-inlets S3 perimeter 6 → 4 (base 0);
- new checks for the ridge/swale and the gully sumps.

Node count (22), trunk pipe count (13) and diameters are unchanged.

## Iteration log

Volumes come from throwaway diagnostics (a per-node capture/spill and sag-region budget), not committed.

| # | change | baseline sag / homes | key results | notes |
|---|---|---|---|---|
| 0 | guard only (pass-1 layout, dt 0.5, 2 sub-steps) | 2.24 / 19 | all presets identical | pond checkerboard: river reset once per coupling step resonates |
| 1 | river reset every sub-step | 2.08 / – | matches dt 0.25 (2.07) | stable. Diagnosis: trunk inlets ~1 m³ each, relief P dead-ended |
| 2 | polder ridge to x 190, sumps 0.1, sag r 60 d 1.3, P = pond storage | 1.08 / 6 | flap 0.84, tank 1.01, t+f 0.75, relief 0.65, upsize 1.16; bioswales 1.06; inlets 1.08 | homes stuck at 6; ridge ponding floods a block |
| 3 | sag r 80 d 1.2 | 1.09 / 7 | upsize 1.25/9, t+f 0.76/7 | homes now discriminate |
| 4 | grassed swale along the ridge | 1.06 / 6 | bioswales −0.02, inlets −0.01 | ridge block dry; inlets never limit a ponded sag (weir ∝ h^1.5) |
| 5 | polder to x 280 (lower boulevard inside), boulevard swales to y 40 | 1.15 / 7 | bioswales 1.13/6, inlets 1.15/7 | inlets still dead |
| 6 | solid covers at S2, S3, O; #6 adds grates | 1.26 / 8 | inlets 1.15/7, t+f 1.04/6, flap 1.09/6, upsize 1.37/11 | baseline > 1.2; bioswales −0.02 |
| 7 | bigger polder (ridge 160/120 and 170/150), swale 100 mm/hr | 1.19–1.33 | all ≈ 1.19–1.21 at 170/150 | larger polder fills to the bund: capped, rejected |
| 8 | bioswales across the slope on the sag approach street; outfall graded 0.3 m deeper | 1.26 / 8 | bioswales 1.20/7 | |
| 9 | sag depth 1.2 → 1.0 (also tried r 90, d 0.9, smaller polder) | 1.13 / 8 | inlets 0.98/6, bioswales 1.08/8 | all criteria met; tank (T6) only −0.04 |
| 10 | tank fed from T8 | 1.13 / 8 | tank 1.04/7, t+f 0.95/6 vs flap 1.02 | final |
| 11 | combinations for drain-down | – | inlets + pump: passable 0 min; relief + inlets: 46 min | target met |

## What the model actually says (read before pitching)

- **Baseline (1.13 m, 8 homes).** The sag is a polder that drains only through pipes, and its low point has no
  gully. Local runoff pools there. Trunk and collector flow surcharges at S1/S3 once the outfall is throttled. When
  the river passes the outfall chamber (ground ≈ 2.72 m, t ≈ 91–137 min) it backflows ~950 m³. The peak is at ~137 min.
- **Upsize (RM 4.5M) makes it worse** (1.19 m, 10 homes). The 900 mm trunk delivers more water to the bottleneck,
  and the 900 mm outfall lets in 2,900 m³ of backflow instead of 950 m³.
- **Flap gate (RM 0.15M)** removes the backflow: 1.02 m, 7 homes.
- **The tank contributes on its own merit.** Alone 1.04 m / 7 homes; with the flap 0.95 m / 6 homes vs 1.02 m for the
  flap alone. It holds the trunk flow that would otherwise surcharge into the sag.
- **Extra inlets (RM 0.3M)** are the cheapest single big win (0.98 m, 6 homes): the low point finally drains while
  the outfall is open. Combined with the pump or relief pipe, roads are passable within the hour.
- **Bioswales** help a little (−0.05 m): realistic for a 100-yr storm.
- **Pump caveat.** At an outfall without a flap gate the pump recirculates river water. In the pump-alone run it
  pumps 9,200 m³ while 7,300 m³ backflows in. The pump should be pitched with a flap gate.
- **Relief caveat.** The pond's live storage is modelled as storage at node P, so the visible pond surface doesn't
  rise with relief flow.
- **Model caveat.** Overland flow in this scheme is unrealistically fast and thin (weak bed friction), which is why
  inlets need sumps to capture anything. Trunk flows are therefore modest, ~1,000 m³ reaching the sag.
