# Site Import: Generate the City from SWMM, GIS and Height Files

**Builds on:**
- Part 2 (the Taman Kyra engine)
- Part 3 (`apps/web` driven by the engine)
- Part 4 (X-ray and 2D views)

**Date:** 2026-10-21

## 1. Goal

In engine mode, a user uploads:
- a **SWMM model file** (`.inp`, required);
- a **GIS layout** (`.geojson`, optional);
- a **height file** (ESRI ASCII grid `.asc`, optional).

The app generates the simulated township from those files, to scale and in the right place:
- the drainage network;
- catchments;
- ground surface;
- buildings, roads, trees, ponds and rivers.

The engine then runs it as before: playback, Live, pipe colours, water and rain.

**Changes to the files must change the city.** A user can:
- re-upload changed files; or
- in Chrome or Edge, turn on **Watch for changes**. The app re-reads the picked files when they are saved, and regenerates the city automatically.

**Demo files:** a synthetic sample package that reproduces today's built-in Taman Kyra is generated and committed, plus an edited variant. It is clearly labelled as synthetic.

## 2. Principles

- **Deterministic:** the conversion is ordinary parsing and geometry, with no LLM. The same files always give the same city.
- **No silent guessing:**
  - Every default or simplification appears in an import report as an **assumption**.
  - Problems appear as **errors**, which block generation, or **warnings**, which don't.
- **To scale:**
  - File coordinates are metres in one projected coordinate system, shared by all three files.
  - The importer only **translates** the site. Distances, sizes and slopes are never scaled.
- **Built-in site unchanged:** the built-in Taman Kyra keeps behaving exactly as now, including:
  - every existing engine, legacy and web test;
  - the dashboard and interventions;
  - Jiajie's scene.
- **Confidential:** files are read in the browser. Nothing is uploaded to a server or stored.

## 3. Engine: a site abstraction (`packages/engine/src/scenario/site.ts`)

