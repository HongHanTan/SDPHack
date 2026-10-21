# Automated Fix Finder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "Find the best fix" in the uploaded-site Compare tab. It diagnoses the baseline, generates up to 6 fixes of 4 types, simulates them in parallel, ranks them, shows pins and cards, and opens side-by-side on OK.

**Spec:** `docs/superpowers/specs/2026-10-21-automated-fix-finder-design.md`. It has the exact rules, numbers and wording, and every task must follow it.

## Global Constraints

- **No LLM or ML.**
  - UI wording: "Automated analysis" / "optimisation engine".
  - Costs are labelled "indicative placeholder".
  - Every displayed result comes from a simulation run in this analysis.
- **Unchanged:** the built-in Taman Kyra, Mock, SWMM API, LegacyApp and all existing tests.
- **Process:**
  - Commits by the user only. NEVER add Co-Authored-By or any co-author line. Do not push. Never stage `md/progress/honghan.md`.
  - Tay's files (`SiteWorkspace.tsx`, `SiteCityScene.tsx` is ours, `compare.ts` is ours): minimal, gated edits. Body line: "SiteWorkspace by Tay Zheheng (zerng); fix-finder additions only."
- **Verify:**
  - `npm -w @floodops/engine test` and its typecheck
  - `npm -w township-floodops-web test`
  - `npm -w township-floodops-web run build` (check the exit code)
  - root `npm test`

  Delete `dist` afterwards.

---

### Task 1: Engine fix actions

**Files:**
- Create:
  - `packages/engine/src/scenario/fixActions.ts`
  - `packages/engine/tests/scenario/fixActions.test.ts`
