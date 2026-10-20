# Build Progress — Township Flood Simulator

Plan: `docs/superpowers/plans/2026-10-20-flood-sim.md` · Branch: `feat/flood-sim`

| # | Task | Status | Commits |
|---|---|---|---|
| 1 | Scaffold, types, surface flow | ✅ done | 215f77c |
| 2 | Pipe network | ✅ done | d10eef9 |
| 3 | River + coupling | ✅ done | fa45ab8 |
| 4 | Engine, metrics, water balance | ✅ done | d88a1ac |
| 5 | Design storms | ✅ done | a620d72 |
| 6 | Township + interventions | ✅ done | d766c6d |
| 7 | Worker + runner | ✅ done | 1821941 |
| 8 | 3D rendering | ✅ done (visual check pending — needs a browser) | 9395525 |
| 9 | UI | ✅ done (visual check pending — needs a browser) | 628825a |
| 10 | Tuning the demo story | ✅ superseded by task 14 | 7bba4fa, fc421be |
| 11 | Draw-a-pipe (stretch) | ✅ done (visual check pending — needs a browser) | 0470680 |
| 12 | Build, README | ✅ done | 0d7be11 |
| 13 | Hide building blocks, make pipe network prominent | ✅ done | 1973520 |
| 14 | Second tuning pass (every preset matters, realistic depths, timestep guard) | ✅ done | f0f263f, fb89a79 |
| 15 | Final review fixes (demo-safety: custom pipes, run locking, stale results) | ✅ done | 6b0674b |

## Notes
- Task 14: all story criteria pass (`npm run story`, ~5 min). Every preset changes the sag; flap gate + tank beats the RM 4.5M upsize for RM 2.65M; inlets + pump clears the roads. Full table in `docs/tuning.md`.
- ⚠️ Each live run takes ~33 s on this laptop (CPU was throttled to 1.4 GHz; ~16 s at normal speed). Pre-cache the demo scenarios before presenting.
- Pitch caveats: pitch the pump together with the flap gate (without it the pump recirculates river water); the relief pipe stores water at the pond node, so the pond surface does not visibly rise.
- Tasks 8, 9, 11, 13: the automated checks pass, but they still need a check in a browser.

---

# Phase 2 — Live mode, rain & intervention UX

Plan: `docs/superpowers/plans/2026-10-21-live-mode-ux.md`

| # | Task | Status | Commits |
|---|---|---|---|
| P2-1 | Rain intensity lookup + intervention catalog | ✅ done | 190f51d |
| P2-2 | patchEngine (mid-run network swap) | ✅ done | 077e51a |
| P2-3 | Live session + live worker | ✅ done | f5c5a7a |
| P2-4 | Pre-computed effect badges | ✅ done | 09b1432 |
| P2-5 | Selection store + grouped intervention panel | ✅ done | 7b6ed81 |
| P2-6 | Rain, rain gauge, map pins | ✅ done | 1d59e52 |
| P2-7 | Split main.ts; panel/pins/rain in Compare | ✅ done | e8fbf3c |
| P2-8 | Live mode + Live/Compare tabs | ✅ done | 2a6430d |
| P2-9 | README, assumptions, browser checklist | ✅ done | 704d648 |
| P2-10 | Final review fixes (stale live messages, view on return to Live, minors) | ✅ done | 5792415 |

## Phase 2 notes
- Everything is built and passes 99 tests, the type checks and the production build. **Nothing in Phase 2 has been opened in a browser yet**; work through `docs/browser-checklist.md`.
- The effect badges come from `src/scenario/effects.json`. Rerun `npm run effects` (~9 min) after any retune. `npm run story` checks that the badges still match the model (~15 min).

---

# Phase 3 — Visual upgrade

Plan: `docs/superpowers/plans/2026-10-22-visual-upgrade.md`

| # | Task | Status | Commits |
|---|---|---|---|
| P3-1 | Pure helpers: theme blend, fps guard, flow maths, depth smoothing | ✅ done | 744f1c1 |
| P3-2 | Ground texture, trees, soil skirt, textured terrain | ✅ done | 62485b8 |
| P3-3 | Water shader (smoothing, foam, ripples, fallback) | ✅ done | 5f9f5e8 |
| P3-4 | X-ray / plan pipe ribbons with flow arrows | ✅ done | cee54d2 |
| P3-5 | Scene conductor: lighting, sky, x-ray blend, plan camera, bloom, quality | ✅ done | 3c82e76 |
| P3-6 | Toolbar, plan overlay, restyled pins | ✅ done | a4b9a17 |
| P3-7 | Docs + browser checklist | ✅ done | d91d7cf |
| P3-8 | Final review + fixes (plan-view fog, smooth arrows, camera limits, polish) | ✅ done | 4be4368 |

## Phase 3 notes
- Everything is built and passes 115 tests, the type checks and the production build. **Nothing in Phase 3 has been opened in a browser yet**; work through `docs/browser-checklist.md`, items 20–27.
- Open question for you: the automatic switch to Low quality triggers below 30 fps, as the spec says. The reviewer suggested 27 fps, so that laptops capped at 30 fps (battery saver, 30 Hz screens) don't trigger it by accident.

---

# Phase 4 — Team integration, part 1 (history merge + monorepo)

Plan: `docs/superpowers/plans/2026-10-23-team-merge.md`

