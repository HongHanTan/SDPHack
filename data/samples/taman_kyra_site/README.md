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
1. Engine mode → 📂 Import site → choose all four files except the P07 variant → Generate city. You should see the same township as the built-in one.
2. Run the 80 mm/h storm: water gathers at the J07 junction and PIPE-P07 runs full.
3. Import again with `taman_kyra_p07_750.inp` instead of `taman_kyra.inp`: P07 no longer runs full and less water reaches the houses.
4. With **Watch for changes** on, open `taman_kyra.inp` in a text editor, change a pipe diameter in [XSECTIONS] or move a manhole in [COORDINATES], and save. The city regenerates within a couple of seconds.

Regenerate these files with `npm -w @floodops/engine run sample`.
