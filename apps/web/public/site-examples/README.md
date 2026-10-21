# FloodOps upload files — version 1

These Riverside files are **fictional, synthetic practice data**. They demonstrate file import and native calculations, not field calibration or an approved drainage design.

## Easiest demonstration

1. Open http://localhost:5173 with the updated API running on port 8000.
2. Enter project name `Riverside Estate drainage review`.
3. Upload `riverside-complete.site.json` as file type `bundle`.
4. Click **Check my files**. Expect 5 nodes, 4 pipes, 4 inlets, 4 catchments, 12 rain intervals, 49 terrain points, 3 road features and 8 building footprints. Map and simulation input checks pass. The model remains uncalibrated.
5. Click **Build my township**. Terrain, uploaded roads/buildings and drainage appear in sequence. Select **Surface view** to see solid ground, or **X-ray drainage** to inspect the pipes.
6. Select **Compare actions**. Read **Modelling assumptions**, then tick **I reviewed the assumptions**. Click **Run uploaded baseline**.
7. Select pipe `LINK-TRUNK`, enter proposed diameter `0.60`, then click **Test this pipe change**.
8. With EPA SWMM 5.2.4, expect approximately **1,597.115 m3** baseline and **148.722 m3** pipe-option network flooding loss. These numbers are computed at run time; they are not UI presets. Other engine versions may differ. This is water lost from drainage nodes over the run, not street depth, affected houses or measured flood extent. Both cases use the same uploaded rainfall and other model inputs.
9. Click **Prepare pipe review**. Enter owner `Township engineering team`; keep cost blank unless you have a basis. Save the Draft. It retains source hashes and both run references. No work is approved or dispatched.
10. Use **Projects** to return and reopen the retained site. In **Compare actions > Retained runs**, load the baseline and option to restore their results.

Repeat with `riverside-map-only.site.json` and name `Riverside incomplete survey`. Expect a usable map, missing MH-C invert elevation, missing LINK-TRUNK diameter, and missing catchments/rainfall. The simulation button must stay disabled. To correct a source, edit its original file and create a new reviewed import; imported model versions are immutable.

## Separate files and mappings

Instead of a bundle, select these **nine files together**: `project.json`, `nodes.csv`, `pipes.csv`, `inlets.csv`, `catchments.csv`, `rainfall.csv`, `terrain.csv`, `roads.geojson`, `buildings.geojson`. File roles are suggested from filenames and can be changed. Do not also select a bundle: only one authoritative source may supply each section.

After checking, expand **Review CSV column mappings** if your export uses different column names. Map each required field to its source header, then click **Check my files** again. An unmapped field stays missing; no values are inferred.

## SWMM package

The portal also accepts our SWMM package: one `.inp` model, an optional layout `.geojson` and an optional `.asc` height grid, all in the same projected metres. It is converted in your browser into one `floodops-site-v1` bundle (role `bundle`) whose `source_reference` records the SHA-256 of each original file.

- Coordinates and elevations are copied unchanged; the `.inp` must use SI flow units (CMS, LPS or MLD).
- Junction ground = invert + max depth. An outfall's ground is its invert plus a stated default depth (listed in the notes).
- Buildings need `height_m` and roads need `width_m`; features without them are omitted and listed. Nothing is invented.
- Anything the site format cannot hold (trees, pond, canal, hotspot, roundabout) is left out and listed in the "What was converted / left out" notes.
- Do not mix an `.inp` with the site tables in one selection.

Demo with the files in `taman-kyra-swmm/`:

1. Choose `taman_kyra.inp`, `taman_kyra_layout.geojson` and `taman_kyra_ground.asc`.
2. Check my files: expect 9 nodes, 8 pipes, 4 catchments, 18,125 terrain points, the roads and 35 buildings; map and simulation ready.
3. Build my township.
4. Compare actions: run the baseline, then test PIPE-P07 at 0.75.

## File specification

