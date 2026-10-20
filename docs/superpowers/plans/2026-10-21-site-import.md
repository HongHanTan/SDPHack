# Site Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** generate the simulated township from an uploaded SWMM `.inp`, an optional GIS `.geojson` layout and an optional `.asc` height file, to scale. Regenerate it when the files change, and ship a synthetic sample package that reproduces today's Taman Kyra.

**Architecture:**
- **Engine side:**
  - A plain, cloneable `SiteSpec` replaces the module-level Taman Kyra constants in the terrain, network, catchment and scenario builders.
  - `TAMAN_KYRA` is the default site, so existing behaviour is unchanged.
  - Pure importers (`packages/engine/src/import/`) parse and validate the files into a `SiteSpec` plus an import report.
- **Web side:**
  - Engine mode holds an active site.
  - The site goes to the workers inside the existing `opts`.
  - A data-driven `SiteEnvironment` renders imported sites using Jiajie's exported scene components.
  - An import panel handles picking, reports, applying, resetting and watching the files.

**Tech Stack:** TypeScript, Vitest 2, React 19, @react-three/fiber 9, drei 10, three 0.170, File System Access API (Chrome/Edge; with a fallback).

## Global Constraints

**Spec:** `docs/superpowers/specs/2026-10-21-site-import-design.md`. The values below are copied from it.

**Behaviour:**
- **Deterministic:** parsing and geometry only, with no LLM. Every default appears as an **assumption** in the import report. **Errors** block generation; **warnings** don't.
- **To scale:** all files share one projected metric coordinate system. The importer only **translates**: x/y so the grid centre lands on the built-in centre (team x 45, y 5), and z so the median *junction* ground equals the built-in median junction ground. It never scales.
- Coordinates where all |x| ≤ 180 and |y| ≤ 90 are an error: "export in the same projected metric CRS as the SWMM model".
- **Grid:**
  - The `.asc` grid when given; otherwise the feature bounding box plus a **30 m** margin at **dx = 2 m**.
  - Coarsen by an integer factor to keep **≤ 40,000 cells**.
- **Defaults:**
  - grate **0.6 m²** at each subcatchment outlet when there are no inlet points;
  - hotspot = the lowest-ground junction;
  - tailwater normal = FIXED stage or outfall invert, high = normal + **1.2 m**;
  - Tay's capture curve, catchment lag **60 s**;
  - outfall max depth **2.0 m**;
  - a **10 × 10 m** outfall sink when no river is near an outfall;
  - road width **8 m**;
  - pond bed = median ground − **2.4 m**, water level = bed + **0.6 m**;
  - river bed = lowest outfall invert − **0.6 m**.
- **Built-in Taman Kyra stays identical:** the existing engine, legacy and web tests pass unchanged; Jiajie's `TownshipEnvironment`, the dashboard and interventions are unchanged for the built-in site. Interventions on an imported site throw an error.
- **Sample package** (`data/samples/taman_kyra_site/`): coordinates = team metres + **(412000, 336000)**, labelled "illustrative projected coordinates, not a real location".
- Files are read in the browser only. Nothing is uploaded or stored.
- **Watch for changes:** poll `lastModified` every **1.5 s** (File System Access handles). On invalid changes, keep the current city and show the errors.

**Process:**
- Commits by the user only. NEVER add `Co-Authored-By` or any co-author line. Do not push. Never stage `md/progress/honghan.md`.
- Credit in commit bodies where relevant:
  - "Sample network from Tay Zheheng's illustrative SWMM model (models/illustrative_taman_kyra)."
  - "Sample layout from TEH JIA JIE's scene layout."
  - "TownshipEnvironment/SceneViewer/InterventionDashboard/SimulationHUD by TEH JIA JIE; imported-site branches only."
- **Verify with:**
  - `npm -w @floodops/engine test`
  - `npm -w @floodops/engine run typecheck`
  - `npm -w township-floodops-web test`
  - `npm -w township-floodops-web run build` (check the exit code)
  - `npm -w legacy run build`
  - root `npm test`

  Delete the `dist` folders afterwards.

---

### Task 1: Engine site abstraction (behaviour-identical refactor)

**Files:**
- Create: `packages/engine/src/scenario/site.ts`, `packages/engine/tests/scenario/site.test.ts`
- Modify:
  - `packages/engine/src/scenario/terrain.ts`
  - `packages/engine/src/scenario/network.ts`
  - `packages/engine/src/scenario/catchments.ts`
  - `packages/engine/src/scenario/index.ts`

**Interfaces:**
- Produces:
  - `site.ts`:
    - types `SiteSpec`, `SitePond`, `SiteRiver`, `SiteSubcatchment`, `SiteLayout`, `SiteHouse`;
    - `TAMAN_KYRA: SiteSpec`;
    - `siteToLocal(site, x, y)`, `siteToTeam(site, x, y)`;
    - `cellIn(g: { nx; ny; dx }, x, y): number`;
    - `medianJunctionGround(assets): number`.
  - `buildTerrain(site = TAMAN_KYRA): Grid`
  - `buildNetwork(grid, blockage = {}, site = TAMAN_KYRA): Network`
  - `buildCatchments(grid, blockage = {}, site = TAMAN_KYRA): Catchment[]`
  - `baseTownship(blockage?, site = TAMAN_KYRA)`
  - `hotspotCell(site = TAMAN_KYRA)`
  - `ScenarioOptions.site?: SiteSpec`
  - `scenarioKey` starts with `site.key`.
  - `cellAt(x, y)` stays (Taman Kyra grid) for the legacy app.

- [ ] **Step 1: Failing test.** Create `packages/engine/tests/scenario/site.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baseTownship, buildScenario, hotspotCell, scenarioKey } from '../../src/scenario/index';
import { cellIn, medianJunctionGround, siteToLocal, siteToTeam, TAMAN_KYRA, type SiteSpec } from '../../src/scenario/site';
import { GRID } from '../../src/scenario/config';
import { ASSETS } from '../../src/scenario/layout';

describe('site abstraction', () => {
  it('describes the built-in township', () => {
    expect(TAMAN_KYRA.builtIn).toBe(true);
    expect(TAMAN_KYRA.gridSpec).toEqual(GRID);
    expect(TAMAN_KYRA.hotspotNodeId).toBe('NODE-J07');
    expect(TAMAN_KYRA.focusInletId).toBe('INLET-D07');
    expect(TAMAN_KYRA.tailwater).toEqual({ normal: 8.2, high: 9.4 });
    expect(TAMAN_KYRA.ponds).toHaveLength(1);
    expect(TAMAN_KYRA.rivers[0]).toMatchObject({ cx: 40, cy: -90, length: 75, angleDeg: 90 });
    expect(medianJunctionGround(ASSETS)).toBeCloseTo(11.65, 6);
  });
  it('converts coordinates and cells with the site datum and grid', () => {
    expect(siteToLocal(TAMAN_KYRA, 40, 0)).toEqual({ x: 120, y: 140 });
    expect(siteToTeam(TAMAN_KYRA, 120, 140)).toEqual({ x: 40, y: 0 });
    expect(cellIn(GRID, 1, 1)).toBe(0);
    expect(cellIn(GRID, 1e9, 1e9)).toBe(GRID.nx * GRID.ny - 1);
  });
  it('defaults every builder to the built-in site', () => {
    expect(baseTownship(undefined, TAMAN_KYRA)).toBe(baseTownship());
    expect(hotspotCell(TAMAN_KYRA)).toBe(hotspotCell());
    expect(scenarioKey([], 'synthetic_80mmh_60min').startsWith('taman-kyra|')).toBe(true);
  });
  it('refuses interventions on an imported site', () => {
    const imported: SiteSpec = { ...TAMAN_KYRA, key: 'import-test', builtIn: false };
    expect(() => buildScenario(['upsize-p07'], 'synthetic_80mmh_60min', [], { site: imported })).toThrow(/built-in township/);
    expect(buildScenario([], 'synthetic_80mmh_60min', [], { site: imported }).grid.nx).toBe(GRID.nx);
  });
});
```

Run `npm -w @floodops/engine exec vitest run tests/scenario/site.test.ts`. It should FAIL with the module not found.

- [ ] **Step 2: Create `packages/engine/src/scenario/site.ts`**

```ts
import hydrology from '../../../../models/illustrative_taman_kyra/hydrology.json';
import capture from '../../../../models/illustrative_taman_kyra/inlet_capture.json';
import { CANAL, DATUM, DIP, GRID, LAKE, TAILWATER } from './config';
import { ASSETS, LAYOUT, type Assets, type LayoutHouse, type RoadCircle, type RoadStraight } from './layout';

/** A house footprint; width/depth (m) override HOUSE × scale when given (imported buildings). */
export type SiteHouse = LayoutHouse & { width?: number; depth?: number } & Record<string, unknown>;
export interface SiteLayout {
  roads: Array<RoadStraight | RoadCircle>;
  houses: SiteHouse[];
  trees: Array<{ x: number; y: number; scale: number }>;
}
export interface SitePond { id: string; x: number; y: number; radius: number; bedZ: number; waterLevel: number }
/** A straight river/canal reach: rectangle centred at (cx, cy), `length` along angleDeg (from east). */
export interface SiteRiver { id: string; cx: number; cy: number; length: number; width: number; angleDeg: number; bedZ: number }
export interface SiteSubcatchment { id: string; outletNodeId: string; areaHa: number; imperviousPercent: number; polygon?: Array<[number, number]> }

/** Everything the engine needs to build a township. Plain data (structured-cloneable) so it can be posted to workers. */
export interface SiteSpec {
  /** Cache key; changes whenever any source content changes. */
  key: string;
  label: string;
  /** Built-in Taman Kyra: interventions and the precomputed dashboard are available. */
  builtIn: boolean;
  /** Team metres → grid-local metres: local = team − datum. */
  datum: { x0: number; y0: number };
  gridSpec: { nx: number; ny: number; dx: number };
  /** Drainage assets in team metres (Tay's asset format). */
  assets: Assets;
  layout: SiteLayout;
  ponds: SitePond[];
  rivers: SiteRiver[];
  subcatchments: SiteSubcatchment[];
  captureCurve: Array<[number, number]>;
  /** Surveyed ground per grid cell (row-major, j = north index); when present the terrain uses it as-is. */
  ground?: Float32Array;
  /** Optional shallow bowl at a node (built-in J07 dip). */
  dip?: { nodeId: string; radius: number; depth: number };
  hotspotNodeId: string;
  /** Inlet the debris selector blocks. */
  focusInletId: string | null;
  tailwater: { normal: number; high: number };
  /** File coordinates − team coordinates (display only). */
  shift: { dx: number; dy: number; dz: number };
}

interface HydroSub { subcatchment_id: string; outlet_node_id: string; area_ha: number; impervious_percent: number }

export function medianJunctionGround(assets: Assets): number {
  const g = assets.nodes.filter((n) => n.node_type === 'junction').map((n) => n.ground_elevation_m).sort((a, b) => a - b);
  const m = g.length >> 1;
  return g.length % 2 ? g[m] : (g[m - 1] + g[m]) / 2;
}

export const TAMAN_KYRA: SiteSpec = {
  key: 'taman-kyra',
  label: 'Taman Kyra (built-in)',
  builtIn: true,
  datum: { ...DATUM },
  gridSpec: { ...GRID },
  assets: ASSETS,
  layout: { roads: LAYOUT.roads, houses: LAYOUT.houses as SiteHouse[], trees: LAYOUT.trees },
  ponds: [{ id: LAYOUT.lake.id, x: LAYOUT.lake.x, y: LAYOUT.lake.y, radius: LAYOUT.lake.radius, bedZ: LAKE.bedZ, waterLevel: LAKE.waterLevel }],
  rivers: [
    {
      id: LAYOUT.canal.id,
      cx: LAYOUT.canal.x,
      cy: (LAYOUT.canal.yFrom + LAYOUT.canal.yTo) / 2,
      length: Math.abs(LAYOUT.canal.yTo - LAYOUT.canal.yFrom),
      width: LAYOUT.canal.width,
      angleDeg: 90,
      bedZ: CANAL.bedZ,
    },
  ],
  subcatchments: (hydrology as unknown as { subcatchments: HydroSub[] }).subcatchments.map((s) => ({
    id: s.subcatchment_id,
    outletNodeId: s.outlet_node_id,
    areaHa: s.area_ha,
    imperviousPercent: s.impervious_percent,
  })),
  captureCurve: (capture as unknown as { capture_curve_m3s: Array<[number, number]> }).capture_curve_m3s,
  dip: { nodeId: 'NODE-J07', radius: DIP.radius, depth: DIP.depth },
  hotspotNodeId: 'NODE-J07',
  focusInletId: 'INLET-D07',
  tailwater: { normal: TAILWATER.normal, high: TAILWATER.high },
  shift: { dx: 0, dy: 0, dz: 0 },
};

export const siteToLocal = (site: SiteSpec, x: number, y: number) => ({ x: x - site.datum.x0, y: y - site.datum.y0 });
export const siteToTeam = (site: SiteSpec, x: number, y: number) => ({ x: x + site.datum.x0, y: y + site.datum.y0 });

/** Cell index for grid-local metres, clamped to the grid. */
export function cellIn(g: { nx: number; ny: number; dx: number }, x: number, y: number): number {
  const i = Math.min(g.nx - 1, Math.max(0, Math.floor(x / g.dx)));
  const j = Math.min(g.ny - 1, Math.max(0, Math.floor(y / g.dx)));
  return j * g.nx + i;
}

/** Local position of a site asset node. */
export function siteNodeLocal(site: SiteSpec, id: string): { x: number; y: number } {
  const nd = site.assets.nodes.find((n) => n.node_id === id);
  if (!nd) throw new Error(`Unknown node ${id}`);
  return siteToLocal(site, nd.position_m.x, nd.position_m.y);
}
```

- [ ] **Step 3: `terrain.ts` → `buildTerrain(site = TAMAN_KYRA)`.**

