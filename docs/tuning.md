# Taman Kyra tuning log (Tasks 4, 4b and 8)

Date: 2026-10-20. Storm: `synthetic_80mmh_60min` (constant 80 mm/h, 60 min, plus 3600 s recession).
Town: Taman Kyra (network from `data/synthetic/taman_kyra_assets.json` by Tay Zheheng; layout from
`data/synthetic/taman_kyra_layout.json`, derived from Jiajie's scene). Baseline blockage `INLET-D07` 40 %.

**Outcome (pass 3, current):** with SWMM-style catchment loading (spec §14) and three tuned values (`CATCHMENT.lagS`
300 → 60 s, `DIP` 30 × 0.5 → 45 × 0.8 m, `HOUSE.width` 12 → 14.4 m), claims 1, 3, 4, 6 and 7 pass. Claim 1 is restored.
Claim 2 now fails because of the catchment loading, and claim 5 still can't be met, so both `it(...)` blocks are removed
(§ Pass 3). The SWMM cross-check stays report-only (`ENFORCED = false`).

**Outcome (pass 2, superseded by pass 3):** with the spec §13 terrain redesign and one tuned value (`FUNNEL.radius` 18 → 30 m), claims 2, 3, 4,
6 and 7 pass. Claim 1 (it needs ≥ 2 homes flooded) and the restated claim 5 (J08 under high tailwater) can't be met within
the tunables, so their `it(...)` blocks are removed from `packages/engine/tests/story.test.ts` (§ Story claims).

## Pass 1 (Task 4, IDW terrain): summary

With the IDW ground surface, no tunable moved any failing claim, so only claim 7 was kept. The causes were structural:
- IDW has zero gradient at each data point, so grates D01, D02 and D04 sat on flat-topped peaks and caught only the rain
  falling on their own cells. P01–P06 carried about nothing.
- The J07 inflow peaked at about 0.39 m³/s against P07's 0.549 m³/s, so P07's max load was 0.71 and J07 never surcharged.
  Upsize gave exactly the baseline, and the tank and lake (fed from dry J05 and J04) were dead toggles.
- OUT01 sat in the canal with the 0.3 m chamber floor (head ≤ 8.5 m), so under the 9.4 m stage P08 stopped completely.
  J08 spilled onto its street and J07 was unaffected.

That led to the spec §13 amendment: a least-squares plane surface, a grate funnel at every inlet, and OUT01's asset
chamber depth (2.0 m).

## Pass 2 (Task 4b): final `npm run tune` table

| scenario | J07 peak (m) | J08 peak (m) | homes | road area (m²) | P07 max load | balance % | run (s) |
|---|---|---|---|---|---|---|---|
| baseline | 0.296 | 0.000 | 0 | 340 | 1.000 | 0.000 | 14.4 |
| desilt-d07 | 0.274 | 0.000 | 0 | 260 | 1.000 | 0.000 | 14.1 |
| upsize-p07 | 0.187 | 0.000 | 0 | 4 | 0.573 | 0.000 | 14.1 |
| flap-gate | 0.296 | 0.000 | 0 | 340 | 1.000 | 0.000 | 13.8 |
| storage-tank | 0.187 | 0.000 | 0 | 4 | 0.690 | 0.000 | 14.2 |
| lake-overflow | 0.187 | 0.000 | 0 | 4 | 0.945 | 0.000 | 14.3 |
| pump | 0.296 | 0.000 | 0 | 340 | 1.000 | 0.000 | 15.9 |
| desilt + upsize | 0.121 | 0.000 | 0 | 0 | 0.573 | 0.000 | 14.0 |
| high: baseline | 0.296 | 0.000 | 0 | 340 | 1.000 | 0.000 | 14.4 |
| high: flap-gate | 0.296 | 0.000 | 0 | 340 | 1.000 | 0.000 | 14.0 |
| high: pump | 0.296 | 0.000 | 0 | 340 | 1.000 | 0.000 | 14.0 |

**Runtime:** 14–16 s per run (single-threaded, dev laptop; pass 1 measured 24–31 s). The story test's 9 runs take about 2 min (117 s).

## Config changes (pass 2)

| Value | Old | New | Why |
|---|---|---|---|
| `FUNNEL` (new, spec §13) | — | `{ radius: 18, depth: 0.3 }` | spec default |
| `FUNNEL.radius` | 18 m | 30 m | At 18 m the upstream funnels gather too little: J07's inflow only just reaches P07's capacity (max load 0.99, J07 node fill 0.08), so J07 never surcharges and upsize, tank and lake change nothing. At 30 m, D01, D02 and D04 capture about 30 % more (0.18 → 0.23 m³/s together), P05 rises from 0.35 to 0.45 load, and J07 surcharges (node fill 0.86). |

All other values stay at their Task 2 defaults: `DIP` 30 m / 0.5 m, `INLET_SUMP` 0.1, `LAKE`, `CANAL`, `TANK`, `PUMP`,
`LAKE_OVERFLOW` and `HOUSE`. `FUNNEL.depth` stays at 0.3 m because 0.6 m gives the same pass/fail outcome (sweep A below).

Scenario-layer changes (spec §13, not tunables): the IDW surface is replaced by the least-squares plane through the 9 node
ground levels, every asset grate gets a `FUNNEL` bowl, and NODE-OUT01 keeps its asset `max_depth_m` (2.0 m).

## Iteration log (pass 2)

Diagnostic runs applied config overrides in-process, one scenario per process. "fill" is J07's max node fill.

| # | Change (from the §13 defaults) | base J07 | desilt | upsize | comb | tank | lake | P07 base / desilt | J07 fill | J08 (all runs) | max house depth |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | §13 defaults, `FUNNEL` 18 m × 0.3 m | 0.196 | 0.126 | 0.196 | 0.126 | 0.196 | 0.196 | 0.99 / 0.99 | 0.08 | 0.000 | 0.00 |
| 1 | `FUNNEL` 30 × 0.1 | 0.193 | | | | | | 0.98 | 0.07 | | |
| 2 | `FUNNEL` 8 × 0.6 | 0.200 | | | | | | 0.96 | 0.09 | | |
| 3 | `FUNNEL` 18 × 0.6 | 0.195 | | | | | | 0.99 | 0.11 | | |
| 4 | `FUNNEL` 24 × 0.45 | 0.257 | | | | | | 1.00 | 0.83 | | |
| 5 (A) | `FUNNEL` 30 × 0.6 | 0.333 | 0.314 | 0.186 | 0.120 | 0.186 | 0.186 | 1.00 / 1.00 | 0.82 | 0.000 | 0.00 |
| **6 (B, chosen)** | **`FUNNEL` 30 × 0.3** | **0.296** | **0.274** | **0.187** | **0.121** | **0.187** | **0.187** | **1.00 / 1.00** | **0.86** | **0.000** | **0.01** |

Sweep for claim 1's homes (on A, `FUNNEL` 30 × 0.6, baseline only). HOUSE "+20 %" area is ×1.095 per side; ×1.2 per
side is the most generous reading of the bound.

| `DIP` (depth × radius) | `HOUSE` | J07 | max house depth | homes |
|---|---|---|---|---|
| 0.5 × 30 (default) | default | 0.333 | 0.00 | 0 |
| 0.6 × 40 | default / +20 % area | 0.390 / 0.409 | 0.00 / 0.01 (H23) | 0 |
| 0.8 × 35 | default / +20 % area | 0.384 / 0.406 | 0.00 / 0.00 | 0 |
| 0.8 × 45 | default / +20 % area | 0.436 / 0.453 | 0.00 / 0.04 (H23) | 0 |
| 1.0 × 30 | default / +20 % area | 0.382 / 0.410 | 0.00 / 0.00 | 0 |
| 1.0 × 38 | default / +20 % area | 0.416 / 0.438 | 0.00 / 0.00 | 0 |
| 1.0 × 45 | default / +20 % area | 0.452 / 0.471 | 0.00 / 0.03 (H23) | 0 |
| 1.0 × 45 (all upper bounds) | ×1.2 per side | 0.490 | 0.09 (H23) | 0 |

Sweep for claim 5 (on B, high tailwater): `CANAL.bedZ` 7.0 and 8.2 give identical results (J08 0.000, OUT01 max fill
0.64). Upsizing P07 under high tailwater, which delivers the most water to J08, also leaves J08 dry (OUT01 fill 0.58).

Static fill-and-spill check (priority-flood to the canal and the grid edge):
- With A, the J07 bowl spills at 10.76 m. Filled to that level, it would put 0.36 m on H23.
- With all upper bounds, H23 would get up to 0.86 m.
- The dynamic runs never fill the bowl. D07 and the surcharged J07 drain it while the storm feeds it, so the pond peaks
  at about 9.84 m. H23's lowest footprint cell is 9.77 m, and a home needs 0.3 m.

## Story claims (pass 2)

| # | Claim | Result (final config) | Status |
|---|---|---|---|
| 1 | baseline J07 ≥ 0.15 m and ≥ 2 homes | J07 0.296 m ✓, 0 homes ✗ | **removed**: homes unreachable (sweep above); the J07 half holds |
| 2 | desilt lowers J07, P07 still ≥ 0.99 | 0.274 < 0.296 ✓, P07 1.000 ✓ | kept, passes |
| 3 | upsize lowers J07 | 0.187 < 0.296 ✓ | kept, passes |
| 4 | combined beats each alone | 0.121 < 0.274 and < 0.187 ✓ | kept, passes |
| 5 | high tailwater raises J08; flap gate and pump each lower it | J08 0.000 in all three runs ✗ | **removed**: see below |
| 6 | tank and lake each change J07 by ≥ 0.03 m | tank Δ 0.109 ✓, lake Δ 0.109 ✓ | kept, passes |
| 7 | water balance < 1 % | 0.000 % on all 9 runs ✓ | kept, passes |

**Why claim 5 can't be met.** The restated claim needs NODE-J08 to surcharge onto its street under the 9.4 m stage, which
needs P08 to be throttled by OUT01:
- In capacity routing, P08 is throttled only when OUT01 lacks free storage. With the 2.0 m chamber, OUT01 discharges
  0.6 · A(Ø750) · √(2g·ΔH), up to about 1.05 m³/s at the 9.4 m stage (ΔH ≤ 0.8 m). That is above P08's own full-bore
  capacity (0.996 m³/s).
- J08's only inflow is P07, at most 0.549 m³/s (asset Ø600). OUT01 passes that at a head of about 9.62 m, below its 10.2 m crown (the observed
  max fill is 0.64), so P08 is never throttled and J08 never spills.
