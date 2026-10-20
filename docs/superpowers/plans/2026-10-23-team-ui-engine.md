# Team React UI Driven by the Engine: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/web`, TEH JIA JIE's React/R3F/Tailwind app, the product UI, driven by `@floodops/engine`. The engine supplies a real water surface rising over time, rain, pipe colours from the physics, a Live toggle, and an engine-backed intervention dashboard. His and Tay's Mock and SWMM-API modes keep working.

**Architecture:**
- A third `DataMode`, `'engine'`, delegates his `ApiClient` calls to a new `engineSource` that runs the engine in Web Workers.
- Pure adapters (`frameAdapter`, `visualGround`, `dashboardOptions`) translate engine data into his types.
- His components get small optional props (`engineDepth`, `heightAt`, `engineOptions`, live controls). When those props are absent, they behave exactly as before.

**Tech Stack:** React 19, @react-three/fiber 9, three 0.170, Tailwind 4, Vite 6, Vitest 2, npm workspaces (`apps/web` = `township-floodops-web`, `packages/engine` = `@floodops/engine`).

**Spec:** `docs/superpowers/specs/2026-10-23-team-ui-engine-design.md`

## Global Constraints

- **Commits and pushing:**
  - Commits are authored by the repo user only. **Never add `Co-Authored-By` or any co-author lines.**
  - Commit bodies credit reused team work where relevant.
  - **Do not push.**
- **Teammates' files:**
  - Edits to TEH JIA JIE's files are small, targeted, and gated: with the new optional props absent, or `mode !== 'engine'`, his behaviour is unchanged.
  - Tay's files (`services/`, `simulation/`, `models/`, `data/validation/`, `contracts/`) are read-only.
- **New integration code** lives in `apps/web/src/engine/` (plus engine-package changes in Task 1).
- **No silent fallback:** engine errors surface through his `apiError` path. Engine mode never falls back to mock silently.
- **Values:**

| Setting | Value |
|---|---|
| Pipe status | surcharged ≥ 0.999 load; near capacity ≥ 0.8 |
| D07 blockage cases | 0, 0.2, 0.4, 0.6 |
| Tailwater | `normal` / `high` |
| Lawn level | 10.8 m |
| Road `surfaceZ` | north 12.15, mid 11.85, main avenue 10.98, boulevard 11.2, east connector 11.5, cul-de-sac 11.86 |
| Dip shapes | the engine's `DIP` and `FUNNEL` (imported, not copied) |
| Wet threshold | 0.01 m |
| POND and RIVER cells | excluded from `EngineWater` (his lake and canal visuals stand) |

- **Windows:** use Git Bash, and `MSYS_NO_PATHCONV=1` for `git show REV:path`.

## File Map

```
packages/engine/src/client/runner.ts        (git mv from apps/legacy/src/ui/runner.ts) + opts passthrough
packages/engine/src/client/smoothDepth.ts   (git mv from apps/legacy/src/render/smoothDepth.ts)
packages/engine/src/worker/protocol.ts, sim.worker.ts   + ScenarioOptions in RunRequest
packages/engine/scripts/extractLayout.ts + data/synthetic/taman_kyra_layout.json   + surfaceZ, house/tree visual fields
packages/engine/scripts/computeDashboard.ts + src/scenario/dashboard.json           per-option metrics
apps/web/src/engine/{engineSource,frameAdapter,visualGround,displaceFlat,dashboardOptions,useLiveEngine}.ts
apps/web/src/engine/{EngineWater.tsx,waterMaterial.ts}
apps/web/src/engine/workers/{sim,live}.worker.ts
apps/web/src/engine/__tests__/*.test.ts
apps/web/src/api/client.ts, App.tsx, components/{StatusHeader,SceneViewer,TownshipEnvironment,SimulationHUD,InterventionDashboard}.tsx  (gated edits)
apps/web/.env, .env.example (default engine), package.json (+@floodops/engine, vitest)
```

---

### Task 1: Engine-side preparation

**Files:**
- Move: `apps/legacy/src/ui/runner.ts` → `packages/engine/src/client/runner.ts`; `apps/legacy/tests/ui/runner.test.ts` → `packages/engine/tests/client/runner.test.ts`; `apps/legacy/src/render/smoothDepth.ts` → `packages/engine/src/client/smoothDepth.ts`
- Modify:
  - `packages/engine/package.json` (`exports` gains `./client/*`, plus the `dashboard` script);
  - `packages/engine/src/worker/protocol.ts`, `packages/engine/src/worker/sim.worker.ts`;
  - `packages/engine/scripts/extractLayout.ts`, `data/synthetic/taman_kyra_layout.json`, `packages/engine/tests/scenario/layout.test.ts`;
  - legacy imports of `runner` and `smoothDepth`.
- Create: `packages/engine/scripts/computeDashboard.ts`, `packages/engine/src/scenario/dashboard.json` (generated), `packages/engine/tests/scenario/dashboard.test.ts`

**Interfaces:**
- Produces:
  - `@floodops/engine/client/runner`: `SimRunner`, `SimRunError`, `WorkerLike`, `RunResult`, `MAX_CACHE`. `run(ids, stormId, onFrame?, custom?, opts?: ScenarioOptions)`, and the same for `isCached`.
  - `@floodops/engine/client/smoothDepth`: `smoothDepth`, `WET`.
  - `RunRequest.opts?: ScenarioOptions`.
  - Layout JSON fields:
    - `roads[].surfaceZ`;
    - `houses[].sceneY`, `roof`, `wall`, `hasCar`, `carColor`;
    - `trees[].sceneY`, `color`.
  - `dashboard.json`: `{ [stormId]: { [optionId]: DashboardMetrics } }`, where `DashboardMetrics = { j07PeakM: number; homesFlooded: number; p07SurchargeMin: number; p07PeakUtilPct: number; floodedRoadAreaM2: number }`.
  - Option IDs: `baseline`, `desilt-d07`, `upsize-p07`, `storage-tank`, `lake-overflow`, `combined`, `store-peak`.

- [ ] **Step 1: Move the runner and smoothDepth into the engine package**

```bash
mkdir -p packages/engine/src/client packages/engine/tests/client
git mv apps/legacy/src/ui/runner.ts packages/engine/src/client/runner.ts
git mv apps/legacy/tests/ui/runner.test.ts packages/engine/tests/client/runner.test.ts
git mv apps/legacy/src/render/smoothDepth.ts packages/engine/src/client/smoothDepth.ts
```

- In `packages/engine/src/client/runner.ts`, fix the imports to relative engine paths: `../scenario/index`, `../scenario/interventions`, `../scenario/storms`, `../sim/types`, `../worker/protocol`.
- In `packages/engine/tests/client/runner.test.ts`, fix the imports: `../../src/client/runner`, `../../src/sim/types`, `../../src/worker/protocol`, and the engine scenario types. The tests themselves are unchanged.
- Add `"./client/*": "./src/client/*.ts"` to `packages/engine/package.json` `exports`.
- In `apps/legacy`, replace imports of `./runner`, `../ui/runner` and `../../src/ui/runner` with `@floodops/engine/client/runner`. Replace imports of `./smoothDepth`, `../render/smoothDepth` and `../../src/render/smoothDepth` with `@floodops/engine/client/smoothDepth`. Find them all with `grep -rn "runner'\|smoothDepth'" apps/legacy`.

- [ ] **Step 2: Pass scenario options through the compare worker**

In `packages/engine/src/worker/protocol.ts`:
- add `import type { ScenarioOptions } from '../scenario/index';`
- add the field `opts?: ScenarioOptions;` to `RunRequest`.

In `packages/engine/src/worker/sim.worker.ts`:
- destructure `opts` from `e.data`;
- call `buildScenario(interventions, stormId, custom, opts ?? {})`.

In `packages/engine/src/client/runner.ts`:
- `run(ids, stormId, onFrame?, custom: CustomPipe[] = [], opts: ScenarioOptions = {})` passes `opts` to `execute`;
- `execute` uses `scenarioKey(ids, stormId, custom, opts)` and posts `{ type: 'run', key, interventions: [...ids].sort(), stormId, custom, opts }`;
- `isCached(ids, stormId, custom = [], opts = {})` uses the same key.

Append to `packages/engine/tests/client/runner.test.ts`:

```ts
  it('keys the cache by scenario options', async () => {
    const w = new FakeWorker();
    const runner = new SimRunner(() => w);
    await runner.run([], 'synthetic_80mmh_60min');
    await runner.run([], 'synthetic_80mmh_60min', undefined, [], { tailwater: 'high' });
    expect(w.posted.length).toBe(2);
    expect(w.posted[1].opts).toEqual({ tailwater: 'high' });
  });
```

Run: `npm -w @floodops/engine test` and `npm -w legacy test`
Expected: both green.

- [ ] **Step 3: Enrich the layout with Jiajie's visual fields**

In `packages/engine/scripts/extractLayout.ts`:

- **Roads:** add `surfaceZ` to each road. Use his scene `position[1]` for each `DetailedRoadSegment`/`CulDeSac`: north 12.15, mid 11.85, main avenue 10.98, boulevard 11.2, east connector 11.5, cul-de-sac 11.86.
- **Houses:** extend `house(...)` to take his `y`, `roof`, `wall`, `hasCar`, `carColor` and record them as `sceneY`, `roof`, `wall`, `hasCar` and `carColor`, using his exact formulas from `TownshipEnvironment.tsx`:
  - `roofStyles = ['#334155', '#7c2d12', '#1e293b', '#475569', '#991b1b', '#0369a1']`
  - `wallStyles = ['#f8fafc', '#f1f5f9', '#fef3c7', '#fdf4ff', '#e2e8f0']`
  - `carColors = ['#2563eb', '#dc2626', '#1e293b', '#f8fafc', '#ca8a04', '#475569']`

  For example, row 1 uses `y = 12.2`, `roof: roofStyles[Math.abs(Math.floor(x / 17)) % 6]`, `wall: wallStyles[Math.abs(Math.floor(x / 13)) % 5]`, `hasCar: x % 2 === 0` and `carColor: carColors[Math.abs(Math.floor(x / 11)) % 6]`. Copy each row's expressions verbatim from his file (rows 1–6).
