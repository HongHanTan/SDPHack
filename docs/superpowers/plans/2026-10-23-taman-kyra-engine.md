# Engine Township on Taman Kyra: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the engine's classic synthetic township with the team's Taman Kyra town. The town is built from Tay's network data and Jiajie's scene layout. Then retune the demo story around the team's three options plus ours, cross-check pipe flows against Tay's EPA SWMM run, and keep the legacy UI running on the new town.

**Architecture:**
- A new layout data file, `data/synthetic/taman_kyra_layout.json`, is extracted once from Jiajie's placement loops. Together with Tay's `taman_kyra_assets.json`, it drives the engine's terrain and network builders.
- Engine coordinates are grid-local metres. `DATUM` converts to the team's datum.
- The physics core (`src/sim/` solver, coupling and engine loop) is unchanged. Grate blockage, tailwater and storms are scenario-level inputs.

**Tech Stack:** TypeScript 5, Vitest 2, tsx, npm workspaces (`packages/engine`, `apps/legacy`).

**Spec:** `docs/superpowers/specs/2026-10-23-taman-kyra-engine-design.md`

## Global Constraints

- **Commits:**
  - Every commit is authored by the repo user. **Never add `Co-Authored-By` or any co-author lines.**
  - Commits that add content derived from teammates' work credit them in the message body, e.g. `Layout derived from apps/web/src/components/TownshipEnvironment.tsx by TEH JIA JIE.` or `Reference results: EPA SWMM 5.2.4 run by Tay Zheheng (data/validation/t1).`
- **Team files are read-only:** `data/synthetic/taman_kyra_assets.json`, `data/validation/**`, `apps/web/**`, `services/**`, `simulation/**`, `models/**`, `contracts/**`, the team's own `md/` files, and `AGENTS.md`.
- **Physics core stays as it is:** no changes to `packages/engine/src/sim/{surface,pipes,coupling,river,engine,metrics}.ts`. The only allowed `src/sim` edit is adding `peakMinute: number` to `Storm` in `types.ts`.
- **Coordinates:**
  - Team datum: metres east `x`, north `y`.
  - Grid-local = team − `DATUM` (`DATUM = { x0: -80, y0: -140 }`).
  - Grid: `nx = 125`, `ny = 145`, `dx = 2`.
- **Asset values used exactly:** all IDs, inverts, diameters, lengths and Manning n from the assets file.
- **Storms:**

  | ID | Rain | Recession | `peakMinute` |
  |---|---|---|---|
  | `synthetic_80mmh_60min` (the default) | constant 80 mm/h, 12 × 5-min blocks | 3600 s | 30 |
  | `synthetic_120mmh_60min` | constant 120 mm/h, 12 × 5-min blocks | 3600 s | 30 |
  | `10yr` | MSMA, unchanged | 3600 s | 60 |
  | `100yr` | MSMA, unchanged | 3600 s | 60 |

- **Tailwater (constant canal stage):** `normal` 8.2 m, `high` 9.4 m.
- **Baseline blockage:** `{ 'INLET-D07': 0.4 }`. Grate edge = `4·√grate_area_m2·(1 − blockage)`.
- **Interventions:** `desilt-d07`, `upsize-p07` (P07 → 0.75 m), `flap-gate`, `storage-tank`, `lake-overflow`, `pump` (0.5 m³/s at NODE-J08).
- **Story claims and the SWMM cross-check must come from the physics.** If one can't be met honestly within the allowed tunables, downgrade it as the spec says and record why in `docs/tuning.md`.
- **Spec corrections adopted by this plan:**
  - Canal walls are visual only (their height is in the layout for part 3). Physics canal banks sit at local ground so overland flow can drain into the canal; the high stage, 9.4 m, stays below the bank ground (≈ 10 m), so there's no overbank flow.
  - Node `maxDepth = max(0.3, groundCell − invert)` rather than the asset's 2 m, so manholes spill at the DEM's ground level. The asset `max_depth_m` is recorded but not used for storage.

## File Map

```
data/synthetic/taman_kyra_layout.json         new (extracted, credits Jiajie)
packages/engine/scripts/extractLayout.ts      new
packages/engine/src/scenario/layout.ts        new: typed LAYOUT + ASSETS loaders, toLocal/toTeam
packages/engine/src/scenario/config.ts        rewritten
packages/engine/src/scenario/terrain.ts       rewritten
packages/engine/src/scenario/network.ts       rewritten
packages/engine/src/scenario/interventions.ts rewritten
packages/engine/src/scenario/storms.ts        + constantStorm, 4 storms, DEFAULT_STORM
packages/engine/src/scenario/index.ts         + ScenarioOptions (tailwater, blockage), hotspotCell
packages/engine/src/sim/types.ts              Storm.peakMinute
packages/engine/tests/scenario/layout.test.ts new
packages/engine/tests/scenario/township.test.ts rewritten
packages/engine/tests/story.test.ts           rewritten
packages/engine/tests/swmm.crosscheck.test.ts new (slow)
packages/engine/scripts/computeEffects.ts, tests/effects.drift.test.ts   tailwater matrix
apps/legacy/**                                minimal adaptation
docs/tuning.md, docs/swmm-crosscheck.md
```

---

### Task 1: Extract the Taman Kyra layout data

**Files:**
- Create: `packages/engine/scripts/extractLayout.ts`, `data/synthetic/taman_kyra_layout.json` (generated), `packages/engine/tests/scenario/layout.test.ts`

**Interfaces:**
- Produces a JSON file with `source`, `datum`, `roads[]`, `houses[]`, `lake`, `canal` and `trees[]`, in the shape listed in Step 1.

- [ ] **Step 1: Write the extractor**

Create `packages/engine/scripts/extractLayout.ts`:

```ts
/**
 * Writes data/synthetic/taman_kyra_layout.json from the placement loops in
 * apps/web/src/components/TownshipEnvironment.tsx (TEH JIA JIE): same ranges, skips, rotations and scales.
 * Scene coordinates are (x, elevation, z) with z = −y (team datum, metres east/north).
 * Run once with `npx tsx scripts/extractLayout.ts`; the committed JSON is the source of truth.
 */
import { writeFileSync } from 'node:fs';

const r2 = (v: number) => Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
/** Direction of a DetailedRoadSegment's length axis (local +z, rotated by rotationY), in team degrees from east. */
const roadAngle = (rotY: number) => r2((Math.atan2(-Math.cos(rotY), Math.sin(rotY)) * 180) / Math.PI);

const roads = [
  { id: 'north_street', kind: 'straight', x: 45, y: 120, width: 13, length: 145, angleDeg: roadAngle(Math.PI / 2) },
  { id: 'mid_street', kind: 'straight', x: 65, y: 80, width: 11, length: 105, angleDeg: roadAngle(Math.PI / 2) },
  { id: 'main_avenue', kind: 'straight', x: 45, y: 0, width: 15, length: 155, angleDeg: roadAngle(Math.PI / 2) },
  { id: 'drainage_boulevard', kind: 'straight', x: 40, y: 35, width: 13, length: 195, angleDeg: roadAngle(0) },
  { id: 'east_connector', kind: 'straight', x: 85, y: 40, width: 10, length: 95, angleDeg: roadAngle(Math.PI / 4) },
  { id: 'cul-de-sac', kind: 'circle', x: 120, y: 80, radius: 10.5 },
];

const houses: Array<{ id: string; x: number; y: number; rotationDeg: number; scale: number }> = [];
const house = (sx: number, sz: number, rotY: number, scale: number) =>
  houses.push({ id: `H${String(houses.length + 1).padStart(2, '0')}`, x: sx, y: -sz, rotationDeg: Math.round((rotY * 180) / Math.PI), scale });
for (let x = -20; x <= 105; x += 18) house(x, -138, 0, 1.05);
for (let x = -10; x <= 95; x += 18) house(x, -102, Math.PI, 1.0);
for (let x = -30; x <= 95; x += 18) {
  if (Math.abs(x - 40) < 10) continue;
  house(x, -22, 0, 1.05);
}
for (let x = -30; x <= 95; x += 18) {
  if (Math.abs(x - 40) < 10) continue;
  house(x, 22, Math.PI, 1.05);
}
for (let z = -85; z <= 45; z += 20) house(-28, z, Math.PI / 2, 1.0);
for (let x = 65; x <= 105; x += 18) house(x, 70, 0, 1.0);

const trees: Array<{ x: number; y: number; scale: number }> = [];
const tree = (sx: number, sz: number, scale: number) => trees.push({ x: r2(sx), y: r2(-sz), scale: r2(scale) });
for (let x = -25; x <= 115; x += 14) tree(x, -128, 1.0 + (x % 3) * 0.1);
for (let x = -35; x <= 105; x += 12) {
  tree(x, -10, 0.95 + (x % 2) * 0.15);
  tree(x, 10, 0.9 + (x % 3) * 0.15);
}
for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
  const dist = 22 + Math.sin(angle * 3) * 3;
  tree(130 + Math.cos(angle) * dist, -30 + Math.sin(angle) * (dist * 0.85), 1.1 + Math.sin(angle * 5) * 0.25);
}
for (let x = -15; x <= 85; x += 22) {
  tree(x, -150, 1.3);
  tree(x, 35, 1.25);
}

const layout = {
  source: 'Derived from apps/web/src/components/TownshipEnvironment.tsx by TEH JIA JIE (team repo zerngx/sdphack).',
  datum: 'team local metres: x east, y north (scene z = -y)',
  roads,
  houses,
  lake: { id: 'maple_grove_pond', x: 130, y: 30, radius: 20 },
  canal: { id: 'east_outfall_canal', x: 40, yFrom: -127.5, yTo: -52.5, width: 15.6, wallHeight: 2.0 },
  trees,
};

writeFileSync(new URL('../../../data/synthetic/taman_kyra_layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n');
console.log(`Wrote taman_kyra_layout.json: ${roads.length} roads, ${houses.length} houses, ${trees.length} trees`);
```