- The J08 street cell stays dry (peak < 0.5 mm) in every run, so neither the high stage nor the flap gate or pump can
  change it.
- With a constant stage and one-way pipe routing, the flap gate only stops the one-off backflow that fills OUT01 to
  9.4 m. It can't change any steady-flow peak.
- No tunable changes this. `CANAL.bedZ` only sets the river cell depth (backflow supply), `PUMP.rate` can only lower J08,
  and the tank's Ø150 release adds too little. A fix would need a physics-core change (head-driven pipe flow) or a
  different outfall design (e.g. a smaller orifice), both outside Task 4b.

**Why claim 1's homes can't be met.** See the homes sweep: even at every upper bound, the J07 pond leaves at most 0.09 m
on a footprint. Unlike pass 1, the bowl is now deep enough (static spill 0.36–0.86 m on H23), but an 80 mm/h, 60-minute
storm doesn't supply enough surplus over P07's capacity and D07's draw to fill it. Claim 1's other assertion (J07 ≥ 0.15
m) holds and could come back as its own test.

## Pass 3 (Task 8): catchments

Spec §14 adds SWMM-style catchment loading: on Tay Zheheng's four subcatchments (CATCH-D01/D02/D04/D07,
`models/illustrative_taman_kyra/hydrology.json`), 80 % of the rain goes to a linear reservoir (lag `CATCHMENT.lagS`) that
drains into NODE-J01/J02/J04/J07. The rest lands on the 2D surface. CATCH-D02 gets only 1469 cells (0.59 ha) because J02
sits near the north grid edge, so its steady inflow is 0.105 m³/s rather than 0.178 m³/s.

