# Township tuning log (Task 10)

Date: 2026-10-20. Tuned config commit: `7bba4fa`.
Storm: 100-yr ARI, 2 h alternating block (136 mm total, peak 316 mm/hr block), + 1 h recession.

## Final `npm run tune` table

| scenario | sag peak (m) | homes | road area (m²) | passable (min) | cost (RM M) | balance % | run (s) |
|---|---|---|---|---|---|---|---|
| baseline | 2.09 | 11 | 1936 | > 60 | 0.00 | 0.000 | 18.6 |
| #1 Upsize trunk drain | 2.10 | 11 | 1936 | > 60 | 4.50 | 0.000 | 18.6 |
| #2 Relief pipe to pond | 2.09 | 11 | 1936 | > 60 | 1.80 | 0.000 | 18.7 |
| #3 Underground detention tank | 2.09 | 11 | 1936 | > 60 | 2.50 | 0.000 | 18.4 |
| #4 Bioswales on the boulevard | 2.09 | 11 | 1936 | > 60 | 0.80 | 0.000 | 18.5 |
| #5 Flap gate on outfall | 1.88 | 9 | 1760 | > 60 | 0.15 | 0.000 | 18.7 |
| #6 Extra inlets in the sag | 2.09 | 11 | 1936 | > 60 | 0.30 | 0.000 | 21.0 |
| #7 Pump station at the sag | 1.67 | 9 | 1584 | > 60 | 3.00 | 0.000 | 18.6 |
| #3 + #5 tank + flap | 1.88 | 9 | 1760 | > 60 | 2.65 | 0.000 | 18.7 |

**Runtime:** ~18.5 s per run (Node 22 / tsx, this Windows laptop; one outlier at 21 s). Just under the ~20 s
live-demo budget. At the original `dt = 0.5` a run took ~9.5 s, but the results were numerical noise (see below).
If the demo machine is slower, `dt = 0.3` is still stable (~15 s/run) but sits close to the stability limit.

`npm run story`: all 4 assertions pass.

## Config changes from plan defaults

| constant | old | new | reason |
|---|---|---|---|
| `SIM.dt` | 0.5 | 0.25 | At 0.5 s the virtual-pipes surface scheme is **unstable**: depths form a cell-by-cell checkerboard (0.00 m next to 1.5 m), the pond peaked at 5.5 m, and all metrics were noise. A sweep found 0.35 unstable and ≤ 0.3 smooth (consistent with a limit of about √(dx / 4g) ≈ 0.32 s). 0.25 gives margin. **This departs from the Global Constraint "dt = 0.5 s"**, and the surface scheme should get a CFL guard (a `src/sim/` follow-up, not done here). |
| `SAG.depth` | 1.5 | 2.5 | With a 1.5 m bowl the sag stored only ~2,900 m³ below its spill rim (~3.65 m, ground at the bund ends), but received ~12,000 m³ (9,000 m³ overland from the bund-dammed strip to the north, plus 3,000 m³ direct rain). Every scenario filled to the rim, giving an identical 1.11 m. Deepening it raises storage and drops the outfall below river stage for longer. |
| `SAG.r` | 60 | 80 | Still rim-limited at r = 60 (every scenario at 1.84–1.86 m except the pump). The knob table says *decrease* r, but here the sag's catchment is the strip dammed by the bund, which grows with r, while storage grows with r². Larger r was needed. 160 m wide × 2.5 m deep, still inside the bund span (x 20–180). |

No pipe diameter, river stage, tank, inlet or infiltration value was changed. River peak 3.2 m is still below `BUND.z` 4.0 m.
No expectation in `tests/scenario/township.test.ts` needed updating.

## Iteration log

| # | change | baseline sag / homes | upsize | flap | tank+flap | notes |
|---|---|---|---|---|---|---|
| 0 | plan defaults (dt 0.5) | 2.24 / 7 | 2.23 / 7 | 2.24 / 7 | 2.24 / 7 | checkerboard instability; ~9.5 s/run |
| 1 | `SIM.dt` 0.5 → 0.25 | 1.11 / 6 | 1.08 / 6 | 1.11 / 6 | 1.11 / 6 | smooth; sag fills to rim in every scenario |
| 2 | `SAG.depth` 1.5 → 2.5 | 1.85 / 9 | 1.86 / 9 | 1.84 / 8 | 1.83 / 8 | still rim-limited; pump 1.60 / 7 |
| 3 | `SAG.r` 60 → 80 | 2.09 / 11 | 2.10 / 11 | 1.88 / 9 | 1.88 / 9 | story passes |

## What the model actually says (read before pitching)

- **Baseline:** the sag fills from local overland runoff during the storm peak (t ≈ 50–80 min). When the river
  rises above the outfall chamber (O ground ≈ 1.6 m), it backflows ~3,700 m³ through the outfall (measured in iteration 2) and keeps the
  sag topped up until the river recedes.
- **Upsize trunk (RM 4.5M):** no help. It is actually 1 cm worse, because the 900 mm outfall also lets in more
  backflow (~8,700 m³ instead of ~3,700 m³, iteration 2). That honestly supports "upsizing alone doesn't fix it, because the
  river backflows through the outfall".
- **Flap gate:** this does all the work in the tank + flap combo (2.09 → 1.88 m, 11 → 9 homes, RM 0.15M).
- **Detention tank:** contributes **nothing** to the sag, alone or combined. It intercepts trunk flow at T6, and a
  check that throttled the trunk-to-sag link (T8→S0) left the sag peak unchanged (1.881 → 1.880 m). Trunk water
  isn't part of the sag problem. So "tank + flap beats upsize for less money" is true, but the honest line is
  "a RM 150k flap gate beats a RM 4.5M upsize". The tank is a passenger in this township.
- **Pump (RM 3M)** is the single most effective preset for sag depth (1.67 m), because it works regardless of river stage.
- Nothing lets the sag drain within 60 min of the storm ending ("> 60" everywhere): the outfall stays blocked
  while the river is above the chamber.

## Commit

Tuned config committed in `chore: tune synthetic township so the demo story emerges from the model`
= `7bba4fa`.
