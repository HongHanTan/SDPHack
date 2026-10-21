# Fix Finder: Per-Problem Fixes and a 3-Zone Demo Package (Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Spec:** `docs/superpowers/specs/2026-10-21-automated-fix-finder-design.md` §10.

## Global Constraints

- **Honesty:**
  - No hard-coded outcomes.
  - The demo package is synthetic and labelled as such.
  - Results come only from engine runs.
  - The UI never says AI or LLM.
- **Unchanged:** existing samples and tests. The Taman Kyra sample stays equivalent to the built-in town.
- **Process:**
  - Commits by the user only. NEVER add Co-Authored-By or any co-author line. Do not push. Never stage `md/progress/honghan.md`.
- **Verify:**
  - `npm -w @floodops/engine test` and its typecheck
  - `npm -w township-floodops-web test`
  - `npm -w township-floodops-web run build` (check the exit code)
  - root `npm test`

  Delete `dist` afterwards.

### Task 1: Finder — series bottlenecks, per-problem candidates, no storage

- **File:** `packages/engine/src/analysis/fixFinder.ts`, with its tests.
- **Implement spec §10 "Finder changes":**
  - merge series bottlenecks into one problem;
  - generate candidates per problem (cap 8, at least 1 per problem);
  - drop storage generation;
  - the best fix per problem prefers its own fixes.
- **Update the web side if any shape changes:** `apps/web/src/site/local/localSiteApi.ts`, `fixPinText.ts`, `FixFinderPanel.tsx`. The existing behaviour on the current sample must stay valid: one P07 problem plus J07 ponding, and an upsize suggested for P07.
- **Tests:**
  - a series chain merges into one problem;
  - relief spans the whole chain;
  - each problem gets its own candidates;
  - the cap of 8, with at least 1 per problem;
  - no storage candidates.
- **Commit:** `feat(engine): fix finder — series bottlenecks, per-problem candidates`

### Task 2: 3-zone synthetic demo package

- **Generator:** `packages/engine/scripts/samplePackage.ts` gets a `makeDemoFiles` function, written by `makeSamplePackage.ts` to `data/samples/taman_kyra_demo/` and `apps/web/public/site-examples/taman-kyra-demo/`.
  - It derives the files from the Taman Kyra sample: the same layout and ground, with a modified network (`.inp`) and inlets (layout).
  - It produces the three zones of spec §10, tuned with real simulations until the finder's best fix per zone is upsize, relief and extra inlet respectively.
  - It keeps values plausible: diameters 0.3–1.5 m, n 0.013, slopes ≥ 0.001.
  - It labels everything synthetic.
- **Tests:**
  - the drift test covers the new files;
  - a slow test (`packages/engine/tests/demoZones.slow.test.ts`, in `story`, excluded from `test`) runs `buildSiteFromFiles` → `stormFromInp` → baseline → `diagnose` → candidates → simulate each → `rankResults` → best per problem, and asserts three problems with best fix kinds `upsize`, `relief` and `inlet`, in distinct zones.
- **Portal:** add "Download the 3-zone demo (synthetic)", linking the 3 files.
- **README** in the demo folder: what each zone demonstrates, and that it is synthetic.
- **Checklist:** add item 63, "3-zone demo: the pins show an upsize at the trunk, a relief pipe on the series branch, and extra grates at the low street".
- **Commit:** `feat: synthetic 3-zone demo package where upsize, relief and extra inlet each win`