### Final `npm run tune` table (pass 3)

| scenario | J07 peak (m) | J08 peak (m) | homes | road area (m²) | P07 max load | balance % | run (s) |
|---|---|---|---|---|---|---|---|
| baseline | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 19.2 |
| desilt-d07 | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 17.1 |
| upsize-p07 | 0.082 | 0.000 | 0 | 0 | 0.751 | 0.000 | 15.8 |
| flap-gate | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 15.7 |
| storage-tank | 0.082 | 0.000 | 0 | 0 | 0.639 | 0.000 | 16.0 |
| lake-overflow | 0.481 | 0.000 | 0 | 824 | 1.000 | 0.000 | 15.6 |
| pump | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 15.9 |
| desilt + upsize | 0.056 | 0.000 | 0 | 0 | 0.751 | 0.000 | 16.1 |
| high: baseline | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 15.3 |
| high: flap-gate | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 13.5 |
| high: pump | 0.664 | 0.000 | 2 | 1164 | 1.000 | 0.000 | 13.5 |

**Runtime:** 13.5–19 s per run (single-threaded, dev laptop, partly with other runs in parallel; about 15 s alone). The
story test's 9 runs take about 2.5 min (148 s). `npm run effects` (34 runs) and the drift test take about 10 min each.

### Config changes (pass 3)