- [ ] **Step 2: Generate**

Run: `cd packages/engine && npx tsx scripts/extractLayout.ts && cd ../..`
Expected: `Wrote taman_kyra_layout.json: 6 roads, 35 houses, <N> trees`, where N is about 59.

- [ ] **Step 3: Layout test**

Create `packages/engine/tests/scenario/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import layout from '../../../../data/synthetic/taman_kyra_layout.json';

describe('taman_kyra_layout.json (derived from TownshipEnvironment.tsx by TEH JIA JIE)', () => {
  it('reproduces the six house rows', () => {
    expect(layout.houses.length).toBe(35);
    expect(layout.houses[0]).toEqual({ id: 'H01', x: -20, y: 138, rotationDeg: 0, scale: 1.05 });
    expect(layout.houses[34]).toEqual({ id: 'H35', x: 101, y: -70, rotationDeg: 0, scale: 1 });
    expect(layout.houses.some((h) => Math.abs(h.x - 40) < 10 && Math.abs(h.y) === 22)).toBe(false); // D07 opening
  });
  it('has the roads, lake and canal', () => {
    expect(layout.roads.map((r) => r.id)).toEqual(['north_street', 'mid_street', 'main_avenue', 'drainage_boulevard', 'east_connector', 'cul-de-sac']);
    expect(layout.roads.find((r) => r.id === 'main_avenue')).toMatchObject({ angleDeg: 0, width: 15 });
    expect(Math.abs(Math.abs((layout.roads.find((r) => r.id === 'drainage_boulevard') as { angleDeg: number }).angleDeg) - 90)).toBeLessThan(1e-9);
    expect(layout.lake).toMatchObject({ x: 130, y: 30, radius: 20 });
    expect(layout.canal).toMatchObject({ x: 40, yFrom: -127.5, yTo: -52.5 });
    expect(layout.source).toContain('TEH JIA JIE');
  });
});
```

Run: `npm -w @floodops/engine test -- tests/scenario/layout.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/scripts/extractLayout.ts data/synthetic/taman_kyra_layout.json packages/engine/tests/scenario/layout.test.ts
git commit -m "feat(engine): extract Taman Kyra layout data" -m "Layout derived from apps/web/src/components/TownshipEnvironment.tsx by TEH JIA JIE."
```

---

### Task 2: Taman Kyra township in the engine

**Files:**
- Modify: `packages/engine/src/sim/types.ts` (`Storm.peakMinute`), `packages/engine/src/scenario/storms.ts`, `packages/engine/tests/helpers.ts` (storm literal), `packages/engine/tests/worker/liveSession.test.ts` (intervention IDs), `packages/engine/scripts/tune.ts`
- Create: `packages/engine/src/scenario/layout.ts`
- Rewrite: `packages/engine/src/scenario/config.ts`, `terrain.ts`, `network.ts`, `interventions.ts`, `index.ts`, `packages/engine/tests/scenario/township.test.ts`, `packages/engine/tests/story.test.ts`

**Interfaces:**
- **Produces from `layout.ts`:** `LAYOUT`, `ASSETS` (typed), `toLocal(x, y)` and `toTeam(x, y)`.
- **Produces from `config.ts`:** `DATUM`, `GRID`, `ROAD_DROP`, `HOUSE`, `LAKE`, `CANAL`, `DIP`, `INLET_SUMP`, `COVER`, `MANHOLE`, `BASELINE_BLOCKAGE`, `TAILWATER`, `type TailwaterCase`, `TANK`, `LAKE_OVERFLOW`, `PUMP`, `P07_UPSIZED_D`, `THRESHOLDS`, `MMHR`, `INFILTRATION_MMHR`, `SIM`.
- **Produces from `terrain.ts`:** `cellAt(x, y)` (grid-local, clamped), `INFIL_BY_LAND` and `buildTerrain(): Grid`.
- **Produces from `network.ts`:**
  - `makeNode` and `makePipe`, with unchanged signatures;
  - `nodeSite(id)`, returning grid-local `{ x, y }`;
  - `inletPerimeter(gratAreaM2, blockage)`;
  - `buildNetwork(grid, blockage)`.
- **Produces from `interventions.ts`:** `Township`, `InterventionId`, `Intervention`, `INTERVENTIONS`, `findNode`, `applyInterventions` and `totalCost`.
- **Produces from `storms.ts`:** `constantStorm`, `STORMS` (4 keys), `StormId` and `DEFAULT_STORM`.
- **Produces from `index.ts`:**
  - `ScenarioOptions { tailwater?: TailwaterCase; blockage?: Record<string, number> }`;
  - `baseTownship(blockage?)`;
  - `buildTownship(ids, custom?, opts?)`;
  - `buildScenario(ids, stormId, custom?, opts?)`;
  - `scenarioKey(ids, stormId, custom?, opts?)`;
  - `hotspotCell()`;
  - `CustomPipe`, `customPipeCost` and `CUSTOM_PIPE_RM_PER_M_PER_M_DIA`, all unchanged.

- [ ] **Step 1: `Storm.peakMinute` and the storms**

In `packages/engine/src/sim/types.ts`, add `peakMinute: number; // minute of peak rain (live-mode jump target)` to the `Storm` interface.

In `packages/engine/tests/helpers.ts`, add `peakMinute: 5,` to the storm object literal in `makeScenario`.

In `packages/engine/src/scenario/storms.ts`:
- in `designStorm`, add `peakMinute: STORM_DURATION_S / 120,` to the returned object;
- replace the `STORMS` / `StormId` lines with:

```ts
/** Constant-intensity storm in 5-minute blocks (the team's synthetic SWMM storms). */
export function constantStorm(id: string, label: string, mmhr: number, minutes: number): Storm {
  const blocks = Math.round((minutes * 60) / BLOCK_S);
  return {
    id,
    label,
    returnPeriod: 0,
    blockS: BLOCK_S,
    intensity: new Array<number>(blocks).fill(mmhr / 3.6e6),
    provisional: false,
    peakMinute: minutes / 2,
  };
}

export const STORMS = {
  synthetic_80mmh_60min: constantStorm('synthetic_80mmh_60min', 'Constant 80 mm/h, 60 min (team SWMM storm)', 80, 60),
  synthetic_120mmh_60min: constantStorm('synthetic_120mmh_60min', 'Constant 120 mm/h, 60 min (team SWMM storm)', 120, 60),
  '10yr': designStorm(10),
  '100yr': designStorm(100),
};
export type StormId = keyof typeof STORMS;
export const DEFAULT_STORM: StormId = 'synthetic_80mmh_60min';
```

Append to `packages/engine/tests/scenario/storms.test.ts`, adding `constantStorm` and `DEFAULT_STORM` to its storms import:

```ts
describe('constantStorm', () => {
  it('matches the team synthetic storms', () => {
    const s = STORMS.synthetic_80mmh_60min;
    expect(s.intensity.length).toBe(12);
    expect(s.intensity.every((v) => Math.abs(v * 3.6e6 - 80) < 1e-9)).toBe(true);
    expect(s.peakMinute).toBe(30);
    expect(STORMS['100yr'].peakMinute).toBe(60);
    expect(DEFAULT_STORM).toBe('synthetic_80mmh_60min');
    expect(constantStorm('x', 'x', 120, 60).intensity[0] * 3.6e6).toBeCloseTo(120, 9);
  });
});
```

- [ ] **Step 2: Data loaders**

Create `packages/engine/src/scenario/layout.ts`:

```ts
import assetsJson from '../../../../data/synthetic/taman_kyra_assets.json';
import layoutJson from '../../../../data/synthetic/taman_kyra_layout.json';
import { DATUM } from './config';

export interface RoadStraight { id: string; kind: 'straight'; x: number; y: number; width: number; length: number; angleDeg: number }
export interface RoadCircle { id: string; kind: 'circle'; x: number; y: number; radius: number }
export interface LayoutHouse { id: string; x: number; y: number; rotationDeg: number; scale: number }
export interface Layout {
  source: string;
  datum: string;
  roads: Array<RoadStraight | RoadCircle>;
  houses: LayoutHouse[];
  lake: { id: string; x: number; y: number; radius: number };
  canal: { id: string; x: number; yFrom: number; yTo: number; width: number; wallHeight: number };
  trees: Array<{ x: number; y: number; scale: number }>;
}
export interface AssetNode {
  node_id: string;
  node_type: 'junction' | 'outfall';
  position_m: { x: number; y: number; z: number };
  invert_elevation_m: number;
  ground_elevation_m: number;
  max_depth_m: number;
}
export interface AssetInlet { inlet_id: string; node_id: string; position_m: { x: number; y: number; z: number }; grate_area_m2: number }
export interface AssetConduit { conduit_id: string; from_node_id: string; to_node_id: string; diameter_m: number; length_m: number; manning_n: number }
export interface Assets { nodes: AssetNode[]; inlets: AssetInlet[]; conduits: AssetConduit[] }

/** Jiajie's scene layout (team datum). */
export const LAYOUT = layoutJson as Layout;
/** Tay's synthetic Taman Kyra drainage assets (team datum). */
export const ASSETS = assetsJson as unknown as Assets;

/** Team datum → grid-local metres. */
export const toLocal = (x: number, y: number) => ({ x: x - DATUM.x0, y: y - DATUM.y0 });
/** Grid-local metres → team datum. */
export const toTeam = (x: number, y: number) => ({ x: x + DATUM.x0, y: y + DATUM.y0 });
```