- **Trees:** extend `tree(...)` to record `sceneY` (his `pos[1]`) and `color`, using his expressions:
  - `colors = ['#15803d', '#16a34a', '#14532d', '#166534', '#15803d']`
  - the street-tree, central, lake-ring and backyard rows, exactly as written in his file.

Re-run: `cd packages/engine && npx tsx scripts/extractLayout.ts && cd ../..`
Expected: the same counts as before (6 roads, 35 houses, 63 trees).

Append to `packages/engine/tests/scenario/layout.test.ts`:

```ts
  it('carries Jiajie scene heights and colours', () => {
    const z = Object.fromEntries(layout.roads.map((r) => [r.id, (r as { surfaceZ: number }).surfaceZ]));
    expect(z).toEqual({ north_street: 12.15, mid_street: 11.85, main_avenue: 10.98, drainage_boulevard: 11.2, east_connector: 11.5, 'cul-de-sac': 11.86 });
    const h0 = layout.houses[0] as { sceneY: number; roof: string; wall: string; hasCar: boolean; carColor: string };
    expect(h0.sceneY).toBe(12.2);
    expect(h0.roof).toBe('#1e293b'); // x=-20: |floor(-20/17)| = 2
    expect(typeof h0.hasCar).toBe('boolean');
    expect((layout.trees[0] as { color: string }).color).toMatch(/^#/);
  });
```

The comment checks the value: `Math.floor(-20 / 17) = -2`, `|−2| % 6 = 2`, so the roof is `'#1e293b'`. If his formula differs from this, trust his file, update this expectation, and say so.

Run: `npm -w @floodops/engine exec vitest run tests/scenario/layout.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 4: Per-option dashboard metrics**

Create `packages/engine/scripts/computeDashboard.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { buildScenario } from '../src/scenario/index';
import type { InterventionId } from '../src/scenario/interventions';
import { STORMS, type StormId } from '../src/scenario/storms';
import { runSimulation } from '../src/sim/engine';

export interface DashboardMetrics {
  j07PeakM: number;
  homesFlooded: number;
  p07SurchargeMin: number;
  p07PeakUtilPct: number;
  floodedRoadAreaM2: number;
}

export const DASHBOARD_OPTIONS: Record<string, InterventionId[]> = {
  baseline: [],
  'desilt-d07': ['desilt-d07'],
  'upsize-p07': ['upsize-p07'],
  'storage-tank': ['storage-tank'],
  'lake-overflow': ['lake-overflow'],
  combined: ['desilt-d07', 'upsize-p07'],
  'store-peak': ['storage-tank', 'lake-overflow'],
};

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function computeDashboard(log: (s: string) => void = () => {}): Record<string, Record<string, DashboardMetrics>> {
  const out: Record<string, Record<string, DashboardMetrics>> = {};
  for (const storm of Object.keys(STORMS) as StormId[]) {
    out[storm] = {};
    for (const [opt, ids] of Object.entries(DASHBOARD_OPTIONS)) {
      const sc = buildScenario(ids, storm);
      const { frames, metrics } = runSimulation(sc);
      const p07 = sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07');
      const loads = frames.map((f) => f.pipeLoad[p07]);
      out[storm][opt] = {
        j07PeakM: r3(metrics.peakSagDepth),
        homesFlooded: metrics.homesFlooded,
        p07SurchargeMin: r3((loads.filter((l) => l >= 0.999).length * sc.frameEveryS) / 60),
        p07PeakUtilPct: Math.round(Math.max(...loads) * 100),
        floodedRoadAreaM2: Math.round(metrics.floodedRoadArea),
      };
      log(`${storm} ${opt}: ${JSON.stringify(out[storm][opt])}`);
    }
  }
  return out;
}

if (process.argv[1]?.endsWith('computeDashboard.ts')) {
  const data = computeDashboard((s) => console.log(s));
  writeFileSync(new URL('../src/scenario/dashboard.json', import.meta.url), JSON.stringify(data, null, 2) + '\n');
  console.log('Wrote src/scenario/dashboard.json');
}
```

- Add `"dashboard": "tsx scripts/computeDashboard.ts"` to `packages/engine/package.json` scripts.
- Add `"./scenario/dashboard.json": "./src/scenario/dashboard.json"` to `exports`, before the `./scenario/*` pattern.
- Run `npm -w @floodops/engine run dashboard` in the background. It does 28 runs, about 8 minutes.

Create `packages/engine/tests/scenario/dashboard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import data from '../../src/scenario/dashboard.json';

describe('dashboard.json', () => {
  it('has all 7 options for every storm, consistent with the tuned story', () => {
    const d = data as Record<string, Record<string, { j07PeakM: number; homesFlooded: number }>>;
    for (const storm of ['synthetic_80mmh_60min', 'synthetic_120mmh_60min', '10yr', '100yr']) {
      expect(Object.keys(d[storm]).sort()).toEqual(['baseline', 'combined', 'desilt-d07', 'lake-overflow', 'storage-tank', 'store-peak', 'upsize-p07']);
    }
    const s = d.synthetic_80mmh_60min;
    expect(s.combined.j07PeakM).toBeLessThan(s['upsize-p07'].j07PeakM);
    expect(s['upsize-p07'].j07PeakM).toBeLessThan(s.baseline.j07PeakM);
    expect(s.baseline.homesFlooded).toBeGreaterThanOrEqual(2);
  });
});
```

Run: `npm -w @floodops/engine exec vitest run tests/scenario/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm test`, `npm -w @floodops/engine run typecheck` and `npm -w legacy run typecheck`
Expected: all green.

```bash
git add -A packages/engine apps/legacy data/synthetic/taman_kyra_layout.json
git commit -m "feat(engine): client runner/smoothDepth in engine, scenario options through the worker, layout visual fields, dashboard metrics" -m "Layout visual fields (heights, colours) derived from TownshipEnvironment.tsx by TEH JIA JIE."
```

---

### Task 2: Web test setup and pure adapters

**Files:**
- Modify: `apps/web/package.json` (dependency `"@floodops/engine": "*"`; devDependency `"vitest": "^2.1.4"`; script `"test": "vitest run"`), the root `package.json` (`test` also runs `npm -w township-floodops-web test`)
- Create: `apps/web/vitest.config.ts`, `apps/web/src/engine/visualGround.ts`, `apps/web/src/engine/frameAdapter.ts`, `apps/web/src/engine/__tests__/visualGround.test.ts`, `apps/web/src/engine/__tests__/frameAdapter.test.ts`

**Interfaces:**
- **Produces from `visualGround.ts`:**
  - `LAWN_Z = 10.8`, `bowlDrop(tx, ty): number`;
  - `roadSurfaceAt(tx, ty): number | null` (the max road `surfaceZ` covering the point);
  - `lawnHeight(tx, ty)` = `LAWN_Z − bowlDrop`;
  - `visualGround(tx, ty)` = `max(roadSurface ?? −∞, LAWN_Z) − bowlDrop`.
- **Produces from `frameAdapter.ts`:**
  - `NEAR_CAPACITY`, `SURCHARGED`, `pipeStatus(load)`;
  - `AdapterContext`, `makeContext(network, grid, blockage)`;
  - `toTeamFrame(frame, ctx): SimulationFrame`;
  - `EngineMetricsExtras { j07_peak_depth_m: number; homes_flooded: number }`;
  - `toTeamMetrics(runId, metrics, teamFrames, ctx, frameEveryS): SimulationMetricsResponse & EngineMetricsExtras`.

- [ ] **Step 1: Test setup.** Edit `apps/web/package.json` as above, and create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['src/**/__tests__/**/*.test.ts'] } });
```

Run `npm install` at the root.

Also make sure `apps/web/tsconfig.json` (and `tsconfig.node.json` if it covers `src`) has `"resolveJsonModule": true`; the engine and the layout import JSON.

`tsc -b` in `apps/web` will now also type-check the engine sources it imports, under Jiajie's stricter flags (e.g. `noUnusedLocals`). If that flags anything inside `packages/engine`, fix the engine code minimally (remove unused bindings). Don't loosen his tsconfig. Record any such fixes in the commit body.

- [ ] **Step 2: Failing tests**

`apps/web/src/engine/__tests__/visualGround.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DIP, FUNNEL } from '@floodops/engine/scenario/config';
import { bowlDrop, LAWN_Z, lawnHeight, roadSurfaceAt, visualGround } from '../visualGround';

describe('visualGround', () => {
  it('uses road surface heights from the layout and the lawn elsewhere', () => {
    expect(roadSurfaceAt(45, 120)).toBe(12.15); // north street
    expect(roadSurfaceAt(-70, -130)).toBeNull();
    expect(visualGround(-70, -130)).toBeCloseTo(LAWN_Z - bowlDrop(-70, -130), 9);
  });
  it('dips at J07 by DIP + FUNNEL', () => {
    expect(bowlDrop(40, 0)).toBeCloseTo(DIP.depth + FUNNEL.depth, 9);
    expect(visualGround(40, 0)).toBeCloseTo(Math.max(roadSurfaceAt(40, 0)!, LAWN_Z) - DIP.depth - FUNNEL.depth, 9);
  });
  it('dips at a grate funnel (D01 at J01)', () => {
    expect(bowlDrop(0, 120)).toBeCloseTo(FUNNEL.depth, 9);
    expect(lawnHeight(0, 120)).toBeCloseTo(LAWN_Z - FUNNEL.depth, 9);
  });
});
```

`apps/web/src/engine/__tests__/frameAdapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildScenario } from '@floodops/engine/scenario/index';
import type { Frame } from '@floodops/engine/sim/types';
import { makeContext, pipeStatus, toTeamFrame, toTeamMetrics } from '../frameAdapter';

