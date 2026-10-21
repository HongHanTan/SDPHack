# Taman Kyra 3-zone demo package (synthetic)

These files are **synthetic**: a demonstration package for the FloodOps automated fix finder. Taman Kyra is not a real
place, and this drainage network is not a real or surveyed one. The coordinates are illustrative projected metres
(built-in coordinates + 412000, 336000), not a real location.

| File | What it is |
|---|---|
| `taman_kyra_demo.inp` | EPA SWMM 5 model of a **modified, synthetic** drainage network with three problem zones (rainfall: the sample's 80 mm/h for 60 min) |
| `taman_kyra_demo_layout.geojson` | The Taman Kyra sample's buildings, roads, trees, pond and canal, with this network's inlets and the NODE-J07 hotspot |
| `taman_kyra_demo_ground.asc` | The Taman Kyra sample's ground heights, 2 m grid (ESRI ASCII grid), unchanged |

## The three zones

| Zone | Where | What is wrong | What the fix finder should find |
|---|---|---|---|
| A, trunk | North: PIPE-P02, NODE-J02 → NODE-J03 | One undersized trunk pipe (Ø375) below the J01 and J02 catchments | An **upsize** of PIPE-P02 |
| B, series branch | East: PIPE-P04 + PIPE-P09, NODE-J04 → NODE-J09 → NODE-J10 | Two undersized pipes (Ø375) in series below the J04 cul-de-sac; upsizing either one alone moves the water to the other | A **relief pipe** bypassing both |
| C, low street | Centre: NODE-J07 (the hotspot) | The street sag has a small grate (0.15 m², a quarter of a standard 0.6 m² grate) for a 2.5 ha catchment; the pipe below (PIPE-P07, Ø750) has spare capacity | **Extra inlet grates** at NODE-J07 |

The site format has no field for a partly blocked grate, so zone C's small, partly blocked grate is written as a small
`grate_area_m2` (0.15 m²).

These outcomes are not stored anywhere: the fix finder must arrive at them by simulating its candidate fixes.
`packages/engine/tests/demoZones.slow.test.ts` (`npm -w @floodops/engine run story`) runs the full pipeline on these
files and checks that it does. All costs the app shows are indicative placeholders.

## Demo
1. Open the app → choose the three files in their slots → Check my files → Build my township → Compare actions.
2. Run the baseline. The fix analysis starts on its own and tests the candidate fixes.
3. Play the baseline: pins appear at PIPE-P02 (zone A), PIPE-P04 + PIPE-P09 (zone B) and NODE-J07 (zone C), each with its own best fix.

## Credits
- Base network: Tay Zheheng's illustrative SWMM model (`models/illustrative_taman_kyra/baseline.inp`), modified here.
- Layout: TEH JIA JIE's scene layout.

Regenerate these files with `npm -w @floodops/engine run sample`.