CSV files have a header row. JSON tables contain arrays of objects using the same field names. A bundle is an object with `format: "floodops-site-v1"`, a `project` object and arrays named `nodes`, `pipes`, `inlets`, `catchments`, `rainfall`, `terrain`, `roads`, `buildings`. Optional `hydrology` can override the explicitly disclosed software assumptions. See the complete example for the exact structure.

| Section | Fields / geometry | Requirements |
|---|---|---|
| project | name, coordinate_units, coordinate_system, vertical_datum, source_type, source_reference | Units must be `m`; declare a common metric site reference and elevation datum. source_type: `synthetic`, `observed`, `assumed` or `literature_derived`. An upload is not automatically observed. |
| nodes | node_id, node_type, x, y, ground_elevation_m, invert_elevation_m, outfall_type, water_level_m | node_type `junction` or `outfall`; ground above invert; outfalls `FREE` or `FIXED`. FIXED needs absolute water elevation in the same datum. |
| pipes | conduit_id, from_node_id, to_node_id, diameter_m, length_m, manning_n; optional shape, inlet_offset_m, outlet_offset_m | Positive dimensions and roughness .005–.5; circular pipes connecting at node inverts only. Every junction needs a directed path to an uploaded outfall. |
| inlets | inlet_id, node_id, x, y, ground_elevation_m, grate_area_m2 | Optional surface markers connected to uploaded nodes. No inlet-capture capacity is inferred from geometry or visible debris. |
| catchments | subcatchment_id, outlet_node_id, area_ha, impervious_percent, width_m, slope_percent | Positive area/width/slope; impervious 0–100; runoff enters the named junction directly. |
| rainfall | time_s, intensity_mmh | Consecutive 5-minute interval starts: 0,300,600…; intensity 0–300 mm/h applies over the following 5 minutes. 1–72 intervals. An additional dry hour lets the network drain. |
| terrain | x, y, z | Optional complete rectangular x/y grid, >=2 distinct x and y values, no duplicates, <=40,000 points; covers all nodes. Missing terrain is displayed as a labelled reference plane. Terrain is used for map geometry, not a 2D flood solver. |
| roads | FeatureCollection or feature array of LineString, properties.width_m | Coordinates in the common site-metre reference; positive actual road width. |
| buildings | FeatureCollection or feature array of Polygon, properties.height_m | One closed exterior ring, no holes; positive uploaded height, no inferred roofs or house models. |

Asset IDs use 1–64 characters: letters, digits, underscore, hyphen or dot; start with a letter/digit. Node, pipe and inlet IDs are globally unique. The pilot supports 500 nodes, 750 pipes, 1,000 features per geometry layer and 5,000 vertices per feature. At most 12 files, 8 MiB each and 24 MiB combined.

The `.geojson` files here are **local metric interchange exports**, not RFC 7946 geographic longitude/latitude. Convert GIS layers to one common metric reference before upload. Native CAD/PDF/GeoTIFF parsing, automatic georeferencing, photogrammetry and automatic drain extraction are not implemented. Export the supported tables first.

## What is calculated and retained

Pipeline: original uploaded text → SHA-256 source manifest → CSV mapping / JSON parsing → units, geometry and connectivity checks → immutable normalized project/model hash → Three.js geometry and native SWMM input → existing native worker → report/binary results and QA → frames/metrics → independently checked proposal links.

Catchment runoff uses SWMM with disclosed surface/Horton assumptions where not supplied. Pipe hydraulics use the uploaded dimensions, elevations, roughness and boundary conditions. The native EPA SWMM dynamic-wave engine computes the results. Only the selected pipe diameter changes in the current uploaded-site intervention workflow. Cleaning, storage and 2D surface comparisons require further supported input models.

Projects, original sources, inspections/media and Draft proposals live on the selected API under `data/runtime/api/site-projects` by default. Runs use the existing retained native run store. Problems/follow-up are browser-local, scoped to that project and API; export them separately in Operations. This local pilot has no user authentication or contractor dispatch. Native errors are displayed; the system never substitutes mock results.
