# Calculation foundation: what is now measured and checked

The browser surface model and native EPA SWMM network model remain separate. Both use synthetic inputs and neither establishes surveyed street flood depths or field-validated intervention benefits.

## Road measurements in the browser demo

1. Dashboard -> Open browser demo.
2. In **Measure a defined street area**, select **D07 street junction** and **15 cm** reference.
3. Leave rain at **80 mm/h for 60 minutes**, assumed inlet loss **40%**, canal **Normal**. Run **Test this storm**, then **Try cleaning D07**, then **Test P07: 600 -> 750 mm**.

The study rectangle is local x=[25,55], y=[-20,20] metres. Only numerical ROAD cells with centres inside the rectangle are measured. Pond/canal/lawn/roof cells and points within 2.5 m of a grate or manhole centre are excluded. There are 196 eligible 2 m x 2 m cells, totalling 784 m2. R1 is the eligible cell nearest the stated probe location, with centre (39,-9), cell index 8184. Its numerical ground is synthetic, not a surveyed pavement elevation.

The diagram and 3D tint identify the same cells; the gold marker is R1. The diagram's dark cells are those above the comparison reference at the displayed sample. The 3D neighbourhood is illustrative geometry, not an absolute-elevation survey.

| Action | Sampled R1 peak | Maximum simultaneous selected road area >=15 cm | Approximate R1 duration >=15 cm |
|---|---:|---:|---:|
| Baseline | 60.0 cm | 760 m2 | 75.0 min |
| Clean D07 | 59.8 cm | 760 m2 | 74.0 min |
| P07 600 -> 750 mm, original inlet loss retained | 7.7 cm | 0 m2 | 0.0 min |

These are rounded results recorded from full 7200-second computations using `node node_modules/tsx/dist/cli.mjs tmp/foundation-road-smoke.ts` on 2026-10-21. They are documentation, not UI lookup values. The UI independently runs its worker and derives metrics from the returned frames. Browser runs took approximately 17-19 seconds each on this machine; other hardware varies. The recorded relative water-balance errors were around 1.1e-11; conservation does not establish physical accuracy.

Change study area to **Downstream street / J08 approach** without rerunning physics. Its baseline point peak is about 7.1 cm, while maximum simultaneous road area above 15 cm is 120 m2. This demonstrates why a single point cannot describe the whole road area. The larger-pipe case has 0 m2 above that reference in this downstream study. A change of reference reanalyses the same stored frames, not the hydraulic inputs.

Definitions:

- Sampled peak: maximum returned depth at fixed road cell R1.
- Affected area at a sample: count of eligible road cells with depth >= selected reference multiplied by 4 m2. Displayed maximum is the largest one-frame value, not the union of individual cell maxima over time.
- R1 duration: right-endpoint estimate, summing actual output time intervals whose ending R1 depth meets the reference. Production frames are 30 seconds apart; peaks/crossings between frames can be missed. Still-above-reference at the final sample is shown explicitly.
- References 10/15/20 cm are user comparison settings, not road-safety criteria. No dry-access, property-protection or monetary saving is inferred.
- The old inlet-cell maximum is retained only as a diagnostic `sumpSummary`; it no longer drives the road headline or curve.

## Matching-input checks

Browser hydraulic snapshots identify the complete grid using SHA-256 fingerprints for ground, land classes, infiltration, building IDs and initial water. A candidate must keep scenario, storm, base options, timing and grid fingerprints equal. Network/catchment data must match the selected actions. Unexpected differences fail the comparison and do not retain displayable metrics. A separate assessment snapshot identifies the road mask/reference; changing that analysis does not change the hydraulic input hash.

Expand **Shared input checks passed** after calculating an action to see its basis. Native proposal validation also reconstructs the expected candidate from the retained baseline; client-provided metrics, hashes and asset targets are replaced with retained server results. Labelling a pipe run as a storage run is rejected.

## Native interventions, API v1.4.0