- [ ] **Step 3: Config**

Replace `packages/engine/src/scenario/config.ts` with:

```ts
import type { Thresholds } from '../sim/types';

/** Grid-local metres = team datum metres − DATUM. The grid covers team x ∈ [−80, 170], y ∈ [−140, 150]. */
export const DATUM = { x0: -80, y0: -140 };
export const GRID = { nx: 125, ny: 145, dx: 2 };

export const ROAD_DROP = 0.1; // m, kerb: road surface below verge
export const HOUSE = { width: 12, depth: 13 }; // m footprint before the layout's scale
/** Maple Grove pond: bed level, normal water level (below NODE-J04 invert 10.0), park margin, overflow live rise. */
export const LAKE = { bedZ: 9.2, waterLevel: 9.8, parkMargin: 12, liveRise: 1.0 };
export const CANAL = { bedZ: 7.6 };
/** Shallow bowl at the J07 junction so street water gathers there. Tunable. */
export const DIP = { radius: 30, depth: 0.5 };
/** Gully sump: each grate cell sits this far below the street. */
export const INLET_SUMP = 0.1;
export const COVER = 1.5; // m, default cover for nodes added by interventions
export const MANHOLE = { area: 1 };

export const BASELINE_BLOCKAGE: Record<string, number> = { 'INLET-D07': 0.4 };
export const TAILWATER = { normal: 8.2, high: 9.4 } as const; // m, constant canal stage (team tailwater cases)
export type TailwaterCase = keyof typeof TAILWATER;

/** Off-line storage tank near J07: fed from J05, slow release to J08. Positions in team datum. */
export const TANK = { x: 60, y: 20, invert: 8.9, area: 2000, depth: 2.0, feedNode: 'NODE-J05', outNode: 'NODE-J08', inflowD: 0.9, outflowD: 0.15 };
export const LAKE_OVERFLOW = { fromNode: 'NODE-J04', diameter: 0.6 };
export const PUMP = { node: 'NODE-J08', rate: 0.5 }; // m³/s to the canal
export const P07_UPSIZED_D = 0.75;

export const THRESHOLDS: Thresholds = { road: 0.15, home: 0.3 };
export const MMHR = 1 / 3.6e6;
export const INFILTRATION_MMHR = { ROOF: 0, ROAD: 0, LAWN: 15, PARK: 25, POND: 0, RIVER: 0 };

// dt is the coupling step; the surface is sub-stepped inside the engine.
export const SIM = { dt: 0.5, recessionS: 3600, frameEveryS: 30 };
```

- [ ] **Step 4: Terrain**

Replace `packages/engine/src/scenario/terrain.ts` with:

```ts
import { LandUse, type Grid } from '../sim/types';
import { CANAL, DIP, GRID, HOUSE, INFILTRATION_MMHR, INLET_SUMP, LAKE, MMHR, ROAD_DROP } from './config';
import { ASSETS, LAYOUT, toLocal } from './layout';

/** Cell index for grid-local metres (clamped to the grid). */
export function cellAt(x: number, y: number): number {
  const i = Math.min(GRID.nx - 1, Math.max(0, Math.floor(x / GRID.dx)));
  const j = Math.min(GRID.ny - 1, Math.max(0, Math.floor(y / GRID.dx)));
  return j * GRID.nx + i;
}

/** Infiltration (m/s) indexed by LandUse code. */
export const INFIL_BY_LAND: number[] = [
  INFILTRATION_MMHR.ROOF,
  INFILTRATION_MMHR.ROAD,
  INFILTRATION_MMHR.LAWN,
  INFILTRATION_MMHR.PARK,
  INFILTRATION_MMHR.POND,
  INFILTRATION_MMHR.RIVER,
].map((v) => v * MMHR);

/** Point inside a rectangle centred at (cx, cy) whose `length` axis points at angleDeg (from east). */
function inRect(x: number, y: number, cx: number, cy: number, length: number, width: number, angleDeg: number): boolean {
  const a = (angleDeg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const along = dx * Math.cos(a) + dy * Math.sin(a);
  const across = -dx * Math.sin(a) + dy * Math.cos(a);
  return Math.abs(along) <= length / 2 && Math.abs(across) <= width / 2;
}

/** Taman Kyra ground: IDW of the 9 asset ground levels, then roads, houses, pond, canal and the J07 dip. */
export function buildTerrain(): Grid {
  const { nx, ny, dx } = GRID;
  const n = nx * ny;
  const z = new Float32Array(n);
  const land = new Uint8Array(n);
  const infil = new Float32Array(n);
  const building = new Int32Array(n).fill(-1);
  const h0 = new Float32Array(n);

  const ground = ASSETS.nodes.map((nd) => ({ ...toLocal(nd.position_m.x, nd.position_m.y), g: nd.ground_elevation_m }));
  const idw = (x: number, y: number) => {
    let s = 0;
    let w = 0;
    for (const p of ground) {
      const d2 = (x - p.x) ** 2 + (y - p.y) ** 2;
      if (d2 < 1e-6) return p.g;
      s += p.g / d2;
      w += 1 / d2;
    }
    return s / w;
  };
  const roads = LAYOUT.roads.map((r) => ({ ...r, ...toLocal(r.x, r.y) }));
  const houses = LAYOUT.houses.map((h, k) => ({ ...h, ...toLocal(h.x, h.y), k }));
  const lake = { ...LAYOUT.lake, ...toLocal(LAYOUT.lake.x, LAYOUT.lake.y) };
  const canal = LAYOUT.canal;
  const canalC = toLocal(canal.x, (canal.yFrom + canal.yTo) / 2);
  const canalLen = Math.abs(canal.yTo - canal.yFrom);
  const j07 = ASSETS.nodes.find((nd) => nd.node_id === 'NODE-J07')!;
  const dip = toLocal(j07.position_m.x, j07.position_m.y);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      const x = (i + 0.5) * dx;
      const y = (j + 0.5) * dx;
      let zc = idw(x, y);
      let lc: number = LandUse.LAWN;

      if (inRect(x, y, canalC.x, canalC.y, canalLen, canal.width, 90)) {
        z[c] = CANAL.bedZ;
        land[c] = LandUse.RIVER;
        continue;
      }
      const dd = Math.hypot(x - dip.x, y - dip.y);
      if (dd < DIP.radius) zc -= DIP.depth * (1 - (dd / DIP.radius) ** 2);

      const dl = Math.hypot(x - lake.x, y - lake.y);
      if (dl < lake.radius) {
        lc = LandUse.POND;
        zc = LAKE.bedZ + (zc - LAKE.bedZ) * (dl / lake.radius) ** 2;
      } else if (dl < lake.radius + LAKE.parkMargin) {
        lc = LandUse.PARK;
      } else if (
        roads.some((r) => (r.kind === 'circle' ? Math.hypot(x - r.x, y - r.y) <= r.radius : inRect(x, y, r.x, r.y, r.length, r.width, r.angleDeg)))
      ) {
        lc = LandUse.ROAD;
        zc -= ROAD_DROP;
      } else {
        const h = houses.find((hh) => inRect(x, y, hh.x, hh.y, HOUSE.width * hh.scale, HOUSE.depth * hh.scale, hh.rotationDeg));
        if (h) {
          lc = LandUse.ROOF;
          building[c] = h.k;
        }
      }
      z[c] = zc;
      land[c] = lc;
      if (lc === LandUse.POND) h0[c] = Math.max(0, LAKE.waterLevel - zc);
    }
  }
  for (const inlet of ASSETS.inlets) {
    const p = toLocal(inlet.position_m.x, inlet.position_m.y);
    z[cellAt(p.x, p.y)] -= INLET_SUMP;
  }
  for (let c = 0; c < n; c++) infil[c] = INFIL_BY_LAND[land[c]];
  return { nx, ny, dx, z, land, infil, building, h0 };
}
```

- [ ] **Step 5: Network**

Replace `packages/engine/src/scenario/network.ts` with:

