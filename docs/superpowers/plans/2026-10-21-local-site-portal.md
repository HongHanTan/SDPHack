# Local Site Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tay's portal and workspace accept only our three files and run entirely in the browser on our engine: no Python API, projects kept in IndexedDB, and street water shown on his map.

**Architecture:**
- The engine gains a storm override, a storm read from the `.inp`, and a helper that changes one pipe's diameter.
- The web gains a local site API under `apps/web/src/site/local/`, which answers the exact request paths Tay's screens use, backed by an IndexedDB store, and runs our engine worker.
- `siteRequest` and `executeSite` route to it.
- The portal's upload section becomes three file slots.
- `SiteScene` gains a water layer.

**Tech Stack:** TypeScript, React 19, @react-three/fiber 9, three 0.170, Vitest 2, IndexedDB (no new dependency).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-10-21-local-site-portal-design.md`, with exact behaviour and labels.
- **Upload:**
  - Only `.inp` (required), `.geojson` (optional) and `.asc` (optional), in three slots: "SWMM model (.inp)", "Layout (.geojson)", "Height grid (.asc)".
  - Removed: CSV, JSON, bundle uploads, column mappings and API connection settings.
- **No server calls** from the site flow. Tay's API code stays in the repo, untouched.
- **IndexedDB:**
  - Database `floodops-local-sites`, with stores `projects`, `runs`, `inspections`, `proposals` and `media`.
  - The newest 6 runs are kept per project.
  - Depth grids are stored every 2nd frame.
- **Tay's screen data shapes stay the same:** `SitePreview`, `SiteProject`, `SimulationRun`, frames and metrics, `InspectionRecord`, `SiteProposal` (`apps/web/src/site/types.ts`, `apps/web/src/types/index.ts`).
- **Wording:**
  - "FloodOps engine (browser)" replaces SWMM labels.
  - "STREET FLOOD VOLUME (≥ 0.15 m) · WHOLE RUN" replaces the network-loss label.
  - Storage text says "stored in this browser".
- **Rainfall:** the uploaded `.inp` rainfall runs the simulation. The app's storm presets are not used in this flow.
- **Unchanged:** our engine dashboard ("Open illustrative demo" → LegacyApp), Mock, SWMM API mode, and all existing tests.
- **Process:**
  - Commits by the user only. NEVER add Co-Authored-By or any co-author line. Do not push. Never stage `md/progress/honghan.md`.
  - Body line on commits touching Tay's files: "SitePortal/SiteWorkspace/SiteScene by Tay Zheheng (zerng); local-engine changes only."
- **Verify:**
  - `npm -w @floodops/engine test` and `npm -w @floodops/engine run typecheck`
  - `npm -w township-floodops-web test`
  - `npm -w township-floodops-web run build` (check the exit code)
  - root `npm test`

  Delete `dist` afterwards.

---

### Task 1: Engine — storm override, storm from `.inp`, pipe-diameter variant

**Files:**
- Modify:
  - `packages/engine/src/scenario/index.ts` (`ScenarioOptions.storm`, used in `buildScenario`, included in `scenarioKey`)
  - `packages/engine/src/import/inp.ts` (if needed)
- Create:
  - `packages/engine/src/import/stormFromInp.ts`
  - `packages/engine/src/scenario/siteVariants.ts`
- Tests:
  - `packages/engine/tests/import/stormFromInp.test.ts`
  - `packages/engine/tests/scenario/siteVariants.test.ts`

**Interfaces:**
- **Produces:**
  - `ScenarioOptions.storm?: Storm`
  - `stormFromInp(text: string): { storm: Storm | null; errors: string[] }`
  - `withPipeDiameter(site: SiteSpec, pipeId: string, diameterM: number): SiteSpec`

**Details:**
- **`buildScenario`:** `storm: opts.storm ?? STORMS[stormId]`.
- **`scenarioKey`:** append `|storm=${hash}`, where `hash` is FNV-1a over `JSON.stringify(opts.storm)`, only when `opts.storm` is set. Built-in keys are byte-identical.
- **`stormFromInp`:**
  - Use `parseInp`'s `rainGages`, `timeseries` and subcatchments' `rainGage`. Pick the gage used by the first subcatchment.
  - Require INTENSITY format, a 300 s interval, and SI flow units (CMS/LPS/MLD); otherwise return an error.
  - Values (mm/h) become `intensity: values × MMHR` (m/s) per 300 s block.
  - The storm is `{ id: 'uploaded_rainfall', label: 'Uploaded rainfall', returnPeriod: 0, blockS: 300, intensity, provisional: false, peakMinute }`, where `peakMinute` = the start minute of the first block with the maximum intensity.
  - No rainfall gives `storm: null` and no error.
- **`withPipeDiameter`:**
  - Deep-copy the site with `structuredClone`.
  - Set the conduit's `diameter_m`; an unknown `pipeId` throws.
  - Set `key = \`${site.key}|${pipeId}@${diameterM}\``.
