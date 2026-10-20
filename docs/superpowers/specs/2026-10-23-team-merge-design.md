# Team Integration, Part 1: History Merge and Monorepo Layout

**Date:** 2026-10-23

## 1. Context

The team's repo `github.com/zerngx/sdphack` ("Township FloodOps") has two parts:
- a React + react-three-fiber + Tailwind frontend (`apps/web`, by TEH JIA JIE);
- an EPA SWMM Python backend (`services/api`, `simulation/`, by Tay Zheheng / zerng).

This repo holds the TypeScript physics engine, the live and compare simulator, and a vanilla three.js UI.

**Goal of the overall integration:** use the team's township surface (houses, trees, cars, roads, lake) and dashboard UI, while keeping this repo's physics engine:
- the rain storm;
- pipe colour changing with load;
- water level rising over time.

Teammates' work must keep its git authorship. Their commits are merged, not copied.

### 1.1 Decisions already made (all three parts)

| Topic | Decision |
|---|---|
| Stack | Move the product UI to their React/R3F app and reuse their components. Our engine sits behind an adapter. |
| UI scope | Their township models and dashboard shell: header, simulation HUD, intervention dashboard, telemetry ticker, asset popups. Field inspectors, debris lab and the real-SWMM-API mode are out of scope for now; their code stays in the repo. |
| Town layout | Their Taman Kyra layout. Our physics township is rebuilt on their network (`taman_kyra_assets.json`: 9 nodes, 8 conduits, 4 inlets, same IDs and levels) and retuned. |
| Interventions | Their three options lead the story (baseline INLET-D07 40% blocked; desilt inlet; upsize PIPE-P07 to Ø750; combined). Our relevant extras are added as further options with effect badges: flap gate, storage tank, overflow to the lake, pump. |
| Sequencing | Three parts, each with its own spec, plan and build: (1) history merge and layout, this spec; (2) physics township rebuild on Taman Kyra and retune; (3) React UI port and engine adapter. |

## 2. Part 1 scope

### 2.1 History merge
- Add `team` as a remote (`https://github.com/zerngx/sdphack.git`, already added) and fetch.
- On a new branch `integrate/team-merge` from `main`, run `git merge --allow-unrelated-histories team/main`. The 23 team commits keep their hashes, authors and dates.
- **Conflicts:**
  - `README.md`: keep the team README as the main document and append a section "TypeScript flood engine (Hong Han)". It describes the engine, the three-part integration roadmap, and how to run the engine tests and the legacy UI.
  - `.gitignore`: the union of both files.
- The merge commit and every later commit are authored by the user only. No `Co-Authored-By` lines.

### 2.2 Monorepo layout
All moves use `git mv`, so `git log --follow` keeps per-file history.

| Path | Contents |
|---|---|
| `apps/web/` | Team frontend, unchanged in part 1 |
| `packages/engine/` | `src/sim/`, `src/scenario/`, `src/worker/`, `scripts/` (tune, effects), `tests/sim`, `tests/scenario`, `tests/worker`, `tests/story.test.ts`, `tests/effects.drift.test.ts`, `tests/helpers.ts`, the engine `tsconfig.json` and `vite.config.ts` (vitest) |
| `apps/legacy/` | Its own `package.json` with name `legacy`; `index.html`, `src/main.ts`, `src/render/`, `src/ui/`, `tests/render`, `tests/ui`, its own `vite.config.ts` and `tsconfig.json`. It imports the engine as the workspace package `@floodops/engine`. |
| `services/api/`, `simulation/`, `models/`, `data/`, `contracts/`, `md/`, `AGENTS.md` | Team files, unchanged |
| `md/progress/honghan.md` | Moved from `progress.md`, following the team's per-person progress convention |
| `docs/superpowers/` | Specs and plans, unchanged |

- **Engine package:**
  - `packages/engine/package.json`, with name `@floodops/engine`, `"type": "module"`, and `exports` mapping `./sim/*`, `./scenario/*` and `./worker/*` to the TypeScript sources.
  - Vite resolves the workspace TS sources directly, so there is no build step.
- **Root `package.json`:** private, `"workspaces": ["apps/*", "packages/*"]`, with scripts:

  | Script | Runs |
  |---|---|
  | `test` | `npm -w @floodops/engine test && npm -w legacy test` |
  | `story` | `npm -w @floodops/engine run story` |
  | `effects` | `npm -w @floodops/engine run effects` |
  | `dev:web` | `npm -w township-floodops-web run dev` |
  | `dev:legacy` | `npm -w legacy run dev` |
  | `build` | builds legacy and web |

- **Imports:**
  - Legacy UI imports that used to point into `../sim/...`, `../scenario/...` or `../worker/...` now use `@floodops/engine/...`.
  - The legacy worker URLs (`new URL('../worker/sim.worker.ts', import.meta.url)`) resolve to the engine package's worker files. Use Vite-compatible imports: `new URL('@floodops/engine/worker/sim.worker.ts', import.meta.url)` is not reliable, so add a thin re-export worker inside `apps/legacy/src/workers/` that imports the engine's worker module.

### 2.3 Not in part 1
- No physics changes.
- No React changes. Their app keeps working in its own mock mode.
- No changes to the team's docs, `AGENTS.md` or their progress files.

## 3. Verification

| Check | Pass condition |
|---|---|
| `npm install` at the root | Succeeds |
| `npm test` | Engine plus legacy UI suites pass; 115 tests are expected (same count as before). |
| `npm run build` | Legacy build succeeds and emits both worker chunks. The team web build succeeds with `tsc -b && vite build`. If the team's build already fails on `team/main` before the merge, record that rather than fixing it in part 1. |
| `git log --format='%an' \| sort \| uniq -c` | Lists HongHanTan, TEH JIA JIE, zerng / Tay Zheheng |
| `git log --follow --oneline packages/engine/src/sim/engine.ts` | Shows the pre-move history |
| `git log --format=%B integrate/team-merge \| grep -ci co-authored-by` | 0 |

## 4. Delivery
- Fast-forward `main` to `integrate/team-merge` after verification, then push to `origin`.
- Nothing is pushed to the team remote in part 1.