```ts
import { MANNING_N } from '../sim/pipes';
import type { DrainNode, Grid, Network, Pipe } from '../sim/types';
import { COVER, MANHOLE } from './config';
import { ASSETS, toLocal } from './layout';
import { cellAt } from './terrain';

export function makeNode(
  grid: Grid,
  id: string,
  x: number,
  y: number,
  opts: Partial<Pick<DrainNode, 'invert' | 'area' | 'maxDepth' | 'inletPerimeter'>> = {},
): DrainNode {
  const cell = cellAt(x, y);
  const ground = grid.z[cell];
  const invert = opts.invert ?? ground - COVER;
  return {
    id,
    x,
    y,
    cell,
    invert,
    area: opts.area ?? MANHOLE.area,
    maxDepth: opts.maxDepth ?? Math.max(0.3, ground - invert),
    inletPerimeter: opts.inletPerimeter ?? 0,
  };
}

export function makePipe(a: DrainNode, b: DrainNode, diameter: number): Pipe {
  const length = Math.hypot(a.x - b.x, a.y - b.y);
  return { id: `${a.id}-${b.id}`, from: a.id, to: b.id, diameter, length, slope: (a.invert - b.invert) / length, n: MANNING_N };
}

/** Grid-local position of an asset node. */
export function nodeSite(id: string): { x: number; y: number } {
  const nd = ASSETS.nodes.find((n) => n.node_id === id);
  if (!nd) throw new Error(`Unknown asset node ${id}`);
  return toLocal(nd.position_m.x, nd.position_m.y);
}

/** Effective weir edge of a square grate (m), reduced by the blocked fraction. */
export function inletPerimeter(grateAreaM2: number, blockage = 0): number {
  return 4 * Math.sqrt(grateAreaM2) * (1 - Math.min(1, Math.max(0, blockage)));
}

/** Tay's Taman Kyra network on the grid; blockage maps inlet_id → blocked fraction. */
export function buildNetwork(grid: Grid, blockage: Record<string, number> = {}): Network {
  const inletByNode = new Map(ASSETS.inlets.map((i) => [i.node_id, i]));
  const nodes: DrainNode[] = ASSETS.nodes.map((nd) => {
    const p = toLocal(nd.position_m.x, nd.position_m.y);
    const inlet = inletByNode.get(nd.node_id);
    return makeNode(grid, nd.node_id, p.x, p.y, {
      invert: nd.invert_elevation_m,
      inletPerimeter: inlet ? inletPerimeter(inlet.grate_area_m2, blockage[inlet.inlet_id] ?? 0) : 0,
    });
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const pipes: Pipe[] = ASSETS.conduits.map((cd) => {
    const a = byId.get(cd.from_node_id)!;
    const b = byId.get(cd.to_node_id)!;
    return { id: cd.conduit_id, from: a.id, to: b.id, diameter: cd.diameter_m, length: cd.length_m, slope: (a.invert - b.invert) / cd.length_m, n: cd.manning_n };
  });
  const outfall = nodes.find((n) => ASSETS.nodes.find((a) => a.node_id === n.id)!.node_type === 'outfall')!;
  const lastPipe = pipes.find((p) => p.to === outfall.id)!;
  return {
    nodes,
    pipes,
    outfalls: [{ node: outfall.id, riverCell: outfall.cell, area: (Math.PI * lastPipe.diameter ** 2) / 4, flapGate: false }],
    pumps: [],
  };
}
```

- [ ] **Step 6: Interventions**

Replace `packages/engine/src/scenario/interventions.ts` with:

```ts
import { LandUse, type DrainNode, type Grid, type Network } from '../sim/types';
import { LAKE, LAKE_OVERFLOW, P07_UPSIZED_D, PUMP, TANK } from './config';
import { ASSETS, LAYOUT, toLocal } from './layout';
import { inletPerimeter, makeNode, makePipe } from './network';

export interface Township {
  grid: Grid;
  network: Network;
}

export type InterventionId = 'desilt-d07' | 'upsize-p07' | 'flap-gate' | 'storage-tank' | 'lake-overflow' | 'pump';

export interface Intervention {
  id: InterventionId;
  name: string;
  description: string;
  costRM: number; // INDICATIVE PLACEHOLDER — replace with SDP quantity-surveyor rates
  disruption: 'Low' | 'Medium' | 'High';
  teamRating?: string; // team InterventionDashboard cost rating / lead time
  apply(t: Township): void;
}

export function findNode(t: Township, id: string): DrainNode {
  const n = t.network.nodes.find((node) => node.id === id);
  if (!n) throw new Error(`Missing node ${id}`);
  return n;
}

export const INTERVENTIONS: Intervention[] = [
  {
    id: 'desilt-d07',
    name: 'Emergency desilting of INLET-D07',
    description: 'Remove leaf litter and sediment from INLET-D07, restoring full grate capacity',
    costRM: 15_000,
    disruption: 'Low',
    teamRating: 'LOW · < 24 hours',
    apply(t) {
      const d07 = ASSETS.inlets.find((i) => i.inlet_id === 'INLET-D07')!;
      findNode(t, d07.node_id).inletPerimeter = inletPerimeter(d07.grate_area_m2, 0);
    },
  },
  {
    id: 'upsize-p07',
    name: 'Upsize PIPE-P07 to Ø750',
    description: 'Replace trunk conduit PIPE-P07 (NODE-J07 → NODE-J08) Ø600 with Ø750 RCP',
    costRM: 1_200_000,
    disruption: 'High',
    teamRating: 'HIGH · 3–6 months',
    apply(t) {
      const p = t.network.pipes.find((pp) => pp.id === 'PIPE-P07')!;
      p.diameter = P07_UPSIZED_D;
    },
  },
  {
    id: 'flap-gate',
    name: 'One-way valve at OUT01',
    description: 'Non-return flap gate stops canal backflow into the drains',
    costRM: 150_000,
    disruption: 'Low',
    apply(t) {
      for (const o of t.network.outfalls) o.flapGate = true;
    },
  },
  {
    id: 'storage-tank',
    name: 'Underground storage tank near J07',
    description: `${TANK.area * TANK.depth} m³ off-line tank fed from NODE-J05, slow release to NODE-J08`,
    costRM: 2_500_000,
    disruption: 'Medium',
    apply(t) {
      const p = toLocal(TANK.x, TANK.y);
      const tk = makeNode(t.grid, 'TK', p.x, p.y, { invert: TANK.invert, area: TANK.area, maxDepth: TANK.depth, inletPerimeter: 0 });
      t.network.nodes.push(tk);
      t.network.pipes.push(
        { ...makePipe(findNode(t, TANK.feedNode), tk, TANK.inflowD), id: 'PIPE-TK-IN' },
        { ...makePipe(tk, findNode(t, TANK.outNode), TANK.outflowD), id: 'PIPE-TK-OUT' },
      );
    },
  },
  {
    id: 'lake-overflow',
    name: 'Overflow from J04 to Maple Grove pond',
    description: 'Relief pipe diverts the J04 branch into the retention pond',
    costRM: 1_800_000,
    disruption: 'Medium',
    apply(t) {
      const g = t.grid;
      const cellArea = g.dx * g.dx;
      let live = 0;
      for (let c = 0; c < g.z.length; c++) {
        if (g.land[c] === LandUse.POND) {
          live += (Math.max(0, LAKE.waterLevel + LAKE.liveRise - g.z[c]) - Math.max(0, LAKE.waterLevel - g.z[c])) * cellArea;
        }
      }
      const p = toLocal(LAYOUT.lake.x, LAYOUT.lake.y);
      const lk = makeNode(g, 'LK', p.x, p.y, { invert: LAKE.waterLevel, area: live / LAKE.liveRise, maxDepth: LAKE.liveRise, inletPerimeter: 0 });
      t.network.nodes.push(lk);
      t.network.pipes.push({ ...makePipe(findNode(t, LAKE_OVERFLOW.fromNode), lk, LAKE_OVERFLOW.diameter), id: 'PIPE-LK' });
    },
  },
  {
    id: 'pump',
    name: 'Pump station at J08',
    description: `${PUMP.rate} m³/s pump from NODE-J08 to the outfall canal`,
    costRM: 3_000_000,
    disruption: 'Medium',
    apply(t) {
      t.network.pumps.push({ node: PUMP.node, rate: PUMP.rate, riverCell: t.network.outfalls[0].riverCell });
    },
  },
];

/** Deep-copies the base and applies the chosen presets in a fixed order. */
export function applyInterventions(base: Township, ids: readonly InterventionId[]): Township {
  const t = structuredClone(base);
  for (const iv of INTERVENTIONS) if (ids.includes(iv.id)) iv.apply(t);
  return t;
}

export function totalCost(ids: readonly InterventionId[]): number {
  return INTERVENTIONS.filter((iv) => ids.includes(iv.id)).reduce((s, iv) => s + iv.costRM, 0);
}
```

- [ ] **Step 7: Scenario API**

Replace `packages/engine/src/scenario/index.ts` with:

```ts
import type { Scenario } from '../sim/types';
import { BASELINE_BLOCKAGE, SIM, TAILWATER, THRESHOLDS, type TailwaterCase } from './config';
import { applyInterventions, findNode, type InterventionId, type Township } from './interventions';
import { buildNetwork, makePipe, nodeSite } from './network';
import { STORMS, type StormId } from './storms';
import { buildTerrain, cellAt } from './terrain';

export interface CustomPipe {
  from: string;
  to: string;
  diameter: number;
}

export interface ScenarioOptions {
  tailwater?: TailwaterCase;
  /** inlet_id → blocked fraction; defaults to BASELINE_BLOCKAGE (INLET-D07 40%). */
  blockage?: Record<string, number>;
}

/** Indicative placeholder rate for user-drawn pipes, RM per metre per metre of diameter. */
export const CUSTOM_PIPE_RM_PER_M_PER_M_DIA = 5_000;

const baseCache = new Map<string, Township>();
const blockageKey = (b: Record<string, number>) =>
  Object.keys(b)
    .sort()
    .map((k) => `${k}=${b[k]}`)
    .join(',');

export function baseTownship(blockage: Record<string, number> = BASELINE_BLOCKAGE): Township {
  const key = blockageKey(blockage);
  let t = baseCache.get(key);
  if (!t) {
    const grid = buildTerrain();
    t = { grid, network: buildNetwork(grid, blockage) };
    baseCache.set(key, t);
  }
  return t;
}

export function buildTownship(ids: readonly InterventionId[], custom: readonly CustomPipe[] = [], opts: ScenarioOptions = {}): Township {
  const t = applyInterventions(baseTownship(opts.blockage ?? BASELINE_BLOCKAGE), ids);
  custom.forEach((cp, k) => {
    const pipe = makePipe(findNode(t, cp.from), findNode(t, cp.to), cp.diameter);
    t.network.pipes.push({ ...pipe, id: `custom-${k}` });
  });
  return t;
}

export function customPipeCost(t: Township, cp: CustomPipe): number {
  const a = findNode(t, cp.from);
  const b = findNode(t, cp.to);
  return Math.hypot(a.x - b.x, a.y - b.y) * cp.diameter * CUSTOM_PIPE_RM_PER_M_PER_M_DIA;
}

/** The J07 junction cell: the hotspot the readouts and charts follow. */
export function hotspotCell(): number {
  const p = nodeSite('NODE-J07');
  return cellAt(p.x, p.y);
}

export function buildScenario(
  ids: readonly InterventionId[],
  stormId: StormId,
  custom: readonly CustomPipe[] = [],
  opts: ScenarioOptions = {},
): Scenario {
  const { grid, network } = buildTownship(ids, custom, opts);
  return {
    grid,
    network,
    storm: STORMS[stormId],
    river: { times: [0], levels: [TAILWATER[opts.tailwater ?? 'normal']] },
    dt: SIM.dt,
    recessionS: SIM.recessionS,
    frameEveryS: SIM.frameEveryS,
    thresholds: THRESHOLDS,
    sagCell: hotspotCell(),
  };
}

export function scenarioKey(
  ids: readonly InterventionId[],
  stormId: StormId,
  custom: readonly CustomPipe[] = [],
  opts: ScenarioOptions = {},
): string {
  const pipes = custom.map((c) => `${c.from}>${c.to}@${c.diameter}`).join(',');
  return `${stormId}|${opts.tailwater ?? 'normal'}|${blockageKey(opts.blockage ?? BASELINE_BLOCKAGE)}|${[...ids].sort().join(',')}|${pipes}`;
}
```