- **Tests:**
  - The sample `.inp` (`data/samples/taman_kyra_site/taman_kyra.inp`) gives 25 blocks: 12 at 80 mm/h, then 0. `peakMinute` is 0.
  - CFS units give an error; a 10-minute gage gives an error.
  - `withPipeDiameter` changes only that conduit and the key; an unknown pipe throws.
  - `buildScenario([], 'synthetic_80mmh_60min', [], { site, storm })` uses the uploaded storm, and `scenarioKey` differs from the same call without it.
- **Commit:** `feat(engine): uploaded-rainfall storm override and pipe-diameter site variants`

---

### Task 2: Web — local site API, IndexedDB store, local engine runs

**Files:**
- Create in `apps/web/src/site/local/`:
  - `store.ts`: the `SiteStore` interface, `IndexedDbSiteStore`, `MemorySiteStore`
  - `localSiteApi.ts`: `localRequest(path, body?, signal?)` and `localExecute(projectId, body, onStatus, signal)`
  - `preview.ts`: `inspectFiles(name, files)` → `SitePreview`
  - `runs.ts`: engine runs into team results and depth grids
  - tests in `__tests__/` using `MemorySiteStore`
- Modify:
  - `apps/web/src/site/api.ts`: `siteRequest` and `executeSite` delegate to the local API. Remove `fetch` and the base URL from the site flow.
  - `apps/web/src/site/SiteWorkspace.tsx`: only the media upload line, which calls `localUploadMedia(projectId, inspectionId, file)` instead of `fetch`, and the media link URL (an object URL from the store).

**Interfaces:**
- **Consumes:**
  - `buildSiteFromFiles`, `swmmPackageToBundle`, `stormFromInp`, `withPipeDiameter`;
  - the engine `SimRunner` (as in `apps/web/src/engine/engineSource.ts`);
  - `makeContext`, `toTeamFrame`, `toTeamMetrics` (`apps/web/src/engine/frameAdapter.ts`).
- **Produces:**
  - `SiteStore`:

```ts
interface SiteStore {
  putProject(p: StoredProject): Promise<void>;
  getProject(id: string): Promise<StoredProject | undefined>;
  listProjects(): Promise<StoredProject[]>;
  putRun(r: StoredRun): Promise<void>;
  getRun(id: string): Promise<StoredRun | undefined>;
  listRuns(projectId: string): Promise<StoredRun[]>;
  deleteRun(id: string): Promise<void>;
  putRecord(store: 'inspections' | 'proposals', projectId: string, rec: { id: string } & Record<string, unknown>): Promise<void>;
  listRecords(store: 'inspections' | 'proposals', projectId: string): Promise<unknown[]>;
  putMedia(id: string, blob: Blob): Promise<void>;
  getMedia(id: string): Promise<Blob | undefined>;
}
```

  - `StoredProject = SiteProject & { sources: { inp: { name: string; text: string }; geojson?: { name: string; text: string }; asc?: { name: string; text: string } } }`
  - `StoredRun = { run: SimulationRun; projectId: string; frames: SimulationFrame[]; metrics: SimulationMetricsResponse; depth: { times: number[]; cells: number; data: ArrayBuffer } }`
  - `getLocalSiteApi()` returns a singleton backed by IndexedDB in the browser. Tests construct `createLocalSiteApi(new MemorySiteStore())`.

**Behaviour:**
- **Route table:** answer the paths listed in spec §3, returning exactly the shapes Tay's screens read. Use `SitePortal`, `SiteWorkspace` and `types.ts` as the reference.
- **Unknown paths** throw `Error('Unknown local site request: <path>')`.
- **Inspect body:** `{ name, files: { inp, geojson?, asc? } }`, where each file is `{ name, text }`. `SitePortal` (Task 3) sends this shape.
- **Run:**
  - Rebuild the site from `sources` and get the storm with `stormFromInp`.
  - A candidate applies `withPipeDiameter`.
  - The run record starts as `status: 'running'`, then `SimRunner.run([], 'synthetic_80mmh_60min', undefined, [], { site, storm, blockage: {} })`. The storm override makes the id irrelevant.
  - Results become team frames and metrics, plus depth grids sampled every 2nd frame.
  - The record ends as `succeeded`, or `failed` with an error message.
  - Then prune to the newest 6 runs per project.
  - `localExecute` reports status through `onStatus` ("Calculating in this browser · <run id>") and respects `signal`.
- **`acknowledge_assumptions` false:** throw, as Tay's API did. Mirror his rule from `services/api/app/site_projects.py`.
- **IndexedDB** opens once. Each operation is a promise over a transaction.

**Tests:**
- With `MemorySiteStore` and the sample files read via `node:fs`: inspect returns `map_ready` and `simulation_ready` true with the expected counts; create, then list and get, round-trip; inspections and proposals round-trip.
- Mock the runner (inject it) to check the run record lifecycle and pruning to 6.
- An unknown path throws.