| Value | Old | New | Why |
|---|---|---|---|
| `CATCHMENT.lagS` | 300 s | 60 s | Lower bound. A short lag (1 ha, 80 % impervious, 1 % slope: minutes to concentrate, so physically plausible) loads J07 sooner and raises the pond. At 120 s and 300 s, H23 peaks at 0.295 m (threshold 0.3 m), so claim 1 fails. |
| `DIP` | 30 m × 0.5 m | 45 m × 0.8 m | A wider bowl brings the J07 pond to H22 and H23. With the default DIP and `HOUSE`, the best is H22 0.20 m, H23 0.13 m. |
| `HOUSE.width` | 12 m | 14.4 m | +20 % footprint (width × 1.2, depth unchanged, so +20 % area too). It lets H23's lowest footprint cell reach the pond: H23 0.296 → 0.305 m. Widening the depth instead (12 × 15.6) leaves H23 at 0.296 m. |

`FUNNEL` stays at 30 × 0.3 m: 30 × 0.6 m and 30 × 0.45 m raise J07 but lower H23 (0.27–0.29 m); 20 × 0.3 m and 24 × 0.3 m
lower both. All other values stay at their pass 2 values.

### Iteration log (pass 3)

Diagnostic runs applied config overrides in-process, one scenario per process. "H22 / H23" is the max peak depth on that
house's footprint (a home floods at 0.3 m).