- [ ] **Step 8: Township tests**

Replace `packages/engine/tests/scenario/township.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { GRID, P07_UPSIZED_D, TAILWATER } from '../../src/scenario/config';
import { buildScenario, buildTownship, hotspotCell, scenarioKey } from '../../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../../src/scenario/interventions';
import { ASSETS, toLocal } from '../../src/scenario/layout';
import { inletPerimeter, nodeSite } from '../../src/scenario/network';
import { buildTerrain, cellAt } from '../../src/scenario/terrain';
import { runSimulation } from '../../src/sim/engine';
import { LandUse } from '../../src/sim/types';

const grid = buildTerrain();
const at = (x: number, y: number) => {
  const p = toLocal(x, y);
  return cellAt(p.x, p.y);
};

describe('Taman Kyra terrain', () => {
  it('has the agreed grid', () => {
    expect([grid.nx, grid.ny, grid.dx]).toEqual([GRID.nx, GRID.ny, GRID.dx]);
    expect([GRID.nx, GRID.ny, GRID.dx]).toEqual([125, 145, 2]);
  });
  it('places roads, houses, pond, park and canal from the layout', () => {
    expect(grid.land[at(0, 0)]).toBe(LandUse.ROAD); // main avenue
    expect(grid.land[at(40, 60)]).toBe(LandUse.ROAD); // drainage boulevard
    expect(grid.land[at(-20, 138)]).toBe(LandUse.ROOF); // house H01
    expect(grid.building[at(-20, 138)]).toBe(0);
    expect(grid.land[at(130, 30)]).toBe(LandUse.POND);
    expect(grid.h0[at(130, 30)]).toBeGreaterThan(0);
    expect(grid.land[at(130, 56)]).toBe(LandUse.PARK);
    expect(grid.land[at(40, -100)]).toBe(LandUse.RIVER);
  });
  it('dips at the J07 junction', () => {
    expect(grid.z[at(40, 0)]).toBeLessThan(grid.z[at(80, 0)]);
  });
});

describe('Taman Kyra network', () => {
  const t = buildTownship([]);
  it('uses every asset node and conduit exactly', () => {
    expect(t.network.nodes.map((n) => n.id)).toEqual(ASSETS.nodes.map((n) => n.node_id));
    for (const cd of ASSETS.conduits) {
      const p = t.network.pipes.find((pp) => pp.id === cd.conduit_id)!;
      expect([p.from, p.to, p.diameter, p.length, p.n]).toEqual([cd.from_node_id, cd.to_node_id, cd.diameter_m, cd.length_m, cd.manning_n]);
    }
    for (const nd of ASSETS.nodes) expect(t.network.nodes.find((n) => n.id === nd.node_id)!.invert).toBe(nd.invert_elevation_m);
  });
  it('applies the D07 baseline blockage and only asset grates', () => {
    const d07 = ASSETS.inlets.find((i) => i.inlet_id === 'INLET-D07')!;
    expect(t.network.nodes.find((n) => n.id === 'NODE-J07')!.inletPerimeter).toBeCloseTo(inletPerimeter(d07.grate_area_m2, 0.4), 12);
    expect(t.network.nodes.find((n) => n.id === 'NODE-J01')!.inletPerimeter).toBeCloseTo(inletPerimeter(0.6, 0), 12);
    expect(t.network.nodes.find((n) => n.id === 'NODE-J03')!.inletPerimeter).toBe(0);
    expect(buildTownship([], [], { blockage: {} }).network.nodes.find((n) => n.id === 'NODE-J07')!.inletPerimeter).toBeCloseTo(inletPerimeter(0.6, 0), 12);
  });
  it('drains to OUT01 in the canal', () => {
    expect(t.network.outfalls[0].node).toBe('NODE-OUT01');
    expect(grid.land[t.network.outfalls[0].riverCell]).toBe(LandUse.RIVER);
  });
});

describe('interventions and scenario options', () => {
  const only = (id: InterventionId) => buildTownship([id]).network;
  it('applies each intervention', () => {
    expect(only('desilt-d07').nodes.find((n) => n.id === 'NODE-J07')!.inletPerimeter).toBeCloseTo(inletPerimeter(0.6, 0), 12);
    expect(only('upsize-p07').pipes.find((p) => p.id === 'PIPE-P07')!.diameter).toBe(P07_UPSIZED_D);
    expect(only('flap-gate').outfalls[0].flapGate).toBe(true);
    expect(only('storage-tank').pipes.map((p) => p.id)).toEqual(expect.arrayContaining(['PIPE-TK-IN', 'PIPE-TK-OUT']));
    expect(only('lake-overflow').pipes.find((p) => p.id === 'PIPE-LK')!.slope).toBeGreaterThan(0);
    expect(only('pump').pumps[0].node).toBe('NODE-J08');
  });
  it('sets the tailwater stage and the J07 hotspot', () => {
    expect(buildScenario([], 'synthetic_80mmh_60min', [], { tailwater: 'high' }).river.levels[0]).toBe(TAILWATER.high);
    const j07 = nodeSite('NODE-J07');
    expect(hotspotCell()).toBe(cellAt(j07.x, j07.y));
    expect(scenarioKey([], 'synthetic_80mmh_60min', [], { tailwater: 'high' })).not.toBe(scenarioKey([], 'synthetic_80mmh_60min'));
  });
});

describe('water balance (short storm)', () => {
  const cases: InterventionId[][] = [[], ...INTERVENTIONS.map((i) => [i.id]), INTERVENTIONS.map((i) => i.id)];
  it.each(cases)('within 1%%: %s', (...ids) => {
    const sc = buildScenario(ids, 'synthetic_80mmh_60min');
    const short = { ...sc, storm: { ...sc.storm, intensity: sc.storm.intensity.slice(0, 3) }, recessionS: 0 };
    expect(runSimulation(short).metrics.balance.error).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 9: Story test (it may fail until Task 4 tunes the town)**

Replace `packages/engine/tests/story.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { buildScenario, type ScenarioOptions } from '../src/scenario/index';
import type { InterventionId } from '../src/scenario/interventions';
import { runSimulation } from '../src/sim/engine';

const STORM = 'synthetic_80mmh_60min';

function run(ids: InterventionId[], opts: ScenarioOptions = {}) {
  const sc = buildScenario(ids, STORM, [], opts);
  const { frames, metrics } = runSimulation(sc);
  const p07 = sc.network.pipes.findIndex((p) => p.id === 'PIPE-P07');
  const p07Max = Math.max(...frames.map((f) => f.pipeLoad[p07]));
  return { m: metrics, p07Max };
}

