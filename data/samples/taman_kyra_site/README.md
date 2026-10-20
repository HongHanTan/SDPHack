# Taman Kyra sample site package (synthetic)

These files are **synthetic**. They describe the FloodOps demo township, Taman Kyra, which is not a real place.
The coordinates are illustrative projected metres (built-in coordinates + 412000, 336000), not a real location.

| File | What it is |
|---|---|
| `taman_kyra.inp` | EPA SWMM 5 model of the drainage network: Tay Zheheng's illustrative model, with its coordinates moved into the sample coordinate system |
| `taman_kyra_p07_750.inp` | The same model with PIPE-P07 upsized from Ø600 to Ø750 |
| `taman_kyra_layout.geojson` | Buildings, roads, trees, pond, canal, inlets and the J07 hotspot, from TEH JIA JIE's scene layout |
| `taman_kyra_ground.asc` | Ground heights, 2 m grid (ESRI ASCII grid) |

## Demo
1. In engine mode, click **📂 Import site** and choose the three files taman_kyra.inp, taman_kyra_layout.geojson and taman_kyra_ground.asc (not the P07 variant).
2. Click **Check files**, then **Generate city**. You should see the same township as the built-in one.
3. Run the 80 mm/h storm: expect water to gather at the J07 junction and PIPE-P07 to run full.
4. Click **📂 Import site** again and choose `taman_kyra_p07_750.inp` in place of `taman_kyra.inp`, with the same layout and ground files, then **Check files** and **Generate city**. Run the storm again: expect P07 not to run full and less water at J07.
5. Tick **Watch for changes (Chrome/Edge)**, open `taman_kyra.inp` in a text editor, change a pipe diameter in [XSECTIONS] or move a manhole in [COORDINATES], and save. The city should regenerate within a couple of seconds and an "Updated from" line appears.

Regenerate these files with `npm -w @floodops/engine run sample`.