const sc = buildScenario([], 'synthetic_80mmh_60min');
const ctx = makeContext(sc.network, sc.grid, { 'INLET-D07': 0.4 });
const nP = sc.network.pipes.length;
const nN = sc.network.nodes.length;
const frame = (load: number, fill: number, wetAt?: number): Frame => {
  const depth = new Float32Array(sc.grid.nx * sc.grid.ny);
  if (wetAt !== undefined) depth[wetAt] = 0.2;
  return { t: 60, depth, nodeFill: new Float32Array(nN).fill(fill), pipeLoad: new Float32Array(nP).fill(load) };
};

describe('frameAdapter', () => {
  it('classifies pipe status by load', () => {
    expect([pipeStatus(0.5), pipeStatus(0.8), pipeStatus(0.999), pipeStatus(Number.NaN)]).toEqual(['normal', 'near_capacity', 'surcharged', 'unknown']);
  });
  it('maps flow = load × qFull and node flooding when full and the street is wet', () => {
    const j07 = sc.network.nodes.find((n) => n.id === 'NODE-J07')!;
    const f = toTeamFrame(frame(0.5, 1, j07.cell), ctx);
    expect(f.timestamp_s).toBe(60);
    expect(f.pipe_states[0].flow_m3s).toBeCloseTo(0.5 * ctx.qFull[0], 9);
    expect(f.node_states.find((n) => n.node_id === 'NODE-J07')!.status).toBe('flooding');
    expect(f.node_states.find((n) => n.node_id === 'NODE-J01')!.status).toBe('surcharged');
    expect(f.inlet_states.find((i) => i.inlet_id === 'INLET-D07')!.hydraulic_inlet_clogging_fraction).toBe(0.4);
  });
  it('is safe when frame sizes do not match the network', () => {
    const bad: Frame = { t: 0, depth: new Float32Array(sc.grid.nx * sc.grid.ny), nodeFill: new Float32Array(1), pipeLoad: new Float32Array(1) };
    const f = toTeamFrame(bad, ctx);
    expect(f.pipe_states.every((p) => p.status === 'unknown')).toBe(true);
    expect(f.node_states.every((n) => n.status === 'unknown')).toBe(true);
  });
  it('maps metrics with engine extras', () => {
    const tf = [toTeamFrame(frame(1, 0.5), ctx), toTeamFrame(frame(0.2, 0.2), ctx)];
    const metrics = { peakDepth: new Float32Array(sc.grid.nx * sc.grid.ny), peakSagDepth: 0.66, floodedRoadArea: 10, homesFlooded: 2, minutesToPassable: null, peakOutfallFlow: 0.5, sagSeries: { t: [], depth: [] }, balance: { rain: 1, error: 0 } };
    const m = toTeamMetrics('engine-1', metrics, tf, ctx, 30);
    expect(m.j07_peak_depth_m).toBe(0.66);
    expect(m.homes_flooded).toBe(2);
    expect(m.surcharge_duration_s).toBe(30);
    expect(m.peak_flow_m3s).toBeCloseTo(ctx.qFull[sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07')], 9);
    expect(m.engine).toBe('FloodOps TS engine');
  });
});
```

Run: `npm -w township-floodops-web test`
Expected: FAIL (modules missing).

- [ ] **Step 3: `apps/web/src/engine/visualGround.ts`**

```ts
import { DIP, FUNNEL } from '@floodops/engine/scenario/config';
import { ASSETS, LAYOUT } from '@floodops/engine/scenario/layout';

/** Jiajie's lawn plane height (scene y). */
export const LAWN_Z = 10.8;

type Road = { kind: 'straight'; x: number; y: number; width: number; length: number; angleDeg: number; surfaceZ: number } | { kind: 'circle'; x: number; y: number; radius: number; surfaceZ: number };
const ROADS = LAYOUT.roads as unknown as Road[];
const j07 = ASSETS.nodes.find((n) => n.node_id === 'NODE-J07')!.position_m;
const funnels = ASSETS.inlets.map((i) => i.position_m);

const bowl = (x: number, y: number, cx: number, cy: number, r: number, d: number) => {
  const dd = Math.hypot(x - cx, y - cy);
  return dd < r ? d * (1 - (dd / r) ** 2) : 0;
};

/** The engine's J07 dip plus grate funnels, in team-datum metres (same shapes the physics uses). */
export function bowlDrop(tx: number, ty: number): number {
  let d = bowl(tx, ty, j07.x, j07.y, DIP.radius, DIP.depth);
  for (const f of funnels) d += bowl(tx, ty, f.x, f.y, FUNNEL.radius, FUNNEL.depth);
  return d;
}

function onRoad(r: Road, x: number, y: number): boolean {
  if (r.kind === 'circle') return Math.hypot(x - r.x, y - r.y) <= r.radius;
  const a = (r.angleDeg * Math.PI) / 180;
  const dx = x - r.x;
  const dy = y - r.y;
  return Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) <= r.length / 2 && Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) <= r.width / 2;
}

export function roadSurfaceAt(tx: number, ty: number): number | null {
  let z: number | null = null;
  for (const r of ROADS) if (onRoad(r, tx, ty)) z = z === null ? r.surfaceZ : Math.max(z, r.surfaceZ);
  return z;
}

export const lawnHeight = (tx: number, ty: number) => LAWN_Z - bowlDrop(tx, ty);

/** Height of Jiajie's visible ground at a team-datum point, with the engine's dips applied. */
export function visualGround(tx: number, ty: number): number {
  const road = roadSurfaceAt(tx, ty);
  return Math.max(road ?? -Infinity, LAWN_Z) - bowlDrop(tx, ty);
}
```

- [ ] **Step 4: `apps/web/src/engine/frameAdapter.ts`**

```ts
import { ASSETS } from '@floodops/engine/scenario/layout';
import { createNetworkState } from '@floodops/engine/sim/pipes';
import { LandUse, type Frame, type Grid, type Metrics, type Network } from '@floodops/engine/sim/types';
import type { ConduitStatus, InletState, NodeState, PipeState, SimulationFrame, SimulationMetricsResponse } from '../types';

export const NEAR_CAPACITY = 0.8;
export const SURCHARGED = 0.999;
const TRUNK = ['PIPE-P03', 'PIPE-P05', 'PIPE-P07', 'PIPE-P08'];
const ROAD_THRESHOLD_M = 0.15;

export function pipeStatus(load: number): ConduitStatus {
  if (!Number.isFinite(load)) return 'unknown';
  return load >= SURCHARGED ? 'surcharged' : load >= NEAR_CAPACITY ? 'near_capacity' : 'normal';
}

export interface AdapterContext {
  network: Network;
  grid: Grid;
  qFull: Float64Array;
  blockage: Record<string, number>;
}

export function makeContext(network: Network, grid: Grid, blockage: Record<string, number>): AdapterContext {
  return { network, grid, qFull: createNetworkState(network).qFull, blockage };
}

export function toTeamFrame(frame: Frame, ctx: AdapterContext): SimulationFrame {
  const { network } = ctx;
  const pipesOk = frame.pipeLoad.length === network.pipes.length;
  const nodesOk = frame.nodeFill.length === network.nodes.length;
  const pipe_states: PipeState[] = network.pipes.map((p, k) => {
    const load = pipesOk ? frame.pipeLoad[k] : Number.NaN;
    return {
      conduit_id: p.id,
      flow_m3s: pipesOk ? load * ctx.qFull[k] : 0,
      depth_m: pipesOk ? p.diameter * Math.min(1, Math.max(0, load)) : 0,
      status: pipeStatus(load),
      capacity_fraction: pipesOk ? load : undefined,
    };
  });
  const node_states: NodeState[] = network.nodes.map((n, k) => {
    const fill = nodesOk ? frame.nodeFill[k] : Number.NaN;
    const surcharged = fill >= SURCHARGED;
    const wet = frame.depth[n.cell] > 0.01;
    return {
      node_id: n.id,
      depth_m: nodesOk ? fill * n.maxDepth : 0,
      flooding_rate_m3s: 0,
      surcharge_flag: surcharged,
      status: !nodesOk ? 'unknown' : surcharged && wet ? 'flooding' : surcharged ? 'surcharged' : 'normal',
    };
  });
  const inlet_states: InletState[] = ASSETS.inlets.map((i) => ({
    inlet_id: i.inlet_id,
    hydraulic_inlet_clogging_fraction: ctx.blockage[i.inlet_id] ?? 0,
    parameter_status: 'assumed_not_calibrated',
    capture_flow_m3s: null,
    bypass_flow_m3s: null,
  }));
  return { timestamp_s: frame.t, pipe_states, node_states, inlet_states };
}

export interface EngineMetricsExtras {
  j07_peak_depth_m: number;
  homes_flooded: number;
}