describe('Taman Kyra demo story (80 mm/h, team storm)', () => {
  const base = run([]);
  const desilt = run(['desilt-d07']);
  const upsize = run(['upsize-p07']);
  const combined = run(['desilt-d07', 'upsize-p07']);
  const highBase = run([], { tailwater: 'high' });
  const highFlap = run(['flap-gate'], { tailwater: 'high' });
  const highPump = run(['pump'], { tailwater: 'high' });
  const tank = run(['storage-tank']);
  const lake = run(['lake-overflow']);

  it('1. baseline floods the J07 junction and homes', () => {
    expect(base.m.peakSagDepth).toBeGreaterThanOrEqual(0.15);
    expect(base.m.homesFlooded).toBeGreaterThanOrEqual(2);
  });
  it('2. desilting D07 helps but P07 still runs full', () => {
    expect(desilt.m.peakSagDepth).toBeLessThan(base.m.peakSagDepth);
    expect(desilt.p07Max).toBeGreaterThanOrEqual(0.99);
  });
  it('3. upsizing P07 helps', () => {
    expect(upsize.m.peakSagDepth).toBeLessThan(base.m.peakSagDepth);
  });
  it('4. combined beats either alone', () => {
    expect(combined.m.peakSagDepth).toBeLessThan(desilt.m.peakSagDepth);
    expect(combined.m.peakSagDepth).toBeLessThan(upsize.m.peakSagDepth);
  });
  it('5. under high tailwater, flap gate and pump each help', () => {
    expect(highFlap.m.peakSagDepth).toBeLessThan(highBase.m.peakSagDepth);
    expect(highPump.m.peakSagDepth).toBeLessThan(highBase.m.peakSagDepth);
  });
  it('6. tank and lake overflow are not dead toggles', () => {
    expect(Math.abs(tank.m.peakSagDepth - base.m.peakSagDepth)).toBeGreaterThanOrEqual(0.03);
    expect(Math.abs(lake.m.peakSagDepth - base.m.peakSagDepth)).toBeGreaterThanOrEqual(0.03);
  });
  it('7. every run closes its water balance', () => {
    for (const r of [base, desilt, upsize, combined, highBase, highFlap, highPump, tank, lake]) expect(r.m.balance.error).toBeLessThan(0.01);
  });
});
```

- [ ] **Step 10: Fix the remaining engine references**

- In `packages/engine/tests/worker/liveSession.test.ts`, replace intervention IDs: `'detention-tank'` → `'storage-tank'`. `'flap-gate'` and `'pump'` stay. Keep `'100yr'` (still valid).
- In `packages/engine/scripts/tune.ts`, use `'synthetic_80mmh_60min'` instead of `'100yr'`.
- In `packages/engine/tests/effects.drift.test.ts`, leave the code as it is. It fails until Task 6, and it's in the slow suite.

- [ ] **Step 11: Verify (engine only) and commit**

Run:
```bash
npm -w @floodops/engine run typecheck
npm -w @floodops/engine test
```
Expected:
- The typecheck is clean.
- The engine fast suite passes: layout, township, storms, sim, worker and patch tests. The legacy workspace is expected to fail to typecheck until Task 3; don't run the root `npm test` here.
- If a township assertion about specific cells fails (e.g. house H01's cell lands on the north-street edge), check it against the layout geometry. Fix the **test's probe point** to a cell that is unambiguously inside the feature, and say so in the report. Don't change the layout.

```bash
git add packages/engine
git commit -m "feat(engine): Taman Kyra township — terrain, network, storms, interventions, tailwater" -m "Network from data/synthetic/taman_kyra_assets.json by Tay Zheheng; layout from TownshipEnvironment.tsx by TEH JIA JIE; storms and tailwater cases from the team bootstrap."
```

---

### Task 3: Keep the legacy UI running on Taman Kyra

**Files:**
- Modify:
  - `apps/legacy/src/ui/catalog.ts`, `apps/legacy/src/ui/effects.ts`, `apps/legacy/src/ui/assumptions.ts`, `apps/legacy/src/ui/controls.ts`, `apps/legacy/src/ui/liveMode.ts`;
  - `apps/legacy/src/render/trees.ts`, `apps/legacy/src/render/skirt.ts`, `apps/legacy/src/render/scene.ts`;
  - `apps/legacy/index.html`;
  - `apps/legacy/tests/ui/catalog.test.ts`, `apps/legacy/tests/ui/selection.test.ts`, `apps/legacy/tests/ui/effects.test.ts`, `apps/legacy/tests/ui/runner.test.ts`, `apps/legacy/tests/render/ground.test.ts`.

**Interfaces:**
- Consumes (Task 2): `nodeSite`, `LAYOUT`, `toLocal`, `TANK`, `TAILWATER`, `DEFAULT_STORM`, `STORMS[...].peakMinute`, and the new `InterventionId`s.

- [ ] **Step 1: Catalog**

In `apps/legacy/src/ui/catalog.ts`:
- replace the config import with:

  ```ts
  import { TANK } from '@floodops/engine/scenario/config';
  import { LAYOUT, toLocal } from '@floodops/engine/scenario/layout';
  import { nodeSite } from '@floodops/engine/scenario/network';
  ```

- delete the `nodeSite`/`OUTFALL` helpers;
- replace `DISPLAY` and `COMBOS` with:

```ts
const OUT01 = nodeSite('NODE-OUT01');

export const DISPLAY: Record<InterventionId, InterventionDisplay> = {
  'desilt-d07': { label: 'Desilt grate D07', short: 'desilt D07', icon: '🧹', group: 'Get water into the drains', site: nodeSite('NODE-J07') },
  'upsize-p07': { label: 'Bigger pipe P07 (Ø750)', short: 'upsize P07', icon: '⬇️', group: 'Move water out faster', site: (() => { const a = nodeSite('NODE-J07'); const b = nodeSite('NODE-J08'); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; })() },
  'flap-gate': { label: 'One-way valve at the outfall', short: 'valve', icon: '🚪', group: 'Stop the river coming back', site: OUT01 },
  'storage-tank': { label: 'Underground storage tank', short: 'tank', icon: '🛢️', group: 'Store water for later', site: toLocal(TANK.x, TANK.y) },
  'lake-overflow': { label: 'Overflow to Maple Grove pond', short: 'lake overflow', icon: '↪️', group: 'Store water for later', site: toLocal(LAYOUT.lake.x, LAYOUT.lake.y) },
  pump: { label: 'Pump station at J08', short: 'pump', icon: '⚡', group: 'Move water out faster', site: nodeSite('NODE-J08') },
};

export const COMBOS: Combo[] = [
  { label: 'Combined desilt + upsize', hint: 'team option 3', ids: ['desilt-d07', 'upsize-p07'] },
  { label: 'High-river defence', hint: 'valve + pump', ids: ['flap-gate', 'pump'] },
];
```

- [ ] **Step 2: Effects loader (tailwater level)**

Replace the body of `apps/legacy/src/ui/effects.ts` with:

```ts
import data from '@floodops/engine/scenario/effects.json';
import type { TailwaterCase } from '@floodops/engine/scenario/config';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import type { StormId } from '@floodops/engine/scenario/storms';

export interface Effect {
  dSag: number;
  dHomes: number;
}

const table = data as unknown as Partial<Record<string, Partial<Record<string, Partial<Record<string, Effect>>>>>>;

/** Pre-computed change vs baseline (from `npm run effects`), or null if missing. */
export function effectOf(storm: StormId, id: InterventionId, tailwater: TailwaterCase = 'normal'): Effect | null {
  const e = table[tailwater]?.[storm]?.[id];
  return e && typeof e.dSag === 'number' ? e : null;
}
```

- [ ] **Step 3: Storm default, live jumps, assumptions**

- **`apps/legacy/src/ui/controls.ts`:** import `DEFAULT_STORM` and select it by default, replacing the `'100yr'` literal with `DEFAULT_STORM`.
- **`apps/legacy/index.html`:** change the three live seek buttons to `data-seek="start"`, `data-seek="peak"` and `data-seek="end"`, with the labels unchanged.
- **`apps/legacy/src/ui/liveMode.ts`:** in the seek click handler, replace `const minute = Number(btn.dataset.seek);` with:

```ts
    const storm = STORMS[o.storm()];
    const minute = btn.dataset.seek === 'peak' ? storm.peakMinute : btn.dataset.seek === 'end' ? (storm.intensity.length * storm.blockS) / 60 : 0;
