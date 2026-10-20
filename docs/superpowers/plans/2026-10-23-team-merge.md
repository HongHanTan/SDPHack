# Team History Merge and Monorepo Layout: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the team repo `zerngx/sdphack`, with its full authored history, into this repo. Then restructure into an npm-workspaces monorepo: `apps/web` (team UI), `apps/legacy` (our three.js UI) and `packages/engine` (our physics engine). Nothing changes in behaviour.

**Architecture:**
- `git merge --allow-unrelated-histories` brings in the team commits unchanged.
- `git mv` moves our files so per-file history follows them.
- The engine becomes the workspace package `@floodops/engine`, and the legacy UI imports it by package name. Vite and Vitest resolve the TypeScript sources directly, so there is no build step.

**Tech Stack:** git, npm workspaces, TypeScript 5, Vite 5, Vitest 2. The team web app uses React 19 and Vite 6, unchanged.

**Spec:** `docs/superpowers/specs/2026-10-23-team-merge-design.md`

## Global Constraints

- **Authorship and history:**
  - Every new commit is authored by the repo's configured user. **Never add `Co-Authored-By` (or any co-author) lines.**
  - Never rebase, amend, filter or otherwise rewrite the team commits.
- **Team files stay unchanged:** `apps/web/`, `services/`, `simulation/`, `models/`, `data/`, `contracts/`, `md/` (except the new `md/progress/honghan.md`), `AGENTS.md`, and the team's `tests/api`, `tests/simulation`.
- **No behaviour changes:** no physics, scenario or UI changes. Only file moves, package and config files, and import specifiers.
- **Moves:** every move uses `git mv`.
- **Git Bash path syntax:** when reading a file from a revision (`git show REV:path`), prefix the command with `MSYS_NO_PATHCONV=1`. Otherwise Git Bash mangles the path.
- **Engine test count:** stays at 115 fast tests. The slow story and drift tests stay excluded from `npm test`.

---

### Task 1: Merge the team history

**Files:**
- Modify (conflict resolution): `README.md`, `.gitignore`

**Interfaces:**
- Produces: the branch `integrate/team-merge`, whose merge commit has two parents: our `main` and `team/main`.

- [ ] **Step 1: Branch and fetch**

```bash
git switch -c integrate/team-merge main
git remote get-url team || git remote add team https://github.com/zerngx/sdphack.git
git fetch team
```
Expected: the branch is created, and `team/main` exists (`git rev-parse --short team/main` prints a hash).

- [ ] **Step 2: Merge**

```bash
git merge --allow-unrelated-histories --no-ff --no-commit team/main
```
Expected: the merge stops with add/add conflicts in exactly `README.md` and `.gitignore`. `git status --short | grep '^AA'` lists only those two.

If any other file conflicts, stop and report it. Do not resolve it by guesswork.

- [ ] **Step 3: Resolve `.gitignore` (the union of both)**

Overwrite `.gitignore` with:

```
# Python / local backend environment
__pycache__/
*.py[cod]
.pytest_cache/
.venv/
.env
.env.*
!.env.example

# Generated simulation runtime artifacts (curated evidence belongs elsewhere)
data/runtime/

# Frontend dependency and build output
node_modules/
dist/

# Brainstorming companion scratch
.superpowers/
```

- [ ] **Step 4: Resolve `README.md` (the team README first, then our section)**

```bash
git checkout --theirs README.md
```

Then append exactly this to the end of `README.md`:

```markdown

---

## TypeScript flood engine (Hong Han)

This repository also contains a browser-based flood simulation engine written in TypeScript, merged in from `github.com/HongHanTan/SDPHack` with its full history.

- **Engine** (`packages/engine`):
  - surface flow on a 2D grid (virtual-pipes shallow-water scheme with a stability guard), coupled to a capacity-routed pipe network with inlets, surcharge, outfall backflow, flap gates and pumps;
  - MSMA-form design storms;
  - mid-run network patching for live what-if;
  - a water balance checked on every run.
- **Legacy UI** (`apps/legacy`): the engine's original three.js interface (Live/Compare modes, x-ray, plan view, intervention panel). The team UI in `apps/web` will replace it.

### Integration roadmap
1. Merge histories and restructure into this monorepo.
2. Rebuild the engine's township on the Taman Kyra network (`data/synthetic/taman_kyra_assets.json`) and retune the demo story: the team's inlet-desilting / Ø750 upsizing options, plus flap gate, storage tank, overflow to the lake and pump.
3. Drive the `apps/web` 3D twin and dashboard from the engine through an adapter.

### Run (from the repo root)

    npm install
    npm test              # engine + legacy UI unit tests
    npm run dev:legacy    # engine UI at http://localhost:5173
    npm run dev:web       # team UI (its own mock mode)
    npm run story         # slow demo-story and effect-drift checks (~15 min)
```