The request extension is `intervention: {"actions": ["upsize-p07"]}`. Null remains the unchanged reference. Supported unique actions are:

- `desilt-d07`: restore native D07 finite-inlet hydraulic loss to zero, preserving the original source hypothesis in its provenance.
- `upsize-p07`: change P07 diameter from 0.6 to 0.75 m; other geometry remains fixed.
- `storage-tank`: add a conceptual 2000 m2 x 2 m tank at local (60,20), invert 8.9 m; 0.9 m feed from J05 and 0.15 m outlet to J08.
- `lake-overflow`: add a conceptual 2000 m2 x 1 m storage cell at local (70,-85), invert 9.8 m, connected from J04 by a 0.6 m pipe. It is not a surveyed existing pond and is not a quantitative cross-engine match to the browser lake representation.

These actions can be combined. Native storage uses SWMM functional depth-area storage; links use the existing dynamic-wave calculation. Each run starts from a fresh input copy and retains the exact changes, .inp/.rpt/.out, hashes, parsed results and numerical warnings. The public baseline asset registry is unchanged. Map preview reads the executed candidate's resolved assets, so its pipe diameter and added conceptual storage match the loaded native frames. High-tailwater native presets remain unavailable pending their own numerical checks.

Use **Settings -> Live FastAPI -> Compare**, choose a native finite D07 preset and Normal tailwater, then **Run matching comparisons**. Baseline and all candidates use one shared inlet source record. An older API lacking the intervention capability marks candidates unavailable and asks for an update; it never manufactures an intervention result.

## Executable reference checks

Expand **Calculation checks and validation limits** in the browser demo.

**Run browser reference checks** executes small numerical cases for: rainfall accumulation on a closed flat surface (analytic depth = intensity x time), hydrostatic water over uneven ground (constant free surface), and the full-bore Manning capacity calculation. It displays actual calculated/reference values, errors and stated project diagnostic tolerances.

**Run native SWMM reference checks** calls `POST /api/validation/reference-checks` on the configured local API. It executes and retains two isolated native models:

- Full-pipe flow under approximately constant head: independent Manning reference 0.6140115433 m3/s; native last-three-sample mean around 0.6141133308 m3/s; absolute difference about 0.0001017876 m3/s, within the stated 2% diagnostic tolerance.
- An isolated 1000 m2 tank at initial depth 1 m with no inflows/outflows/losses: maximum native depth change is 0 m against a 0 m reference, tolerance 1e-6 m.

API reference artifacts are retained under its runtime `reference-checks/<id>/`. The returned report contains native run/input hashes, numerical QA and a report hash. Missing API/engine or failed calculations show an error; no browser substitute is returned as a native check.

**What these checks do not establish:** real township hydrology, surveyed pavement levels, road inundation accuracy, construction feasibility or measured savings. Passing pipe/storage calculations does not validate a 2D surface model. The existing repository's historical unmatched-catchment SWMM cross-check remains report-only and is not presented as an accuracy pass.

Field validation still requires suitable surveyed inputs and independent observed events, with acceptance criteria agreed by the responsible engineer. Sources for storage formulation and validation distinction: [EPA SWMM 5.2 manual](https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P10145M6.TXT), [EPA model configuration/calibration guidance](https://www.epa.gov/n-steps-online/mechanistic-modeling-configuration-calibration).

## Checks completed

- Frontend: 63 tests across 21 files, TypeScript and production build pass.
- API/simulation: 100 tests pass, including actual native baseline, cleaning, pipe/storage/pond/combinations, input isolation, forged-proposal rejection and analytic checks.
- Contract export/check matches v1.4.0. Retained T1-T3 evidence is not overwritten.
- HTTP health/bootstrap and native reference checks succeeded on localhost:8000; Vite serves the current demo on localhost:5173.
- No connected CUA browser is available. Automated checks and HTTP responses do not establish visual/WebGL or click acceptance.