```

  and add `import { STORMS } from '@floodops/engine/scenario/storms';` if it isn't already imported.
- **`apps/legacy/src/ui/assumptions.ts`:**
  - import `TAILWATER` instead of `RIVER_STAGE`;
  - replace the `River stage` row with `['Canal level (tailwater)', \`normal ${TAILWATER.normal} m · high ${TAILWATER.high} m (constant)\`]`;
  - add three rows before `Costs`:

```ts
    ['Town', 'Taman Kyra synthetic zone: drainage network by Tay Zheheng (data/synthetic/taman_kyra_assets.json), street/house layout by TEH JIA JIE (TownshipEnvironment.tsx). Grid-local metres = team datum − (−80, −140).'],
    ['Grate D07', 'Baseline 40% blocked (team demo_inlet_40pct); grate edge = 4·√area·(1 − blockage).'],
    ['SWMM cross-check', 'Pipe peaks compared with EPA SWMM 5.2.4 runs by Tay Zheheng — see docs/swmm-crosscheck.md.'],
```

- [ ] **Step 4: Rendering adjustments**

- **`apps/legacy/src/render/trees.ts`:**
  - remove the classic config import (`BIOSWALE`, `BOULEVARD_I`, `POND`, `TANK`) and the tank/pond exclusion line;
  - replace `treeCellAllowed` with this version, keeping `NODE_CLEARANCE_M` and the rest:

```ts
const ROAD_BAND_CELLS = 4; // 8 m at dx = 2

/** Park cells, or lawn within ~8 m of a road (street trees). */
export function treeCellAllowed(grid: Grid, c: number): boolean {
  const land = grid.land[c];
  if (land === LandUse.PARK) return !isBioswale(grid, c);
  if (land !== LandUse.LAWN) return false;
  const i = c % grid.nx;
  const j = Math.floor(c / grid.nx);
  for (let dj = -ROAD_BAND_CELLS; dj <= ROAD_BAND_CELLS; dj++) {
    for (let di = -ROAD_BAND_CELLS; di <= ROAD_BAND_CELLS; di++) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= grid.nx || jj >= grid.ny) continue;
      if (grid.land[jj * grid.nx + ii] === LandUse.ROAD) return true;
    }
  }
  return false;
}
```

- **`apps/legacy/src/render/groundTexture.ts`:** the grid is no longer square (125 × 145), so `paintGround` must scale each axis separately:
  - replace `const s = size / nx;` with `const sx = size / nx; const sy = size / ny;`;
  - set `px(i) = i * sx` and `py(j) = (ny - 1 - j) * sy`;
  - every `fillRect` uses width `sx` (+0.5 where it was `s + 0.5`) and height `sy` (+0.5 likewise);
  - the lot-shadow offset is `Math.max(1, sx * 0.15)`;
  - in `edges`, the vertical border segment spans `sy`, the horizontal one spans `sx`, and `ctx.lineWidth = Math.max(1, Math.min(sx, sy) * 0.12)`.

  The canvas stays `size × size`; the UVs already map v to `(j + 0.5) / ny`.
- **`apps/legacy/src/render/skirt.ts`:** replace the constant `BASE_ELEV = -4` with a per-grid base. In the constructor compute `let minZ = Infinity; for (const v of z) minZ = Math.min(minZ, v); const base = worldY(minZ - 2);`, and use `base` where `worldY(BASE_ELEV)` was used.
- **`apps/legacy/src/render/scene.ts`:**
  - replace `const SITE_SIZE = 512;` with a value computed from the first township: pass `Math.max(t.grid.nx, t.grid.ny) * t.grid.dx` (290) to the camera rig.
  - Minimal approach: keep the constant but set it to `290`, with the comment `// Taman Kyra grid: 145 cells × 2 m`.
  - Set the initial camera so the whole site is framed. Change the `CameraRig` saved pose to `pos (-80, 230, 300)`, `target (0, 40, 0)` in `cameras.ts`. Elevations are ~10–12 m × VERT 4 ≈ 40–48 world units.

- [ ] **Step 5: Tests**

**`apps/legacy/tests/ui/catalog.test.ts`:**
- change the combos expectation to `[['desilt-d07', 'upsize-p07'], ['flap-gate', 'pump']]`;
- replace the "places node-based pins" test with:

```ts
  it('places node-based pins on their manholes', () => {
    const nodes = new Map(baseTownship().network.nodes.map((n) => [n.id, n]));
    for (const [id, node] of [['flap-gate', 'NODE-OUT01'], ['desilt-d07', 'NODE-J07'], ['pump', 'NODE-J08']] as const) {
      expect(DISPLAY[id].site).toEqual({ x: nodes.get(node)!.x, y: nodes.get(node)!.y });
    }
  });
```

**`apps/legacy/tests/ui/selection.test.ts`:**
- map the IDs: `'detention-tank'` → `'storage-tank'`, `'upsize-trunk'` → `'upsize-p07'`, `'relief-pond'` → `'lake-overflow'`;
- the expected `state.interventions` order follows `INTERVENTIONS`: `['desilt-d07', 'upsize-p07', 'flap-gate', 'storage-tank', 'lake-overflow', 'pump']`. So the "orders interventions" test expects `['upsize-p07', 'pump']` for `pump` then `upsize-p07`, and the combo test expects `['flap-gate', 'storage-tank']`;
- for `activePipes`, replace `{ from: 'S3', to: 'P' }` with `{ from: 'NODE-J04', to: 'LK' }` (active only with `lake-overflow`), and `{ from: 'SL0', to: 'O' }` with `{ from: 'NODE-J06', to: 'NODE-J08' }`. The second-case intervention is `['lake-overflow']`.
- the label test expects `['+ valve', '− valve']`, unchanged.

**`apps/legacy/tests/ui/effects.test.ts`:** replace with:

```ts
import { describe, expect, it } from 'vitest';
import type { StormId } from '@floodops/engine/scenario/storms';
import { effectOf } from '../../src/ui/effects';

describe('effectOf', () => {
  it('returns null for unknown storms or tailwater instead of crashing', () => {
    expect(effectOf('500yr' as StormId, 'pump')).toBeNull();
    expect(effectOf('synthetic_80mmh_60min', 'pump', 'flood' as never)).toBeNull();
  });
  it('returns finite numbers whenever an entry exists', () => {
    const e = effectOf('synthetic_80mmh_60min', 'desilt-d07');
    if (e) {
      expect(Number.isFinite(e.dSag)).toBe(true);
      expect(Number.isInteger(e.dHomes)).toBe(true);
    }
  });
});
```

**`apps/legacy/tests/ui/runner.test.ts`:**
- replace storm `'100yr'` with `'synthetic_80mmh_60min'` and `'10yr'` with `'synthetic_120mmh_60min'`. The fake worker ignores storms.
- in the LRU test, use seven distinct keys:

```ts
    const keys: Array<[InterventionId[], StormId]> = [
      [['desilt-d07'], 'synthetic_80mmh_60min'], [['upsize-p07'], 'synthetic_80mmh_60min'], [['flap-gate'], 'synthetic_80mmh_60min'],
      [['storage-tank'], 'synthetic_80mmh_60min'], [['lake-overflow'], 'synthetic_80mmh_60min'], [['pump'], 'synthetic_80mmh_60min'],
      [['pump'], 'synthetic_120mmh_60min'],
    ];
    for (const [ids, s] of keys) await runner.run(ids, s);
    expect(keys.length).toBe(MAX_CACHE + 1);
    expect(runner.isCached(keys[0][0], keys[0][1])).toBe(false);
    expect(runner.isCached(keys[6][0], keys[6][1])).toBe(true);
```

  and add the type imports `InterventionId` (`@floodops/engine/scenario/interventions`) and `StormId` (`@floodops/engine/scenario/storms`).

**`apps/legacy/tests/render/ground.test.ts`:**
- remove the `BIOSWALE` import and the bioswale-row tree assertion;
- in "detects bioswale cells only when the preset is applied", assert only that the base town has 0 bioswale cells (rename it "has no bioswale cells");
- change "places TREE_COUNT trees" to expect `a.length` to be `> 100` and `≤ TREE_COUNT`. Keep the determinism, allowed-cell and node-clearance assertions.

- [ ] **Step 6: Verify and commit**

Run:
```bash
npm test
npm -w legacy run typecheck
npm -w legacy run build
rm -rf apps/legacy/dist
```
Expected: all pass. The total test count is reported: engine plus legacy.

```bash
git add apps/legacy
git commit -m "feat(legacy): run the legacy UI on the Taman Kyra township"
```

---

### Task 4: Tune the demo story

**Files:**
- Modify (tuning only): `packages/engine/src/scenario/config.ts`
- Create: `docs/tuning.md` (rewrite)

- [ ] **Step 1: Baseline numbers**

Update `packages/engine/scripts/tune.ts` so it prints, for storm `synthetic_80mmh_60min`, one row per scenario:
- **Scenarios:** baseline, each single intervention, combined (desilt + upsize), and the high-tailwater baseline, flap and pump.
- **Columns:** J07 peak depth (`peakSagDepth`), homes flooded, flooded road area, P07 max load (computed from frames as in the story test), balance %, and runtime.

Use `console.table`, then run it:

Run: `npm run tune`

- [ ] **Step 2: Tune until `npm run story` passes, within these bounds**

Allowed tunables, all in `config.ts`, one at a time:

| Tunable | Range |
|---|---|
| `DIP.depth` | 0.2–1.0 m |
| `DIP.radius` | 15–45 m |
| `INLET_SUMP` | 0.05–0.25 |
| `LAKE.bedZ`, `LAKE.waterLevel` | `waterLevel` stays < 10.0 |
| `CANAL.bedZ` | 7.0–8.2 |
| `TANK` (position, area, depth, feed diameter, outflow diameter) | diameters 0.15–1.2 m |
| `PUMP.rate` | 0.2–1.5 m³/s |
| `LAKE_OVERFLOW.diameter` | 0.3–0.9 m |
| `HOUSE` | footprint ±20% |

Not allowed:
- edits to `src/sim/`;
- edits to asset values;
- weakening the story test's thresholds.

If a claim can't be reached:
1. Remove that single `it(...)` from `tests/story.test.ts`.
2. Explain why in `docs/tuning.md`.
3. Keep the rest.

Commands: `npm run story` takes several minutes; use the slow suite. Running only the story test is fine: `npm -w @floodops/engine exec vitest run tests/story.test.ts`.

- [ ] **Step 3: Record**

Rewrite `docs/tuning.md` for Taman Kyra, with:
- the final `npm run tune` table;
- every config value changed from Task 2's defaults (old → new, and why);
- an iteration log;
- the per-run runtime;
- any story claims dropped.

- [ ] **Step 4: Verify and commit**

Run: `npm test` (fast) and `npm -w @floodops/engine exec vitest run tests/story.test.ts`
Expected: both pass.

```bash
git add packages/engine/src/scenario/config.ts packages/engine/scripts/tune.ts packages/engine/tests/story.test.ts docs/tuning.md
git commit -m "chore(engine): tune the Taman Kyra demo story"
```

---

### Task 5: SWMM cross-check

**Files:**
- Create: `packages/engine/tests/swmm.crosscheck.test.ts`, `docs/swmm-crosscheck.md` (written by the test)
- Modify: `packages/engine/package.json` (`test` excludes the cross-check; `story` includes it), `packages/engine/src/scenario/config.ts` (only if tuning within the Task 4 bounds is needed)

- [ ] **Step 1: The test**

Create `packages/engine/tests/swmm.crosscheck.test.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import swmm from '../../../data/validation/t1/baseline/frames.json';
import { buildScenario } from '../src/scenario/index';
import { runSimulation } from '../src/sim/engine';
import { createNetworkState } from '../src/sim/pipes';

/** Set false (report-only) only if ±30% / 10 min is unreachable within the documented tunables; record why in docs/tuning.md. */
const ENFORCED = true;
const TRUNK = ['PIPE-P03', 'PIPE-P05', 'PIPE-P07', 'PIPE-P08'];
const TOL_FLOW = 0.3;
const TOL_TIME_S = 600;

interface SwmmFrames { frames: Array<{ timestamp_s: number; pipe_states: Array<{ conduit_id: string; flow_m3s: number }> }> }

describe('cross-check vs EPA SWMM 5.2.4 (run by Tay Zheheng, data/validation/t1/baseline)', () => {
  it('trunk pipe peaks agree within ±30% and 10 min', () => {
    // Same storm, D07 clean (SWMM T1 routes runoff without inlet restriction), normal tailwater.
    const sc = buildScenario([], 'synthetic_80mmh_60min', [], { blockage: {}, tailwater: 'normal' });
    const { frames } = runSimulation(sc);
    const qFull = createNetworkState(sc.network).qFull;

    const ours = new Map<string, { peak: number; t: number }>();
    sc.network.pipes.forEach((p, k) => {
      let peak = 0;
      let t = 0;
      for (const f of frames) {
        const q = f.pipeLoad[k] * qFull[k];
        if (q > peak) {
          peak = q;
          t = f.t;
        }
      }
      ours.set(p.id, { peak, t });
    });
    const ref = new Map<string, { peak: number; t: number }>();
    for (const fr of (swmm as unknown as SwmmFrames).frames) {
      for (const ps of fr.pipe_states) {
        const cur = ref.get(ps.conduit_id) ?? { peak: 0, t: 0 };
        if (ps.flow_m3s > cur.peak) ref.set(ps.conduit_id, { peak: ps.flow_m3s, t: fr.timestamp_s });
        else if (!ref.has(ps.conduit_id)) ref.set(ps.conduit_id, cur);
      }
    }

    const rows = [...ref.keys()].sort().map((id) => {
      const r = ref.get(id)!;
      const o = ours.get(id) ?? { peak: 0, t: 0 };
      const diff = r.peak > 0 ? (o.peak - r.peak) / r.peak : 0;
      return { id, swmm: r.peak, ours: o.peak, diff, dt: o.t - r.t };
    });
    const fmt = (v: number) => v.toFixed(3);
    const md = [
      '# Cross-check: TypeScript engine vs EPA SWMM 5.2.4',
      '',
      'Reference: `data/validation/t1/baseline/frames.json`, an EPA SWMM 5.2.4 run by **Tay Zheheng** on the same Taman Kyra network (constant 80 mm/h for 60 min, normal tailwater, unrestricted inlets).',
      'Ours: same storm and network, INLET-D07 clean, normal tailwater. Generated by `packages/engine/tests/swmm.crosscheck.test.ts`.',
      '',
      `Status: ${ENFORCED ? `enforced — trunk pipes ${TRUNK.join(', ')} within ±${TOL_FLOW * 100}% peak flow and ±${TOL_TIME_S / 60} min peak time` : 'report-only (see docs/tuning.md)'}.`,
      '',
      '| Pipe | SWMM peak (m³/s) | Engine peak (m³/s) | Difference | Peak time difference (min) |',
      '|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.id} | ${fmt(r.swmm)} | ${fmt(r.ours)} | ${(r.diff * 100).toFixed(1)}% | ${(r.dt / 60).toFixed(1)} |`),
      '',
      '**Why they differ:**',
      '- SWMM T1 routes catchment runoff directly into the manholes. The engine routes rain over a 2D surface into capacity-limited grates (only 4 grates exist), so some water bypasses the network.',
      '- SWMM uses dynamic-wave pressure flow. The engine caps each pipe at its full-bore Manning capacity.',
      '- The engine rains on the whole 7.3 ha grid. SWMM uses four 1 ha catchments.',
      '',
    ].join('\n');
    writeFileSync(new URL('../../../docs/swmm-crosscheck.md', import.meta.url), md);

    if (ENFORCED) {
      for (const id of TRUNK) {
        const r = rows.find((x) => x.id === id)!;
        expect(Math.abs(r.diff), `${id} peak flow`).toBeLessThanOrEqual(TOL_FLOW);
        expect(Math.abs(r.dt), `${id} peak time`).toBeLessThanOrEqual(TOL_TIME_S);
      }
    }
  }, 1_200_000);
});
```

In `packages/engine/package.json`:
- change `test` to `vitest run --exclude tests/story.test.ts --exclude tests/effects.drift.test.ts --exclude tests/swmm.crosscheck.test.ts`;
- change `story` to `vitest run tests/story.test.ts tests/effects.drift.test.ts tests/swmm.crosscheck.test.ts`.

- [ ] **Step 2: Run, then tune or downgrade**

Run: `npm -w @floodops/engine exec vitest run tests/swmm.crosscheck.test.ts`

If it fails:
1. Tune only within the Task 4 bounds, plus `WEIR_C` is **not** allowed (it's in `src/sim/coupling.ts`).
2. After **every** change, re-run `npm -w @floodops/engine exec vitest run tests/story.test.ts`, which must stay green.
3. If ±30% / 10 min still can't be met, set `ENFORCED = false` and add a "SWMM cross-check" section to `docs/tuning.md` with the table and the reason.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/tests/swmm.crosscheck.test.ts packages/engine/package.json docs/swmm-crosscheck.md docs/tuning.md packages/engine/src/scenario/config.ts
git commit -m "test(engine): cross-check trunk pipe peaks against EPA SWMM" -m "Reference results: EPA SWMM 5.2.4 run by Tay Zheheng (data/validation/t1/baseline)."
```