| # | Task | Status |
|---|---|---|
| P4-1 | Merge team history (zerngx/sdphack) | ✅ done (352164e) |
| P4-2 | Restructure into workspaces (packages/engine, apps/legacy, apps/web) | ✅ done (f602e3b) — note: three→0.170 & vite→6 for legacy/engine so the team app builds in the shared install |
| P4-3 | Move ledger, final checks, push to main | ✅ done |

---

# Team integration

| # | Part | Status |
|---|---|---|
| T1 | History merge + monorepo layout (`apps/web`, `apps/legacy`, `packages/engine`) | ✅ done |
| T2 | Rebuild engine township on Taman Kyra + retune (team's 3 options + flap gate, tank, lake overflow, pump) | pending |
| T3 | Drive `apps/web` UI from the engine through an adapter | pending |

---

# Phase 5 — Team integration, part 2 (engine township on Taman Kyra)

Plan: `docs/superpowers/plans/2026-10-23-taman-kyra-engine.md`

| # | Task | Status |
|---|---|---|
| P5-1 | Extract Taman Kyra layout data (credit Jiajie) | ✅ done (30eca9a) |
| P5-2 | Engine township: terrain, network, storms, interventions, tailwater | ✅ done (8cb1671) |
| P5-3 | Keep legacy UI running on Taman Kyra | ✅ done (52af994) |
| P5-4 | Tune the demo story | ⚠️ pass 1 (f7522cf): only water-balance claim held — terrain redesign chosen (option A) |
| P5-4b | Terrain redesign (plane + grate funnels + outfall chamber) and retune | ✅ done (a708367) — claims 2,3,4,6,7 pass; 1 (homes) & 5 (high tailwater) removed, see docs/tuning.md |
| P5-5 | SWMM cross-check vs Tay's run | ✅ done (c4b3009) — report-only: engine ~35–68% below SWMM (full-bore cap + grate-limited intake) |
| P5-6 | Effect badges (with tailwater) | ✅ done (98daa52) — flap-gate & pump show 0 effect (see notes) |

## Phase 5 notes
- Team story works under the 80 mm/h storm. J07 junction peak depth for each option:

  | Option | J07 peak depth |
  |---|---|
  | Baseline | 0.30 m |
  | Desilt D07 | 0.27 m |
  | Upsize P07 | 0.19 m |
  | **Combined** | **0.12 m** |
  | Tank | 0.19 m |
  | Lake overflow | 0.19 m |

- Open issues needing a decision:
  - No houses flood. The deepest water on a house is 0.09 m, against the 0.30 m threshold.
  - The high canal level never reaches the streets, so the flap gate and pump show no effect.
  - The SWMM cross-check is report-only. The engine is 35–68% below Tay's SWMM peaks, because the engine caps each pipe at its full-bore capacity and limits intake at the grates, while SWMM loads catchments directly into the nodes.
- Details are in `docs/tuning.md` and `docs/swmm-crosscheck.md`.

| # | Task | Status |
|---|---|---|
| P5-7 | SWMM-style catchment loading (engine + scenario) | ✅ done (9de10df) — note: J02 catchment only 0.59 ha (grid edge) |
| P5-8 | Retune with catchments; restore claims; cross-check; badges | ✅ done (3cfa486) — claims 1,3,4,6,7 pass; 2 (desilt) & 5 (tailwater) removed; cross-check report-only |
| P5-9 | Grate capture for catchments; drop flap gate and pump | ✅ done (1796ac6) |
| P5-10 | Retune; restore claim 2; badges | ✅ done (b1611f7) — claims 1,3,4,6,7 pass (homes margin 39 mm); claim 2 stays removed (desilt alone ≈ 0 while P07 saturated) |

---

# Phase 6: team integration, part 3 (team React UI driven by the engine)

Plan: `docs/superpowers/plans/2026-10-23-team-ui-engine.md`

| # | Task | Status |
|---|---|---|
| P6-1 | Engine prep: move runner and smoothing, pass options to the worker, layout visual fields, dashboard metrics | ✅ done (434f865) |
| P6-2 | Web tests and pure adapters (visual ground, frame/metrics) | ✅ done (c4afe99) |
| P6-3 | Engine data mode, three-way switch, engine-mode gating | ✅ done (a3d82eb) — follow-ups: engine-mode storm selector; gate handleSwitchAppMode offline load |
| P6-4 | Scene: layout-driven houses and trees, dips, real water | ✅ done (0258471) |
| P6-5 | Live toggle | ✅ done (d34d5d7) — plus engine storm selector and appMode gating |
| P6-6 | Engine-backed dashboard, HUD metrics, docs | ✅ done (b05f5dd) |
| P6-7 | Final review + fixes | ✅ done |

## Phase 7: X-ray view and 2D/3D toggle in the team UI
| Task | Description | Status |
|---|---|---|
| P7-1 | Pure view helpers: theme blend, flow math, scale bar and camera fit, surface ghosting | ✅ done (e8243d2) |
| P7-2 | X-ray toggle: theme fade, scene look, ghosted township | ✅ done (5d2fafe) — minor: grid hides instantly; surface swaps at the fade midpoint |
| P7-3 | X-ray flow ribbons, bloom, manhole glow | ✅ done (039250c) — minor: list postprocessing peer explicitly; ribbons rebuild if asset arrays change identity |
| P7-4 | 2D plan / 3D toggle, scale bar, checklist | ✅ done (e47a404, fix 27ba413) |
| P7-5 | Final review + fixes (camera aspect after 2D, gizmo with bloom, clickable manholes in 2D, label polish) | ✅ done (ff249dc) |
