# SWMM Package → Site Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tay's upload portal (`apps/web/src/site/SitePortal.tsx`) stays the product's entry, with his UI, dashboard and Python site API unchanged. It additionally accepts our three files: a SWMM `.inp`, our layout `.geojson` and a height `.asc`. They are converted in the browser into his `floodops-site-v1` bundle and submitted as one `bundle` file, so his Check → Build → workspace → native SWMM flow runs unchanged.

**Architecture:**
- A pure converter, `swmmPackageToBundle`, in `packages/engine/src/import/toSiteBundle.ts`.
  - It reuses our parsers (`parseInp`, extended additively; `parseLayoutGeoJson`; `parseAsciiGrid`) and validation (`buildSiteFromFiles`).
  - It maps the result onto Tay's bundle schema (`simulation/site_import.py`), following his principle that no value is inferred. Unsupported or missing things are **omitted with a note**, never invented.
- `SitePortal` detects an `.inp` among the picked files, converts the package, and swaps the selection for the generated bundle. It shows the original files, the warnings and the notes.

**Tech Stack:** TypeScript, Vitest 2, React 19; Tay's FastAPI and Python parser (unchanged).

## Global Constraints

**What stays unchanged:**
- Tay's UI, dashboard, API and Python parser are unchanged, apart from a small, gated `SitePortal` edit.
- His CSV, JSON and bundle uploads work as before.
- Our engine importer's behaviour (`buildSiteFromFiles`) is unchanged, and existing tests stay unchanged.

**Tay's bundle schema** (`simulation/site_import.py`):

| Section | Fields and rules |
|---|---|
| top level | `format: "floodops-site-v1"`; `project`; arrays `nodes`, `pipes`, `inlets`, `catchments`, `rainfall`, `terrain`, `roads`, `buildings`; optional `hydrology` |
| `project` | `name`, `coordinate_units: "m"`, `coordinate_system`, `vertical_datum`, `source_type` (one of `synthetic`, `observed`, `assumed`, `literature_derived`), `source_reference` |
| `nodes` | `node_id`, `node_type` (`junction`/`outfall`), `x`, `y`, `ground_elevation_m`, `invert_elevation_m`, `outfall_type` (`FREE`/`FIXED`), `water_level_m` (FIXED: absolute, ≥ invert) |
| `pipes` | `conduit_id`, `from_node_id`, `to_node_id`, `diameter_m`, `length_m`, `manning_n` (0.005–0.5); circular, connecting at node inverts |
| `inlets` | `inlet_id`, `node_id`, `x`, `y`, `ground_elevation_m`, `grate_area_m2` |
| `catchments` | `subcatchment_id`, `outlet_node_id`, `area_ha`, `impervious_percent`, `width_m`, `slope_percent` |
| `rainfall` | `time_s` = 0, 300, 600, … consecutively; `intensity_mmh` 0–300; 1–72 intervals |
| `terrain` | `{x, y, z}` points on a complete rectangular grid, ≤ 40,000 points, covering all nodes |
| `roads` | GeoJSON LineString features with `properties.width_m` > 0 |
| `buildings` | Polygon features, one closed ring, with `properties.height_m` > 0. **Heights are not inferred.** |
| `hydrology` | `surface_parameters { n_impervious, n_pervious, storage_impervious_mm, storage_pervious_mm, zero_storage_impervious_percent }` and `horton_parameters { max_infiltration_mmh, min_infiltration_mmh, decay_per_hour, drying_time_days, max_infiltration_mm }` |

- **IDs** match `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`.