---

### Task 6: Effect badges for Taman Kyra

**Files:**
- Modify: `packages/engine/scripts/computeEffects.ts`, `packages/engine/tests/effects.drift.test.ts`, `packages/engine/src/scenario/effects.json` (regenerated), `apps/legacy/tests/ui/effects.test.ts`

- [ ] **Step 1: Compute the matrix**

Replace `packages/engine/scripts/computeEffects.ts` with:

```ts
import type { TailwaterCase } from '../src/scenario/config';
import { buildScenario } from '../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../src/scenario/interventions';
import { STORMS, type StormId } from '../src/scenario/storms';
import { runSimulation } from '../src/sim/engine';

type Cell = { dSag: number; dHomes: number };
export type Effects = Record<TailwaterCase, Partial<Record<StormId, Partial<Record<InterventionId, Cell>>>>>;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Which (tailwater, storm, interventions) cells get a badge. */
export const EFFECT_MATRIX: Array<{ tailwater: TailwaterCase; storms: StormId[]; ids: InterventionId[] }> = [
  { tailwater: 'normal', storms: Object.keys(STORMS) as StormId[], ids: INTERVENTIONS.map((i) => i.id) },
  { tailwater: 'high', storms: ['synthetic_80mmh_60min', 'synthetic_120mmh_60min'], ids: ['flap-gate', 'pump'] },
];

/** Baseline + single-intervention runs for every matrix cell; returns the change vs that cell's baseline. */
export function computeEffects(log: (line: string) => void = () => {}): Effects {
  const out: Effects = { normal: {}, high: {} };
  for (const block of EFFECT_MATRIX) {
    for (const storm of block.storms) {
      const base = runSimulation(buildScenario([], storm, [], { tailwater: block.tailwater })).metrics;
      log(`${block.tailwater} ${storm} baseline: J07 ${base.peakSagDepth.toFixed(3)} m, homes ${base.homesFlooded}`);
      const row: Partial<Record<InterventionId, Cell>> = {};
      for (const id of block.ids) {
        const m = runSimulation(buildScenario([id], storm, [], { tailwater: block.tailwater })).metrics;
        row[id] = { dSag: round3(m.peakSagDepth - base.peakSagDepth), dHomes: m.homesFlooded - base.homesFlooded };
        log(`${block.tailwater} ${storm} ${id}: dSag ${row[id]!.dSag}, dHomes ${row[id]!.dHomes}`);
      }
      out[block.tailwater][storm] = row;
    }
  }
  return out;
}
```

Replace the body of `packages/engine/tests/effects.drift.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { computeEffects } from '../scripts/computeEffects';
import stored from '../src/scenario/effects.json';

type Table = Record<string, Record<string, Record<string, { dSag: number; dHomes: number }>>>;

describe('pre-computed intervention effects', () => {
  it('still match the live model (re-run `npm run effects` after retuning)', () => {
    const fresh = computeEffects() as unknown as Table;
    const saved = stored as unknown as Table;
    for (const [tw, storms] of Object.entries(fresh)) {
      for (const [storm, row] of Object.entries(storms)) {
        for (const [id, e] of Object.entries(row)) {
          expect(Math.abs(saved[tw][storm][id].dSag - e.dSag), `${tw} ${storm} ${id} dSag`).toBeLessThanOrEqual(0.005);
          expect(saved[tw][storm][id].dHomes, `${tw} ${storm} ${id} dHomes`).toBe(e.dHomes);
        }
      }
    }
  }, 3_000_000);
});
```

- [ ] **Step 2: Regenerate**

Run `npm run effects` in the background. It does 4 × 7 + 2 × 3 = 34 runs; expect several minutes per storm. Wait for `Wrote src/scenario/effects.json`.

Check: the JSON has the top-level keys `normal` and `high`. `normal.synthetic_80mmh_60min` has all 6 intervention IDs, and `high.synthetic_80mmh_60min` has `flap-gate` and `pump`. The signs agree with the story: `desilt-d07` and `upsize-p07` have negative `dSag` at 80 mm/h normal.

- [ ] **Step 3: Strengthen the legacy loader test**

In `apps/legacy/tests/ui/effects.test.ts`, add:

```ts
  it('has badges for every intervention on the default storm', () => {
    for (const id of ['desilt-d07', 'upsize-p07', 'flap-gate', 'storage-tank', 'lake-overflow', 'pump'] as const) {
      expect(effectOf('synthetic_80mmh_60min', id)).not.toBeNull();
    }
    expect(effectOf('synthetic_80mmh_60min', 'flap-gate', 'high')).not.toBeNull();
  });
```

- [ ] **Step 4: Verify and commit**

Run: `npm test`
Expected: passes.

Run `npm -w @floodops/engine exec vitest run tests/effects.drift.test.ts` in the background.
Expected: PASS.

```bash
git add packages/engine/scripts/computeEffects.ts packages/engine/tests/effects.drift.test.ts packages/engine/src/scenario/effects.json apps/legacy/tests/ui/effects.test.ts
git commit -m "feat(engine): Taman Kyra effect badges with tailwater cases"
```