- **`SiteSpec`** is a plain, structured-cloneable object, so it can be posted to workers. It holds:
  - `key` (changes with any file content), `label`, `builtIn`;
  - `datum` (team → grid-local offset) and `gridSpec { nx, ny, dx }`;
  - `assets` (Tay's asset format, team coordinates);
  - `layout` (roads, houses, trees);
  - `ponds[]` and `rivers[]`;
  - `subcatchments[]` (optionally with polygons) and `captureCurve`;
  - optional `ground: Float32Array` (one value per grid cell);
  - optional `dip` (the hotspot bowl, built-in only);
  - `hotspotNodeId`, `focusInletId`, `tailwater { normal, high }`;
  - `shift { dx, dy, dz }`: file coordinates minus team coordinates, for display.
- **`TAMAN_KYRA`** is the built-in site, assembled from today's data:
  - `ASSETS`, `LAYOUT`, `hydrology.json`, `inlet_capture.json`;
  - `DATUM`, `GRID`, `TAILWATER`, `DIP`;
  - `LAKE` → `ponds`, `CANAL` → `rivers`.
- **Generic builders:**
  - `buildTerrain(site)`, `buildNetwork(grid, blockage, site)`, `buildCatchments(grid, blockage, site)`;
  - `baseTownship(blockage, site)`, `hotspotCell(site)`;
  - all defaulting to `TAMAN_KYRA`.
  - `ScenarioOptions.site?: SiteSpec` flows through `buildScenario`, the runner cache key (`scenarioKey`) and both workers. The worker protocols already carry `opts`.
- **Interventions:** only for `builtIn` sites. Requesting them on an imported site throws a clear error.

### Terrain

| Case | How the ground is built |
|---|---|
| **With a height file** | Ground = the file, resampled to the grid. Roads, funnels and the dip are not added; the survey is the truth. |
| **Without one** | Today's method: a least-squares plane through node ground levels, grate funnels and road drop. The built-in site also has the J07 dip. |

In both cases:
- Land use comes from the layout: roofs, roads, ponds with a park margin, rivers, otherwise lawn.
- The 0.1 m inlet sump at each grate cell is applied.

### Network

- **Outfalls:** every outfall node discharges into the nearest river cell. If the layout has no river near an outfall, the importer adds a 10 × 10 m outfall sink there and reports it as an assumption.

## 4. Import (`packages/engine/src/import/`)

### SWMM `.inp` (`inp.ts`)

**Used sections:**
- `[JUNCTIONS]`: invert, max depth.
- `[OUTFALLS]`: invert, type, FIXED stage.
- `[STORAGE]`: treated as a junction, with a warning.
- `[CONDUITS]`: from, to, length, roughness n.
- `[XSECTIONS]`: CIRCULAR diameter. Other shapes use Geom1 as the diameter, with a warning.
- `[SUBCATCHMENTS]`: outlet, area in ha, % impervious.
- `[COORDINATES]` and `[POLYGONS]`.

**Ignored, with a note:** `[TIMESERIES]` and `[RAINGAGES]`. Rain comes from the app's storm selector.

**Unsupported:** `[PUMPS]`, `[ORIFICES]`, `[WEIRS]`, `[OUTLETS]`. These give a warning and are skipped. If skipping one leaves a node with no route to an outfall, that is an error.

**Node ground** = invert + max depth.

### GIS layout `.geojson` (`geojson.ts`)

Each feature has `properties.kind`:

| kind | Geometry | Properties |
|---|---|---|
| `building` | Polygon | `rotation_deg?` |
| `road` | LineString | `width_m` (default 8), `surface_z?` |
| `roundabout` | Point | `radius_m` |
| `tree` | Point | `scale?` |
| `pond` | Point or Polygon | `radius_m`, `water_level_m?`, `bed_m?` |
| `river` | LineString | `width_m`, `bed_m?` |
| `inlet` | Point | `inlet_id`, `node_id`, `grate_area_m2?` |
| `hotspot` | Point | `node_id` |

A building polygon becomes an oriented rectangle: its longest edge sets the rotation, unless `rotation_deg` is given. Its width and depth come from the polygon's extent along that axis.

### Height `.asc` (`asciiGrid.ts`)

ESRI ASCII grid: `ncols`, `nrows`, `xllcorner`, `yllcorner`, `cellsize`, `NODATA_value`, with rows from north to south.

### Site builder (`buildSite.ts`)

`buildSiteFromFiles({ inp, geojson?, asc? }) → { site?: SiteSpec, report: ImportReport }`

**Validation errors (block generation):**
- a missing section or coordinates;
- unknown node references;
- duplicate IDs;
- no outfall;
- a node with no downstream path to an outfall;
- coordinates that look like longitude/latitude (all |x| ≤ 180 and |y| ≤ 90): "export in the same projected metric CRS as the SWMM model";
- a malformed `.asc`.

**Validation warnings (don't block):**
- a pipe whose inverts run uphill;
- a stated length that differs from the distance between its nodes by more than 10%;
- a diameter outside 0.15–3.0 m;
- an inlet with no node;
- `NODATA` cells, which are filled with the median and reported.

**Grid:**
- With a height file: the grid is the `.asc` grid.
- Otherwise: the bounding box of every feature plus a 30 m margin, with `dx` = 2 m.
- In both cases, cells are coarsened by an integer factor to stay at or under **40,000 cells**, the engine's live budget. Coarsening is reported.

**Placement:**
- **Translate** x/y so the grid's centre lands on the built-in grid's centre (team x 45, y 5).
- **Shift** z so the median node ground equals the built-in median (11.5 m).
- Both are reported: the shift is shown in the import report summary (Placement). Only translation is applied, so scale is preserved.

**Defaults, each listed as an assumption in the report:**
- **Inlets:** without inlet points, one grate (0.6 m²) at each subcatchment outlet.
- **Hotspot:** without a hotspot point, the junction with the lowest ground.
- **Tailwater:** normal = the FIXED stage, or the outfall invert. High = normal + 1.2 m.
- **Capture curve:** Tay's `inlet_capture.json`.
- **Catchment lag:** 60 s.
- **Catchment cells:** subcatchment polygons if given; otherwise the nearest cells to the outlet, up to the stated area (as now).

## 5. Sample package (`data/samples/taman_kyra_site/`)

Generated by `packages/engine/scripts/makeSamplePackage.ts` from the built-in data. A drift test keeps the committed files identical to the generator's output.

**Files:**
- **`taman_kyra.inp`:** Tay's `models/illustrative_taman_kyra/baseline.inp`, with its coordinates moved into illustrative projected coordinates. The title says it is synthetic.
- **`taman_kyra_layout.geojson`:**
  - Jiajie's layout: roads, houses as rectangles, trees, the pond and the canal;
  - Tay's inlets and the J07 hotspot.
- **`taman_kyra_ground.asc`:** the built-in terrain, at 2 m with 3 decimals.
- **`taman_kyra_p07_750.inp`:** a variant with PIPE-P07 at Ø750, for the "edit the file" demo.
- **`README.md`:** what each file is, the credits, and a demo script (upload, edit a diameter or move a manhole, watch the city change).

**Coordinates:** the built-in team metres plus **(412000, 336000)**, labelled "illustrative projected coordinates, not a real location".

**Equivalence test.** Importing the sample package must give the built-in township back:
- same grid size and datum;
- ground within 1 mm;
- the same land use, apart from at most 0.5% of cells at shape edges;
- the same nodes and pipes;
- on the 80 mm/h storm: J07 peak within 2% and the same homes flooded.

## 6. Web (`apps/web`, engine mode only)

- **Active site:** `engineSource.setSite(site | null)`.
  - Assets, runs, Live, frame adapting, water ground and the bootstrap's tailwater all follow the active site.
  - The debris selector sets `site.focusInletId`, which is INLET-D07 for the built-in site.
- **Scene:**
  - **Built-in site:** Jiajie's `TownshipEnvironment`, unchanged.
  - **Imported site:** a new data-driven **`SiteEnvironment`**, which reuses his exported `RealisticSuburbanHouse`, `LushTree`, `DetailedRoadSegment` and `CulDeSac`. It shows:
    - a displaced ground mesh from the site grid;
    - houses at their rectangles;
    - roads following the ground;
    - trees;
    - pond and river water planes.

    Ghosting and 2D hiding work the same way as on his scene.
- **Engine water:** for imported sites it uses the site ground.
- **Views:** the 2D framing and scale come from the site extent. Camera presets other than Overview are disabled for imported sites.
- **HUD:** the J07 rows read "Hotspot (NODE-…)".
- **Dashboard:** for imported sites it shows "Intervention comparison is available for the built-in township. For an uploaded site, edit the files and re-upload to compare designs." with no cards. Apply is disabled.
- **Import panel** (`apps/web/src/site/`):
  - **Opening it:** an "📂 Import site" button in the header, in engine mode only.
  - **Picking files:** a picker that classifies files by extension; it uses the File System Access API where available, so files can be watched.
  - **Report:** summary, translation and shift, grid, then errors, warnings and assumptions.
  - **Buttons:** **Generate city**, **Reset to built-in Taman Kyra**, and **Watch for changes** (Chrome or Edge, polls `lastModified` every 1.5 s).
  - **On a change:**
    - **Valid files:** re-import and apply, and show "Updated from <file> at hh:mm:ss".
    - **Invalid files:** keep the current city and show the errors.
  - **Applying a site:** stops Live, clears interventions and frames, and refreshes the assets.
- Mock and SWMM API modes are unchanged.

## 7. Tests and verification

**Engine (Vitest):**
- The site refactor is behaviour-identical: all existing tests stay green unchanged.
- Parsers: `.inp` sections and comments, GeoJSON kinds, `.asc` header and orientation.
- Validation: each error and warning.
- Placement: translation and z shift.
- Coarsening.
- Building rectangle fitting.
- Sample drift test.
- Equivalence test.

**Web:**
- Engine-source site switching, which affects assets and blockage keys.
- Watch-change detection logic (pure).

**Browser checklist:** a "Site import" section:
- upload the sample and see the same city;
- upload the P07 Ø750 variant and see the bottleneck go;
- edit a manhole position in the `.inp` with Watch on and see the city update;
- upload a broken file and see a clear error, with the city kept;
- Reset;
- Mock and API unchanged.

## 8. Credit

- Commits are by the user only, with no co-author lines.
- The sample `.inp` derives from Tay Zheheng's `baseline.inp`, and the sample layout from TEH JIA JIE's scene layout; both are credited in the README and the commit bodies.
- Jiajie's scene components are reused through `export`, not copied.
