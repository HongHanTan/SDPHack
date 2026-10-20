# Taman Kyra tuning log (Task 4)

Date: 2026-10-20. Storm: `synthetic_80mmh_60min` (constant 80 mm/h, 60 min, plus 3600 s recession).
Town: Taman Kyra (network from `data/synthetic/taman_kyra_assets.json` by Tay Zheheng; layout from
`data/synthetic/taman_kyra_layout.json`, derived from Jiajie's scene). Baseline blockage `INLET-D07` 40 %.
This replaces the pass-2 log for the classic synthetic township.

**Outcome:** the demo story can't be reached within the allowed tunables. Claims 1–6 are removed from
`packages/engine/tests/story.test.ts`. Only claim 7 (water balance) is kept, and it passes. The config is left at the Task 2
defaults: no tunable moved any of the failing claims (see the sweeps below). The cause is structural (§ Root cause),
so it has to be fixed outside this task's bounds.

## Final `npm run tune` table

| scenario | J07 peak (m) | homes | road area (m²) | P07 max load | balance % | run (s) |
|---|---|---|---|---|---|---|
| baseline | 0.203 | 0 | 4 | 0.713 | 0.000 | 29.5 |
| desilt-d07 | 0.130 | 0 | 0 | 0.713 | 0.000 | 30.3 |
| upsize-p07 | 0.203 | 0 | 4 | 0.393 | 0.000 | 23.5 |
| flap-gate | 0.203 | 0 | 4 | 0.713 | 0.000 | 26.2 |
| storage-tank | 0.203 | 0 | 4 | 0.711 | 0.000 | 30.9 |
| lake-overflow | 0.203 | 0 | 4 | 0.713 | 0.000 | 29.6 |
| pump | 0.203 | 0 | 4 | 0.713 | 0.000 | 29.8 |
| desilt + upsize | 0.130 | 0 | 0 | 0.393 | 0.000 | 29.5 |
| high: baseline | 0.203 | 0 | 4 | 0.713 | 0.000 | 26.1 |
| high: flap-gate | 0.203 | 0 | 4 | 0.713 | 0.000 | 25.2 |
| high: pump | 0.203 | 0 | 4 | 0.713 | 0.000 | 23.8 |

**Runtime:** 24–31 s per run, single-threaded on the dev laptop. The story test's 9 runs take about 4–5 min.

## Config changes

None. Every value in `packages/engine/src/scenario/config.ts` stays at its Task 2 default (`DIP` 30 m / 0.5 m,
`INLET_SUMP` 0.1, `LAKE`, `CANAL`, `TANK`, `PUMP`, `LAKE_OVERFLOW`, `HOUSE`). The sweeps below show that no in-bounds value
changes the outcome of any claim. So moving them would only add churn that a later fix would have to undo.

## Root cause

1. **Only J07 sees water.**
   - Surface water enters the network only through the four asset grates: D01 at J01, D02 at J02, D04 at J04, and D07 at J07.
   - Ground is IDW (power 2) of the node ground levels. IDW has zero gradient at each data point, and J01 (12.2), J02 (12.1) and J04 (12.0) are the highest nodes. So their grate cells sit on flat-topped peaks.
   - In the baseline, the peak depth on the D01, D02 and D04 cells is 0.002 m: only rain falling straight onto the sump.
   - P01–P06 carry about 0 m³/s; P05's max load is 0.00.
   - Tay's SWMM model routes subcatchment runoff straight to the nodes, which our 2-D surface doesn't do.
2. **J07 can't fill P07.**
   - Overland flow reaching the J07 cell peaks at about 0.39 m³/s. P07's capacity is 0.549 m³/s, so its max load is 0.71.
   - Even the 40 %-blocked D07 grate takes almost all of it. The J07 dip never fills: 0.20 m is mostly the 0.1 m sump plus the kerb drop. So no water ponds near the houses.
   - J07 never surcharges, which leaves upsizing P07 with nothing to relieve. Upsize gives the baseline result exactly, and combined gives the desilt result exactly.
3. **A blocked outfall doesn't back up to J07.**
   - OUT01 sits inside the canal (bed 7.6), so its `maxDepth` is the 0.3 m floor and its head is at most 8.5 m. Under the 9.4 m high stage it can never discharge, with or without the flap gate, and P08 stops.
   - Capacity routing in `src/sim/pipes.ts` lets J08 accept P07's flow and spill the excess onto the street at J08, beside the canal. So J07 is unchanged under high tailwater, and the flap gate and the pump can't lower it.
4. **The tank and lake overflow are dead toggles.** They are fed from J05 and J04, which carry no flow (point 1).

## Sweeps (iteration log)

Diagnostic scripts ran single scenarios with config overrides applied in-process. `INLET_SUMP` was applied by re-cutting the grate cells.

| # | Change | baseline J07 / P07 load | desilt J07 / P07 | upsize J07 | comb J07 | homes | note |
|---|---|---|---|---|---|---|---|
| 0 | Task 2 defaults | 0.203 / 0.71 | 0.130 / 0.71 | 0.203 | 0.130 | 0 | P05 = P06 = 0; high tailwater, flap gate and pump all equal 0.203 |
| 1 | DIP 1.0 m × 35 m, HOUSE +20 % | 0.208 / 0.74 | 0.134 / 0.74 | 0.208 | 0.134 | 0 | max house depth 0.01 m |
| 2 | as 1, INLET_SUMP 0.25 | 0.212 / 0.75 | 0.136 / 0.75 | 0.212 | 0.136 | 0 | the deeper sump doesn't widen the catchment |
| 3 | DIP 1.0 m × 30 m, HOUSE +20 % | 0.206 / 0.73 | 0.132 / 0.73 | 0.206 | 0.132 | 0 | |
| 4 | DIP 1.0 m × 45 m, HOUSE +20 % (upper bounds) | 0.216 / 0.79 | 0.138 / 0.79 | 0.216 | 0.138 | 0 | best J07 supply: 0.44 m³/s, still < 0.549 |
| 5 | DIP 1.0 m × 45 m, HOUSE +20 %, INLET_SUMP 0.25 | 0.220 / 0.80 | 0.140 / 0.80 | 0.220 | 0.140 | 0 | |

Static fill-and-spill analysis (priority-flood to the canal) agrees:
- the deepest in-bounds dip, 1.0 m × 35 m with houses +20 %, would put at most 0.34 m (H23) and 0.29 m (H24) on house footprints, and only if the 727 m³ dip filled to its spill level;
- the dynamic runs never fill it, because D07 drains the dip faster than it fills.

`CANAL.bedZ`, `LAKE`, `TANK`, `PUMP.rate` and `LAKE_OVERFLOW.diameter` can't help:
- OUT01's head stays capped at invert + 0.3 m for any `bedZ` from 7.0 to 8.2;
- the tank and lake are fed by dry nodes;
- the pump only lowers the J08 spill.

## Story claims dropped

| # | Claim | Result | Why it can't be met |
|---|---|---|---|
| 1 | baseline J07 ≥ 0.15 m and ≥ 2 homes | 0.203 m ✓, 0 homes ✗ | no ponding reaches any footprint (max 0.01 m); root cause 1–2 |
| 2 | desilt lowers J07, P07 ≥ 0.99 | 0.130 < 0.203 ✓, P07 0.71 ✗ | J07 inflow ≤ 0.44 m³/s even at tunable bounds |
| 3 | upsize lowers J07 | 0.203 = 0.203 ✗ | P07 never runs full in the baseline |
| 4 | combined beats each alone | 0.130 = desilt ✗ (< upsize ✓) | same as 3 |
| 5 | high tailwater: flap gate and pump each lower J07 | all 0.203 ✗ | outfall blockage spills at J08, not J07 (root cause 3) |
| 6 | tank and lake change J07 by ≥ 0.03 m | Δ 0.000 ✗ | fed from dry J05 and J04 (root cause 4) |
| 7 | water balance < 1 % | 0.000 % on all 9 runs ✓ | **kept** |

Claims 1 and 2 each contain a sub-assertion that holds (J07 ≥ 0.15 m; desilt lowers J07). They were removed with
their `it(...)` blocks, as the plan requires. They could come back as separate tests if wanted.

## Suggested fixes (outside Task 4's bounds)

- Route each node's subcatchment runoff into the node, as Tay's SWMM model does. Alternatively, place the grates at low points of the ground: cut a local dip under every inlet, not only J07, or replace IDW with a surface that drains toward the grates. This feeds J05/P05, so P07 can surcharge, which revives claims 2–4 and 6.
- Have a full outfall back water up to J07. Today `routePipes` checks P07 against J08's outflow before P08 itself is throttled, so J08 overfills and spills. Fixing this needs a physics-core change, or a scenario-level redesign such as OUT01 outside the canal with a real `maxDepth`. It would revive claim 5.
- Then re-tune `DIP` and `HOUSE` for claim 1's homes.