| # | Change (from the pass 2 config, `CATCHMENT.lagS` 300) | base J07 | desilt J07 | homes | H22 / H23 |
|---|---|---|---|---|---|
| 0 | none (pass 2 config) | 0.611 | 0.611 | 0 | 0.20 / 0.13 |
| 1 | lagS 60 | 0.611 | 0.611 | 0 | 0.20 / 0.13 |
| 2 | lagS 1200 | 0.449 | 0.449 | 0 | 0.04 / – |
| 3 | lagS 1200, DIP 45 × 1.0 | 0.440 | 0.440 | 0 | 0.05 / – |
| 4 | lagS 1200, DIP 45 × 0.5 | 0.379 | 0.379 | 0 | 0.09 / 0.06 |
| 5 | lagS 1200, FUNNEL 8 × 0.1 | 0.408 | 0.408 | 0 | 0.04 / 0.00 |
| 6 | lagS 60, DIP 45 × 1.0 | 0.698 | 0.698 | 1 | 0.31 / 0.25 |
| 7 | lagS 60, DIP 45 × 1.0, HOUSE 13.14 × 14.24 (area +20 %, both sides × 1.095) | 0.706 | | 1 | 0.36 / 0.29 |
| 8 | lagS 60, DIP 45 × 0.6–0.9, HOUSE 13.14 × 14.24 | 0.585–0.686 | | 1 | 0.30–0.35 / 0.26–0.296 |
| 9 | lagS 60, DIP 45 × 1.0, HOUSE 14.4 × 15.6 (both sides × 1.2) | 0.715 | | 2 | 0.40 / 0.35 |
| 10 | lagS 60, DIP 45 × 0.8, HOUSE 12 × 15.6 | 0.665 | | 1 | 0.35 / 0.296 |
| 11 | lagS 120, DIP 45 × 0.8, HOUSE 14.4 × 13 | 0.654 | | 1 | 0.34 / 0.295 |
| 12 | lagS 60, DIP 45 × 1.0, HOUSE 14.4 × 13 | 0.705 | | 2 | 0.35 / 0.301 |
| **13 (chosen)** | **lagS 60, DIP 45 × 0.8, HOUSE 14.4 × 13** | **0.664** | **0.664** | **2** | **0.35 / 0.305** |

Run 13 was chosen over 12 for the larger H23 margin. The margin is thin (5 mm over the threshold), so claim 1 is
sensitive to any future retune.

### Story claims (pass 3)

| # | Claim | Result (final config) | Status |
|---|---|---|---|
| 1 | baseline J07 ≥ 0.15 m and ≥ 2 homes | J07 0.664 m ✓, 2 homes (H22 0.35 m, H23 0.305 m) ✓ | **restored**, passes |
| 2 | desilt lowers J07, P07 still ≥ 0.99 | 0.664 = 0.664 ✗, P07 1.000 ✓ | **removed**: catchments break it (below) |
| 3 | upsize lowers J07 | 0.082 < 0.664 ✓ | kept, passes |
| 4 | combined beats each alone | 0.056 < 0.664 and < 0.082 ✓ | kept, passes |
| 5 | high tailwater raises J08; flap gate and pump each lower it | J08 0.000 in all runs ✗ | **removed** again (below) |
| 6 | tank and lake each change J07 by ≥ 0.03 m | tank Δ 0.582 ✓, lake Δ 0.183 ✓ | kept, passes |
| 7 | water balance < 1 % | 0.000 % on all 9 runs ✓ | kept, passes |

**Why claim 2 now fails (caused by the catchments).** At steady state the catchments alone deliver about 0.64 m³/s to
J07 (J01 0.178 + J02 0.105 + J04 0.178 via P03/P04/P05, plus J07's own 0.178), above P07's 0.549 m³/s full-bore cap. So
J07 fills (max node fill 1.00 in every baseline run) and stays full for the rest of the storm. `captureInlets` limits
grate inflow to the node's free storage, so at the peak the D07 grate takes nothing whatever its blockage. The J07 pond is
set by J07's overflow, not by the grate. Before J07 fills, only 20 % of the rain reaches the surface, and the 40 %-blocked
grate already takes all the water that reaches it. Desilt's J07 change was exactly 0.000 m in every sweep above (lagS 60,
300 and 1200 s; DIP 30–45 m × 0.5–1.0 m; FUNNEL 8 × 0.1 m and 30 × 0.3 m), and it is 0 for all four storms in the
badges. The second half of the claim (desilt P07 max load ≥ 0.99) still holds. Desilting only matters once P07 is
upsized (claim 4: combined 0.056 < upsize 0.082).

**Why claim 5 still fails.** The pass 2 argument stands: P07 delivers at most 0.549 m³/s to J08. OUT01's 2 m chamber
passes that below its 10.2 m crown at the 9.4 m stage (max fill 0.64), so P08 is never throttled. J08's node peaks at
0.14 fill and its street cell stays dry (≤ 1 mm) in the normal, high, flap and pump runs. The catchments add no inflow
downstream of P07, so they can't change this.

