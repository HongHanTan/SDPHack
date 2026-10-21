# Taman Kyra sample site package (synthetic)

These files are **synthetic**. They describe the FloodOps demo township, Taman Kyra, which is not a real place.
The coordinates are illustrative projected metres (built-in coordinates + 412000, 336000), not a real location.

| File | What it is |
|---|---|
| `taman_kyra.inp` | EPA SWMM 5 model of the drainage network: Tay Zheheng's illustrative model, with its coordinates moved into the sample coordinate system |
| `taman_kyra_p07_750.inp` | The same model with PIPE-P07 upsized from Ø600 to Ø750 |
| `taman_kyra_layout.geojson` | Buildings, roads, trees, pond, canal, inlets and the J07 hotspot, from TEH JIA JIE's scene layout. Every building has `height_m: 7`, an illustrative synthetic height (not a survey value) |
| `taman_kyra_ground.asc` | Ground heights, 2 m grid (ESRI ASCII grid) |

## Demo
1. Start the app with the local API running on port 8000 (see md/UPLOAD_FIRST_WALKTHROUGH.md) and open the upload portal: **Choose your site files** → pick the three files `taman_kyra.inp`, `taman_kyra_layout.geojson` and `taman_kyra_ground.asc`. They are converted to a site bundle in your browser.
2. **Check my files**: expect 9 nodes, 8 pipes, 4 catchments, 18,125 terrain points, the roads and 35 buildings, with map and simulation ready.
3. **Build my township**.
4. **Compare actions**: run the baseline, then test PIPE-P07 at 0.75 m (the same change as `taman_kyra_p07_750.inp`): the network flooding loss drops.

Regenerate these files with `npm -w @floodops/engine run sample`.
