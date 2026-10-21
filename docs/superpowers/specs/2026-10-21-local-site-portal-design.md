# Tay's Site Portal, Run Locally on Our Engine (No Python API)

**Date:** 2026-10-21
**Builds on:**
- the site-import spec `2026-10-21-site-import-design.md` (engine importer, `SiteSpec`);
- the SWMM-package converter (`swmmPackageToBundle`).

## 1. Goal

- **Keep Tay's screens:** the upload portal (`SitePortal`) and the workspace (`SiteWorkspace`, with tabs for Site map, Compare actions, Operations, Evidence & inputs, and Work proposals).
- **Accept only our three files:** a SWMM `.inp` (required), a layout `.geojson` (optional) and a height grid `.asc` (optional). CSV, JSON and bundle uploads are removed.
- **No server:** checking, building, simulating and storage all happen in the browser. Tay's Python API stays in the repo but the app doesn't use it.

## 2. Upload screen

- **Three fixed slots**, each with its own button and the chosen file's name:
  - "SWMM model (.inp)": required;
  - "Layout (.geojson)": optional;
  - "Height grid (.asc)": optional.

  A slot accepts only its own extension. Picking a file again replaces only that slot.
- **Removed:**
  - the multi-file drop box;
  - per-file role selects;
  - CSV column mappings;
  - the "Local API connection" settings.
- **Kept:**
  - project name;
  - **Check my files** (readiness review: counts, map/simulation readiness, issues, assumptions);
  - **Build my township**;
  - **Your saved projects**;
  - **Open illustrative demo**.
- **Template links:** the three Taman Kyra sample files.
- **Help text:** describes the three files, the projected-metres rule, `height_m` on buildings and `width_m` on roads.

## 3. Local site API (`apps/web/src/site/local/`)

The same request paths Tay's screens use, answered in the browser:

| Request | Answered by |
|---|---|
| `GET /api/site-projects` | list of saved projects |
| `POST /api/site-projects/inspect` | `SitePreview` from the three files |
| `POST /api/site-projects` | create a project |
| `GET /api/site-projects/{id}` | the project |
| `GET`/`POST …/{id}/inspections` | inspections |
| media upload | Blob store |
| `GET`/`POST …/{id}/proposals` | proposals |
| `GET`/`POST …/{id}/simulations` | engine runs |
| `GET /api/simulations/{run}`, `/frames`, `/metrics` | run status and results |
| `GET …/{id}/sources` | the original files |

**Inspect** (`SitePreview`):
- `site` = `swmmPackageToBundle(…).bundle`, which is Tay's `ImportedSite` shape, so his map works unchanged.
- `issues`:
  - converter or importer errors → level `map`;
  - missing catchments or rainfall → level `simulation`;
  - warnings → level `warning`.
- `assumptions` = the importer's assumptions plus the converter's notes.
- `map_ready` = no `map` issues. `simulation_ready` = additionally no `simulation` issues.
- `counts` from the converter.
- `manifest` = the three originals (name, SHA-256, bytes, role `swmm`/`layout`/`height`).
- `fields` = `{}`.

**Project:**
- `project_id` = `site_` + 32 hex characters;
- `model_hash` = SHA-256 of the canonical bundle JSON;
- the three original texts are kept for **Download original** and for re-importing the engine site;
- `is_verified_site_model: false`.

**Storage:**
- IndexedDB database `floodops-local-sites`, with stores for `projects`, `runs`, `inspections`, `proposals` and `media`.
- A small promise wrapper, with no new dependency.
- An in-memory implementation of the same interface for tests.

**Runs (Compare actions):**
- **Engine site:** rebuild the `SiteSpec` from the stored originals with `buildSiteFromFiles`.
- **Rainfall:** the storm comes from the `.inp`'s rainfall (`stormFromInp`): 5-minute blocks, then the engine's recession hour.
- **Candidate run:** `withPipeDiameter(site, pipe_id, diameter_m)` builds a new site with its own `key`.
- **Execution:** the engine `SimRunner` web worker, with `opts.site` and `opts.storm`. Results go through `toTeamFrame` and `toTeamMetrics` into Tay's `SimulationFrame` and `SimulationMetricsResponse` shapes.
- **Run record** (Tay's `SimulationRun` shape):
  - `engine: 'FloodOps TS engine'`;
  - `input_snapshot.intervention.changes = [{ asset_id, after }]` for candidates;
  - `input_hash`;
  - `status` running → succeeded/failed.
- **Street-water depth grids** are stored with the run, every 2nd frame (60 s), for the map's water layer.
- The newest 6 runs are kept per project; older ones are pruned.

## 4. Workspace wording, to match what is computed

- "Native SWMM" and "EPA SWMM {version}" → "FloodOps engine (browser)".
- The outcome label "NETWORK FLOODING LOSS · WHOLE RUN … water lost from network nodes" → "STREET FLOOD VOLUME (≥ 0.15 m) · WHOLE RUN", with the engine's own definition text.
- The run notice says results are computed in this browser and are uncalibrated.
- Text about the API or storage on the server says the project is stored in this browser.

## 5. Street water on the map

- `SiteScene` gains an optional water layer, drawn when a run is shown. It is a mesh over the engine grid, with:
  - cell centres converted from team metres to file metres (+ `site.shift`);
  - height = engine ground + depth, plus `shift.dz`, mapped through Tay's `point()`;
  - cells under 0.01 m hidden;
  - pond and river cells excluded;
  - our water material.
- The depth for the shown frame comes from the stored grids (the nearest earlier stored frame).
- The scene note changes from "no street-water layer is inferred" to "Street water from the FloodOps engine (uncalibrated)".

## 6. Engine additions (`packages/engine`)

- `ScenarioOptions.storm?: Storm` overrides `STORMS[stormId]`. `scenarioKey` includes a storm hash when it is given.
- `stormFromInp(text): Storm | null`: the rain gage the subcatchments use, INTENSITY format, 5-minute steps, SI units; mm/h → m/s.
- `withPipeDiameter(site, pipeId, d): SiteSpec`: a copy with that conduit's diameter changed and the key suffixed.

## 7. Credit and process

- Tay's screens are kept; edits to his files are limited to the upload section, wording, the api.ts routing and the scene's water layer.
- Commit bodies credit him.
- Commits by the user only, with no co-author lines. No push until asked.