export function toTeamMetrics(
  runId: string,
  m: Metrics,
  teamFrames: SimulationFrame[],
  ctx: AdapterContext,
  frameEveryS: number,
): SimulationMetricsResponse & EngineMetricsExtras {
  const area = ctx.grid.dx * ctx.grid.dx;
  let floodVol = 0;
  for (let c = 0; c < m.peakDepth.length; c++) {
    const land = ctx.grid.land[c];
    if (land === LandUse.RIVER || land === LandUse.POND) continue;
    if (m.peakDepth[c] >= ROAD_THRESHOLD_M) floodVol += m.peakDepth[c] * area;
  }
  const flooded = new Set<string>();
  let surchargedFrames = 0;
  let p07Peak = 0;
  for (const f of teamFrames) {
    for (const n of f.node_states) if (n.status === 'flooding') flooded.add(n.node_id);
    if (f.pipe_states.some((p) => TRUNK.includes(p.conduit_id) && p.status === 'surcharged')) surchargedFrames++;
    const p07 = f.pipe_states.find((p) => p.conduit_id === 'PIPE-P07');
    if (p07 && p07.flow_m3s > p07Peak) p07Peak = p07.flow_m3s;
  }
  return {
    run_id: runId,
    model_version_id: 'taman_kyra_synthetic_v1',
    result_type: 'simulated',
    engine: 'FloodOps TS engine',
    engine_version: '1.0',
    is_verified_site_model: false,
    assumptions: [
      '2D surface flow on a 2 m grid coupled to capacity-routed pipes; SWMM-style catchments through grate capture.',
      'Synthetic Taman Kyra network (Tay Zheheng) and layout (TEH JIA JIE); not a surveyed site.',
    ],
    warnings: m.balance.error >= 0.01 ? [`Water balance error ${(m.balance.error * 100).toFixed(2)}%`] : [],
    status_definitions: { surcharged: 'pipe load ≥ 99.9% of full-bore capacity', near_capacity: 'pipe load ≥ 80%', flooding: 'manhole full and street wet at its cell' },
    total_flooding_volume_m3: Math.round(floodVol * 10) / 10,
    flooded_node_count: flooded.size,
    surcharge_duration_s: surchargedFrames * frameEveryS,
    metric_definitions: { total_flooding_volume_m3: 'peak surface water volume on cells ≥ 0.15 m deep (excl. pond/canal)' },
    peak_flow_m3s: p07Peak,
    inlet_volumes: null,
    j07_peak_depth_m: m.peakSagDepth,
    homes_flooded: m.homesFlooded,
  };
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm -w township-floodops-web test`
Expected: PASS, 7 tests.

Run: `npm test` (now including web) and `npm -w township-floodops-web run build`
Expected: green.

```bash
git add apps/web/package.json apps/web/vitest.config.ts apps/web/src/engine package.json package-lock.json
git commit -m "feat(web): engine adapters — visual ground and team frame/metrics adapters"
```

---

### Task 3: Engine data mode (client, source, header, App gating)

**Files:**
- Create: `apps/web/src/engine/engineSource.ts`, `apps/web/src/engine/workers/sim.worker.ts`, `apps/web/src/engine/__tests__/engineSource.test.ts`
- Modify: `apps/web/src/api/client.ts`, `apps/web/src/components/StatusHeader.tsx`, `apps/web/src/components/SceneViewer.tsx`, `apps/web/src/App.tsx`, `apps/web/.env`, `apps/web/.env.example`

**Interfaces:**
- Produces `engineSource`. Its methods:
  - `getHealth()`, `getBootstrap()`, `getTownshipAssets()`;
  - `createSimulation(req)`, `getSimulation(id)`, `getSimulationFrames(id)`, `getSimulationMetrics(id)`;
  - `setInterventions(ids: InterventionId[])`, `getInterventions()`;
  - `blockageForDebris(debrisId): Record<string, number>`;
  - `surfaceAt(timestamp_s): Float32Array | null`.
- Produces `DEBRIS_CASES`.
- `DataMode = 'engine' | 'mock' | 'api'`.
- New optional `SceneViewer` props `engineDepth?: Float32Array | null` (consumed in Task 4) and `showInspectors?: boolean`.

- [ ] **Step 1: Worker entry.** Create `apps/web/src/engine/workers/sim.worker.ts`:

```ts
// Thin entry so Vite bundles the engine's compare worker for the team UI.
import '@floodops/engine/worker/sim.worker';
```

- [ ] **Step 2: Failing test** (`apps/web/src/engine/__tests__/engineSource.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { DEBRIS_CASES, engineSource } from '../engineSource';

describe('engineSource (pure parts)', () => {
  it('bootstraps with the four storms, D07 blockage cases and tailwater cases', () => {
    const b = engineSource.getBootstrap();
    expect(b.storms.map((s) => s.storm_id)).toEqual(['synthetic_80mmh_60min', 'synthetic_120mmh_60min', '10yr', '100yr']);
    expect(b.debris_scenarios.map((d) => d.parameters.hydraulic_inlet_clogging_fraction)).toEqual([0, 0.2, 0.4, 0.6]);
    expect(b.tailwater_cases.map((t) => t.tailwater_case)).toEqual(['normal', 'high']);
    expect(engineSource.blockageForDebris(DEBRIS_CASES[2].id)).toEqual({ 'INLET-D07': 0.4 });
  });
  it('returns Tay assets plus intervention nodes in team coordinates', () => {
    engineSource.setInterventions([]);
    expect(engineSource.getTownshipAssets().nodes.length).toBe(9);
    engineSource.setInterventions(['storage-tank', 'lake-overflow']);
    const a = engineSource.getTownshipAssets();
    expect(a.nodes.map((n) => n.node_id)).toEqual(expect.arrayContaining(['TK', 'LK']));
    expect(a.conduits.map((c) => c.conduit_id)).toEqual(expect.arrayContaining(['PIPE-TK-IN', 'PIPE-TK-OUT', 'PIPE-LK']));
    const tk = a.nodes.find((n) => n.node_id === 'TK')!;
    expect(tk.position_m.x).toBeCloseTo(60, 6); // TANK.x in team datum
    engineSource.setInterventions([]);
  });
});
```

- [ ] **Step 3: `apps/web/src/engine/engineSource.ts`**

```ts
import { SimRunError, SimRunner, type WorkerLike } from '@floodops/engine/client/runner';
import type { TailwaterCase } from '@floodops/engine/scenario/config';
import { buildScenario, buildTownship, effectiveBlockage, type ScenarioOptions } from '@floodops/engine/scenario/index';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import { ASSETS, toTeam } from '@floodops/engine/scenario/layout';
import { STORMS, type StormId } from '@floodops/engine/scenario/storms';
import type {
  AssetConduit,
  AssetNode,
  BootstrapResponse,
  HealthResponse,
  SimulationCreateRequest,
  SimulationFrame,
  SimulationFramesResponse,
  SimulationMetricsResponse,
  SimulationRun,
  TownshipAssetsResponse,
} from '../types';
import { makeContext, toTeamFrame, toTeamMetrics, type EngineMetricsExtras } from './frameAdapter';

export const MODEL_VERSION = 'taman_kyra_synthetic_v1';
export const DEBRIS_CASES = [0, 0.2, 0.4, 0.6].map((f) => ({ id: f === 0 ? 'engine_d07_clean' : `engine_d07_${Math.round(f * 100)}pct`, fraction: f }));
const CAPS = { assets: true, storm_creation: false, simulations: true, inspections: false, debris: true, comparisons: true };

interface RunRecord {
  status: SimulationRun['status'];
  frames?: SimulationFrame[];
  metrics?: SimulationMetricsResponse & EngineMetricsExtras;
  surfaces?: Map<number, Float32Array>;
  error?: string;
}

class EngineSource {
  private runner: SimRunner | null = null;
  private interventions: InterventionId[] = [];
  private runs = new Map<string, RunRecord>();
  private lastSurfaces = new Map<number, Float32Array>();
  private counter = 0;

  private getRunner(): SimRunner {
    if (!this.runner) {
      this.runner = new SimRunner(
        () => new Worker(new URL('./workers/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
      );
    }
    return this.runner;
  }

  setInterventions(ids: InterventionId[]): void {
    this.interventions = [...ids];
  }

  getInterventions(): InterventionId[] {
    return [...this.interventions];
  }

  blockageForDebris(debrisId: string | null | undefined): Record<string, number> {
    const c = DEBRIS_CASES.find((d) => d.id === debrisId) ?? DEBRIS_CASES[2];
    return { 'INLET-D07': c.fraction };
  }

  getHealth(): HealthResponse {
    return {
      status: 'ok',
      api_version: 'engine',
      swmm: { available: true, engine: 'FloodOps TS engine', engine_version: '1.0', execution_verified: true, message: 'Local TypeScript engine (Taman Kyra)' },
      capabilities: CAPS,
    };
  }

  getBootstrap(): BootstrapResponse {
    return {
      api_version: 'engine',
      township_id: 'taman_kyra_demo',
      model_versions: [
        { model_version_id: MODEL_VERSION, name: 'Illustrative Taman Kyra drainage zone (TS engine)', source_type: 'synthetic', is_verified_site_model: false, readiness: 'execution_verified' },
      ],
      storms: (Object.keys(STORMS) as StormId[]).map((id) => {
        const s = STORMS[id];
        const peak = Math.max(...s.intensity) * 3.6e6;
        return {
          storm_id: id,
          name: s.label,
          source_type: s.returnPeriod ? 'literature_derived' : 'synthetic',
          parameters: { intensity_mmh: Math.round(peak), duration_s: s.intensity.length * s.blockS, pattern: s.returnPeriod ? 'msma_alternating_block' : 'constant' },
        };
      }),
      debris_scenarios: DEBRIS_CASES.map((d) => ({
        debris_scenario_id: d.id,
        name: d.fraction === 0 ? 'D07 clean' : `D07 ${Math.round(d.fraction * 100)}% blocked`,
        source_type: 'assumed',
        parameters: { inlet_id: 'INLET-D07', hydraulic_inlet_clogging_fraction: d.fraction, parameter_status: 'assumed_not_calibrated' },
        swmm_supported: true,
      })),
      tailwater_cases: (['normal', 'high'] as TailwaterCase[]).map((t) => ({
        tailwater_case: t,
        name: t === 'normal' ? 'Normal canal level' : 'High canal level',
        source_type: 'assumed',
        parameters: { depth_above_outfall_invert_m: t === 'normal' ? 0 : 1.2 },
      })),
      capabilities: CAPS,
      assumptions: ['Local TypeScript engine on the Taman Kyra synthetic network; not a surveyed site model.'],
    };
  }

  getTownshipAssets(): TownshipAssetsResponse {
    const t = buildTownship(this.interventions);
    const known = new Set(ASSETS.nodes.map((n) => n.node_id));
    const knownPipes = new Set(ASSETS.conduits.map((c) => c.conduit_id));
    const extraNodes: AssetNode[] = t.network.nodes
      .filter((n) => !known.has(n.id))
      .map((n) => {
        const p = toTeam(n.x, n.y);
        const ground = t.grid.z[n.cell];
        return { node_id: n.id, node_type: 'storage', position_m: { x: p.x, y: p.y, z: n.invert }, invert_elevation_m: n.invert, ground_elevation_m: ground, max_depth_m: n.maxDepth, source_type: 'assumed' };
      });
    const extraPipes: AssetConduit[] = t.network.pipes
      .filter((p) => !knownPipes.has(p.id))
      .map((p) => ({ conduit_id: p.id, from_node_id: p.from, to_node_id: p.to, diameter_m: p.diameter, length_m: p.length, manning_n: p.n, source_type: 'assumed' }));
    const upsized = t.network.pipes.find((p) => p.id === 'PIPE-P07')!.diameter;
    return {
      township_id: 'taman_kyra_demo',
      model_version_id: MODEL_VERSION,
      source_type: 'synthetic',
      is_verified_site_model: false,
      coordinate_system: 'local_metres_east_north_elevation',
      nodes: [...(ASSETS.nodes as unknown as AssetNode[]), ...extraNodes],
      inlets: ASSETS.inlets as unknown as TownshipAssetsResponse['inlets'],
      conduits: [...(ASSETS.conduits as unknown as AssetConduit[]).map((c) => (c.conduit_id === 'PIPE-P07' ? { ...c, diameter_m: upsized } : c)), ...extraPipes],
      assumptions: ['Synthetic network by Tay Zheheng; intervention assets added by the TS engine.'],
    };
  }

  async createSimulation(req: SimulationCreateRequest): Promise<{ run_id: string; status: string }> {
    if (!(req.storm_id in STORMS)) throw new Error(`[ENGINE] Unknown storm ${req.storm_id}`);
    const stormId = req.storm_id as StormId;
    const opts: ScenarioOptions = { tailwater: (req.tailwater_case === 'high' ? 'high' : 'normal') as TailwaterCase, blockage: this.blockageForDebris(req.debris_scenario_id) };
    const ids = this.getInterventions();
    const runId = `engine-${++this.counter}`;
    const rec: RunRecord = { status: 'running' };
    this.runs.set(runId, rec);
    const sc = buildScenario(ids, stormId, [], opts);
    const ctx = makeContext(sc.network, sc.grid, effectiveBlockage(ids, opts));
    this.getRunner()
      .run(ids, stormId, undefined, [], opts)
      .then((r) => {
        const frames = r.frames.map((f) => toTeamFrame(f, ctx));
        rec.frames = frames;
        rec.metrics = toTeamMetrics(runId, r.metrics, frames, ctx, sc.frameEveryS);
        rec.surfaces = new Map(r.frames.map((f) => [f.t, f.depth]));
        this.lastSurfaces = rec.surfaces;
        rec.status = 'succeeded';
      })
      .catch((e: unknown) => {
        rec.status = 'failed';
        rec.error = e instanceof SimRunError && e.step >= 0 ? `Engine stopped at step ${e.step}: ${e.message}` : e instanceof Error ? e.message : String(e);
      });
    return { run_id: runId, status: 'running' };
  }

  async getSimulation(runId: string): Promise<SimulationRun> {
    const rec = this.runs.get(runId);
    if (!rec) throw new Error(`[ENGINE] Unknown run ${runId}`);
    return {
      run_id: runId,
      status: rec.status,
      model_version_id: MODEL_VERSION,
      engine: 'FloodOps TS engine',
      engine_version: '1.0',
      is_verified_site_model: false,
      error: rec.error ? { code: 'ENGINE_ERROR', message: rec.error } : null,
    };
  }

  async getSimulationFrames(runId: string): Promise<SimulationFramesResponse> {
    const rec = this.runs.get(runId);
    if (!rec?.frames) throw new Error(`[ENGINE] RESULTS_NOT_READY ${runId}`);
    return {
      run_id: runId,
      model_version_id: MODEL_VERSION,
      result_type: 'simulated',
      engine: 'FloodOps TS engine',
      engine_version: '1.0',
      is_verified_site_model: false,
      assumptions: rec.metrics?.assumptions ?? [],
      warnings: rec.metrics?.warnings ?? [],
      status_definitions: rec.metrics?.status_definitions ?? {},
      frames: rec.frames,
    };
  }

  async getSimulationMetrics(runId: string): Promise<SimulationMetricsResponse> {
    const rec = this.runs.get(runId);
    if (!rec?.metrics) throw new Error(`[ENGINE] RESULTS_NOT_READY ${runId}`);
    return rec.metrics;
  }

  /** Depth grid of the latest finished run at a frame time (nearest earlier frame), for the water surface. */
  surfaceAt(timestampS: number): Float32Array | null {
    let best: Float32Array | null = null;
    let bestT = -Infinity;
    for (const [t, d] of this.lastSurfaces) {
      if (t <= timestampS + 1e-6 && t > bestT) {
        best = d;
        bestT = t;
      }
    }
    return best;
  }
}

export const engineSource = new EngineSource();
```

Run: `npm -w township-floodops-web test`
Expected: PASS, 9 tests. If `effectiveBlockage` isn't exported from `@floodops/engine/scenario/index`, export it there (it exists after part 2 Task 9).

- [ ] **Step 4: `client.ts`**

- Change to `export type DataMode = 'engine' | 'mock' | 'api';`
- Change the env default to `|| 'engine'`.
- Add `import { engineSource } from '../engine/engineSource';`
- At the top of each of these methods, add an engine branch:
  - `getHealth`, `getBootstrap`, `getTownshipAssets`, `createSimulation`, `getSimulation`, `getSimulationFrames`, `getSimulationMetrics` each `return engineSource.<same method>(...)` when `this.mode === 'engine'`;
  - `getInspections`: when `this.mode === 'engine'`, `return { items: [] };`
  - `createInspection`, `uploadInspectionMedia`, `createDebrisScenario`, `createStorm`: when `this.mode === 'engine'`, `throw new Error('[ENGINE] Not supported in engine mode — switch to Mock or SWMM API');`
- Leave `getOfflineFrames` and `getOfflineMetrics` unchanged.
- In `apps/web/.env` and `apps/web/.env.example`, set `VITE_DATA_MODE=engine`, and change the `.env.example` comment to `# Data Mode: 'engine' (local TS engine), 'mock' or 'api'`.

- [ ] **Step 5: Three-way header switch.** In `StatusHeader.tsx`, next to his existing Mock and API buttons (around lines 274–290), add an **Engine** button before them, styled exactly like his others: `onClick={() => onToggleMode('engine')}`, active when `mode === 'engine'`. Leave his two buttons as they are; the API one keeps his label.

- [ ] **Step 6: App and SceneViewer gating**

In `SceneViewer.tsx`:
- add the optional props `engineDepth?: Float32Array | null` and `showInspectors?: boolean` to `SceneViewerProps`;
- wrap his `<FieldInspectorsManager .../>` (around line 691) in `{showInspectors !== false && (...)}`;
- store `engineDepth` for Task 4 (pass it nowhere yet).

In `App.tsx`:
1. `const engineMode = mode === 'engine';`
2. **`loadData`:** wrap the "Load initial offline verified SWMM 5.2.4 run" block in `if (mode !== 'engine') { ... } else { setFrames([]); setMetrics(null); }`, and add `mode` to its `useCallback` deps.
3. **`handleRunSimulation`:**
   - the existing `if (mode === 'mock')` branch stays;
   - engine mode uses the polling path, with `const maxAttempts = mode === 'engine' ? 300 : 60;`;
   - the progress text is `` `${mode === 'engine' ? 'Engine solving' : 'EPA SWMM Solving'} (${run.status})...` ``;
   - the timeout message uses the correct seconds.
4. **Rain in engine mode:**

   ```ts
   const stormIntensity = engineMode
     ? rainIntensityAt(STORMS[selectedStormId as StormId] ?? STORMS.synthetic_80mmh_60min, currentTimestamp)
     : selectedStormId === 'synthetic_120mmh_60min' ? 120 : 80;
   const isRainActive = engineMode
     ? rainEnabled && hasSimulationStarted && (isPlaying || isRunning) && stormIntensity > 0
     : rainEnabled && hasSimulationStarted && (isPlaying || isRunning) && currentTimestamp <= 3600;
   ```

   Keep his original lines in the non-engine branch. `currentTimestamp` must be declared above `stormIntensity`. Import `rainIntensityAt`, `STORMS` and `StormId` from `@floodops/engine/scenario/storms`.
5. **Default storm:** initialise `selectedDebrisId` to `'engine_d07_40pct'` when `apiClient.getDataMode() === 'engine'`, otherwise his default. When the mode switches to engine, set `selectedDebrisId('engine_d07_40pct')`. When it switches away, restore his `'demo_inlet_clean'`.
6. **Hide in engine mode:**
   - render `VirtualDebrisLab` only when `!engineMode && isDebrisLabOpen`;
   - render `InspectionModal` only when `!engineMode && inspectingAssetId`;
   - pass `showInspectors={!engineMode}` and `engineDepth={engineMode ? engineSource.surfaceAt(currentTimestamp) : undefined}` to `SceneViewer`.
7. **`handleUpdateBlockage`:** when `engineMode`, only update `customBlockages` state and return early, without his frame-mutation code.
8. **HUD:** for engine mode, pass `onLoadVerifiedRun={engineMode ? () => {} : handleLoadVerifiedRun}`, and add the prop `hideVerifiedRun={engineMode}`. In `SimulationHUD.tsx`, add `hideVerifiedRun?: boolean` to the props and wrap the "load verified run" controls (around lines 255–270) in `{!hideVerifiedRun && (...)}`.

- [ ] **Step 7: Verify and commit**

Run: `npm -w township-floodops-web test` and `npm -w township-floodops-web run build`
Expected: green. Check by reading that with `mode` set to `'mock'` every edited branch runs his original code.

```bash
git add apps/web
git commit -m "feat(web): engine data mode — local TS engine behind ApiClient, three-way data switch, engine-mode gating"
```

---

### Task 4: Scene — layout data, dips and real water

**Files:**
- Create: `apps/web/src/engine/displaceFlat.ts`, `apps/web/src/engine/waterMaterial.ts`, `apps/web/src/engine/EngineWater.tsx`, `apps/web/src/engine/__tests__/displaceFlat.test.ts`
- Modify: `apps/web/src/components/TownshipEnvironment.tsx`, `apps/web/src/components/SceneViewer.tsx`

**Interfaces:**
- Consumes: `visualGround`, `lawnHeight`, `bowlDrop`, `LAWN_Z` (Task 2); `engineDepth` (Task 3).
- Produces: `displaceFlat(geom, place, heightAt)`, `EngineWater({ depth })`, and the `TownshipEnvironment` props `engineDepth?: Float32Array | null` and `engineMode?: boolean`.

- [ ] **Step 1: `displaceFlat` with a test.** Create `apps/web/src/engine/displaceFlat.ts`:

```ts
import * as THREE from 'three';

export interface FlatPlacement {
  x: number; // group position (scene)
  y: number;
  z: number;
  rotY: number; // group rotation about Y
  meshY: number; // mesh offset above the group
}

/**
 * Displaces a flat geometry drawn in a mesh rotated −π/2 about X (local XY plane) inside a group placed at `place`.
 * heightAt(teamX, teamY) returns the absolute elevation; team y = −scene z.
 */
export function displaceFlat(geom: THREE.BufferGeometry, place: FlatPlacement, heightAt: (tx: number, ty: number) => number): THREE.BufferGeometry {
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const c = Math.cos(place.rotY);
  const s = Math.sin(place.rotY);
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const lz = -pos.getY(i);
    const sx = place.x + lx * c + lz * s;
    const sz = place.z - lx * s + lz * c;
    pos.setZ(i, heightAt(sx, -sz) - place.y - place.meshY);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}
```

`apps/web/src/engine/__tests__/displaceFlat.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { displaceFlat } from '../displaceFlat';

describe('displaceFlat', () => {
  it('sets each vertex to the absolute height at its scene position', () => {
    const g = new THREE.PlaneGeometry(10, 10, 1, 1);
    displaceFlat(g, { x: 100, y: 11, z: -50, rotY: 0, meshY: 0.02 }, (tx, ty) => 11 + tx * 0.001 + ty * 0.01);
    const pos = g.getAttribute('position');
    // vertex 0 of PlaneGeometry is (-5, +5): scene (95, z = -50 - 5 = -55) -> team (95, 55)
    expect(pos.getZ(0)).toBeCloseTo(11 + 95 * 0.001 + 55 * 0.01 - 11 - 0.02, 9);
  });
});
```

Run: `npm -w township-floodops-web test`
Expected: PASS.

- [ ] **Step 2: Water material (ported).** Create `apps/web/src/engine/waterMaterial.ts` by copying `apps/legacy/src/render/waterMaterial.ts` verbatim. Add a header comment, `// Ported from apps/legacy/src/render/waterMaterial.ts (Hong Han) for the team UI.`, and keep the `createWaterMaterial` export.

- [ ] **Step 3: `EngineWater.tsx`**

```tsx
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { smoothDepth, WET } from '@floodops/engine/client/smoothDepth';
import { baseTownship } from '@floodops/engine/scenario/index';
import { toTeam } from '@floodops/engine/scenario/layout';
import { LandUse } from '@floodops/engine/sim/types';
import { visualGround } from './visualGround';
import { createWaterMaterial } from './waterMaterial';

/** Engine water surface over Jiajie's scene: height = visual ground + simulated depth (pond and canal excluded). */
export function EngineWater({ depth }: { depth: Float32Array | null }) {
  const grid = useMemo(() => baseTownship().grid, []);
  const { nx, ny, dx } = grid;
  const n = nx * ny;
  const { geom, base, mask, depthAttr } = useMemo(() => {
    const pos = new Float32Array(n * 3);
    const base = new Float32Array(n);
    const mask = new Uint8Array(n);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        const t = toTeam((i + 0.5) * dx, (j + 0.5) * dx);
        base[c] = visualGround(t.x, t.y);
        mask[c] = grid.land[c] === LandUse.POND || grid.land[c] === LandUse.RIVER ? 0 : 1;
        pos[3 * c] = t.x;
        pos[3 * c + 1] = base[c] - 0.5;
        pos[3 * c + 2] = -t.y;
      }
    }
    const index: number[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        index.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(index);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const depthAttr = new THREE.BufferAttribute(new Float32Array(n), 1);
    g.setAttribute('aDepth', depthAttr);
    g.computeVertexNormals();
    return { geom: g, base, mask, depthAttr };
  }, [grid, n, nx, ny, dx]);
  const smoothed = useMemo(() => new Float32Array(n), [n]);
  const material = useMemo(() => {
    const m = createWaterMaterial();
    (m.uniforms.uShallow.value as THREE.Color).set('#bfe3ec');
    (m.uniforms.uDeep.value as THREE.Color).set('#2b7fb8');
    return m;
  }, []);

  useEffect(() => {
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    if (depth) smoothDepth(depth, nx, ny, smoothed);
    else smoothed.fill(0);
    for (let c = 0; c < n; c++) {
      const v = mask[c] ? smoothed[c] : 0;
      pos.setY(c, v > WET ? base[c] + v + 0.03 : base[c] - 0.5);
      depthAttr.setX(c, v);
    }
    pos.needsUpdate = true;
    depthAttr.needsUpdate = true;
    geom.computeVertexNormals();
  }, [depth, geom, base, mask, depthAttr, smoothed, n, nx, ny]);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
  });

  return <mesh geometry={geom} material={material} renderOrder={2} />;
}
```

- [ ] **Step 4: `TownshipEnvironment` from layout data, with dips (engine mode only)**

In `TownshipEnvironment.tsx`:

1. Add the props `engineDepth?: Float32Array | null` and `engineMode?: boolean`. Add the imports:

   ```ts
   import layout from '../../../../data/synthetic/taman_kyra_layout.json';
   import { useMemo } from 'react';
   import * as THREE from 'three';
   import { displaceFlat } from '../engine/displaceFlat';
   import { EngineWater } from '../engine/EngineWater';
   import { bowlDrop, lawnHeight } from '../engine/visualGround';
   ```

   Merge `useMemo` into his existing React import.
2. **Houses and trees from data.** Replace the bodies of his `houses` and `trees` `useMemo`s with mappings from `layout.houses` and `layout.trees`:
   - houses: `pos: [h.x, engineMode ? lawnHeight(h.x, h.y) : h.sceneY, -h.y]`, `rotY: (h.rotationDeg * Math.PI) / 180`, and `roof`, `wall`, `hasCar`, `carColor`, `scale` from the record;
   - trees: `pos: [t.x, engineMode ? lawnHeight(t.x, t.y) : t.sceneY, -t.y]`, plus `scale` and `color`;
   - add `engineMode` to the deps.

   Keep a one-line comment: `// Placement data extracted from this component's original loops (TEH JIA JIE) into data/synthetic/taman_kyra_layout.json`.
3. **`DetailedRoadSegment`:** add the optional prop `heightAt?: (tx: number, ty: number) => number`. When it's present:
   - the asphalt becomes `<mesh ... geometry={asphaltGeom}>`, where `asphaltGeom = useMemo(() => displaceFlat(new THREE.PlaneGeometry(width, length, Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(length / 2))), { x: position[0], y: position[1], z: position[2], rotY: rotationY, meshY: 0.02 }, heightAt), [...])`;
   - the centreline is displaced the same way, with `meshY: 0.03`;
   - each curb is rendered as `Math.ceil(length / 4)` boxes of length `length / N`. Piece `k` is at local `z = -length / 2 + (k + 0.5) * length / N`, and its y is `0.09 + (heightAt(worldX, worldY) - position[1])`, where world comes from the same rotation used by `displaceFlat`.

   When `heightAt` is absent, render his original JSX unchanged.
4. **`CulDeSac`:** add an optional `heightAt`. When it's present:
   - the asphalt circle uses `displaceFlat(new THREE.CircleGeometry(radius, 32), { x, y, z, rotY: 0, meshY: 0.02 }, heightAt)`;
   - the island meshes and tree group are offset by `heightAt(x, -z) - y`.
5. **Lawn:** when `engineMode`, render the base lawn with `displaceFlat(new THREE.PlaneGeometry(240, 280, 120, 140), { x: 45, y: 10.8, z: -10, rotY: 0, meshY: 0 }, lawnHeight)` instead of his flat plane. The material is unchanged.
6. **Roads in engine mode:** pass `heightAt={engineMode ? (tx, ty) => position[1] - bowlDrop(tx, ty) : undefined}` to each `DetailedRoadSegment` and to `CulDeSac`, using each element's own `position[1]`.
7. **Water:** replace `<PondingWaterAnimation .../>` with `{engineMode ? <EngineWater depth={engineDepth ?? null} /> : <PondingWaterAnimation ... />}`, keeping his original props on the animation.

In `SceneViewer.tsx`, pass `engineMode={engineDepth !== undefined}` and `engineDepth={engineDepth}` to `<TownshipEnvironment>`. App passes `undefined` outside engine mode (Task 3), so his modes are unaffected.

- [ ] **Step 5: Verify and commit**

Run: `npm -w township-floodops-web test` and `npm -w township-floodops-web run build`
Expected: green.

Check by reading:
- in non-engine modes, `TownshipEnvironment` renders his original roads, lawn and animation, and houses and trees at his original positions (same data);
- `EngineWater` excludes POND and RIVER.

```bash
git add apps/web
git commit -m "feat(web): real engine water over the team scene; layout-driven houses/trees; engine dips on lawn and roads" -m "Builds on TownshipEnvironment.tsx by TEH JIA JIE; water shader ported from apps/legacy."
```

---

### Task 5: Live toggle

**Files:**
- Create: `apps/web/src/engine/useLiveEngine.ts`, `apps/web/src/engine/workers/live.worker.ts`
- Modify: `apps/web/src/components/SimulationHUD.tsx`, `apps/web/src/App.tsx`

**Interfaces:**
- Produces `useLiveEngine()`, which returns:
  - `{ on, setOn, frame: SimulationFrame | null, depth: Float32Array | null, t, readouts, paused, speed }`;
  - `start(stormId, ids, opts)`, `patch(ids, label)`, `setSpeed(s)`, `togglePause()`, `seek(target: 'start' | 'peak' | 'end')`, `stop()`, `error: string | null`.

- [ ] **Step 1: Worker entry.** `apps/web/src/engine/workers/live.worker.ts`:

```ts
// Thin entry so Vite bundles the engine's live worker for the team UI.
import '@floodops/engine/worker/live.worker';
```

- [ ] **Step 2: The hook.** First read `packages/engine/src/worker/liveProtocol.ts`, and use its exact message shapes, including the `session` field. Create `apps/web/src/engine/useLiveEngine.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScenarioOptions } from '@floodops/engine/scenario/index';
import { buildScenario, effectiveBlockage } from '@floodops/engine/scenario/index';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import { STORMS, type StormId } from '@floodops/engine/scenario/storms';
import type { LiveCommand, LiveMessage } from '@floodops/engine/worker/liveProtocol';
import type { SimulationFrame } from '../types';
import { makeContext, toTeamFrame, type AdapterContext } from './frameAdapter';

export function useLiveEngine() {
  const worker = useRef<Worker | null>(null);
  const session = useRef(0);
  const ctx = useRef<AdapterContext | null>(null);
  const cfg = useRef<{ stormId: StormId; ids: InterventionId[]; opts: ScenarioOptions } | null>(null);
  const [on, setOn] = useState(false);
  const [frame, setFrame] = useState<SimulationFrame | null>(null);
  const [depth, setDepth] = useState<Float32Array | null>(null);
  const [t, setT] = useState(0);
  const [readouts, setReadouts] = useState<{ sagNow: number; sagPeak: number; homesNow: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const send = (c: LiveCommand) => worker.current?.postMessage(c);

  const ensureWorker = useCallback(() => {
    if (worker.current) return;
    const w = new Worker(new URL('./workers/live.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<LiveMessage>) => {
      const m = e.data as LiveMessage & { session?: number };
      if (m.session !== undefined && m.session !== session.current) return;
      if (m.type === 'frame' && ctx.current) {
        setFrame(toTeamFrame(m.frame, ctx.current));
        setDepth(m.frame.depth);
        setT(m.t);
        setReadouts({ sagNow: m.readouts.sagNow, sagPeak: m.readouts.sagPeak, homesNow: m.readouts.homesNow });
      } else if (m.type === 'error') {
        setError(`Live engine stopped at step ${m.step}: ${m.message}`);
        setPaused(true);
      }
    };
    w.onerror = (e) => {
      setError(`Live engine crashed: ${e.message || 'unknown error'}`);
      w.terminate();
      worker.current = null;
    };
    worker.current = w;
  }, []);

  const start = useCallback((stormId: StormId, ids: InterventionId[], opts: ScenarioOptions) => {
    ensureWorker();
    cfg.current = { stormId, ids, opts };
    const sc = buildScenario(ids, stormId, [], opts);
    ctx.current = makeContext(sc.network, sc.grid, effectiveBlockage(ids, opts));
    session.current += 1;
    setError(null);
    setPaused(false);
    send({ type: 'start', session: session.current, stormId, interventions: ids, custom: [] } as LiveCommand);
    send({ type: 'setSpeed', speed } as LiveCommand);
  }, [ensureWorker, speed]);

  const patch = useCallback((ids: InterventionId[], label: string) => {
    if (!cfg.current) return;
    cfg.current = { ...cfg.current, ids };
    const sc = buildScenario(ids, cfg.current.stormId, [], cfg.current.opts);
    ctx.current = makeContext(sc.network, sc.grid, effectiveBlockage(ids, cfg.current.opts));
    send({ type: 'patch', interventions: ids, custom: [], label } as LiveCommand);
  }, []);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
    send({ type: 'setSpeed', speed: s } as LiveCommand);
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      send({ type: p ? 'resume' : 'pause' } as LiveCommand);
      return !p;
    });
  }, []);

  const seek = useCallback((target: 'start' | 'peak' | 'end') => {
    if (!cfg.current) return;
    const s = STORMS[cfg.current.stormId];
    const minute = target === 'peak' ? s.peakMinute : target === 'end' ? (s.intensity.length * s.blockS) / 60 : 0;
    session.current += 1;
    send({ type: 'seek', session: session.current, minute } as LiveCommand);
  }, []);

  const stop = useCallback(() => send({ type: 'pause' } as LiveCommand), []);

  useEffect(() => () => worker.current?.terminate(), []);

  return { on, setOn, frame, depth, t, readouts, paused, speed, error, start, patch, setSpeed, togglePause, seek, stop };
}
```

If the live protocol's `start` or `seek` don't take `session` exactly as above, or if `start` also expects tailwater or blockage options, adapt the `send` calls to the real `LiveCommand` type. If the live worker doesn't accept scenario options, extend `liveProtocol` `start` with `opts?: ScenarioOptions`, and have `live.worker` / `LiveSession` pass it to `buildScenario`, mirroring Task 1 Step 2. Add an engine test for it (`tests/worker/liveSession.test.ts`: a session built with `{ tailwater: 'high' }` has river level 9.4), and record this in the commit body.

- [ ] **Step 3: HUD switch.** In `SimulationHUD.tsx`, add the optional props:

```ts
  liveAvailable?: boolean;
  liveOn?: boolean;
  onToggleLive?: (on: boolean) => void;
  liveSpeed?: number;
  onLiveSpeed?: (s: number) => void;
  livePaused?: boolean;
  onLivePause?: () => void;
  onLiveSeek?: (t: 'start' | 'peak' | 'end') => void;
```

When `liveAvailable`:
- render a two-button **Playback | Live** segmented control at the top of his controls block, in his Tailwind button styling;
- when `liveOn`, hide his frame scrubber and play/run buttons, and render:
  - four speed buttons (½×, 1×, 2×, 4×);
  - Pause/Resume;
  - three jump buttons (Start, Peak rain, Rain stops).

When `liveAvailable` is falsy, nothing changes.

- [ ] **Step 4: App wiring.** In `App.tsx`:
- `const live = useLiveEngine();`
- pass `liveAvailable={engineMode}`, `liveOn={live.on}`, `onToggleLive={(v) => { live.setOn(v); if (v) { setHasSimulationStarted(true); setIsPlaying(true); live.start(selectedStormId as StormId, engineSource.getInterventions(), { tailwater: selectedTailwater === 'high' ? 'high' : 'normal', blockage: engineSource.blockageForDebris(selectedDebrisId) }); } else live.stop(); }}`, `liveSpeed={live.speed}`, `onLiveSpeed={live.setSpeed}`, `livePaused={live.paused}`, `onLivePause={live.togglePause}` and `onLiveSeek={live.seek}` to `SimulationHUD`.
- When `engineMode && live.on`:
  - `currentFrame` passed to `SceneViewer` is `live.frame`;
  - `engineDepth` is `live.depth`;
  - the rain timestamp is `live.t`;
  - `apiError` shows `live.error` when set.

  Use derived variables, and don't overwrite his `frames` state.

- [ ] **Step 5: Verify and commit**

Run: `npm -w township-floodops-web test`, `npm -w township-floodops-web run build` (the build must emit both `sim.worker-*.js` and `live.worker-*.js` for web) and `npm test`.

```bash
git add apps/web packages/engine
git commit -m "feat(web): Live toggle — continuous engine storm with mid-storm patching in the team HUD"
```

---

### Task 6: Engine-backed intervention dashboard, HUD metrics, docs

**Files:**
- Create: `apps/web/src/engine/dashboardOptions.ts`, `apps/web/src/engine/__tests__/dashboardOptions.test.ts`
- Modify: `apps/web/src/components/InterventionDashboard.tsx`, `apps/web/src/components/SimulationHUD.tsx`, `apps/web/src/App.tsx`, `docs/browser-checklist.md`, `README.md`

**Interfaces:**
- Produces:
  - `EngineOption { id; title; subtitle; icon; tag; description; finding; interventions: InterventionId[]; costRM; costRating; timeframe; recommended; metrics: DashboardMetrics | null; dSagVsBaseline: number | null; dHomesVsBaseline: number | null }`;
  - `buildDashboardOptions(stormId): EngineOption[]`;
  - `idsForOption(optionId): InterventionId[]`;
  - the `InterventionDashboard` prop `engineOptions?: EngineOption[]` and `engineStormLabel?: string`.

- [ ] **Step 1: Failing test** (`apps/web/src/engine/__tests__/dashboardOptions.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { buildDashboardOptions, idsForOption } from '../dashboardOptions';

describe('dashboardOptions', () => {
  const opts = buildDashboardOptions('synthetic_80mmh_60min');
  it('has the seven engine cards in order', () => {
    expect(opts.map((o) => o.id)).toEqual(['baseline', 'desilt-d07', 'upsize-p07', 'storage-tank', 'lake-overflow', 'combined', 'store-peak']);
  });
  it('carries the honest desilt finding and recommends the combined option', () => {
    expect(opts.find((o) => o.id === 'desilt-d07')!.finding).toContain('No effect on its own while P07 runs full');
    const combined = opts.find((o) => o.id === 'combined')!;
    expect(combined.tag).toBe('Optimal Holistic Solution');
    expect(combined.recommended).toBe(true);
    expect(combined.dSagVsBaseline!).toBeLessThan(0);
  });
  it('maps option ids to intervention ids', () => {
    expect(idsForOption('combined')).toEqual(['desilt-d07', 'upsize-p07']);
    expect(idsForOption('baseline')).toEqual([]);
  });
});
```

- [ ] **Step 2: `apps/web/src/engine/dashboardOptions.ts`**

```ts
import dashboard from '@floodops/engine/scenario/dashboard.json';
import { INTERVENTIONS, type InterventionId } from '@floodops/engine/scenario/interventions';
import type { StormId } from '@floodops/engine/scenario/storms';

export interface DashboardMetrics {
  j07PeakM: number;
  homesFlooded: number;
  p07SurchargeMin: number;
  p07PeakUtilPct: number;
  floodedRoadAreaM2: number;
}

export interface EngineOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tag: string;
  description: string;
  finding: string;
  interventions: InterventionId[];
  costRM: number;
  costRating: string;
  timeframe: string;
  recommended: boolean;
  metrics: DashboardMetrics | null;
  dSagVsBaseline: number | null;
  dHomesVsBaseline: number | null;
}

const CARDS: Array<Omit<EngineOption, 'costRM' | 'metrics' | 'dSagVsBaseline' | 'dHomesVsBaseline'>> = [
  { id: 'baseline', title: 'Baseline Condition', subtitle: 'INLET-D07 40% blocked, PIPE-P07 Ø600', icon: '⚠️', tag: 'Baseline', description: 'Current field state from the team scenario.', finding: 'P07 runs full early in the storm; water ponds at the J07 junction and reaches nearby homes.', interventions: [], costRating: 'FREE', timeframe: 'Current', recommended: false },
  { id: 'desilt-d07', title: 'Option 1: Emergency Inlet Desilting', subtitle: 'Clean INLET-D07', icon: '🧹', tag: 'Immediate O&M', description: 'Remove leaf litter and sediment from INLET-D07, restoring full grate capacity.', finding: 'No effect on its own while P07 runs full; adds benefit once P07 is upsized.', interventions: ['desilt-d07'], costRating: 'LOW', timeframe: '< 24 Hours', recommended: false },
  { id: 'upsize-p07', title: 'Option 2: Conduit Upsizing', subtitle: 'PIPE-P07 Ø600 → Ø750', icon: '⬇️', tag: 'Capital Engineering', description: 'Replace trunk conduit PIPE-P07 (J07 → J08) with Ø750 RCP.', finding: 'Removes the P07 bottleneck — the largest single reduction at J07.', interventions: ['upsize-p07'], costRating: 'HIGH', timeframe: '3 - 6 Months', recommended: false },
  { id: 'storage-tank', title: 'Option 4: Underground Storage Tank', subtitle: 'Off-line tank fed from J05', icon: '🛢️', tag: 'Capital Engineering', description: 'Store the peak from J05 and release slowly to J08.', finding: 'Takes the peak off P07 — comparable to upsizing at J07.', interventions: ['storage-tank'], costRating: 'HIGH', timeframe: 'Phased Implementation', recommended: false },
  { id: 'lake-overflow', title: 'Option 5: Overflow to Maple Grove Pond', subtitle: 'Relief pipe J04 → pond', icon: '↪️', tag: 'Green-Blue Infrastructure', description: 'Divert the J04 branch into the retention pond.', finding: 'Partial relief: diverts the east branch away from the trunk.', interventions: ['lake-overflow'], costRating: 'MEDIUM', timeframe: 'Phased Implementation', recommended: false },
  { id: 'combined', title: 'Option 3: Combined Desilting & Upsizing', subtitle: 'Clean D07 + Ø750 P07', icon: '✅', tag: 'Optimal Holistic Solution', description: 'Inlet desilting coupled with conduit upsizing.', finding: 'Best result: upsizing frees P07, and the clean grate then captures more.', interventions: ['desilt-d07', 'upsize-p07'], costRating: 'MEDIUM', timeframe: 'Phased Implementation', recommended: true },
  { id: 'store-peak', title: 'Option 6: Store the Peak', subtitle: 'Tank + pond overflow', icon: '💧', tag: 'Green-Blue Infrastructure', description: 'Storage tank and pond overflow together.', finding: 'Storage-led alternative to upsizing.', interventions: ['storage-tank', 'lake-overflow'], costRating: 'HIGH', timeframe: 'Long-Term Masterplan', recommended: false },
];

const COST = new Map(INTERVENTIONS.map((iv) => [iv.id, iv.costRM]));

export function idsForOption(optionId: string): InterventionId[] {
  return CARDS.find((c) => c.id === optionId)?.interventions ?? [];
}

export function buildDashboardOptions(stormId: StormId): EngineOption[] {
  const table = (dashboard as unknown as Record<string, Record<string, DashboardMetrics>>)[stormId] ?? {};
  const base = table.baseline ?? null;
  return CARDS.map((c) => {
    const m = table[c.id] ?? null;
    return {
      ...c,
      costRM: c.interventions.reduce((s, id) => s + (COST.get(id) ?? 0), 0),
      metrics: m,
      dSagVsBaseline: m && base ? Math.round((m.j07PeakM - base.j07PeakM) * 1000) / 1000 : null,
      dHomesVsBaseline: m && base ? m.homesFlooded - base.homesFlooded : null,
    };
  });
}
```

Run: `npm -w township-floodops-web test`
Expected: PASS.

- [ ] **Step 3: Dashboard props (engine mode only).** In `InterventionDashboard.tsx`:

1. Add the optional props `engineOptions?: EngineOption[]` and `engineStormLabel?: string`. Import the `EngineOption` type.
2. If `engineOptions` is provided, build his `options` array from them with a mapper inside the component:

   ```ts
   const fromEngine = (o: EngineOption): InterventionOption => ({
     id: o.id,
     title: o.title,
     subtitle: o.subtitle,
     type: o.id as InterventionOption['type'],
     target_asset: o.interventions.length ? o.interventions.join(' + ') : 'INLET-D07 + PIPE-P07',
     description: `${o.description} — ${o.finding}`,
     tag: o.tag,
     parameters: { hydraulic_loss_fraction: o.interventions.includes('desilt-d07') ? 0 : 0.4, pipe_diameter_mm: o.interventions.includes('upsize-p07') ? 750 : 600, storm_id: '', tailwater_case: 'normal' },
     metrics: {
       total_flooding_volume_m3: o.metrics?.floodedRoadAreaM2 ?? 0,
       surcharge_duration_s: (o.metrics?.p07SurchargeMin ?? 0) * 60,
       d07_captured_volume_m3: o.metrics?.j07PeakM ?? 0,
       d07_bypass_volume_m3: o.metrics?.homesFlooded ?? 0,
       flooded_node_count: o.metrics?.homesFlooded ?? 0,
       peak_conduit_utilization_pct: o.metrics?.p07PeakUtilPct ?? 0,
     },
     feasibility: { timeframe: o.timeframe, cost_rating: o.costRating, lead_time_days: 0, crew_type: o.tag },
     is_available: true,
   });
   ```

   Use `const options = engineOptions ? engineOptions.map(fromEngine) : <his existing array>;`. His array stays as written, in an else-branch or a const.
3. In engine mode, the comparison rows labelled for D07 captured/bypass volumes must show the engine meanings instead:
   - the row reading `d07_captured_volume_m3` is labelled **"J07 peak water depth (m)"**;
   - the row reading `d07_bypass_volume_m3` is labelled **"Homes flooded"**;
   - "total flooding volume" is labelled **"Flooded road area (m²)"**;
   - percentage deltas are computed on those numbers.

   Do this with `const L = engineOptions ? ENGINE_LABELS : HIS_LABELS` lookups at the label sites. Keep his wording verbatim in `HIS_LABELS`.
4. Make the default selected option `'combined'` when `engineOptions` is present. Use `options.slice(0, 7)` instead of `slice(0, 4)` only when `engineOptions` is present; his original `slice(0, 4)` stays for his modes.
5. In engine mode, the heading "Multi-Scenario Hydraulic Evaluation (120 mm/h 60min Storm Benchmark)" uses `engineStormLabel`.
6. Leave his proposed-actions section unchanged, except: when `engineOptions` is present, prefix the justification text of the D07 work order with `"Engine finding: desilting alone has no effect while P07 runs full; schedule together with the P07 upsizing. "`. That sentence goes in front of his text.

- [ ] **Step 4: App and HUD.** In `App.tsx`:

- Pass `engineOptions={engineMode ? buildDashboardOptions(selectedStormId as StormId) : undefined}` and `engineStormLabel={STORMS[selectedStormId as StormId]?.label}` to `InterventionDashboard`.
- In `handleApplyIntervention`, add at the top:

```ts
    if (engineMode) {
      const ids = idsForOption(interventionId);
      engineSource.setInterventions(ids);
      const a = await apiClient.getTownshipAssets('taman_kyra_demo');
      setNodes(a.nodes);
      setConduits(a.conduits);
      setIsInterventionDashboardOpen(false);
      if (live.on) live.patch(ids, interventionId);
      else void handleRunSimulation();
      return;
    }
```

  (make `handleApplyIntervention` `async`).

In `SimulationHUD.tsx`, where his metrics panel renders `metrics` fields, add two rows that render only when present:
- **"J07 peak depth"** from `(metrics as { j07_peak_depth_m?: number }).j07_peak_depth_m`, formatted as `x.xx m`;
- **"Homes flooded"** from `homes_flooded`.

- [ ] **Step 5: Docs**

Append to `docs/browser-checklist.md`:

```markdown

## Team UI (engine mode) — `npm run dev:web`
28. Header shows Engine | Mock | SWMM API; Engine is selected by default.
29. Run the 80 mm/h storm: water rises at the J07 junction over time, pipes P05/P07 turn red (surcharged), rain stops at 60 min and water drains afterwards.
30. The J07 pond surface looks flat (dips visible as a gentle hollow in lawn and roads); houses near J07 stand in water at the peak.
31. Intervention dashboard shows 7 cards from the engine; Desilt card shows "No effect on its own while P07 runs full"; Combined is tagged Optimal Holistic Solution; Apply re-runs and the water drops.
32. Live toggle: storm plays continuously; Apply mid-storm changes the water in place; speed/pause/jumps work.
33. Switch to Mock: the team's original app (inspectors, debris lab, offline SWMM run) works unchanged. Switch to SWMM API with the backend stopped: a clear error, no silent fallback.
34. `npm run build` passes; the built app loads both engine workers.
```

In `README.md`, in the TypeScript engine section, replace the roadmap list with:
- steps 1–3 done;
- "The team UI (`apps/web`) runs on the engine by default (Engine mode); Mock and SWMM API modes remain";
- `npm run dev:web` as the main way to run.

- [ ] **Step 6: Verify and commit**

Run: `npm test`, `npm -w township-floodops-web run build` and `npm -w legacy run build`. Delete the `dist` folders afterwards.
Expected: all green.

```bash
git add apps/web docs/browser-checklist.md README.md
git commit -m "feat(web): engine-backed intervention dashboard and HUD metrics; docs" -m "Dashboard layout and action-plan sections by TEH JIA JIE, now fed by the engine."
```