**Behaviour must be identical for `TAMAN_KYRA`.** Rewrite `buildTerrain` as follows, keeping `cellAt`, `INFIL_BY_LAND` and `inRect`:
- **Grid and imports:**
  - `const { nx, ny, dx } = site.gridSpec;`
  - `import { cellIn, siteNodeLocal, siteToLocal, TAMAN_KYRA, type SiteSpec } from './site';`
  - change `cellAt` to `export function cellAt(x: number, y: number): number { return cellIn(GRID, x, y); }`
- **Plane:** the least-squares plane uses `site.assets.nodes` (ground levels) with `siteToLocal(site, …)`. Only compute it when `!site.ground`.
- **Shapes, in local coordinates:**
  - `funnels` = `site.assets.inlets`;
  - `roads` = `site.layout.roads`;
  - `houses` = `site.layout.houses`;
  - `ponds` = `site.ponds`;
  - `rivers` = `site.rivers` (each with local cx/cy);
  - `dip` = `site.dip ? { ...siteNodeLocal(site, site.dip.nodeId), radius: site.dip.radius, depth: site.dip.depth } : null`.
- **Per-cell order** (the same as today's):

```ts
      const surveyed = site.ground ? site.ground[c] : null;
      let zc = surveyed ?? plane(x, y);
      let lc: number = LandUse.LAWN;
      const river = rivers.find((r) => inRect(x, y, r.x, r.y, r.length, r.width, r.angleDeg));
      if (river) {
        z[c] = surveyed ?? river.bedZ;
        land[c] = LandUse.RIVER;
        continue;
      }
      if (surveyed === null) {
        if (dip) {
          const dd = Math.hypot(x - dip.x, y - dip.y);
          if (dd < dip.radius) zc -= dip.depth * (1 - (dd / dip.radius) ** 2);
        }
        for (const f of funnels) {
          const df = Math.hypot(x - f.x, y - f.y);
          if (df < FUNNEL.radius) zc -= FUNNEL.depth * (1 - (df / FUNNEL.radius) ** 2);
        }
      }
      const pond = ponds.find((p) => Math.hypot(x - p.x, y - p.y) < p.radius + LAKE.parkMargin);
      const dl = pond ? Math.hypot(x - pond.x, y - pond.y) : Infinity;
      if (pond && dl < pond.radius) {
        lc = LandUse.POND;
        if (surveyed === null) zc = pond.bedZ + (zc - pond.bedZ) * (dl / pond.radius) ** 2;
      } else if (pond) {
        lc = LandUse.PARK;
      } else if (roads.some((r) => (r.kind === 'circle' ? Math.hypot(x - r.x, y - r.y) <= r.radius : inRect(x, y, r.x, r.y, r.length, r.width, r.angleDeg)))) {
        lc = LandUse.ROAD;
        if (surveyed === null) zc -= ROAD_DROP;
      } else {
        const h = houses.find((hh) => inRect(x, y, hh.x, hh.y, hh.width ?? HOUSE.width * hh.scale, hh.depth ?? HOUSE.depth * hh.scale, hh.rotationDeg));
        if (h) {
          lc = LandUse.ROOF;
          building[c] = h.k;
        }
      }
      z[c] = zc;
      land[c] = lc;
      if (lc === LandUse.POND) h0[c] = Math.max(0, pond!.waterLevel - zc);
```

- **Inlet sump:** `z[cellIn(site.gridSpec, p.x, p.y)] -= INLET_SUMP` for each site inlet.

The canal is checked first. Taman Kyra has one pond, and its LAKE values are reproduced exactly. The `j07` lookup and the use of `LAYOUT.canal` disappear.

- [ ] **Step 4: `network.ts`.**
  - **`makeNode`:** compute the cell with `cellIn(grid, x, y)` (Grid has nx, ny and dx) instead of `cellAt`.
  - **`nodeSite(id)`:** keep it, implemented as `siteNodeLocal(TAMAN_KYRA, id)`. The legacy app and interventions use it.
  - **`buildNetwork(grid, blockage = {}, site = TAMAN_KYRA)`:** use `site.assets` and `siteToLocal(site, …)` everywhere `ASSETS`/`toLocal` were used.
  - **Outfalls:** replace the single-outfall code with one entry per outfall node:

```ts
  const outfalls = site.assets.nodes
    .filter((a) => a.node_type === 'outfall')
    .map((a) => {
      const node = byId.get(a.node_id)!;
      const into = pipes.find((p) => p.to === node.id);
      if (!into) throw new Error(`Outfall ${node.id} has no incoming pipe`);
      return { node: node.id, riverCell: nearestRiverCell(grid, node.cell), area: (Math.PI * into.diameter ** 2) / 4, flapGate: false };
    });
```

  - **`nearestRiverCell`:** add `export function nearestRiverCell(grid: Grid, cell: number): number`.
    - Return `cell` if `grid.land[cell] === LandUse.RIVER`.
    - Otherwise return the RIVER cell with the smallest Euclidean cell distance; ties go to the lower index.
    - Throw `Error('No river cell for outfall')` if there are none.

For Taman Kyra, OUT01's cell is already river, so the result is identical.

- [ ] **Step 5: `catchments.ts` → `buildCatchments(grid, blockage = {}, site = TAMAN_KYRA)`.**
  - Read `site.subcatchments` instead of `hydrology`, and `site.captureCurve` instead of `capture`. Look up `captureLoss` through `site.assets.inlets`.
  - Find outlet sites with `siteNodeLocal(site, s.outletNodeId)`.
  - **Subcatchments with a `polygon`** (team metres): their cells are the non-water cells whose centre is inside the polygon (even-odd ray test, local coordinates). They don't take part in nearest-outlet assignment. Polygon cells are claimed first, in subcatchment order.
  - **All other subcatchments:** keep today's nearest-outlet assignment (over the remaining cells) and the `area_ha` cut.
  - Keep the field order and values of the returned objects.

- [ ] **Step 6: `index.ts`.**
  - `import { TAMAN_KYRA, type SiteSpec, siteNodeLocal, cellIn } from './site';`
  - **`ScenarioOptions`:** add `/** Township to build; default the built-in Taman Kyra. */ site?: SiteSpec;`
  - **`baseTownship(blockage = BASELINE_BLOCKAGE, site: SiteSpec = TAMAN_KYRA)`:**
    - cache key `${site.key}|${blockageKey(blockage)}`;
    - `buildTerrain(site)`, `buildNetwork(grid, blockage, site)`;
    - keep at most **8** cache entries (delete the oldest key).
  - **`buildTownship(ids, custom, opts)`:**
    - `const site = opts.site ?? TAMAN_KYRA;`
    - if `ids.length && !site.builtIn`, throw `new Error('Interventions are only available for the built-in township')`;
    - default blockage = `opts.blockage ?? (site.builtIn ? BASELINE_BLOCKAGE : {})`.
  - **`hotspotCell(site = TAMAN_KYRA)`:** `const p = siteNodeLocal(site, site.hotspotNodeId); return cellIn(site.gridSpec, p.x, p.y);`
  - **`buildScenario`:**
    - `const site = opts.site ?? TAMAN_KYRA;`
    - `river.levels = [site.tailwater[opts.tailwater ?? 'normal']]`;
    - `sagCell: hotspotCell(site)`;
    - `catchments: … buildCatchments(grid, effectiveBlockage(ids, opts), site)`.
  - **`effectiveBlockage`:** default `opts.blockage ?? ((opts.site ?? TAMAN_KYRA).builtIn ? BASELINE_BLOCKAGE : {})`.
  - **`scenarioKey`:** prefix `${(opts.site ?? TAMAN_KYRA).key}|` before the existing string.
  - Re-export: `export { TAMAN_KYRA, type SiteSpec } from './site';`

- [ ] **Step 7: Verify.**
  - `npm -w @floodops/engine test`: all PASS, including `site.test.ts` and the unchanged `township.test.ts`.
  - `npm -w @floodops/engine run typecheck`, `npm -w legacy run build`, and `npm -w township-floodops-web test`.
  - `npm -w @floodops/engine run story`: claims and drift unchanged. Run it in the background, because it is slow.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/scenario packages/engine/tests/scenario/site.test.ts
git commit -m "refactor(engine): site abstraction — builders take a SiteSpec, Taman Kyra is the default site"
```

---

### Task 2: Importers and the site builder

**Files:**
- Create in `packages/engine/src/import/`:
  - `inp.ts`, `geojson.ts`, `asciiGrid.ts`, `geometry.ts`, `buildSite.ts`
- Tests in `packages/engine/tests/import/`:
  - `inp.test.ts`, `geojson.test.ts`, `asciiGrid.test.ts`, `geometry.test.ts`, `buildSite.test.ts`

**Interfaces:**
- Consumes (Task 1): `SiteSpec`, `medianJunctionGround`, `TAMAN_KYRA`, `cellIn`; `HOUSE`, `TAILWATER` from config.
- Produces:
  - `parseInp(text): InpModel`
  - `parseLayoutGeoJson(text): { features: LayoutFeatures; errors: string[]; warnings: string[] }`
  - `parseAsciiGrid(text): AsciiGrid` (throws on malformed input)
  - `fitRect(ring, rotationDeg?)`, `polygonCentroidArea(ring)`
  - `buildSiteFromFiles(files: ImportFiles): { site?: SiteSpec; report: ImportReport }`
  - `ImportFiles = { inp: { name: string; text: string }; geojson?: { name; text }; asc?: { name; text } }`
  - `ImportReport = { ok: boolean; errors: string[]; warnings: string[]; assumptions: string[]; summary: Array<[string, string]> }`
  - constants `MAX_CELLS = 40_000`, `DEFAULT_DX = 2`, `MARGIN_M = 30`, `DEFAULT_GRATE_M2 = 0.6`, `DEFAULT_ROAD_WIDTH_M = 8`, `DEFAULT_OUTFALL_DEPTH_M = 2`, `SINK_SIZE_M = 10`

- [ ] **Step 1: Write the failing tests.**

`tests/import/inp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseInp } from '../../src/import/inp';

const INP = `[TITLE]
; demo
[JUNCTIONS]
;;Name Elev MaxDepth
J1 10.0 2.0 0 0 0
J2 9.5  2.5 0 0 0   ; comment
[OUTFALLS]
O1 9.0 FIXED 9.2 NO
[CONDUITS]
P1 J1 J2 50 0.013 0 0 0 0
P2 J2 O1 40 0.013 0.1 0 0 0
[XSECTIONS]
P1 CIRCULAR 0.45 0 0 0 1
P2 RECT_CLOSED 0.6 0.9 0 0 1
[SUBCATCHMENTS]
S1 G1 J1 1.5 70 100 1 0
[COORDINATES]
J1 1000 2000
J2 1050 2000
O1 1090 2000
[POLYGONS]
S1 990 1990
S1 1010 1990
S1 1010 2010
[PUMPS]
PU1 J2 O1 * ON 0 0
`;

describe('parseInp', () => {
  const m = parseInp(INP);
  it('reads junctions, outfalls, conduits and cross-sections, ignoring comments', () => {
    expect(m.junctions).toEqual([
      { id: 'J1', invert: 10, maxDepth: 2, storage: false },
      { id: 'J2', invert: 9.5, maxDepth: 2.5, storage: false },
    ]);
    expect(m.outfalls).toEqual([{ id: 'O1', invert: 9, type: 'FIXED', stage: 9.2 }]);
    expect(m.conduits[1]).toEqual({ id: 'P2', from: 'J2', to: 'O1', length: 40, n: 0.013, inOffset: 0.1, outOffset: 0 });
    expect(m.xsections.get('P1')).toEqual({ shape: 'CIRCULAR', geom1: 0.45 });
    expect(m.xsections.get('P2')).toEqual({ shape: 'RECT_CLOSED', geom1: 0.6 });
  });
  it('reads subcatchments, coordinates, polygons and the list of sections', () => {
    expect(m.subcatchments).toEqual([{ id: 'S1', outlet: 'J1', areaHa: 1.5, imperviousPercent: 70 }]);
    expect(m.coordinates.get('J2')).toEqual([1050, 2000]);
    expect(m.polygons.get('S1')).toHaveLength(3);
    expect(m.sections).toContain('PUMPS');
  });
  it('treats STORAGE as a junction flagged storage', () => {
    const s = parseInp('[STORAGE]\nT1 8.0 3.0 0 FUNCTIONAL 1000 0 0\n');
    expect(s.junctions).toEqual([{ id: 'T1', invert: 8, maxDepth: 3, storage: true }]);
  });
});
```

`tests/import/asciiGrid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseAsciiGrid } from '../../src/import/asciiGrid';

describe('parseAsciiGrid', () => {
  it('reads the header and stores rows south-first', () => {
    const g = parseAsciiGrid('ncols 2\nnrows 3\nxllcorner 100\nyllcorner 200\ncellsize 2\nNODATA_value -9999\n1 2\n3 4\n5 -9999\n');
    expect(g).toMatchObject({ ncols: 2, nrows: 3, xll: 100, yll: 200, cellsize: 2, nodata: -9999 });
    expect(Array.from(g.values)).toEqual([5, -9999, 3, 4, 1, 2]);
  });
  it('accepts xllcenter/yllcenter', () => {
    const g = parseAsciiGrid('ncols 1\nnrows 1\nxllcenter 101\nyllcenter 201\ncellsize 2\n7\n');
    expect(g.xll).toBe(100);
    expect(g.yll).toBe(200);
    expect(g.nodata).toBeNull();
  });
  it('rejects a short body', () => {
    expect(() => parseAsciiGrid('ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\n1 2 3\n')).toThrow(/expected 4 values/);
  });
});
```

`tests/import/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fitRect, polygonCentroidArea } from '../../src/import/geometry';