- Modify:
  - `packages/engine/src/scenario/layout.ts` (`AssetNode.storage_area_m2?`)
  - `packages/engine/src/scenario/site.ts` (`SiteSubcatchment.captureScale?`)
  - `packages/engine/src/scenario/network.ts` (use `storage_area_m2` as the node area)
  - `packages/engine/src/scenario/catchments.ts` (scale the curve's captured values by `captureScale`)
  - `siteVariants.ts` (keep `withPipeDiameter`; export it or re-export it from `fixActions`)

**Produces:**
- `type FixAction`, one of:
  - `{ kind: 'upsize'; pipeId; diameterM }`
  - `{ kind: 'relief'; fromNode; toNode; diameterM }`
  - `{ kind: 'storage'; nodeId; volumeM3 }`
  - `{ kind: 'inlet'; nodeId; grates }`
- `applyFix(site, fix): SiteSpec`: a new key suffixed by a fix id. It throws on invalid input: unknown ids, relief pipes that run uphill, non-positive sizes.
- `fixLabel(fix, site): string`, for example "Upsize PIPE-P07 to Ø750", "Relief pipe NODE-J07 → NODE-OUT01 (Ø600)", "800 m³ storage at NODE-J05", "Extra inlet grate at NODE-J07".
- `fixCostRM(fix, site): number`, using the indicative rates in spec §2.
- `fixLocation(fix, site): { x: number; y: number }` in team metres: the pipe midpoint, the node, or the relief-pipe midpoint.
- `STANDARD_PIPE_SIZES_M`

**Tests:**
- Each action changes only what it should, and the original site is untouched.
- Keys are unique.
- Relief pipe: the length equals the plan distance, and an uphill relief pipe throws.
- Storage area = volume ÷ max depth.
- Extra inlet: grate area +0.6 m², and the capture scale = (n + 1) ÷ n.
- Costs match the formulas.
- Built-in builders are unchanged: existing tests pass unchanged.
- A slow test, excluded from `npm test` and included in the `story` script: on the sample package, upsize PIPE-P07 to 0.75 lowers the J07 peak, and each of the other three actions runs without error.

**Commit:** `feat(engine): general fix actions for any site — upsize, relief pipe, storage, extra inlet`

### Task 2: Engine diagnosis, candidate generation, ranking (pure)

**Files:**
- Create:
  - `packages/engine/src/analysis/fixFinder.ts`
  - `packages/engine/tests/analysis/fixFinder.test.ts`

**Produces:**
- `diagnose(frames, metrics, site) → Diagnosis`, per spec §3. It uses the web's team-frame shape:

  ```ts
  { pipe_states: { conduit_id; capacity_fraction?; status }[];
    node_states: { node_id; status; depth_m }[];
    timestamp_s }
  ```

  plus the metrics fields `j07_peak_depth_m`, `homes_flooded` and `total_flooding_volume_m3`. Define a minimal structural input type in the engine; don't import the web types.
- `generateCandidates(diagnosis, site) → FixAction[]`, per spec §4.
- `rankResults(baseline, results[]) → { ranked; noEffect }`, per spec §5.
- `logLines` helpers that produce the exact spec §6 message formats.

**Tests:**
- Synthetic frames: a bottleneck is found, with the right surcharge minutes.
- Candidates for the sample network topology:
  - upsize P07 to 0.675 and 0.75;
  - relief from J07 to a node 2 links downstream;
  - storage at J05;
  - inlet at J07.
  - At most 6, with duplicates dropped.
- No flooding gives no candidates.
- Ranking order and the no-effect rule.
- The message formats.

**Commit:** `feat(engine): fix finder — diagnose, generate candidate fixes, rank simulated results`

### Task 3: Web: analysis in the local site API

**Files:**
- Modify: `apps/web/src/site/local/localSiteApi.ts` and `runs.ts` (worker pool)
- Tests in `__tests__/`, with a mocked runner pool.

**Produces:**
- `analyse(projectId, onEvent, signal) → Promise<AnalysisResult>`
  - Events:
    - `{ type: 'log'; text }`
    - `{ type: 'progress'; done; total }`
    - `{ type: 'candidate'; index; fix; label; costRM; metrics; improved }`
  - Result:
    - `{ baselineRunId; diagnosis; ranked: Array<{ fix; label; costRM; location; metrics; resultKey }>; noEffect: string[] }`
- `acceptFix(projectId, resultKey) → SimulationRun`: saves the kept in-memory result as a stored run, with `input_snapshot.intervention = { kind, label, changes }` (`changes` = `[{ asset_id, before, after }]` where meaningful; empty for storage and inlet). Then prune.
- `discardAnalysis(projectId)`

**Behaviour:**
- Run the baseline first if none is stored, saving it as a baseline run.
- Run candidates through a pool of up to 3 `SimRunner`s (cache 1 each), with the same storm and options.
- Respect `signal` between candidates.

**Tests:**
- Event order and messages.
- Baseline reuse versus creation.
- `acceptFix` stores exactly one run, with the right snapshot.
- Cancel stops the analysis.
- The pool size cap.

**Commit:** `feat(web): automated fix analysis in the local site API`

### Task 4: Web: analysis panel, cards, map pins, OK → side by side

**Files:**
- Create:
  - `apps/web/src/site/FixFinderPanel.tsx`
  - `apps/web/src/site/FixPins.tsx`
- Modify:
  - `SiteWorkspace.tsx` (gated)
  - `SiteCityScene.tsx` (`pins` prop)
  - `compare.ts` (the AFTER title uses `intervention.label` when present)
  - `docs/browser-checklist.md`

**Behaviour:**
- The UI and wording follow spec §7 exactly.
- Pins use drei `Html` at `fixLocation`, converted through the scene's team → scene mapping.
- OK calls `acceptFix`, sets `candidate` to the returned result (frames, metrics, depth), sets the view to side by side, and closes the panel.
- Leaving the tab or project calls `discardAnalysis`.

**Checklist:** add items 60–62:
- 60: Find the best fix runs, the log streams, and the progress bar advances.
- 61: The cards and pins match. P07 upsize is recommended on the sample; an upstream pipe upsize shows "no effect".
- 62: OK opens side-by-side with the fix label, and the strip shows the improvement.

**Commit:** `feat(web): fix finder panel, map pins and OK to side-by-side`