**Conversion rules** (every entry is listed in the converter's `notes`):
- **Coordinates and elevations** are taken from the files unchanged: no translation, no z shift.
- **Rainfall:**
  - comes from the rain gage that the subcatchments reference, through its `[TIMESERIES]`;
  - must be INTENSITY format, 5-minute steps and SI flow units (CMS/LPS/MLD); otherwise it's an error;
  - more than 72 intervals is an error.
- **Outfalls:** FIXED → `outfall_type FIXED` with `water_level_m` = stage. FREE → FREE. Other types become FREE with a warning. An outfall's ground = invert + 2.0 m, listed as a note.
- **Pipe offsets and non-circular shapes:** listed as warnings (offsets dropped; Geom1 used as the diameter).
- **Not carried into the bundle**, each with a note:
  - roads without `width_m`;
  - roundabouts;
  - buildings without `height_m`;
  - trees, ponds, rivers and the hotspot;
  - subcatchment polygons.
- **Hydrology:** taken from `[SUBAREAS]` and HORTON `[INFILTRATION]` when every subcatchment shares the same values. If they differ, the first subcatchment's values are used, with a warning. If the sections are absent, there is no `hydrology` and Tay's defaults apply; his report discloses them.
- **Terrain:** the `.asc` cell centres in file coordinates. Grids over 40,000 points are coarsened by an integer block mean, with a warning. NODATA cells get the median, with a warning.
- **`source_type`:** `synthetic` when `[TITLE]` contains "synthetic" (case-insensitive); otherwise `assumed`, with a note to change it if the data is observed.
- **`source_reference`:** "Converted in the browser from <file names> (SHA-256 <first 12 hex> …)". The web layer passes this in.

**Sample package:**
- The generated sample layout's buildings gain an explicit synthetic `height_m: 7`.
- The generator also writes the package to `apps/web/public/site-examples/taman-kyra-swmm/`, and the drift test checks both copies.

**Process:**
- Commits by the user only. NEVER add `Co-Authored-By` or any co-author line. Do not push. Never stage `md/progress/honghan.md`.
- **Credit lines:**
  - On commits touching his files: "SitePortal by Tay Zheheng (zerng); SWMM package option only."
  - On commits using Tay's model: "Sample network from Tay Zheheng's illustrative SWMM model."

**Verify:**
- `npm -w @floodops/engine test` and `npm -w @floodops/engine run typecheck`
- `npm -w township-floodops-web test`
- `npm -w township-floodops-web run build` (check the exit code)
- root `npm test`

Delete `dist` afterwards.

---

### Task 1: Converter (engine, pure)

**Files:**
- Modify: `packages/engine/src/import/inp.ts` (additive fields only)
- Create:
  - `packages/engine/src/import/toSiteBundle.ts`
  - `packages/engine/tests/import/toSiteBundle.test.ts`

**Interfaces:**
- **Produces:**
  - `InpModel` gains:
    - `title: string[]`
    - `flowUnits: string | null`
    - `rainGages: Map<string, { format: string; intervalS: number; series: string }>`
    - `timeseries: Map<string, Array<{ t: number; v: number }>>`, with `t` in seconds from the series' first entry
    - `subareas: Map<string, number[]>` (N-Imperv, N-Perv, S-Imperv, S-Perv, PctZero)
    - `infiltration: Map<string, number[]>`
    - `infiltrationModel: string | null` (from `[OPTIONS] INFILTRATION`)
    - and each subcatchment gains `rainGage`, `widthM` and `slopePercent`.
  - `swmmPackageToBundle(files: ImportFiles, sourceReference: string): { bundle: Record<string, unknown> | null; errors: string[]; warnings: string[]; notes: string[]; counts: Record<string, number> }`

- [ ] **Step 1: Failing tests.** In `toSiteBundle.test.ts`, read the sample files in `data/samples/taman_kyra_site/` with `node:fs`, as the equivalence test does. Assert:
  - `errors` is empty;
  - `bundle.format === 'floodops-site-v1'`;
  - `project.source_type === 'synthetic'` and `project.coordinate_units === 'm'`;
  - nodes: 9, with NODE-OUT01 `outfall_type: 'FIXED'`, `water_level_m: 8.2`, invert 8.2, and NODE-J07 `x: 412040, y: 336000, ground 11, invert 9`;
  - pipes: 8, with PIPE-P07 diameter 0.6, length 50, n 0.013;
  - inlets: 4 (INLET-D07 on NODE-J07, grate 0.6);
  - catchments: 4, each with `width_m: 100`, `slope_percent: 1`, area 1, impervious 80;
  - rainfall: 25 rows, `time_s` 0…7200 in 300 steps, intensity 80 for the first 12 rows and 0 after;
  - terrain: 125 × 145 = 18,125 points, with the first point at the south-west cell centre (411921, 335861);
  - roads: every LineString with `width_m`. Count the sample's straight roads; the roundabout is omitted with a note.
  - buildings: 35 with `height_m: 7`, once Task 1 Step 4 regenerates the sample;
  - `hydrology.surface_parameters.n_impervious === 0.015` and `hydrology.horton_parameters.max_infiltration_mmh === 75`;
  - `notes` mention trees, the pond, the canal (rivers), the hotspot and the roundabout.

  Also add small inline tests:
  - an `.inp` with `FLOW_UNITS CFS` gives a "SI" error;
  - a 10-minute rain gage gives a "5-minute" error;
  - an `.inp` without `[TIMESERIES]` gives no rainfall, with a note;
  - a building without `height_m` is omitted, with a note;
  - an outfall of type NORMAL becomes FREE, with a warning.
- [ ] **Step 2: Extend `parseInp`.**
  - **`[OPTIONS]`:** `FLOW_UNITS` and `INFILTRATION`.
  - **`[TITLE]`:** the lines, with the `;` comment prefix stripped. (The current parser drops comment lines, so read `[TITLE]` raw lines before comment stripping.)
  - **`[RAINGAGES]`:** `name format interval(h:mm or decimal hours) SCF TIMESERIES series`.
  - **`[TIMESERIES]`:** rows of `name [date] time value`, where time is `h:mm[:ss]` or decimal hours. Convert to seconds, combining date and time when a date is present, relative to the series' first row.
  - **`[SUBCATCHMENTS]`:** add `rainGage` (t[1]), `widthM` (t[5]) and `slopePercent` (t[6]).
  - **`[SUBAREAS]` and `[INFILTRATION]`:** numeric arrays.
  - **Keep all existing fields and behaviour.** The existing import tests must still pass unchanged.
- [ ] **Step 3: Implement `swmmPackageToBundle`.**
  - First call `buildSiteFromFiles(files)`. If its report has errors, return them (`bundle: null`), and carry its warnings across.
  - Then build each bundle section by the conversion rules above, collecting `notes` and `warnings`.
  - `counts` = the length of each section.
  - The project `name` is the `.inp` file stem.
  - `coordinate_system` is "SWMM model coordinates (projected metres); layout and height files in the same reference".
  - `vertical_datum` is "Elevations as given in the SWMM model".
- [ ] **Step 4: Sample buildings get a height.**
  - In `packages/engine/scripts/samplePackage.ts`, add `height_m: 7` to each building feature's properties, labelled in the README as an illustrative synthetic height.
  - Make the generator also write every file to `apps/web/public/site-examples/taman-kyra-swmm/`. The CLI writes both directories.
  - Extend `tests/samplePackage.drift.test.ts` to check both copies.
  - Run `npm -w @floodops/engine run sample`.
  - The equivalence test (`npm -w @floodops/engine exec vitest run tests/samplePackage.equivalence.test.ts`, run in the background) must still pass, since the importer ignores `height_m`.
- [ ] **Step 5: Verify.** `npm -w @floodops/engine test` and `npm -w @floodops/engine run typecheck` must PASS.
  - If `python` is available with the repo's API requirements, also check the bundle against Tay's parser, and record the result:

```bash
node -e "…write the bundle for the sample to %TEMP%/tk.site.json…"
python -c "import json,sys; sys.path.insert(0,'.'); from simulation.site_import import parse_upload; t=open(sys.argv[1]).read(); r=parse_upload([{'name':'tk.site.json','text':t,'role':'bundle'}],'Taman Kyra',{}); print(r['map_ready'], r['simulation_ready'], [i for i in r['issues'] if i['level']!='warning'])" %TEMP%/tk.site.json
```

  - Expected: `True True []`. If his parser reports issues, fix the converter.
- [ ] **Step 6: Commit**

```bash
git add packages/engine data/samples apps/web/public/site-examples/taman-kyra-swmm
git commit -m "feat(engine): convert a SWMM package (.inp + layout + height grid) into the floodops-site-v1 bundle" -m "Sample network from Tay Zheheng's illustrative SWMM model."
```

---

### Task 2: Portal integration and docs

**Files:**
- Modify:
  - `apps/web/src/site/SitePortal.tsx` (small, gated)
  - `apps/web/public/site-examples/README.md` (add a section)
  - `packages/engine/scripts/samplePackage.ts` (README demo steps), then regenerate the sample
  - `docs/browser-checklist.md`
- Create:
  - `apps/web/src/site/swmmPackage.ts` (web glue: SHA-256 via `crypto.subtle`, classification, and the call to the converter)
  - `apps/web/src/site/__tests__/swmmPackage.test.ts`

**Interfaces:**
- **Consumes:** `swmmPackageToBundle` (Task 1).
- **Produces:** `convertSwmmPackage(files: Array<{ name: string; text: string }>): Promise<{ bundleFile?: { name: string; text: string; role: 'bundle' }; originals: string[]; errors: string[]; warnings: string[]; notes: string[]; counts: Record<string, number> }>`

- [ ] **Step 1: Failing test.** `swmmPackage.test.ts`:
  - Feed the three sample texts from `apps/web/public/site-examples/taman-kyra-swmm/`, read with `node:fs`.
  - Expect a `bundleFile` named `taman_kyra.site.json` with role `bundle`, `JSON.parse(text).format === 'floodops-site-v1'`, `originals` listing the three names, and a `source_reference` containing "SHA-256".
  - **Mixing** an `.inp` with a `nodes.csv` gives the error "Upload either a SWMM package (.inp with optional layout .geojson and height .asc) or the site tables, not both."
  - **Two `.inp` files** give a duplicate error.
- [ ] **Step 2: Implement `swmmPackage.ts`.**
  - Classify by extension: `.inp`; `.asc`; and `.geojson`/`.json`. Any other `.json` in a SWMM package counts as the layout only if it is a FeatureCollection; otherwise it's an error.
  - Hash each original with `crypto.subtle.digest('SHA-256')`, which is available in Node 18+ for Vitest.
  - Build the source reference and call the converter. Return the result.
- [ ] **Step 3: `SitePortal` edit**, small and gated on an `.inp` being present:
  - **File input:** `accept` becomes `.csv,.json,.geojson,.inp,.asc`, and the drop label reads "CSV, JSON, site-metre GeoJSON, or a SWMM package (.inp + layout .geojson + height .asc)".
  - **In the `onChange` handler:** if any picked name ends in `.inp`, read the texts and call `convertSwmmPackage`.
    - On errors: `setError(errors.join(' '))` and keep `files` empty.
    - Otherwise: `setFiles([bundleFile])`, and store `{ originals, warnings, notes, counts }` in a new state `swmm`.
    - Without an `.inp`: his existing code path, unchanged.
  - **Summary card:** when `swmm` is set, render it under the file list in his `site-help`/`site-warning` styles:
    - "SWMM package converted in your browser: {originals.join(', ')} → {bundleFile.name}";
    - the counts;
    - the warnings (amber) and notes (a `<details>` "What was converted / left out ({notes.length})").
  - Clearing the selection or picking new files resets `swmm`.
  - **Help text:** in his "What files do I need?" block, add one paragraph: "A SWMM package also works: a .inp model with optional layout .geojson (buildings need height_m; roads need width_m) and .asc height grid in the same projected metres. It is converted into a site bundle in your browser; anything the site format can't hold is listed, never invented."
  - **Template links:** add "Download SWMM sample package (3 files)", linking the three files under `/site-examples/taman-kyra-swmm/`.
- [ ] **Step 4: Docs.**
  - **Site-examples README:** add a "SWMM package" section with the conversion rules (summarised from Global Constraints) and the demo:
    1. Choose the three Taman Kyra files.
    2. Check my files: expect 9 nodes, 8 pipes, 4 catchments, 18,125 terrain points, the roads and 35 buildings; map and simulation ready.
    3. Build my township.
    4. Compare actions: run the baseline, then test PIPE-P07 at 0.75.
  - **Sample README** (generator constant): replace the demo steps with the portal flow (Choose your site files → the three files → Check my files → Build my township → Compare actions). Regenerate it; the drift test must pass.
  - **`docs/browser-checklist.md`:** add a note at items 42–53 that the engine-mode Import site page was replaced by Tay's portal. Append:

```markdown
54. Portal: choose taman_kyra.inp + taman_kyra_layout.geojson + taman_kyra_ground.asc → a "SWMM package converted" card lists originals, counts and what was left out (trees, pond, canal, hotspot, roundabout) → Check my files: map and simulation ready.
55. Build my township → Compare actions → Run uploaded baseline → test PIPE-P07 at 0.75 m: the network flooding loss drops.
56. A building without height_m in a custom layout is omitted with a note; an .inp mixed with nodes.csv shows the "either … or" error. CSV/JSON uploads behave as before.
```

- [ ] **Step 5: Verify.** Run `npm -w township-floodops-web test`, `npm -w township-floodops-web run build` (exit 0), `npm -w @floodops/engine test` and root `npm test`. Delete `dist`.
- [ ] **Step 6: Commit**

```bash
git add apps/web packages/engine/scripts/samplePackage.ts data/samples docs/browser-checklist.md
git commit -m "feat(web): portal accepts a SWMM package and converts it to a site bundle in the browser" -m "SitePortal by Tay Zheheng (zerng); SWMM package option only."
```