describe('geometry', () => {
  it('fits an axis-aligned rectangle', () => {
    const r = fitRect([[0, 0], [10, 0], [10, 4], [0, 4], [0, 0]]);
    expect(r.cx).toBeCloseTo(5);
    expect(r.cy).toBeCloseTo(2);
    expect(r.width).toBeCloseTo(10);
    expect(r.depth).toBeCloseTo(4);
    expect(r.rotationDeg).toBeCloseTo(0);
  });
  it('fits a rotated rectangle along its longest edge, or a given rotation', () => {
    const c = Math.SQRT1_2;
    const ring: Array<[number, number]> = [[0, 0], [10 * c, 10 * c], [10 * c - 4 * c, 10 * c + 4 * c], [-4 * c, 4 * c]];
    const r = fitRect(ring);
    expect(r.width).toBeCloseTo(10);
    expect(r.depth).toBeCloseTo(4);
    expect(r.rotationDeg).toBeCloseTo(45);
    expect(fitRect(ring, 135).width).toBeCloseTo(4);
  });
  it('computes centroid and area', () => {
    const { cx, cy, area } = polygonCentroidArea([[0, 0], [4, 0], [4, 2], [0, 2]]);
    expect([cx, cy, area]).toEqual([2, 1, 8]);
  });
});
```

`tests/import/geojson.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLayoutGeoJson } from '../../src/import/geojson';

const fc = (features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features });
const f = (kind: string, geometry: unknown, props: Record<string, unknown> = {}) => ({ type: 'Feature', geometry, properties: { kind, ...props } });

describe('parseLayoutGeoJson', () => {
  it('sorts features by kind with defaults', () => {
    const { features, errors, warnings } = parseLayoutGeoJson(
      fc([
        f('building', { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]] }, { id: 'B1', rotation_deg: 0 }),
        f('road', { type: 'LineString', coordinates: [[0, 0], [100, 0], [100, 50]] }),
        f('roundabout', { type: 'Point', coordinates: [5, 5] }, { radius_m: 9 }),
        f('tree', { type: 'Point', coordinates: [1, 2] }),
        f('pond', { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] }, { water_level_m: 9.8 }),
        f('river', { type: 'LineString', coordinates: [[0, 0], [0, 80]] }, { width_m: 12, bed_m: 7 }),
        f('inlet', { type: 'Point', coordinates: [3, 3] }, { inlet_id: 'I1', node_id: 'J1' }),
        f('hotspot', { type: 'Point', coordinates: [3, 3] }, { node_id: 'J1' }),
        f('lamppost', { type: 'Point', coordinates: [0, 0] }),
      ]),
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual(['1 feature(s) with an unknown kind were ignored (lamppost).']);
    expect(features.buildings[0]).toMatchObject({ id: 'B1', rotationDeg: 0 });
    expect(features.roads[0]).toMatchObject({ width: 8, line: [[0, 0], [100, 0], [100, 50]] });
    expect(features.roundabouts[0]).toMatchObject({ x: 5, y: 5, radius: 9 });
    expect(features.trees[0]).toEqual({ x: 1, y: 2, scale: 1 });
    expect(features.ponds[0]).toMatchObject({ x: 2, y: 2, waterLevel: 9.8 });
    expect(features.ponds[0].radius).toBeCloseTo(Math.sqrt(16 / Math.PI));
    expect(features.rivers[0]).toMatchObject({ width: 12, bedZ: 7 });
    expect(features.inlets[0]).toMatchObject({ x: 3, y: 3, inletId: 'I1', nodeId: 'J1' });
    expect(features.hotspots).toEqual([{ nodeId: 'J1' }]);
  });
  it('reports invalid JSON and missing kinds as errors', () => {
    expect(parseLayoutGeoJson('{').errors[0]).toMatch(/not valid JSON/);
    expect(parseLayoutGeoJson(fc([{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }])).errors[0]).toMatch(/kind/);
  });
});
```

`tests/import/buildSite.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSiteFromFiles, MAX_CELLS } from '../../src/import/buildSite';
import { buildScenario } from '../../src/scenario/index';

const inp = (extra = '', coordOffset = 0) => `[JUNCTIONS]
J1 10.0 2.0 0 0 0
J2 9.5 2.0 0 0 0
[OUTFALLS]
O1 9.0 FIXED 9.2 NO
[CONDUITS]
P1 J1 J2 50 0.013 0 0 0 0
P2 J2 O1 40 0.013 0 0 0 0
[XSECTIONS]
P1 CIRCULAR 0.45 0 0 0 1
P2 CIRCULAR 0.6 0 0 0 1
[SUBCATCHMENTS]
S1 G1 J1 0.5 70 100 1 0
[COORDINATES]
J1 ${500000 + coordOffset} 300100
J2 ${500050 + coordOffset} 300100
O1 ${500090 + coordOffset} 300100
${extra}`;
const files = (text: string) => ({ inp: { name: 'site.inp', text } });

describe('buildSiteFromFiles', () => {
  it('builds a runnable site with translation, defaults and a report', () => {
    const { site, report } = buildSiteFromFiles(files(inp()));
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    expect(site!.builtIn).toBe(false);
    expect(site!.assets.nodes.map((n) => n.node_id)).toEqual(['J1', 'J2', 'O1']);
    expect(site!.gridSpec.dx).toBe(2);
    // Grid centre lands on the built-in centre (team x 45, y 5).
    expect(site!.datum.x0 + (site!.gridSpec.nx * site!.gridSpec.dx) / 2).toBeCloseTo(45, 6);
    expect(site!.datum.y0 + (site!.gridSpec.ny * site!.gridSpec.dx) / 2).toBeCloseTo(5, 6);
    // Distances are preserved.
    const [a, b] = site!.assets.nodes;
    expect(b.position_m.x - a.position_m.x).toBeCloseTo(50, 9);
    expect(site!.assets.inlets).toHaveLength(1);
    expect(site!.hotspotNodeId).toBe('J2');
    expect(site!.tailwater.high - site!.tailwater.normal).toBeCloseTo(1.2, 9);
    expect(report.assumptions.join(' ')).toMatch(/grate/);
    expect(report.assumptions.join(' ')).toMatch(/outfall sink/);
    const sc = buildScenario([], 'synthetic_80mmh_60min', [], { site });
    expect(sc.network.outfalls).toHaveLength(1);
  });
  it('changes the site when the file changes', () => {
    const a = buildSiteFromFiles(files(inp())).site!;
    const b = buildSiteFromFiles(files(inp().replace('P2 CIRCULAR 0.6', 'P2 CIRCULAR 0.75'))).site!;
    expect(a.key).not.toBe(b.key);
    expect(b.assets.conduits.find((c) => c.conduit_id === 'P2')!.diameter_m).toBe(0.75);
  });
  it('errors on longitude/latitude coordinates, unknown references and no route to an outfall', () => {
    const lonLat = inp().replace('J1 500000 300100', 'J1 101.60 3.10').replace('J2 500050 300100', 'J2 101.61 3.10').replace('O1 500090 300100', 'O1 101.62 3.10');
    expect(buildSiteFromFiles(files(lonLat)).report.errors.join(' ')).toMatch(/projected metric/);
    expect(buildSiteFromFiles(files(inp().replace('P1 J1 J2', 'P1 J1 JX'))).report.errors.join(' ')).toMatch(/unknown node JX/);
    // J3 has coordinates but no pipe out of it.
    const island = inp('J3 500010 300050').replace('J2 9.5 2.0 0 0 0', 'J2 9.5 2.0 0 0 0
J3 9.0 2.0 0 0 0');
    expect(buildSiteFromFiles(files(island)).report.errors.join(' ')).toMatch(/J3 has no route to an outfall/);
  });
  it('warns on uphill pipes, length mismatches and unsupported sections', () => {
    const w = buildSiteFromFiles(files(inp('[WEIRS]\nW1 J2 O1 TRANSVERSE 0 3\n').replace('P1 J1 J2 50', 'P1 J1 J2 80').replace('J2 9.5', 'J2 10.5'))).report.warnings.join(' ');
    expect(w).toMatch(/uphill/);
    expect(w).toMatch(/length/);
    expect(w).toMatch(/WEIRS/);
  });
  it('coarsens big sites to stay within the cell budget', () => {
    const big = inp().replace('O1 500090 300100', 'O1 501000 301000');
    const { site, report } = buildSiteFromFiles(files(big));
    expect(site!.gridSpec.nx * site!.gridSpec.ny).toBeLessThanOrEqual(MAX_CELLS);
    expect(site!.gridSpec.dx).toBeGreaterThan(2);
    expect(report.warnings.join(' ')).toMatch(/coarsened/);
  });
});
```

Run `npm -w @floodops/engine exec vitest run tests/import`. It should FAIL with the modules not found.

- [ ] **Step 2: `src/import/inp.ts`**

```ts
export interface InpModel {
  junctions: Array<{ id: string; invert: number; maxDepth: number; storage: boolean }>;
  outfalls: Array<{ id: string; invert: number; type: string; stage: number | null }>;
  conduits: Array<{ id: string; from: string; to: string; length: number; n: number; inOffset: number; outOffset: number }>;
  xsections: Map<string, { shape: string; geom1: number }>;
  subcatchments: Array<{ id: string; outlet: string; areaHa: number; imperviousPercent: number }>;
  coordinates: Map<string, [number, number]>;
  polygons: Map<string, Array<[number, number]>>;
  /** Upper-case names of every section present. */
  sections: string[];
}

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));

/** Parses the EPA SWMM 5 sections FloodOps uses. Comments (;) and blank lines are ignored. */
export function parseInp(text: string): InpModel {
  const m: InpModel = { junctions: [], outfalls: [], conduits: [], xsections: new Map(), subcatchments: [], coordinates: new Map(), polygons: new Map(), sections: [] };
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const head = /^\[([^\]]+)\]$/.exec(line);
    if (head) {
      section = head[1].trim().toUpperCase();
      if (!m.sections.includes(section)) m.sections.push(section);
      continue;
    }
    const t = line.split(/\s+/);
    switch (section) {
      case 'JUNCTIONS':
        m.junctions.push({ id: t[0], invert: num(t[1]), maxDepth: num(t[2]), storage: false });
        break;
      case 'STORAGE':
        m.junctions.push({ id: t[0], invert: num(t[1]), maxDepth: num(t[2]), storage: true });
        break;
      case 'OUTFALLS':
        m.outfalls.push({ id: t[0], invert: num(t[1]), type: (t[2] ?? 'FREE').toUpperCase(), stage: (t[2] ?? '').toUpperCase() === 'FIXED' ? num(t[3]) : null });
        break;
      case 'CONDUITS':
        m.conduits.push({ id: t[0], from: t[1], to: t[2], length: num(t[3]), n: num(t[4]), inOffset: num(t[5] ?? '0'), outOffset: num(t[6] ?? '0') });
        break;
      case 'XSECTIONS':
        m.xsections.set(t[0], { shape: (t[1] ?? '').toUpperCase(), geom1: num(t[2]) });
        break;
      case 'SUBCATCHMENTS':
        m.subcatchments.push({ id: t[0], outlet: t[2], areaHa: num(t[3]), imperviousPercent: num(t[4]) });
        break;
      case 'COORDINATES':
        m.coordinates.set(t[0], [num(t[1]), num(t[2])]);
        break;
      case 'POLYGONS': {
        const ring = m.polygons.get(t[0]) ?? [];
        ring.push([num(t[1]), num(t[2])]);
        m.polygons.set(t[0], ring);
        break;
      }
      default:
        break;
    }
  }
  return m;
}
```

- [ ] **Step 3: `src/import/asciiGrid.ts`**

```ts
export interface AsciiGrid {
  ncols: number;
  nrows: number;
  /** Lower-left corner of the lower-left cell (metres). */
  xll: number;
  yll: number;
  cellsize: number;
  nodata: number | null;
  /** Row-major, row 0 = SOUTH (engine orientation). */
  values: Float32Array;
}

/** ESRI ASCII grid (rows north → south in the file). Throws an Error with a readable message when malformed. */
export function parseAsciiGrid(text: string): AsciiGrid {
  const tokens = text.split(/\s+/).filter(Boolean);
  const header: Record<string, number> = {};
  let k = 0;
  while (k < tokens.length && /^[a-z_]+$/i.test(tokens[k])) {
    header[tokens[k].toLowerCase()] = Number(tokens[k + 1]);
    k += 2;
  }
  const ncols = header.ncols;
  const nrows = header.nrows;
  const cellsize = header.cellsize;
  if (!(ncols > 0 && nrows > 0 && cellsize > 0)) throw new Error('Height file: ncols, nrows and cellsize are required.');
  const xll = 'xllcorner' in header ? header.xllcorner : header.xllcenter - cellsize / 2;
  const yll = 'yllcorner' in header ? header.yllcorner : header.yllcenter - cellsize / 2;
  if (!Number.isFinite(xll) || !Number.isFinite(yll)) throw new Error('Height file: xllcorner/yllcorner (or xllcenter/yllcenter) are required.');
  const body = tokens.slice(k).map(Number);
  if (body.length !== ncols * nrows) throw new Error(`Height file: expected ${ncols * nrows} values, found ${body.length}.`);
  if (body.some((v) => !Number.isFinite(v))) throw new Error('Height file: non-numeric value in the grid.');
  const values = new Float32Array(ncols * nrows);
  for (let r = 0; r < nrows; r++) {
    const south = nrows - 1 - r;
    for (let c = 0; c < ncols; c++) values[south * ncols + c] = body[r * ncols + c];
  }
  return { ncols, nrows, xll, yll, cellsize, nodata: 'nodata_value' in header ? header.nodata_value : null, values };
}
```

- [ ] **Step 4: `src/import/geometry.ts`**

```ts
export type Ring = Array<[number, number]>;

/** Shoelace centroid and (absolute) area; falls back to the vertex mean for degenerate rings. */
export function polygonCentroidArea(ring: Ring): { cx: number; cy: number; area: number } {
  const pts = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-12) {
    const n = pts.length || 1;
    return { cx: pts.reduce((s, p) => s + p[0], 0) / n, cy: pts.reduce((s, p) => s + p[1], 0) / n, area: 0 };
  }
  return { cx: cx / (3 * a), cy: cy / (3 * a), area: Math.abs(a / 2) };
}

