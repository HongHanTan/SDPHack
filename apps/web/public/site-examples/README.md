# FloodOps upload files

The upload screen takes exactly three files, all in the same projected coordinate system (metres):

| Slot | File | Required | What it holds |
|---|---|---|---|
| SWMM model | `.inp` | yes | Junctions, outfalls, conduits and their coordinates, subcatchments and a rain gage |
| Layout | `.geojson` | no | Buildings with `height_m`, roads with `width_m`, inlets (and trees, pond, canal, hotspot, which the site format leaves out) |
| Height grid | `.asc` | no | Ground heights as an ESRI ASCII grid |

Everything is checked, built and simulated in your browser. Projects, runs, inspections and proposals are stored in this browser (IndexedDB). There is no server and no sign-in. Results come from the FloodOps engine and are uncalibrated.

## Demo with the Taman Kyra sample

The files are in `taman-kyra-swmm/` (synthetic practice data, not a real place).

1. Open the app and choose the three files in their slots: `taman_kyra.inp`, `taman_kyra_layout.geojson`, `taman_kyra_ground.asc`.
2. **Check my files**: expect 9 nodes, 8 pipes, 4 catchments, 18,125 terrain points, the roads and 35 buildings; map and simulation ready.
3. **Build my township**.
4. **Compare actions**: run the baseline (progress is shown), then test PIPE-P07 at 0.75 m. The street flood volume drops.
5. Reload the page: the project is listed under **Your saved projects** and reopens with its retained runs.

## How the files are read

- The `.inp` must use SI flow units (CMS, LPS or MLD). Coordinates and elevations are copied unchanged.
- Junction ground = invert + max depth. An outfall's ground is its invert plus a stated default depth (listed in the notes).
- Rainfall comes from the rain gage the subcatchments use (INTENSITY format, 5-minute steps); a dry hour follows so the network can drain.
- Buildings need `height_m` and roads need `width_m`; features without them are omitted and listed. Nothing is invented.
- Anything the site format cannot hold is left out and listed in the review notes.
- A height grid is used for the ground shape and the street model; without one, the ground is a labelled reference plane.
- Each file can be at most 8 MiB.

The `.geojson` is a local metric export, not RFC 7946 longitude/latitude. Convert GIS layers to one metric reference first. CAD, PDF and GeoTIFF are not parsed.

## What is calculated

Original files -> SHA-256 manifest -> SWMM-to-site conversion and checks -> FloodOps engine (browser worker) -> frames and metrics.

The street flood volume is the sum of each street cell's peak water volume where depth reaches 0.15 m or more; it is not a simultaneous peak, and pond and canal cells are excluded. Only the selected pipe diameter changes in the pipe comparison. Baseline and option use the same rainfall and other inputs.

The newest 6 runs are kept per project. Problems and follow-ups stay browser-local too. Errors are shown; the system never substitutes mock results.
