# Taman Kyra tuning log (Tasks 4 and 4b)

Date: 2026-10-20. Storm: `synthetic_80mmh_60min` (constant 80 mm/h, 60 min, plus 3600 s recession).
Town: Taman Kyra (network from `data/synthetic/taman_kyra_assets.json` by Tay Zheheng; layout from
`data/synthetic/taman_kyra_layout.json`, derived from Jiajie's scene). Baseline blockage `INLET-D07` 40 %.

**Outcome (pass 2):** with the spec §13 terrain redesign and one tuned value (`FUNNEL.radius` 18 → 30 m), claims 2, 3, 4,
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

## Story claims

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