- [ ] **Step 5: Commit the merge**

```bash
git add README.md .gitignore
git commit -m "Merge team repository zerngx/sdphack (Township FloodOps) with full history"
```
Expected: the commit succeeds. `git log -1 --format=%P` prints two parent hashes.

- [ ] **Step 6: Verify authorship and that our code still runs**

```bash
git log --format='%an' | sort | uniq -c
git log --format=%B | grep -ci co-authored-by
npm test
```

Expected:
- The author list includes `HongHanTan`, `TEH JIA JIE`, `zerng` and `Tay Zheheng`.
- The co-author count is `0`.
- `npm test` passes with the same count as before the merge (our files haven't moved yet).

---

### Task 2: Restructure into workspaces

**Files:**
- Move (with `git mv`):
  - `src/sim`, `src/scenario`, `src/worker` → `packages/engine/src/`
  - `scripts` → `packages/engine/scripts`
  - `tests/sim`, `tests/scenario`, `tests/worker`, `tests/story.test.ts`, `tests/effects.drift.test.ts`, `tests/helpers.ts` → `packages/engine/tests/`
  - `vite.config.ts`, `tsconfig.json` → `packages/engine/`
  - `index.html` → `apps/legacy/index.html`
  - `src/main.ts`, `src/render`, `src/ui` → `apps/legacy/src/`
  - `tests/render`, `tests/ui` → `apps/legacy/tests/`
  - `package.json` → `apps/legacy/package.json` (then rewritten)
- Delete: `package-lock.json` (regenerated at the root)
- Create:
  - `package.json` (root workspace)
  - `packages/engine/package.json`
  - `apps/legacy/tsconfig.json`, `apps/legacy/vite.config.ts`
  - `apps/legacy/src/workers/sim.worker.ts`, `apps/legacy/src/workers/live.worker.ts`
- Modify: import specifiers in `apps/legacy/src/**` and `apps/legacy/tests/**`

**Interfaces:**
- Produces:
  - the workspace package `@floodops/engine`, with exports `./sim/*`, `./scenario/*`, `./worker/*` and `./scenario/effects.json`;
  - the workspace `legacy`;
  - root scripts `test`, `story`, `effects`, `tune`, `dev:web`, `dev:legacy` and `build`.

- [ ] **Step 1: Move the engine**

```bash
mkdir -p packages/engine/src packages/engine/tests
git mv src/sim packages/engine/src/sim
git mv src/scenario packages/engine/src/scenario
git mv src/worker packages/engine/src/worker
git mv scripts packages/engine/scripts
git mv tests/sim packages/engine/tests/sim
git mv tests/scenario packages/engine/tests/scenario
git mv tests/worker packages/engine/tests/worker
git mv tests/story.test.ts packages/engine/tests/story.test.ts
git mv tests/effects.drift.test.ts packages/engine/tests/effects.drift.test.ts
git mv tests/helpers.ts packages/engine/tests/helpers.ts
git mv vite.config.ts packages/engine/vite.config.ts
git mv tsconfig.json packages/engine/tsconfig.json
```
The engine's internal relative imports (`../../src/sim/...` in its tests, `../src/...` in its scripts) stay valid, because the `src/tests/scripts` shape is preserved inside `packages/engine/`.

- [ ] **Step 2: Move the legacy UI**

```bash
mkdir -p apps/legacy/src apps/legacy/tests
git mv index.html apps/legacy/index.html
git mv src/main.ts apps/legacy/src/main.ts
git mv src/render apps/legacy/src/render
git mv src/ui apps/legacy/src/ui
git mv tests/render apps/legacy/tests/render
git mv tests/ui apps/legacy/tests/ui
git mv package.json apps/legacy/package.json
git rm -q package-lock.json
```
Expected: `ls src` fails (the directory is gone). `ls tests` shows only the team's `api` and `simulation` folders.

- [ ] **Step 3: Engine package files**

Create `packages/engine/package.json`:

```json
{
  "name": "@floodops/engine",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "exports": {
    "./scenario/effects.json": "./src/scenario/effects.json",
    "./sim/*": "./src/sim/*.ts",
    "./scenario/*": "./src/scenario/*.ts",
    "./worker/*": "./src/worker/*.ts"
  },
  "scripts": {
    "test": "vitest run --exclude tests/story.test.ts --exclude tests/effects.drift.test.ts",
    "story": "vitest run tests/story.test.ts tests/effects.drift.test.ts",
    "effects": "tsx scripts/effects.ts",
    "tune": "tsx scripts/tune.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

`packages/engine/tsconfig.json` and `packages/engine/vite.config.ts` keep their moved content unchanged (`include: ["src", "tests", "scripts"]`).

- [ ] **Step 4: Legacy package files**

Overwrite `apps/legacy/package.json`:

```json
{
  "name": "legacy",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@floodops/engine": "*",
    "three": "^0.169.0",
    "uplot": "^1.6.31"
  },
  "devDependencies": {
    "@types/node": "^22.9.0",
    "@types/three": "^0.169.0",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

Create `apps/legacy/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "tests"]
}
```

Create `apps/legacy/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  worker: { format: 'es' },
  test: { environment: 'node', testTimeout: 300_000 },
});
```

Create `apps/legacy/src/workers/sim.worker.ts`:

```ts
// Thin entry so Vite bundles the engine's compare-mode worker from the legacy app.
import '@floodops/engine/worker/sim.worker';
```

Create `apps/legacy/src/workers/live.worker.ts`:

```ts
// Thin entry so Vite bundles the engine's live-mode worker from the legacy app.
import '@floodops/engine/worker/live.worker';
```

- [ ] **Step 5: Root workspace**

Create `package.json` at the repo root:

```json
{
  "name": "township-floodops",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "test": "npm -w @floodops/engine test && npm -w legacy test",
    "story": "npm -w @floodops/engine run story",
    "effects": "npm -w @floodops/engine run effects",
    "tune": "npm -w @floodops/engine run tune",
    "dev:web": "npm -w township-floodops-web run dev",
    "dev:legacy": "npm -w legacy run dev",
    "build": "npm -w legacy run build && npm -w township-floodops-web run build"
  }
}
```

- [ ] **Step 6: Rewrite the legacy imports**

The worker URLs change first, then the general specifiers:

```bash
cd apps/legacy
sed -i "s#new URL('../worker/sim.worker.ts'#new URL('../workers/sim.worker.ts'#; s#new URL('../worker/live.worker.ts'#new URL('../workers/live.worker.ts'#" src/ui/compareMode.ts src/ui/liveMode.ts
grep -rl --include=*.ts -e "'\.\./sim/" -e "'\.\./scenario/" -e "'\.\./worker/" src | xargs -r sed -i "s#'\.\./sim/#'@floodops/engine/sim/#g; s#'\.\./scenario/#'@floodops/engine/scenario/#g; s#'\.\./worker/#'@floodops/engine/worker/#g"
sed -i "s#'\./sim/#'@floodops/engine/sim/#g; s#'\./scenario/#'@floodops/engine/scenario/#g; s#'\./worker/#'@floodops/engine/worker/#g" src/main.ts
grep -rl --include=*.ts -e "'\.\./\.\./src/sim/" -e "'\.\./\.\./src/scenario/" -e "'\.\./\.\./src/worker/" tests | xargs -r sed -i "s#'\.\./\.\./src/sim/#'@floodops/engine/sim/#g; s#'\.\./\.\./src/scenario/#'@floodops/engine/scenario/#g; s#'\.\./\.\./src/worker/#'@floodops/engine/worker/#g"
cd ../..
```

Then check:

```bash
grep -rn -e "\.\./sim/" -e "\.\./scenario/" -e "\.\./worker/" -e "'\./sim/" -e "'\./scenario/" -e "src/sim/" -e "src/scenario/" -e "src/worker/" apps/legacy/src apps/legacy/tests
```
Expected: no output, apart from the two `new URL('../workers/...` lines (plural `workers`).

- [ ] **Step 7: Install and verify**

```bash
npm install
npm test
npm -w @floodops/engine run typecheck
npm -w legacy run typecheck
npm -w legacy run build
ls apps/legacy/dist/assets | grep -E "sim.worker|live.worker"
rm -rf apps/legacy/dist
npm -w township-floodops-web run build
```

Expected:
- `npm install` succeeds, with no `ERR!`.
- `npm test`: the engine suite passes (fast tests), then the legacy suite passes. The combined total is 115, the same as before.
- Both typechecks print nothing.
- The legacy build succeeds, and the `ls` shows a `sim.worker-*.js` and a `live.worker-*.js`.
- The team web build: record the outcome. If it fails, run the same build on a clean checkout of `team/main` to see whether it fails there too:

  ```bash
  git worktree add ../teamcheck team/main
  cd ../teamcheck/apps/web
  npm install
  npm run build
  cd -
  git worktree remove --force ../teamcheck
  ```

  - If it also fails on `team/main`, this restructure didn't cause it. Note it in `md/progress/honghan.md` (Task 3) and do not fix it.
  - If it only fails after the restructure, fix the root cause (most likely workspace hoisting) without editing files under `apps/web/`.

Then remove `apps/web/dist` if it was created.

- [ ] **Step 8: Check per-file history survived**

```bash
git add -A
git status --short | grep -v '^R' | head -20
git log --follow --oneline -- packages/engine/src/sim/engine.ts | tail -1
```

Expected:
- Moved files show as `R` (renames). The non-rename lines are only the new or deleted files listed above, plus the regenerated root `package-lock.json`.
- The `--follow` log reaches back to the original "engine loop, metrics, water balance, validation" commit. (This only works once the rename is committed; see Step 9.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: monorepo layout — engine to packages/engine, legacy UI to apps/legacy, npm workspaces"
git log --follow --oneline -- packages/engine/src/sim/engine.ts | tail -1
```
Expected: the last line is the original engine commit, `… feat(sim): engine loop, metrics, water balance, validation`.

---

### Task 3: Progress ledger, final checks, publish

**Files:**
- Move: `progress.md` → `md/progress/honghan.md`

- [ ] **Step 1: Move the ledger and record part 1**

```bash
git mv progress.md md/progress/honghan.md
```

Append to the end of `md/progress/honghan.md`:

```markdown

---

# Team integration

| # | Part | Status |
|---|---|---|
| T1 | History merge + monorepo layout (`apps/web`, `apps/legacy`, `packages/engine`) | ✅ done |
| T2 | Rebuild engine township on Taman Kyra + retune (team's 3 options + flap gate, tank, lake overflow, pump) | pending |
| T3 | Drive `apps/web` UI from the engine through an adapter | pending |
```

If Task 2 Step 7 found that the team web build fails on `team/main` itself, also append one line under that table:

```markdown
- Note: `apps/web` build fails on the team's own `main` too (`<first error line>`); left for part 3.
```

- [ ] **Step 2: Commit**

```bash
git add md/progress/honghan.md
git commit -m "docs: move progress ledger into md/progress and record team integration plan"
```

- [ ] **Step 3: Final verification**

```bash
npm test
git log --format='%an' | sort | uniq -c
git log --format=%B | grep -ci co-authored-by
git log --oneline team/main..HEAD | wc -l
git merge-base --is-ancestor team/main HEAD && echo "team history included"
```

Expected:
- The tests pass.
- The author list includes HongHanTan, TEH JIA JIE, zerng and Tay Zheheng.
- The co-author count is `0`.
- `team history included` is printed.

- [ ] **Step 4: Publish to `main`**

```bash
git switch main
git merge --ff-only integrate/team-merge
git push origin main
```
Expected: a fast-forward, then a push of `main` to `origin` (`github.com/HongHanTan/SDPHack`). Do not push to the `team` remote.