**Commit:** `feat(web): local site API — projects, runs and records in this browser on the FloodOps engine`, with Tay's credit body line.

---

### Task 3: Web — three-slot upload, wording, docs

**Files:**
- Modify:
  - `apps/web/src/site/SitePortal.tsx` (upload section and API-settings removal)
  - `apps/web/src/site/SiteWorkspace.tsx` (wording only)
  - `apps/web/src/site/swmmPackage.ts` (adapt or trim to what's still used)
  - `apps/web/public/site-examples/README.md`
  - `packages/engine/scripts/samplePackage.ts` (README demo steps), then regenerate the sample
  - `docs/browser-checklist.md`

**Behaviour:**
- **Upload slots:** three labelled slots with **Choose…** buttons. Each is a hidden `<input type="file">` with `accept` set to `.inp`, `.geojson` or `.asc`. The chosen file's name and size are shown, with a ✕ to clear the slot.
  - **Check my files** is enabled when an `.inp` is chosen. It sends `{ name, files }` to `/api/site-projects/inspect` through `siteRequest`.
  - Changing any slot marks the review dirty, as his `change()` does.
- **Remove:**
  - the multi-file drop box and role selects;
  - CSV mappings and the `mappings` state;
  - the "Local API connection" `<details>`;
  - the base-URL state;
  - Tay's CSV/JSON/bundle example download links;
  - the earlier SWMM-package card, since conversion now happens in the local API's inspect.
- **Keep:** the project name, readiness review, build, saved projects and the demo button.
- **Help text:** "Upload your drainage model as up to three files in the same projected coordinate system (metres): a SWMM model (.inp, required), a layout (.geojson: buildings with height_m, roads with width_m, inlets) and a height grid (.asc). Everything is checked and simulated in this browser; projects are stored in this browser."
- **Template links:** "Download the Taman Kyra sample (3 files)", linking the three files under `/site-examples/taman-kyra-swmm/`.
- **Workspace wording** (spec §4):
  - the run notice;
  - the playback header, "FloodOps engine (browser)" instead of "EPA SWMM {version}";
  - the outcome label and explanation, using the engine's definition: "Sum of each street cell's peak water volume where depth reaches ≥ 0.15 m";
  - the "stored on the API" texts → "stored in this browser";
  - the evidence text about API storage.
- **Unused code:** `inferRole` and the sample-bundle links can be removed if nothing else uses them; check with grep.
- **Docs:**
  - The site-examples README becomes the three-file guide, retiring the CSV/bundle sections.
  - Sample README step 1 becomes "Open the app → choose the three files in their slots → Check my files → Build my township → Compare actions"; regenerate it.
  - In the checklist, mark 54–56 as retired and add:

```markdown
57. Upload screen shows three slots (SWMM model, Layout, Height grid); only the matching file type can be chosen in each; Check my files works with no API running.
58. Build my township shows Tay's map from the three files; Compare actions runs the baseline in the browser (progress shown), then PIPE-P07 at 0.75: the street flood volume drops.
59. Reload the page: the project is listed under Your saved projects and opens with its retained runs; inspections and proposals persist.
```

**Commit:** `feat(web): three-file upload on Tay's portal; engine wording`, with Tay's credit body line.

---

### Task 4: Web — street water on Tay's map

**Files:**
- Modify:
  - `apps/web/src/site/SiteScene.tsx`: an optional prop `water?: { site: SiteSpec; depth: Float32Array | null }`
  - `apps/web/src/site/SiteWorkspace.tsx`: pass the depth for the shown frame
- Create: `apps/web/src/site/SiteWater.tsx`

**Behaviour:**
- **`SiteWater`:** a mesh over `site.gridSpec`, where each cell centre in team metres becomes:
  - file metres = team + `(site.shift.dx, site.shift.dy)`;
  - z = `grid.z[c] + site.shift.dz` + depth;
  - the scene position through Tay's `point(x, y, z)` (pass `point` in).
- **Hidden cells:** depth < 0.01, or POND/RIVER land.
- **Material:** `createWaterMaterial()` with the day colours, as in `EngineWater`. Dispose geometry and material on change.
- **Depth for the shown frame:** the stored grid with the greatest time ≤ the frame's `timestamp_s`.
  - The workspace gets it from the run's `StoredRun.depth`. `localExecute` and the run loading return it alongside frames and metrics; extend `SiteResult` with an optional `depth`.
  - `SiteWorkspace` rebuilds the engine `SiteSpec` once per project with `buildSiteFromFiles` on the stored sources.
- **Scene note:** "Street water from the FloodOps engine (uncalibrated)" when a run is shown.

**Commit:** `feat(web): street water from the engine on Tay's site map`, with Tay's credit body line.