/** Oriented rectangle around a footprint: axis = rotationDeg if given, else the longest edge; width runs along the axis. */
export function fitRect(ring: Ring, rotationDeg?: number): { cx: number; cy: number; width: number; depth: number; rotationDeg: number } {
  let angle = rotationDeg;
  if (angle === undefined) {
    let best = -1;
    for (let i = 0; i + 1 < ring.length; i++) {
      const dx = ring[i + 1][0] - ring[i][0];
      const dy = ring[i + 1][1] - ring[i][1];
      const len = Math.hypot(dx, dy);
      if (len > best + 1e-9) {
        best = len;
        angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      }
    }
    // Close the ring if the last point isn't the first.
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    const closing = Math.hypot(fx - lx, fy - ly);
    if (closing > best + 1e-9) angle = (Math.atan2(fy - ly, fx - lx) * 180) / Math.PI;
  }
  const a = ((angle ?? 0) * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [x, y] of ring) {
    const u = x * ux + y * uy;
    const v = -x * uy + y * ux;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const mu = (minU + maxU) / 2;
  const mv = (minV + maxV) / 2;
  return { cx: mu * ux - mv * uy, cy: mu * uy + mv * ux, width: maxU - minU, depth: maxV - minV, rotationDeg: angle ?? 0 };
}
```

- [ ] **Step 5: `src/import/geojson.ts`**

```ts
import { polygonCentroidArea, type Ring } from './geometry';

export interface LayoutFeatures {
  buildings: Array<{ id: string | null; ring: Ring; rotationDeg?: number; props: Record<string, unknown> }>;
  roads: Array<{ id: string | null; line: Ring; width: number; surfaceZ: number | null }>;
  roundabouts: Array<{ id: string | null; x: number; y: number; radius: number; surfaceZ: number | null }>;
  trees: Array<{ x: number; y: number; scale: number }>;
  ponds: Array<{ id: string | null; x: number; y: number; radius: number; waterLevel: number | null; bedZ: number | null }>;
  rivers: Array<{ id: string | null; line: Ring; width: number; bedZ: number | null }>;
  inlets: Array<{ x: number; y: number; inletId: string; nodeId: string; grateArea: number | null }>;
  hotspots: Array<{ nodeId: string }>;
}

const numOr = (v: unknown, d: number | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strOr = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Parses the FloodOps layout GeoJSON (features typed by properties.kind). Coordinates stay in the file's metres. */
export function parseLayoutGeoJson(text: string): { features: LayoutFeatures; errors: string[]; warnings: string[] } {
  const features: LayoutFeatures = { buildings: [], roads: [], roundabouts: [], trees: [], ponds: [], rivers: [], inlets: [], hotspots: [] };
  const errors: string[] = [];
  const warnings: string[] = [];
  let doc: { type?: string; features?: Array<{ geometry?: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }> };
  try {
    doc = JSON.parse(text);
  } catch {
    return { features, errors: ['Layout file is not valid JSON.'], warnings };
  }
  if (doc.type !== 'FeatureCollection' || !Array.isArray(doc.features)) return { features, errors: ['Layout file must be a GeoJSON FeatureCollection.'], warnings };
  const unknown = new Set<string>();
  let unknownCount = 0;
  doc.features.forEach((ft, idx) => {
    const p = ft.properties ?? {};
    const g = ft.geometry;
    const kind = strOr(p.kind);
    if (!kind) {
      errors.push(`Layout feature #${idx + 1} has no properties.kind.`);
      return;
    }
    const want = (type: string) => {
      if (g?.type !== type) {
        errors.push(`Layout feature #${idx + 1} (${kind}) must be a ${type}, found ${g?.type ?? 'none'}.`);
        return false;
      }
      return true;
    };
    const point = () => g!.coordinates as [number, number];
    const line = () => (g!.coordinates as Ring).map(([x, y]) => [x, y] as [number, number]);
    const ring = () => ((g!.coordinates as Ring[])[0] ?? []).map(([x, y]) => [x, y] as [number, number]);
    const id = strOr(p.id);
    switch (kind) {
      case 'building':
        if (want('Polygon')) features.buildings.push({ id, ring: ring(), rotationDeg: numOr(p.rotation_deg, null) ?? undefined, props: p });
        break;
      case 'road':
        if (want('LineString')) features.roads.push({ id, line: line(), width: numOr(p.width_m, 8)!, surfaceZ: numOr(p.surface_z, null) });
        break;
      case 'roundabout':
        if (want('Point')) features.roundabouts.push({ id, x: point()[0], y: point()[1], radius: numOr(p.radius_m, 10)!, surfaceZ: numOr(p.surface_z, null) });
        break;
      case 'tree':
        if (want('Point')) features.trees.push({ x: point()[0], y: point()[1], scale: numOr(p.scale, 1)! });
        break;
      case 'pond':
        if (g?.type === 'Point') {
          features.ponds.push({ id, x: point()[0], y: point()[1], radius: numOr(p.radius_m, 10)!, waterLevel: numOr(p.water_level_m, null), bedZ: numOr(p.bed_m, null) });
        } else if (want('Polygon')) {
          const { cx, cy, area } = polygonCentroidArea(ring());
          features.ponds.push({ id, x: cx, y: cy, radius: Math.sqrt(area / Math.PI), waterLevel: numOr(p.water_level_m, null), bedZ: numOr(p.bed_m, null) });
        }
        break;
      case 'river':
        if (want('LineString')) features.rivers.push({ id, line: line(), width: numOr(p.width_m, 10)!, bedZ: numOr(p.bed_m, null) });
        break;
      case 'inlet':
        if (want('Point')) {
          const inletId = strOr(p.inlet_id);
          const nodeId = strOr(p.node_id);
          if (!inletId || !nodeId) errors.push(`Layout inlet #${idx + 1} needs inlet_id and node_id.`);
          else features.inlets.push({ x: point()[0], y: point()[1], inletId, nodeId, grateArea: numOr(p.grate_area_m2, null) });
        }
        break;
      case 'hotspot': {
        const nodeId = strOr(p.node_id);
        if (!nodeId) errors.push(`Layout hotspot #${idx + 1} needs node_id.`);
        else features.hotspots.push({ nodeId });
        break;
      }
      default:
        unknownCount++;
        unknown.add(kind);
    }
  });
  if (unknownCount) warnings.push(`${unknownCount} feature(s) with an unknown kind were ignored (${[...unknown].join(', ')}).`);
  return { features, errors, warnings };
}
```

- [ ] **Step 6: `src/import/buildSite.ts`.** Implement this exactly. It is long, but every rule is a spec value.

```ts
import { HOUSE, TAILWATER } from '../scenario/config';
import type { AssetConduit, AssetInlet, AssetNode, Assets, RoadCircle, RoadStraight } from '../scenario/layout';
import { medianJunctionGround, TAMAN_KYRA, type SiteHouse, type SitePond, type SiteRiver, type SiteSpec } from '../scenario/site';
import { parseAsciiGrid, type AsciiGrid } from './asciiGrid';
import { fitRect, type Ring } from './geometry';
import { parseLayoutGeoJson, type LayoutFeatures } from './geojson';
import { parseInp } from './inp';

export const MAX_CELLS = 40_000;
export const DEFAULT_DX = 2;
export const MARGIN_M = 30;
export const DEFAULT_GRATE_M2 = 0.6;
export const DEFAULT_ROAD_WIDTH_M = 8;
export const DEFAULT_OUTFALL_DEPTH_M = 2;
export const SINK_SIZE_M = 10;
const HIGH_RISE_M = TAILWATER.high - TAILWATER.normal; // 1.2
const POND_BED_BELOW_MEDIAN_M = 2.4;
const POND_WATER_ABOVE_BED_M = 0.6;
const RIVER_BED_BELOW_OUTFALL_M = 0.6;
const UNSUPPORTED = ['PUMPS', 'ORIFICES', 'WEIRS', 'OUTLETS'];
const IGNORED = ['TIMESERIES', 'RAINGAGES'];

export interface ImportFiles {
  inp: { name: string; text: string };
  geojson?: { name: string; text: string };
  asc?: { name: string; text: string };
}
export interface ImportReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  assumptions: string[];
  summary: Array<[string, string]>;
}

/** FNV-1a 32-bit, hex. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const TK_CENTRE = {
  x: TAMAN_KYRA.datum.x0 + (TAMAN_KYRA.gridSpec.nx * TAMAN_KYRA.gridSpec.dx) / 2,
  y: TAMAN_KYRA.datum.y0 + (TAMAN_KYRA.gridSpec.ny * TAMAN_KYRA.gridSpec.dx) / 2,
};
const TK_MEDIAN_GROUND = medianJunctionGround(TAMAN_KYRA.assets);

export function buildSiteFromFiles(files: ImportFiles): { site?: SiteSpec; report: ImportReport } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const report = (): ImportReport => ({ ok: errors.length === 0, errors, warnings, assumptions, summary });
  const summary: Array<[string, string]> = [];

  // 1. SWMM model.
  const m = parseInp(files.inp.text);
  for (const s of ['JUNCTIONS', 'OUTFALLS', 'CONDUITS', 'XSECTIONS', 'COORDINATES']) if (!m.sections.includes(s)) errors.push(`SWMM file: missing [${s}] section.`);
  for (const s of UNSUPPORTED) if (m.sections.includes(s)) warnings.push(`SWMM file: [${s}] is not supported yet and was skipped.`);
  for (const s of IGNORED) if (m.sections.includes(s)) assumptions.push(`SWMM [${s}] is not used: rainfall comes from the storm selector.`);
  if (m.junctions.some((j) => j.storage)) warnings.push('SWMM file: [STORAGE] nodes are treated as junctions (storage curves not modelled yet).');
  const ids = new Set<string>();
  for (const id of [...m.junctions.map((j) => j.id), ...m.outfalls.map((o) => o.id), ...m.conduits.map((c) => c.id)]) {
    if (ids.has(id)) errors.push(`SWMM file: duplicate id ${id}.`);
    ids.add(id);
  }
  const nodeIds = new Set([...m.junctions.map((j) => j.id), ...m.outfalls.map((o) => o.id)]);
  if (!m.outfalls.length) errors.push('SWMM file: no outfall.');
  for (const id of nodeIds) if (!m.coordinates.has(id)) errors.push(`SWMM file: node ${id} has no [COORDINATES] entry.`);
  for (const j of m.junctions) if (!(Number.isFinite(j.invert) && j.maxDepth > 0)) errors.push(`SWMM file: junction ${j.id} needs an invert and a positive max depth.`);
  for (const c of m.conduits) {
    for (const end of [c.from, c.to]) if (!nodeIds.has(end)) errors.push(`SWMM file: conduit ${c.id} refers to unknown node ${end}.`);
    if (!m.xsections.has(c.id)) errors.push(`SWMM file: conduit ${c.id} has no [XSECTIONS] entry.`);
    else if (m.xsections.get(c.id)!.shape !== 'CIRCULAR') warnings.push(`SWMM file: conduit ${c.id} is ${m.xsections.get(c.id)!.shape}; modelled as circular with diameter = Geom1.`);
    if (c.inOffset || c.outOffset) warnings.push(`SWMM file: conduit ${c.id} offsets are ignored.`);
  }
  for (const s of m.subcatchments) if (!nodeIds.has(s.outlet)) errors.push(`SWMM file: subcatchment ${s.id} drains to unknown node ${s.outlet}.`);
  // Every node must reach an outfall through conduits.
  const outIds = new Set(m.outfalls.map((o) => o.id));
  const down = new Map<string, string[]>();
  for (const c of m.conduits) down.set(c.from, [...(down.get(c.from) ?? []), c.to]);
  for (const j of m.junctions) {
    const seen = new Set<string>([j.id]);
    const stack = [j.id];
    let ok = false;
    while (stack.length && !ok) {
      for (const nx of down.get(stack.pop()!) ?? []) {
        if (outIds.has(nx)) ok = true;
        else if (!seen.has(nx)) {
          seen.add(nx);
          stack.push(nx);
        }
      }
    }
    if (!ok) errors.push(`SWMM file: node ${j.id} has no route to an outfall.`);
  }
  const coords = [...m.coordinates.values()];
  if (coords.length && coords.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90)) {
    errors.push('Coordinates look like longitude/latitude: export in the same projected metric CRS as the SWMM model.');
  }

  // 2. Layout and height files.
  let layout: LayoutFeatures | null = null;
  if (files.geojson) {
    const r = parseLayoutGeoJson(files.geojson.text);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    layout = r.features;
  } else {
    assumptions.push('No layout file: no buildings, roads, trees, ponds or rivers.');
  }
  let asc: AsciiGrid | null = null;
  if (files.asc) {
    try {
      asc = parseAsciiGrid(files.asc.text);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  } else {
    assumptions.push('No height file: ground is a plane through manhole cover levels with grate funnels and a road kerb drop.');
  }
  if (errors.length) return { report: report() };

  // 3. Extent and grid (file coordinates).
  const layoutPts: Array<[number, number]> = layout
    ? [
        ...layout.buildings.flatMap((b) => b.ring),
        ...layout.roads.flatMap((r) => r.line),
        ...layout.roundabouts.map((r) => [r.x, r.y] as [number, number]),
        ...layout.trees.map((t) => [t.x, t.y] as [number, number]),
        ...layout.ponds.map((p) => [p.x, p.y] as [number, number]),
        ...layout.rivers.flatMap((r) => r.line),
      ]
    : [];
  const polyPts = [...m.polygons.values()].flat();
  let minX: number;
  let minY: number;
  let nx: number;
  let ny: number;
  let dx: number;
  let k = 1;
  if (asc) {
    minX = asc.xll;
    minY = asc.yll;
    for (const id of nodeIds) {
      const [x, y] = m.coordinates.get(id)!;
      if (x < asc.xll || y < asc.yll || x > asc.xll + asc.ncols * asc.cellsize || y > asc.yll + asc.nrows * asc.cellsize) {
        errors.push(`Node ${id} lies outside the height file.`);
      }
    }
    if (errors.length) return { report: report() };
    while (Math.floor(asc.ncols / k) * Math.floor(asc.nrows / k) > MAX_CELLS) k++;
    dx = asc.cellsize * k;
    nx = Math.floor(asc.ncols / k);
    ny = Math.floor(asc.nrows / k);
  } else {
    const all = [...coords, ...layoutPts, ...polyPts];
    minX = Math.min(...all.map((p) => p[0])) - MARGIN_M;
    minY = Math.min(...all.map((p) => p[1])) - MARGIN_M;
    const w = Math.max(...all.map((p) => p[0])) + MARGIN_M - minX;
    const h = Math.max(...all.map((p) => p[1])) + MARGIN_M - minY;
    while (Math.ceil(w / (DEFAULT_DX * k)) * Math.ceil(h / (DEFAULT_DX * k)) > MAX_CELLS) k++;
    dx = DEFAULT_DX * k;
    nx = Math.ceil(w / dx);
    ny = Math.ceil(h / dx);
  }
  if (k > 1) warnings.push(`Grid coarsened to ${dx} m cells to stay within ${MAX_CELLS.toLocaleString('en')} cells.`);

  // 4. Placement: translate only.
  const shift = { dx: minX + (nx * dx) / 2 - TK_CENTRE.x, dy: minY + (ny * dx) / 2 - TK_CENTRE.y, dz: 0 };
  const groundOf = (j: { invert: number; maxDepth: number }) => j.invert + j.maxDepth;
  const jg = m.junctions.map(groundOf).sort((a, b) => a - b);
  const med = jg.length % 2 ? jg[jg.length >> 1] : (jg[(jg.length >> 1) - 1] + jg[jg.length >> 1]) / 2;
  shift.dz = round(med - TK_MEDIAN_GROUND, 2);
  const T = (x: number, y: number) => ({ x: x - shift.dx, y: y - shift.dy });
  const Z = (z: number) => z - shift.dz;

  // 5. Ground raster (team z), resampled k × k.
  let ground: Float32Array | undefined;
  if (asc) {
    const valid = Array.from(asc.values).filter((v) => asc!.nodata === null || v !== asc!.nodata).sort((a, b) => a - b);
    const fill = valid[valid.length >> 1] ?? 0;
    let filled = 0;
    ground = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let s = 0;
        for (let bj = 0; bj < k; bj++) {
          for (let bi = 0; bi < k; bi++) {
            let v = asc.values[(j * k + bj) * asc.ncols + (i * k + bi)];
            if (asc.nodata !== null && v === asc.nodata) {
              v = fill;
              filled++;
            }
            s += v;
          }
        }
        ground[j * nx + i] = Z(s / (k * k));
      }
    }
    if (filled) warnings.push(`Height file: ${filled} NODATA cell(s) filled with the median ground (${round(fill, 2)} m).`);
  }

  // 6. Assets (team coordinates).
  const nodes: AssetNode[] = [
    ...m.junctions.map((j) => {
      const p = T(...m.coordinates.get(j.id)!);
      return { node_id: j.id, node_type: 'junction' as const, position_m: { x: p.x, y: p.y, z: Z(j.invert) }, invert_elevation_m: Z(j.invert), ground_elevation_m: Z(groundOf(j)), max_depth_m: j.maxDepth };
    }),
    ...m.outfalls.map((o) => {
      const p = T(...m.coordinates.get(o.id)!);
      return { node_id: o.id, node_type: 'outfall' as const, position_m: { x: p.x, y: p.y, z: Z(o.invert) }, invert_elevation_m: Z(o.invert), ground_elevation_m: Z(o.invert + DEFAULT_OUTFALL_DEPTH_M), max_depth_m: DEFAULT_OUTFALL_DEPTH_M };
    }),
  ];
  assumptions.push(`Outfall chambers are ${DEFAULT_OUTFALL_DEPTH_M} m deep.`);
  const nodeById = new Map(nodes.map((n) => [n.node_id, n]));
  const conduits: AssetConduit[] = m.conduits.map((c) => {
    const a = nodeById.get(c.from)!;
    const b = nodeById.get(c.to)!;
    const dist = Math.hypot(a.position_m.x - b.position_m.x, a.position_m.y - b.position_m.y);
    if (dist > 0 && Math.abs(c.length - dist) / dist > 0.1) warnings.push(`Conduit ${c.id}: stated length ${round(c.length, 1)} m differs from the ${round(dist, 1)} m between its nodes by more than 10%.`);
    if (a.invert_elevation_m < b.invert_elevation_m) warnings.push(`Conduit ${c.id} runs uphill (${round(a.invert_elevation_m, 2)} → ${round(b.invert_elevation_m, 2)} m).`);
    const d = m.xsections.get(c.id)!.geom1;
    if (!(d >= 0.15 && d <= 3)) warnings.push(`Conduit ${c.id}: diameter ${d} m is outside 0.15–3.0 m.`);
    return { conduit_id: c.id, from_node_id: c.from, to_node_id: c.to, diameter_m: d, length_m: c.length, manning_n: c.n };
  });
  let inlets: AssetInlet[];
  if (layout?.inlets.length) {
    inlets = layout.inlets
      .filter((i) => {
        if (nodeById.has(i.nodeId)) return true;
        warnings.push(`Inlet ${i.inletId} refers to unknown node ${i.nodeId} and was skipped.`);
        return false;
      })
      .map((i) => {
        const p = T(i.x, i.y);
        return { inlet_id: i.inletId, node_id: i.nodeId, position_m: { x: p.x, y: p.y, z: nodeById.get(i.nodeId)!.ground_elevation_m }, grate_area_m2: i.grateArea ?? DEFAULT_GRATE_M2 };
      });
  } else {
    const outlets = [...new Set(m.subcatchments.map((s) => s.outlet))];
    inlets = outlets.map((id) => {
      const n = nodeById.get(id)!;
      return { inlet_id: `INLET-${id}`, node_id: id, position_m: { x: n.position_m.x, y: n.position_m.y, z: n.ground_elevation_m }, grate_area_m2: DEFAULT_GRATE_M2 };
    });
    if (inlets.length) assumptions.push(`No inlet points: one ${DEFAULT_GRATE_M2} m² grate at each subcatchment outlet (${inlets.length}).`);
  }
  const assets: Assets = { nodes, inlets, conduits };

  // 7. Layout (team coordinates).
  const roads: Array<RoadStraight | RoadCircle> = [];
  const houses: SiteHouse[] = [];
  const trees: Array<{ x: number; y: number; scale: number }> = [];
  const ponds: SitePond[] = [];
  const rivers: SiteRiver[] = [];
  const pondBed = TK_MEDIAN_GROUND - POND_BED_BELOW_MEDIAN_M;
  const riverBed = Math.min(...nodes.filter((n) => n.node_type === 'outfall').map((n) => n.invert_elevation_m)) - RIVER_BED_BELOW_OUTFALL_M;
  if (layout) {
    const segs = (line: Ring) => line.slice(1).map((b, s) => [line[s], b] as const);
    layout.roads.forEach((r, ri) =>
      segs(r.line).forEach(([a, b], s) => {
        const pa = T(...a);
        const pb = T(...b);
        roads.push({
          id: r.line.length === 2 && r.id ? r.id : `${r.id ?? `road-${ri + 1}`}-${s + 1}`,
          kind: 'straight',
          x: (pa.x + pb.x) / 2,
          y: (pa.y + pb.y) / 2,
          width: r.width,
          length: Math.hypot(pb.x - pa.x, pb.y - pa.y),
          angleDeg: (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI,
          ...(r.surfaceZ !== null ? { surfaceZ: Z(r.surfaceZ) } : {}),
        } as RoadStraight);
      }),
    );
    if (layout.roads.some((r) => r.width === DEFAULT_ROAD_WIDTH_M)) assumptions.push(`Roads without width_m are ${DEFAULT_ROAD_WIDTH_M} m wide.`);
    layout.roundabouts.forEach((r, i) => {
      const p = T(r.x, r.y);
      roads.push({ id: r.id ?? `roundabout-${i + 1}`, kind: 'circle', x: p.x, y: p.y, radius: r.radius, ...(r.surfaceZ !== null ? { surfaceZ: Z(r.surfaceZ) } : {}) } as RoadCircle);
    });
    layout.buildings.forEach((b, i) => {
      const ring = b.ring.map(([x, y]) => {
        const p = T(x, y);
        return [p.x, p.y] as [number, number];
      });
      const r = fitRect(ring, b.rotationDeg);
      const extras = Object.fromEntries(Object.entries(b.props).filter(([key]) => !['kind', 'id', 'rotation_deg'].includes(key)));
      houses.push({ ...extras, id: b.id ?? `B${i + 1}`, x: r.cx, y: r.cy, rotationDeg: r.rotationDeg, scale: Math.sqrt((r.width * r.depth) / (HOUSE.width * HOUSE.depth)), width: r.width, depth: r.depth });
    });
    layout.trees.forEach((t) => trees.push({ ...T(t.x, t.y), scale: t.scale }));
    layout.ponds.forEach((p, i) => {
      const c = T(p.x, p.y);
      const bedZ = p.bedZ !== null ? Z(p.bedZ) : pondBed;
      ponds.push({ id: p.id ?? `pond-${i + 1}`, x: c.x, y: c.y, radius: p.radius, bedZ, waterLevel: p.waterLevel !== null ? Z(p.waterLevel) : bedZ + POND_WATER_ABOVE_BED_M });
    });
    if (layout.ponds.some((p) => p.bedZ === null || p.waterLevel === null)) {
      assumptions.push(`Ponds without levels: bed ${round(pondBed, 2)} m, water ${round(pondBed + POND_WATER_ABOVE_BED_M, 2)} m.`);
    }
    layout.rivers.forEach((r, ri) =>
      segs(r.line).forEach(([a, b], s) => {
        const pa = T(...a);
        const pb = T(...b);
        rivers.push({
          id: r.line.length === 2 && r.id ? r.id : `${r.id ?? `river-${ri + 1}`}-${s + 1}`,
          cx: (pa.x + pb.x) / 2,
          cy: (pa.y + pb.y) / 2,
          length: Math.hypot(pb.x - pa.x, pb.y - pa.y),
          width: r.width,
          angleDeg: (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI,
          bedZ: r.bedZ !== null ? Z(r.bedZ) : riverBed,
        });
      }),
    );
  }
  // Outfall sinks where no river is near an outfall.
  const nearRiver = (x: number, y: number) =>
    rivers.some((r) => {
      const a = (r.angleDeg * Math.PI) / 180;
      const ux = x - r.cx;
      const uy = y - r.cy;
      return Math.abs(ux * Math.cos(a) + uy * Math.sin(a)) <= r.length / 2 + SINK_SIZE_M && Math.abs(-ux * Math.sin(a) + uy * Math.cos(a)) <= r.width / 2 + SINK_SIZE_M;
    });
  for (const o of nodes.filter((n) => n.node_type === 'outfall')) {
    if (!nearRiver(o.position_m.x, o.position_m.y)) {
      rivers.push({ id: `sink-${o.node_id}`, cx: o.position_m.x, cy: o.position_m.y, length: SINK_SIZE_M, width: SINK_SIZE_M, angleDeg: 0, bedZ: o.invert_elevation_m - RIVER_BED_BELOW_OUTFALL_M });
      assumptions.push(`No river near outfall ${o.node_id}: a ${SINK_SIZE_M} × ${SINK_SIZE_M} m outfall sink was added.`);
    }
  }

  // 8. Hotspot, focus inlet, tailwater, catchments.
  const lowest = nodes.filter((n) => n.node_type === 'junction').sort((a, b) => a.ground_elevation_m - b.ground_elevation_m)[0];
  const hotspotNodeId = layout?.hotspots.find((h) => nodeById.has(h.nodeId))?.nodeId ?? lowest.node_id;
  if (!layout?.hotspots.length) assumptions.push(`Hotspot: ${hotspotNodeId}, the junction with the lowest ground.`);
  const focusInletId = inlets.find((i) => i.node_id === hotspotNodeId)?.inlet_id ?? inlets[0]?.inlet_id ?? null;
  const o0 = m.outfalls[0];
  const normal = Z(o0.stage ?? o0.invert);
  if (o0.stage === null) assumptions.push(`Outfall ${o0.id} has no FIXED stage: normal tailwater at its invert.`);
  assumptions.push(`High tailwater = normal + ${HIGH_RISE_M} m.`);
  assumptions.push("Inlet capture curve: Tay Zheheng's illustrative curve (80% of approach flow up to 0.20 m³/s); catchment lag 60 s.");
  const subcatchments = m.subcatchments.map((s) => {
    const ring = m.polygons.get(s.id);
    return {
      id: s.id,
      outletNodeId: s.outlet,
      areaHa: s.areaHa,
      imperviousPercent: s.imperviousPercent,
      ...(ring && ring.length >= 3 ? { polygon: ring.map(([x, y]) => {
        const p = T(x, y);
        return [p.x, p.y] as [number, number];
      }) } : {}),
    };
  });
  if (subcatchments.some((s) => !('polygon' in s))) assumptions.push('Subcatchments without polygons take the nearest cells to their outlet, up to their stated area.');

  const key = `import-${hash(files.inp.text)}${files.geojson ? hash(files.geojson.text) : ''}${files.asc ? hash(files.asc.text) : ''}`;
  const site: SiteSpec = {
    key,
    label: files.inp.name,
    builtIn: false,
    datum: { x0: minX - shift.dx, y0: minY - shift.dy },
    gridSpec: { nx, ny, dx },
    assets,
    layout: { roads, houses, trees },
    ponds,
    rivers,
    subcatchments,
    captureCurve: TAMAN_KYRA.captureCurve,
    ...(ground ? { ground } : {}),
    hotspotNodeId,
    focusInletId,
    tailwater: { normal, high: normal + HIGH_RISE_M },
    shift,
  };
  summary.push(
    ['Network', `${m.junctions.length} junctions, ${m.outfalls.length} outfall(s), ${conduits.length} pipes, ${inlets.length} inlets`],
    ['Catchments', `${subcatchments.length}`],
    ['Layout', `${houses.length} buildings, ${roads.length} road pieces, ${trees.length} trees, ${ponds.length} ponds, ${rivers.length} river pieces`],
    ['Grid', `${nx} × ${ny} cells at ${dx} m (${round((nx * dx) / 1000, 2)} × ${round((ny * dx) / 1000, 2)} km)`],
    ['Placement', `moved by (${round(-shift.dx, 1)}, ${round(-shift.dy, 1)}) m and ${round(-shift.dz, 2)} m vertically; not scaled`],
    ['Hotspot', hotspotNodeId],
  );
  return { site, report: report() };
}
```

The `hash` of the separate texts concatenated is enough: a change to any file changes the key.

- [ ] **Step 7: Run the tests.** `npm -w @floodops/engine exec vitest run tests/import` should PASS. Then run `npm -w @floodops/engine test` and `npm -w @floodops/engine run typecheck`; both should PASS.

  If a test fails, fix the code to meet the spec rule the test checks. Don't weaken the test.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/import packages/engine/tests/import
git commit -m "feat(engine): import SWMM .inp, GIS layout and height grid into a site, with validation report"
```

---

### Task 3: Synthetic sample package, drift test and equivalence test

**Files:**
- Create:
  - `packages/engine/scripts/samplePackage.ts` (pure generator)
  - `packages/engine/scripts/makeSamplePackage.ts` (CLI)
  - `packages/engine/tests/samplePackage.drift.test.ts`
  - `packages/engine/tests/samplePackage.equivalence.test.ts`
  - `data/samples/taman_kyra_site/` containing `taman_kyra.inp`, `taman_kyra_p07_750.inp`, `taman_kyra_layout.geojson`, `taman_kyra_ground.asc` and `README.md`
- Modify: `packages/engine/package.json` (scripts)

**Interfaces:**
- Consumes: `TAMAN_KYRA`, `buildTerrain`, `INLET_SUMP`, `LAYOUT`, `buildSiteFromFiles`, `buildScenario`, `runSimulation`.
- Produces: `SAMPLE_OFFSET = { x: 412000, y: 336000 }` and `makeSampleFiles(baselineInp: string): Record<string, string>`, keyed by file name.

- [ ] **Step 1: `packages/engine/scripts/samplePackage.ts`**

```ts
import { HOUSE, INLET_SUMP } from '../src/scenario/config';
import { LAYOUT } from '../src/scenario/layout';
import { buildTerrain } from '../src/scenario/terrain';
import { cellIn, siteToLocal, TAMAN_KYRA } from '../src/scenario/site';

/** Illustrative projected coordinates (metres) for the sample package: not a real location. */
export const SAMPLE_OFFSET = { x: 412000, y: 336000 };
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const X = (x: number) => r3(x + SAMPLE_OFFSET.x);
const Y = (y: number) => r3(y + SAMPLE_OFFSET.y);
const TITLE =
  '; FloodOps synthetic sample site package (Taman Kyra). Not a real location: coordinates are illustrative projected metres.\n' +
  "; Network: Tay Zheheng's illustrative SWMM model (models/illustrative_taman_kyra/baseline.inp).";

function withCoordinates(inp: string): string {
  const out: string[] = [];
  let section = '';
  for (const line of inp.split(/\r?\n/)) {
    const head = /^\[([^\]]+)\]/.exec(line.trim());
    if (head) section = head[1].toUpperCase();
    if (section === 'TITLE' && head) {
      out.push(line, TITLE);
      continue;
    }
    if (section === 'COORDINATES' && !head && line.trim() && !line.trim().startsWith(';')) {
      const [id, x, y] = line.trim().split(/\s+/);
      out.push(`${id} ${X(Number(x))} ${Y(Number(y))}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function geojson(): string {
  const feats: unknown[] = [];
  const add = (kind: string, geometry: unknown, props: Record<string, unknown> = {}) => feats.push({ type: 'Feature', geometry, properties: { kind, ...props } });
  for (const r of LAYOUT.roads) {
    if (r.kind === 'circle') {
      add('roundabout', { type: 'Point', coordinates: [X(r.x), Y(r.y)] }, { id: r.id, radius_m: r.radius, surface_z: (r as unknown as { surfaceZ: number }).surfaceZ });
    } else {
      const a = (r.angleDeg * Math.PI) / 180;
      const hx = (Math.cos(a) * r.length) / 2;
      const hy = (Math.sin(a) * r.length) / 2;
      add('road', { type: 'LineString', coordinates: [[X(r.x - hx), Y(r.y - hy)], [X(r.x + hx), Y(r.y + hy)]] }, { id: r.id, width_m: r.width, surface_z: (r as unknown as { surfaceZ: number }).surfaceZ });
    }
  }
  for (const h of LAYOUT.houses as Array<Record<string, unknown> & { id: string; x: number; y: number; rotationDeg: number; scale: number }>) {
    const a = (h.rotationDeg * Math.PI) / 180;
    const w = (HOUSE.width * h.scale) / 2;
    const d = (HOUSE.depth * h.scale) / 2;
    const corner = (su: number, sv: number) => [X(h.x + su * w * Math.cos(a) - sv * d * Math.sin(a)), Y(h.y + su * w * Math.sin(a) + sv * d * Math.cos(a))];
    const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)];
    const { id, x: _x, y: _y, rotationDeg: _r, scale: _s, ...rest } = h;
    add('building', { type: 'Polygon', coordinates: [ring] }, { id, rotation_deg: h.rotationDeg, ...rest });
  }
  for (const t of LAYOUT.trees) add('tree', { type: 'Point', coordinates: [X(t.x), Y(t.y)] }, { scale: t.scale });
  for (const p of TAMAN_KYRA.ponds) add('pond', { type: 'Point', coordinates: [X(p.x), Y(p.y)] }, { id: p.id, radius_m: p.radius, water_level_m: p.waterLevel, bed_m: p.bedZ });
  for (const r of TAMAN_KYRA.rivers) {
    const a = (r.angleDeg * Math.PI) / 180;
    const hx = (Math.cos(a) * r.length) / 2;
    const hy = (Math.sin(a) * r.length) / 2;
    add('river', { type: 'LineString', coordinates: [[X(r.cx - hx), Y(r.cy - hy)], [X(r.cx + hx), Y(r.cy + hy)]] }, { id: r.id, width_m: r.width, bed_m: r.bedZ });
  }
  for (const i of TAMAN_KYRA.assets.inlets) add('inlet', { type: 'Point', coordinates: [X(i.position_m.x), Y(i.position_m.y)] }, { inlet_id: i.inlet_id, node_id: i.node_id, grate_area_m2: i.grate_area_m2 });
  const j07 = TAMAN_KYRA.assets.nodes.find((n) => n.node_id === TAMAN_KYRA.hotspotNodeId)!;
  add('hotspot', { type: 'Point', coordinates: [X(j07.position_m.x), Y(j07.position_m.y)] }, { node_id: j07.node_id });
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: 'taman_kyra_layout',
      description: "FloodOps synthetic sample layout (illustrative projected metres, not a real location). Derived from TEH JIA JIE's scene layout; inlets from Tay Zheheng's synthetic assets.",
      features: feats,
    },
    null,
    1,
  );
}

function ground(): string {
  const g = buildTerrain(TAMAN_KYRA);
  const z = Float32Array.from(g.z);
  // The importer re-applies the inlet sump, so export the ground without it.
  for (const i of TAMAN_KYRA.assets.inlets) {
    const p = siteToLocal(TAMAN_KYRA, i.position_m.x, i.position_m.y);
    z[cellIn(TAMAN_KYRA.gridSpec, p.x, p.y)] += INLET_SUMP;
  }
  const { nx, ny, dx } = TAMAN_KYRA.gridSpec;
  const lines = [`ncols ${nx}`, `nrows ${ny}`, `xllcorner ${X(TAMAN_KYRA.datum.x0)}`, `yllcorner ${Y(TAMAN_KYRA.datum.y0)}`, `cellsize ${dx}`, 'NODATA_value -9999'];
  for (let j = ny - 1; j >= 0; j--) {
    const row: string[] = [];
    for (let i = 0; i < nx; i++) row.push(z[j * nx + i].toFixed(3));
    lines.push(row.join(' '));
  }
  return lines.join('\n') + '\n';
}

const README = `# Taman Kyra sample site package (synthetic)

These files are **synthetic**. They describe the FloodOps demo township, Taman Kyra, which is not a real place.
The coordinates are illustrative projected metres (built-in coordinates + ${SAMPLE_OFFSET.x}, ${SAMPLE_OFFSET.y}), not a real location.

| File | What it is |
|---|---|
| \`taman_kyra.inp\` | EPA SWMM 5 model of the drainage network: Tay Zheheng's illustrative model, with its coordinates moved into the sample coordinate system |
| \`taman_kyra_p07_750.inp\` | The same model with PIPE-P07 upsized from Ø600 to Ø750 |
| \`taman_kyra_layout.geojson\` | Buildings, roads, trees, pond, canal, inlets and the J07 hotspot, from TEH JIA JIE's scene layout |
| \`taman_kyra_ground.asc\` | Ground heights, 2 m grid (ESRI ASCII grid) |

## Demo
1. Engine mode → 📂 Import site → choose all four files except the P07 variant → Generate city. You should see the same township as the built-in one.
2. Run the 80 mm/h storm: water gathers at the J07 junction and PIPE-P07 runs full.
3. Import again with \`taman_kyra_p07_750.inp\` instead of \`taman_kyra.inp\`: P07 no longer runs full and less water reaches the houses.
4. With **Watch for changes** on, open \`taman_kyra.inp\` in a text editor, change a pipe diameter in [XSECTIONS] or move a manhole in [COORDINATES], and save. The city regenerates within a couple of seconds.

Regenerate these files with \`npm -w @floodops/engine run sample\`.
`;

export function makeSampleFiles(baselineInp: string): Record<string, string> {
  const inp = withCoordinates(baselineInp);
  const p07 = inp
    .replace(/^(PIPE-P07\s+CIRCULAR\s+)0\.6(\s)/m, '$10.75$2')
    .replace(TITLE, `${TITLE}\n; Variant: PIPE-P07 upsized to 750 mm.`);
  return {
    'taman_kyra.inp': inp,
    'taman_kyra_p07_750.inp': p07,
    'taman_kyra_layout.geojson': geojson() + '\n',
    'taman_kyra_ground.asc': ground(),
    'README.md': README,
  };
}
```

**Check before writing the files:**
- Tay's `[XSECTIONS]` line for PIPE-P07 reads `PIPE-P07 CIRCULAR 0.6 0 0 0 1`.
- The regex keeps everything after the diameter. Confirm the variant differs only on that line and the title.

- [ ] **Step 2: CLI `packages/engine/scripts/makeSamplePackage.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeSampleFiles } from './samplePackage';

const root = resolve(__dirname, '../../..');
const out = resolve(root, 'data/samples/taman_kyra_site');
mkdirSync(out, { recursive: true });
const files = makeSampleFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
for (const [name, text] of Object.entries(files)) writeFileSync(resolve(out, name), text);
console.log(`wrote ${Object.keys(files).length} files to ${out}`);
```

In `packages/engine/package.json`:
- add the script `"sample": "tsx scripts/makeSamplePackage.ts"`;
- add `--exclude tests/samplePackage.equivalence.test.ts` to `"test"`;
- add `tests/samplePackage.equivalence.test.ts` to `"story"`. The equivalence test runs a full storm, so it is slow.

If `__dirname` is unavailable under tsx ESM, use `fileURLToPath(new URL('.', import.meta.url))`. Copy whatever pattern `scripts/computeDashboard.ts` uses for writing files.

- [ ] **Step 3: Generate the files.** Run `npm -w @floodops/engine run sample`. Expected: "wrote 5 files". Inspect them:
  - `taman_kyra.inp` has `NODE-J07 412040 336000`;
  - the `.asc` header shows `ncols 125`, `nrows 145`, `xllcorner 411920` and `yllcorner 335860`.

- [ ] **Step 4: Drift test** `packages/engine/tests/samplePackage.drift.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeSampleFiles } from '../scripts/samplePackage';

const root = resolve(__dirname, '../../..');

describe('sample site package', () => {
  it('matches the generator (run `npm -w @floodops/engine run sample` after changing the built-in township)', () => {
    const files = makeSampleFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
    for (const [name, text] of Object.entries(files)) {
      expect(readFileSync(resolve(root, 'data/samples/taman_kyra_site', name), 'utf8').replace(/\r\n/g, '\n')).toBe(text.replace(/\r\n/g, '\n'));
    }
  });
});
```

- [ ] **Step 5: Equivalence test** `packages/engine/tests/samplePackage.equivalence.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSiteFromFiles } from '../src/import/buildSite';
import { buildScenario } from '../src/scenario/index';
import { TAMAN_KYRA } from '../src/scenario/site';
import { runSimulation } from '../src/sim/engine';

const dir = resolve(__dirname, '../../../data/samples/taman_kyra_site');
const read = (name: string) => ({ name, text: readFileSync(resolve(dir, name), 'utf8') });

describe('importing the sample package gives the built-in township back', () => {
  const { site, report } = buildSiteFromFiles({ inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') });
  it('imports without errors and lands on the built-in grid', () => {
    expect(report.errors).toEqual([]);
    expect(site!.gridSpec).toEqual(TAMAN_KYRA.gridSpec);
    expect(site!.datum.x0).toBeCloseTo(TAMAN_KYRA.datum.x0, 6);
    expect(site!.datum.y0).toBeCloseTo(TAMAN_KYRA.datum.y0, 6);
    expect(site!.shift.dz).toBe(0);
    expect(site!.hotspotNodeId).toBe('NODE-J07');
    expect(site!.focusInletId).toBe('INLET-D07');
    expect(site!.tailwater).toEqual(TAMAN_KYRA.tailwater);
  });
  it('builds the same terrain and network', () => {
    const a = buildScenario([], 'synthetic_80mmh_60min');
    const b = buildScenario([], 'synthetic_80mmh_60min', [], { site, blockage: { 'INLET-D07': 0.4 } });
    let maxDz = 0;
    let landDiff = 0;
    for (let c = 0; c < a.grid.z.length; c++) {
      maxDz = Math.max(maxDz, Math.abs(a.grid.z[c] - b.grid.z[c]));
      if (a.grid.land[c] !== b.grid.land[c]) landDiff++;
    }
    expect(maxDz).toBeLessThanOrEqual(0.001);
    expect(landDiff / a.grid.z.length).toBeLessThanOrEqual(0.005);
    expect(b.network.nodes.map((n) => [n.id, n.cell, n.invert])).toEqual(a.network.nodes.map((n) => [n.id, n.cell, n.invert]));
    expect(b.network.pipes.map((p) => [p.id, p.diameter])).toEqual(a.network.pipes.map((p) => [p.id, p.diameter]));
    expect(b.sagCell).toBe(a.sagCell);
  });
  it('floods the same way on the 80 mm/h storm', () => {
    const a = runSimulation(buildScenario([], 'synthetic_80mmh_60min')).metrics;
    const b = runSimulation(buildScenario([], 'synthetic_80mmh_60min', [], { site, blockage: { 'INLET-D07': 0.4 } })).metrics;
    expect(Math.abs(b.peakSagDepth - a.peakSagDepth) / a.peakSagDepth).toBeLessThanOrEqual(0.02);
    expect(b.homesFlooded).toBe(a.homesFlooded);
  }, 300_000);
});
```

- [ ] **Step 6: Verify.**
  - `npm -w @floodops/engine test` should PASS, including the drift test.
  - Run `npm -w @floodops/engine exec vitest run tests/samplePackage.equivalence.test.ts` in the background. It must PASS.
    - If the land differs by more than 0.5%, investigate the house rectangles (rounding of the polygon corners) before changing anything.
    - Never loosen the tolerances.
  - Run `npm -w @floodops/engine run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/scripts/samplePackage.ts packages/engine/scripts/makeSamplePackage.ts packages/engine/package.json packages/engine/tests/samplePackage.drift.test.ts packages/engine/tests/samplePackage.equivalence.test.ts data/samples/taman_kyra_site
git commit -m "feat(engine): synthetic Taman Kyra sample site package with drift and equivalence tests" -m "Sample network from Tay Zheheng's illustrative SWMM model (models/illustrative_taman_kyra)." -m "Sample layout from TEH JIA JIE's scene layout."
```

---

### Task 4: Web — the active site through source, workers, live, adapters and water

**Files:**
- Modify:
  - `apps/web/src/engine/engineSource.ts`
  - `apps/web/src/engine/frameAdapter.ts`
  - `apps/web/src/engine/useLiveEngine.ts`
  - `apps/web/src/engine/EngineWater.tsx`
  - `apps/web/src/engine/visualGround.ts`
  - `apps/web/src/App.tsx`
  - `apps/web/src/components/InterventionDashboard.tsx`
  - `apps/web/src/components/SimulationHUD.tsx`
- Test: `apps/web/src/engine/__tests__/engineSource.test.ts` (extend)

**Interfaces:**
- Consumes: `SiteSpec`, `TAMAN_KYRA`, `ScenarioOptions.site`, `baseTownship(blockage, site)`, `siteToTeam`.
- Produces:
  - `engineSource.setSite(site: SiteSpec | null)` and `engineSource.getSite(): SiteSpec` (default `TAMAN_KYRA`);
  - `makeContext(network, grid, blockage, inlets)`;
  - `useLiveEngine().start(storm, ids, opts)` with `opts.site`;
  - `groundSampler(site): (tx, ty) => number`, exported from `apps/web/src/engine/visualGround.ts`;
  - `EngineWater({ depth, site })`;
  - SimulationHUD prop `hotspotLabel?: string`;
  - InterventionDashboard prop `engineNotice?: string`;
  - App state `site: SiteSpec` (passed to SceneViewer in Task 5).

- [ ] **Step 1: Failing tests.** Append to `apps/web/src/engine/__tests__/engineSource.test.ts`:

```ts
import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { TAMAN_KYRA } from '@floodops/engine/scenario/site';

const SMALL_INP = `[JUNCTIONS]
J1 10.0 2.0 0 0 0
J2 9.5 2.0 0 0 0
[OUTFALLS]
O1 9.0 FIXED 9.2 NO
[CONDUITS]
P1 J1 J2 50 0.013 0 0 0 0
P2 J2 O1 40 0.013 0 0 0 0
[XSECTIONS]
P1 CIRCULAR 0.45 0 0 0 1
P2 CIRCULAR 0.6 0 0 0 1
[SUBCATCHMENTS]
S1 G1 J1 0.5 70 100 1 0
[COORDINATES]
J1 500000 300100
J2 500050 300100
O1 500090 300100
`;

describe('engineSource site switching', () => {
  it('serves the active site assets and blocks its focus inlet', () => {
    const site = buildSiteFromFiles({ inp: { name: 'small.inp', text: SMALL_INP } }).site!;
    engineSource.setSite(site);
    expect(engineSource.getSite()).toBe(site);
    expect(engineSource.getTownshipAssets().nodes.map((n) => n.node_id)).toEqual(['J1', 'J2', 'O1']);
    expect(engineSource.blockageForDebris('engine_d07_40pct')).toEqual({ 'INLET-J1': 0.4 });
    engineSource.setSite(null);
    expect(engineSource.getSite()).toBe(TAMAN_KYRA);
    expect(engineSource.blockageForDebris('engine_d07_40pct')).toEqual({ 'INLET-D07': 0.4 });
  });
});
```

  Add `"./import/*"` to `@floodops/engine`'s package `exports` if needed, using the same pattern as `"./scenario/*"`.

  Run `npm -w township-floodops-web test`. Expected: FAIL (`setSite` is missing).

- [ ] **Step 2: `engineSource.ts`.**
  - Add `private site: SiteSpec = TAMAN_KYRA;` with:
    - `setSite(site: SiteSpec | null) { this.site = site ?? TAMAN_KYRA; this.interventions = []; }`
    - `getSite() { return this.site; }`
  - **`blockageForDebris`:** return `this.site.focusInletId ? { [this.site.focusInletId]: c.fraction } : {}`.
  - **`getBootstrap`:**
    - tailwater depths come from `this.site.tailwater`;
    - debris names use `this.site.focusInletId ?? 'inlet'` instead of "D07";
    - the model version name for an imported site is `Imported site: ${site.label}`.
  - **`getTownshipAssets`:**
    - if `!this.site.builtIn`, return `this.site.assets` in the team response shape, with `township_id` and `model_version_id: 'imported_site'`, `source_type: 'imported'` and `assumptions: ['Generated from uploaded files: ' + this.site.label]`;
    - the built-in path stays as it is.
  - **`createSimulation`:**
    - `opts = { …, blockage, site: this.site }`;
    - `buildScenario(ids, stormId, [], opts)`;
    - `makeContext(sc.network, sc.grid, effectiveBlockage(ids, opts), this.site.assets.inlets)`;
    - pass `opts` (including the site) to `runner.run`.

- [ ] **Step 3: `frameAdapter.ts`.**
  - `makeContext(network, grid, blockage, inlets: AssetInlet[] = ASSETS.inlets)`: store `inlets` in the context.
  - `toTeamFrame` maps `ctx.inlets` instead of `ASSETS.inlets`.
  - Existing tests must still pass.

- [ ] **Step 4: `useLiveEngine.ts`.**
  - `contextFor(ids, stormId, opts)` uses `buildScenario(ids, stormId, [], opts)` and `makeContext(…, (opts.site ?? TAMAN_KYRA).assets.inlets)`.
  - `start`, `patch` and `seek` already carry `opts`. The site goes to the worker inside `opts`, so nothing else changes.
  - **App:** `startLive` adds `site: engineSource.getSite()` to its opts.

- [ ] **Step 5: `visualGround.ts` and `EngineWater.tsx`.**
  - **`groundSampler`:** add to `visualGround.ts`:

```ts
import { baseTownship } from '@floodops/engine/scenario/index';
import { siteToLocal, type SiteSpec } from '@floodops/engine/scenario/site';

/** Imported sites: the engine ground itself (bilinear over cell centres), in team metres. Built-in: Jiajie's visual ground. */
export function groundSampler(site: SiteSpec): (tx: number, ty: number) => number {
  if (site.builtIn) return visualGround;
  const g = baseTownship({}, site).grid;
  return (tx, ty) => {
    const p = siteToLocal(site, tx, ty);
    const fx = Math.min(g.nx - 1, Math.max(0, p.x / g.dx - 0.5));
    const fy = Math.min(g.ny - 1, Math.max(0, p.y / g.dx - 0.5));
    const i = Math.min(g.nx - 2, Math.floor(fx));
    const j = Math.min(g.ny - 2, Math.floor(fy));
    const u = fx - i;
    const v = fy - j;
    const z = (ii: number, jj: number) => g.z[jj * g.nx + ii];
    return (1 - u) * (1 - v) * z(i, j) + u * (1 - v) * z(i + 1, j) + (1 - u) * v * z(i, j + 1) + u * v * z(i + 1, j + 1);
  };
}
```

  - **`EngineWater`:** takes a `site` prop.
    - `grid = baseTownship(site.builtIn ? undefined : {}, site).grid`;
    - `toTeam` → `siteToTeam(site, …)`;
    - the base height uses `groundSampler(site)`;
    - recompute the geometry memo when `site.key` changes.
  - **SceneViewer:** passes `site` (Task 5 adds the prop). Until then, call `<EngineWater depth={…} site={TAMAN_KYRA} />` so the build passes.

- [ ] **Step 6: App, HUD and dashboard.**
  - **App:**
    - add `const [site, setSiteState] = useState<SiteSpec>(TAMAN_KYRA);`
    - add `const applySite = (s: SiteSpec | null) => { stopLive(); engineSource.setSite(s); setSiteState(engineSource.getSite()); setAppliedOptionId('baseline'); setFrames([]); setMetrics(null); setEngineRunId(null); setHasSimulationStarted(false); setIsPlaying(false); setCurrentFrameIndex(0); setSelectedDebrisId('engine_d07_40pct'); void loadData(); };` Task 6 calls it.
    - in `handleToggleMode` (entering engine mode), keep the current site; `engineSource.setInterventions([])` already resets interventions.
  - **Dashboard engine options:** `engineOptions` only when `engineMode && site.builtIn`. Otherwise pass `engineNotice="Intervention comparison is available for the built-in township. For an uploaded site, edit the files and re-upload to compare designs."`.
  - **`InterventionDashboard`:** with `engineNotice` set, render:
    - his header, with the badge `FloodOps TS engine (simulated)`;
    - a single panel showing the notice;
    - the footer with only Close (no Apply).

    Mock/API and built-in engine paths stay unchanged.
  - **`SimulationHUD`:** new prop `hotspotLabel?: string`, default `'J07'`. The "J07 peak depth" text becomes `${hotspotLabel} peak depth`. App passes `engineMode && !site.builtIn ? site.hotspotNodeId : undefined`.

- [ ] **Step 7: Verify.** Run `npm -w township-floodops-web test` (PASS), `npm -w township-floodops-web run build` (exit 0) and root `npm test` (PASS). Delete `dist`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src packages/engine/package.json
git commit -m "feat(web): active engine site — assets, runs, live, adapters and water follow the selected site" -m "InterventionDashboard/SimulationHUD by TEH JIA JIE; imported-site branches only."
```

---

### Task 5: Web — `SiteEnvironment` scene for imported sites

**Files:**
- Create: `apps/web/src/site/SiteEnvironment.tsx` and `apps/web/src/site/siteFrame.ts`
- Test: `apps/web/src/site/__tests__/siteFrame.test.ts`
- Modify:
  - `apps/web/src/components/TownshipEnvironment.tsx` (add `export` to `RealisticSuburbanHouse`, `LushTree`, `DetailedRoadSegment`, `CulDeSac`; nothing else)
  - `apps/web/src/components/SceneViewer.tsx`
  - `apps/web/src/view/ViewRig.tsx`
  - `apps/web/src/App.tsx`

**Interfaces:**
- Consumes:
  - `SiteSpec`, `baseTownship`, `siteToTeam`;
  - `groundSampler` (Task 4);
  - `useViewLook`, `applySurfaceLook` (view toggles);
  - his exported components.
- Produces:
  - `siteFrame(site): { cx: number; cz: number; w: number; h: number; groundY: number }` (scene coordinates);
  - SceneViewer prop `site?: SiteSpec` (default `TAMAN_KYRA`);
  - ViewRig prop `frame?: { cx; cz; w; h; groundY }` (default: the current `SITE` and `GROUND_Y`).

- [ ] **Step 1: Failing test** `apps/web/src/site/__tests__/siteFrame.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { TAMAN_KYRA } from '@floodops/engine/scenario/site';
import { siteFrame } from '../siteFrame';

describe('siteFrame', () => {
  it('frames the built-in grid in scene coordinates', () => {
    const f = siteFrame(TAMAN_KYRA);
    expect(f.cx).toBeCloseTo(45);
    expect(f.cz).toBeCloseTo(-5);
    expect(f.w).toBe(250);
    expect(f.h).toBe(290);
    expect(f.groundY).toBeCloseTo(11.65, 6);
  });
});
```

- [ ] **Step 2: `apps/web/src/site/siteFrame.ts`**

```ts
import { medianJunctionGround, type SiteSpec } from '@floodops/engine/scenario/site';

/** Site extent in scene coordinates (x east, z = −north) and a representative ground height for cameras. */
export function siteFrame(site: SiteSpec) {
  const w = site.gridSpec.nx * site.gridSpec.dx;
  const h = site.gridSpec.ny * site.gridSpec.dx;
  return { cx: site.datum.x0 + w / 2, cz: -(site.datum.y0 + h / 2), w, h, groundY: medianJunctionGround(site.assets) };
}
```

- [ ] **Step 3: `apps/web/src/site/SiteEnvironment.tsx`.** Data-driven. All positions are team metres converted to scene `[x, y, −y]`, and heights come from `groundSampler(site)`:
  - **Ground mesh:**
    - a `PlaneGeometry` of `(nx·dx) × (ny·dx)` with `nx−1 × ny−1` segments, rotated flat;
    - each vertex y = `groundSampler(site)(tx, ty)`;
    - vertex colours by the engine grid's land use at that cell: LAWN `#1e3a24`, PARK `#2f5d3a`, ROAD `#1e293b`, ROOF `#1e3a24` (houses sit on top), POND/RIVER `#0e7490`;
    - `meshStandardMaterial vertexColors roughness 0.95`;
    - dispose on change.
  - **Roads:**
    - each `straight` road → `<DetailedRoadSegment position={[r.x, groundAt(r.x, r.y), -r.y]} width={r.width} length={r.length} rotationY={((r.angleDeg + 90) * Math.PI) / 180} heightAt={(tx, ty) => groundAt(tx, ty) + 0.02} />`;
    - each `circle` → `<CulDeSac position={[r.x, groundAt(r.x, r.y), -r.y]} radius={r.radius} heightAt={…same…} />`.
    - **Check the `rotationY` formula against Jiajie's built-in roads:** north street (`angleDeg` 0) is rendered with `rotationY = π/2`, and the drainage boulevard (`angleDeg` −90) with `0`. Use whatever mapping reproduces those.
  - **Houses:** `<RealisticSuburbanHouse position={[h.x, groundAt(h.x, h.y), -h.y]} rotationY={…} scale={h.scale} roofColor={h.roof ?? '#334155'} wallColor={h.wall ?? '#f8fafc'} hasCar={h.hasCar ?? false} carColor={h.carColor} />`.
    - **`rotationY`:** use the same `rotationDeg` → `rotationY` mapping as the `houses` memo in `TownshipEnvironment.tsx`; read it there.
  - **Trees:** `<LushTree position={[t.x, groundAt(t.x, t.y), -t.y]} scale={t.scale} />`, hidden when `ghost || is2d`.
  - **Ponds:** a flat circle at `y = waterLevel`, radius `r`, colour `#0e7490`, opacity 0.85.
  - **Rivers:** a flat plane of `length × width` at `y = site.tailwater.normal`, rotated by `angleDeg`, same colour.
  - **View toggles:** the same `rootRef` / `useLayoutEffect(applySurfaceLook(rootRef.current, ghost, is2d))` pattern as `TownshipEnvironment`, with water planes inside `userData={{ noGhost: true }}` groups.
  - Wrap the component in `React.memo`.

- [ ] **Step 4: SceneViewer and ViewRig.**
  - **SceneViewer:**
    - new prop `site?: SiteSpec` (default `TAMAN_KYRA`);
    - in engine mode with `!site.builtIn`, render `<SiteEnvironment site={site} />` instead of `<TownshipEnvironment …/>`;
    - pass `site` to `<EngineWater depth={engineDepth} site={site} />`;
    - for an imported site:
      - disable the D07 Lowland, Outfall and Upstream preset buttons (`disabled`, plus the existing disabled styles);
      - Overview targets `[f.cx, f.groundY, f.cz]` from `siteFrame(site)`, with the camera at `[f.cx + 15, f.groundY + Math.max(f.w, f.h) * 0.45, f.cz + Math.max(f.w, f.h) * 0.55]`;
    - pass `frame={site.builtIn ? undefined : siteFrame(site)}` to `<ViewRig>`.
  - **ViewRig:** accept `frame?: { cx: number; cz: number; w: number; h: number; groundY: number }`. When given, replace `SITE.cx`, `SITE.cz`, `SITE.w`, `SITE.h` and `GROUND_Y` with `frame.cx`, `frame.cz`, `frame.w`, `frame.h` and `frame.groundY`. Pass `w` and `h` to `orthoZoomFor(size.width, size.height, frame.w, frame.h)`. Without `frame`, nothing changes.
  - **Note:** `SITE.cz` in `scaleBar.ts` is the scene z centre (−10). Keep the built-in behaviour exactly as it is.
  - **App:** pass `site={site}` to `<SceneViewer>`.

- [ ] **Step 5: Verify.**
  - Run `npm -w township-floodops-web test` (PASS), `npm -w township-floodops-web run build` (exit 0) and root `npm test`. Delete `dist`.
  - Reason through the built-in path: `site` is `TAMAN_KYRA` → `TownshipEnvironment`; presets and ViewRig behave as before.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): data-driven SiteEnvironment for imported sites; views frame the active site" -m "Reuses TEH JIA JIE's RealisticSuburbanHouse, LushTree, DetailedRoadSegment and CulDeSac (exported, unchanged)." -m "TownshipEnvironment/SceneViewer by TEH JIA JIE; imported-site branches only."
```

---

### Task 6: Web — import panel, watch for changes, checklist

**Files:**
- Create:
  - `apps/web/src/site/siteFiles.ts` (pure: classify and change detection)
  - `apps/web/src/site/useSiteFiles.ts` (picking, reading, watching)
  - `apps/web/src/site/SiteImportPanel.tsx`
- Test: `apps/web/src/site/__tests__/siteFiles.test.ts`
- Modify:
  - `apps/web/src/components/StatusHeader.tsx` (optional `onOpenSiteImport` prop; button shown only when given)
  - `apps/web/src/App.tsx`
  - `docs/browser-checklist.md`

**Interfaces:**
- Consumes: `buildSiteFromFiles`, `ImportReport`, `ImportFiles`, App's `applySite` (Task 4).
- Produces:
  - `classifySiteFiles(names: string[]): { inp?: string; geojson?: string; asc?: string; unknown: string[]; duplicates: string[] }`
  - `changedFiles(prev: Record<string, number>, next: Record<string, number>): string[]`
  - `useSiteFiles()`: `{ pick(), files, read(): Promise<ImportFiles | null>, canWatch, watching, setWatching(b), lastChange }`
  - `<SiteImportPanel onApply(site) onReset() onClose() activeSiteKey />`

- [ ] **Step 1: Failing test** `apps/web/src/site/__tests__/siteFiles.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { changedFiles, classifySiteFiles } from '../siteFiles';

describe('siteFiles', () => {
  it('classifies files by extension, case-insensitively', () => {
    expect(classifySiteFiles(['a.INP', 'layout.geojson', 'dem.asc', 'notes.txt'])).toEqual({ inp: 'a.INP', geojson: 'layout.geojson', asc: 'dem.asc', unknown: ['notes.txt'], duplicates: [] });
    expect(classifySiteFiles(['layout.json']).geojson).toBe('layout.json');
    expect(classifySiteFiles(['a.inp', 'b.inp']).duplicates).toEqual(['b.inp']);
  });
  it('reports files whose lastModified changed', () => {
    expect(changedFiles({ 'a.inp': 1, 'b.asc': 5 }, { 'a.inp': 2, 'b.asc': 5 })).toEqual(['a.inp']);
    expect(changedFiles({ 'a.inp': 1 }, { 'a.inp': 1 })).toEqual([]);
  });
});
```

- [ ] **Step 2: `apps/web/src/site/siteFiles.ts`**

```ts
const KIND: Array<[RegExp, 'inp' | 'geojson' | 'asc']> = [
  [/\.inp$/i, 'inp'],
  [/\.(geo)?json$/i, 'geojson'],
  [/\.asc$/i, 'asc'],
];

/** Sorts picked file names into the three inputs; a second file of the same kind is a duplicate. */
export function classifySiteFiles(names: string[]): { inp?: string; geojson?: string; asc?: string; unknown: string[]; duplicates: string[] } {
  const out: { inp?: string; geojson?: string; asc?: string; unknown: string[]; duplicates: string[] } = { unknown: [], duplicates: [] };
  for (const n of names) {
    const kind = KIND.find(([re]) => re.test(n))?.[1];
    if (!kind) out.unknown.push(n);
    else if (out[kind]) out.duplicates.push(n);
    else out[kind] = n;
  }
  return out;
}

/** Names whose lastModified differs between two snapshots. */
export function changedFiles(prev: Record<string, number>, next: Record<string, number>): string[] {
  return Object.keys(next).filter((n) => prev[n] !== next[n]);
}

export const WATCH_INTERVAL_MS = 1500;
```

- [ ] **Step 3: `apps/web/src/site/useSiteFiles.ts`**

  **State:**
  - `entries: Array<{ name: string; handle?: FileSystemFileHandle; file?: File }>`
  - `watching: boolean`
  - `lastChange: { names: string[]; at: Date } | null`

  **Behaviour:**
  - **`pick()`:**
    - when `'showOpenFilePicker' in window`: call `window.showOpenFilePicker({ multiple: true, types: [{ description: 'Site files', accept: { 'text/plain': ['.inp', '.asc'], 'application/geo+json': ['.geojson', '.json'] } }] })` and keep the handles. A rejected call (the user cancelled) resolves to no change.
    - otherwise: create an `<input type="file" multiple accept=".inp,.geojson,.json,.asc">`, click it, and keep the `File`s.
  - **`read()`:**
    - classify the names;
    - return `null` without an `.inp`;
    - otherwise read the texts (`(await handle.getFile()).text()` or `file.text()`) into `ImportFiles`.
  - **`canWatch`:** every entry has a handle.
  - **Watching** (an effect while `watching && canWatch`):
    - every `WATCH_INTERVAL_MS`, read `lastModified` from each handle's `getFile()`;
    - compare with the previous snapshot using `changedFiles`;
    - when anything changed, set `lastChange` and call the `onChange` callback passed to the hook (`useSiteFiles({ onChange })`);
    - clear the interval on cleanup or toggle-off.
  - Use `declare global` or a local cast for the `showOpenFilePicker` and `FileSystemFileHandle` types if TypeScript's DOM lib lacks them. Add no dependency.

- [ ] **Step 4: `apps/web/src/site/SiteImportPanel.tsx`**

  A modal in the dashboard's Tailwind style (white card, slate borders, red primary button).

  **Contents:**
  - Title "Import site". The subtitle shows the active site label.
  - A file area:
    - a **Choose files…** button (`pick`);
    - the list of picked names with their detected role (SWMM model / Layout / Height). Unknown names and duplicates are shown in amber.
    - Helper text: "All files must use the same projected coordinate system (metres). Files are read in your browser and are not uploaded."
  - **Check files:** calls `read()`, then `buildSiteFromFiles(files)`, then stores `{ site, report }`.
  - **Report panel:**
    - the summary as key/value rows;
    - **Errors** (red list);
    - **Warnings** (amber);
    - **Assumptions** (slate).
  - **Footer:**
    - **Generate city:** primary, disabled unless `report.ok`. It calls `onApply(site)`.
    - **Reset to built-in Taman Kyra:** calls `onReset()`.
    - **Watch for changes:** a checkbox, shown only when `canWatch`, labelled "(Chrome/Edge)".
    - **Close.**
  - **Watch `onChange`:**
    - re-read, then re-import;
    - if `report.ok`, call `onApply(site)` and show the green line "Updated from <names> at <hh:mm:ss>";
    - otherwise show "Changes in <names> have errors; the current city is kept." with the errors.
  - **Error handling:** read errors (permission revoked, file moved) appear in the errors list. Watching stops on a read error.

- [ ] **Step 5: Wiring.**
  - **`StatusHeader`:** optional `onOpenSiteImport?: () => void`. When given, render a "📂 Import site" button next to the engine/mock/API switch, styled like his header buttons.
  - **App:**
    - add `const [isSiteImportOpen, setIsSiteImportOpen] = useState(false);`
    - pass `onOpenSiteImport={engineMode ? () => setIsSiteImportOpen(true) : undefined}`;
    - render `{engineMode && isSiteImportOpen && <SiteImportPanel activeSite={site} onApply={applySite} onReset={() => applySite(null)} onClose={() => setIsSiteImportOpen(false)} />}`.
    - Keep the panel mounted while watching. Closing the panel stops watching, and the panel says so.

- [ ] **Step 6: Checklist.** Append to `docs/browser-checklist.md`:

```markdown

## Site import — `npm run dev:web` (engine mode)
42. 📂 Import site → choose `data/samples/taman_kyra_site/taman_kyra.inp`, `taman_kyra_layout.geojson`, `taman_kyra_ground.asc` → Check files: no errors; summary shows 9 nodes, 8 pipes, 4 inlets, 35 buildings, grid 125 × 145 at 2 m, moved by (−412000, −336000) m → Generate city: the township looks like the built-in one (roads, houses, pond, canal) and the HUD hotspot reads NODE-J07.
43. Run 80 mm/h: water gathers at J07, P07 turns red — same as the built-in run.
44. Re-import with `taman_kyra_p07_750.inp`: P07 no longer runs full; less water at J07.
45. Watch for changes (Chrome/Edge): edit `taman_kyra.inp` (e.g. move NODE-J05 by 20 m in [COORDINATES], or change PIPE-P05's diameter) and save → within ~2 s the city regenerates and the "Updated from" line appears.
46. Break the file (delete the [OUTFALLS] section) and save → errors shown, the current city kept.
47. Upload only the `.inp`: a city with ground from manhole levels, an outfall sink and default grates; assumptions list says so.
48. Intervention dashboard on an imported site shows the notice and no Apply; Reset to built-in Taman Kyra restores Jiajie's scene and the 7 cards.
49. X-ray and 2D work on an imported site; 2D frames the site and the scale bar is correct.
50. Mock and SWMM API modes: no Import site button; unchanged.
```

- [ ] **Step 7: Verify.** Run `npm -w township-floodops-web test` (PASS), `npm -w township-floodops-web run build` (exit 0) and root `npm test` (PASS). Delete `dist`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src docs/browser-checklist.md
git commit -m "feat(web): import panel — check, generate, reset and watch site files" -m "StatusHeader by TEH JIA JIE; engine-mode button only."
```