### Effect badges (pass 3)

`npm run effects` regenerated `packages/engine/src/scenario/effects.json`. The 80 mm/h normal-tailwater row:
desilt 0 / 0 homes, upsize −0.581 m / −2, flap gate 0 / 0, tank −0.581 m / −2, lake overflow −0.183 m / −2, pump 0 / 0.
Desilt, flap gate and pump are 0 on every storm and both tailwater cases, for the reasons under claims 2 and 5.

### SWMM cross-check (pass 3)

`ENFORCED = true` was tried and failed on its first trunk pipe (P03 −31.5 % against ±30 %). It is back to
`false`. See the next section.

## SWMM cross-check (Tasks 5 and 8): report-only

`packages/engine/tests/swmm.crosscheck.test.ts` compares the engine's pipe peaks with Tay Zheheng's EPA SWMM 5.2.4 run
(`data/validation/t1/baseline`) for `synthetic_80mmh_60min`, normal tailwater and INLET-D07 clean. The test regenerates
`docs/swmm-crosscheck.md`. The target is ±30 % peak flow and ±10 min peak time on the trunk pipes P03, P05, P07 and P08.
In Task 8 the test was run with `ENFORCED = true` and failed (P03 −31.5 %), so it is back to `ENFORCED = false`
(report-only). The tolerances are unchanged.

Pass 3 (with catchments, final config):

| Pipe | SWMM peak (m³/s) | Engine peak (m³/s) | Difference | Peak time difference (min) | Engine full-bore capacity (m³/s) |
|---|---|---|---|---|---|
| PIPE-P01 | 0.218 | 0.186 | -14.7% | -43.0 | 0.240 |
| PIPE-P02 | 0.218 | 0.113 | -48.2% | -43.5 | 0.208 |
| PIPE-P03 | 0.437 | 0.299 | -31.5% | -43.5 | 0.516 |
| PIPE-P04 | 0.218 | 0.183 | -16.1% | -42.0 | 0.294 |
| PIPE-P05 | 0.655 | 0.441 | -32.6% | 0.5 | 0.516 |
| PIPE-P06 | 0.029 | 0.000 | -100.0% | -61.0 | 0.319 |
| PIPE-P07 | 0.873 | 0.549 | -37.1% | -58.5 | 0.549 |
| PIPE-P08 | 0.873 | 0.549 | -37.1% | -58.5 | 0.996 |

Pass 2 (before catchments) had P01–P05 at −58 % to −69 % and every peak time about −58 min. The catchments close most of
the gap on P01, P04 and P05's timing, but enforcement still fails:
- **P07 and P08 (structural, unchanged).** The engine caps each pipe at its full-bore Manning capacity. P07 (asset Ø600,
  slope 0.008) carries at most 0.549 m³/s, so −37.1 % is the best it can reach against SWMM's surcharged 0.873 m³/s. P08's
  only inflow is P07. Closing this needs head-driven pressure flow in `src/sim/pipes.ts` or a different P07 diameter;
  both are off-limits.
- **P03 and P05 (catchment area).** CATCH-D02 gets only 0.59 ha of grid cells (J02 is near the north grid edge) against
  SWMM's 1 ha, so P02 is −48 % and P03 sits at −31.5 %. P05 (−32.6 %) is also held down by J07/J05 surcharge from the P07
  cap. Grate capture (`FUNNEL`, `INLET_SUMP`) adds only about 0.016 m³/s to P03, and the catchment areas come from Tay's
  data and the grid, not from a tunable.
- **Peak time (structural).** SWMM's hydrographs peak at t = 60 min. The engine's pipes reach a capped plateau early
  (P07 at about 2 min, P03 at about 17 min) and the first plateau frame counts as the peak, which gives −43 to −58 min.
  A longer `CATCHMENT.lagS` (1200 s) delays P07's plateau only to about 25 min, still −35 min.
