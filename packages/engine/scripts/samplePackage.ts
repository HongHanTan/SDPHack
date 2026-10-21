import { HOUSE, INLET_SUMP } from '../src/scenario/config';
import { LAYOUT } from '../src/scenario/layout';
import { buildTerrain } from '../src/scenario/terrain';
import { cellIn, siteToLocal, TAMAN_KYRA } from '../src/scenario/site';

/** Where the sample package is written (relative to the repo root): the data copy and the copy the web app serves. */
export const SAMPLE_DIRS = ['data/samples/taman_kyra_site', 'apps/web/public/site-examples/taman-kyra-swmm'] as const;

/** Illustrative projected coordinates (metres) for the sample package: not a real location. */
export const SAMPLE_OFFSET = { x: 412000, y: 336000 };
/** Illustrative synthetic building height (m) written on every sample building: not a survey value. */
export const SAMPLE_BUILDING_HEIGHT_M = 7;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const X = (x: number) => r3(x + SAMPLE_OFFSET.x);
const Y = (y: number) => r3(y + SAMPLE_OFFSET.y);
const TITLE =
  '; FloodOps synthetic sample site package (Taman Kyra). Not a real location: coordinates are illustrative projected metres.\n' +
  "; Network: Tay Zheheng's illustrative SWMM model (models/illustrative_taman_kyra/baseline.inp).";

function withCoordinates(inp: string): string {
  const out: string[] = [];
  let section = '';
  for (const line of inp.split(/\r?\n/)) {
    const head = /^\[([^\]]+)\]/.exec(line.trim());
    if (head) section = head[1].toUpperCase();
    if (section === 'TITLE' && head) {
      out.push(line, TITLE);
      continue;
    }
    if (section === 'COORDINATES' && !head && line.trim() && !line.trim().startsWith(';')) {
      const [id, x, y] = line.trim().split(/\s+/);
      out.push(`${id} ${X(Number(x))} ${Y(Number(y))}`);
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function geojson(): string {
  const feats: unknown[] = [];
  const add = (kind: string, geometry: unknown, props: Record<string, unknown> = {}) => feats.push({ type: 'Feature', geometry, properties: { kind, ...props } });
  for (const r of LAYOUT.roads) {
    if (r.kind === 'circle') {
      add('roundabout', { type: 'Point', coordinates: [X(r.x), Y(r.y)] }, { id: r.id, radius_m: r.radius, surface_z: (r as unknown as { surfaceZ: number }).surfaceZ });
    } else {
      const a = (r.angleDeg * Math.PI) / 180;
      const hx = (Math.cos(a) * r.length) / 2;
      const hy = (Math.sin(a) * r.length) / 2;
      add('road', { type: 'LineString', coordinates: [[X(r.x - hx), Y(r.y - hy)], [X(r.x + hx), Y(r.y + hy)]] }, { id: r.id, width_m: r.width, surface_z: (r as unknown as { surfaceZ: number }).surfaceZ });
    }
  }
  for (const h of LAYOUT.houses as Array<Record<string, unknown> & { id: string; x: number; y: number; rotationDeg: number; scale: number }>) {
    const a = (h.rotationDeg * Math.PI) / 180;
    const w = (HOUSE.width * h.scale) / 2;
    const d = (HOUSE.depth * h.scale) / 2;
    const corner = (su: number, sv: number) => [X(h.x + su * w * Math.cos(a) - sv * d * Math.sin(a)), Y(h.y + su * w * Math.sin(a) + sv * d * Math.cos(a))];
    const ring = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1), corner(-1, -1)];
    const { id, x: _x, y: _y, rotationDeg: _r, scale: _s, ...rest } = h;
    add('building', { type: 'Polygon', coordinates: [ring] }, { id, rotation_deg: h.rotationDeg, ...rest, height_m: SAMPLE_BUILDING_HEIGHT_M });
  }
  for (const t of LAYOUT.trees) add('tree', { type: 'Point', coordinates: [X(t.x), Y(t.y)] }, { scale: t.scale });
  for (const p of TAMAN_KYRA.ponds) add('pond', { type: 'Point', coordinates: [X(p.x), Y(p.y)] }, { id: p.id, radius_m: p.radius, water_level_m: p.waterLevel, bed_m: p.bedZ });
  for (const r of TAMAN_KYRA.rivers) {
    const a = (r.angleDeg * Math.PI) / 180;
    const hx = (Math.cos(a) * r.length) / 2;
    const hy = (Math.sin(a) * r.length) / 2;
    add('river', { type: 'LineString', coordinates: [[X(r.cx - hx), Y(r.cy - hy)], [X(r.cx + hx), Y(r.cy + hy)]] }, { id: r.id, width_m: r.width, bed_m: r.bedZ });
  }
  for (const i of TAMAN_KYRA.assets.inlets) add('inlet', { type: 'Point', coordinates: [X(i.position_m.x), Y(i.position_m.y)] }, { inlet_id: i.inlet_id, node_id: i.node_id, grate_area_m2: i.grate_area_m2 });
  const j07 = TAMAN_KYRA.assets.nodes.find((n) => n.node_id === TAMAN_KYRA.hotspotNodeId)!;
  add('hotspot', { type: 'Point', coordinates: [X(j07.position_m.x), Y(j07.position_m.y)] }, { node_id: j07.node_id });
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: 'taman_kyra_layout',
      description: "FloodOps synthetic sample layout (illustrative projected metres, not a real location). Derived from TEH JIA JIE's scene layout; inlets from Tay Zheheng's synthetic assets.",
      features: feats,
    },
    null,
    1,
  );
}

function ground(): string {
  const g = buildTerrain(TAMAN_KYRA);
  const z = Float32Array.from(g.z);
  // The importer re-applies the inlet sump, so export the ground without it.
  for (const i of TAMAN_KYRA.assets.inlets) {
    const p = siteToLocal(TAMAN_KYRA, i.position_m.x, i.position_m.y);
    z[cellIn(TAMAN_KYRA.gridSpec, p.x, p.y)] += INLET_SUMP;
  }
  const { nx, ny, dx } = TAMAN_KYRA.gridSpec;
  const lines = [`ncols ${nx}`, `nrows ${ny}`, `xllcorner ${X(TAMAN_KYRA.datum.x0)}`, `yllcorner ${Y(TAMAN_KYRA.datum.y0)}`, `cellsize ${dx}`, 'NODATA_value -9999'];
  for (let j = ny - 1; j >= 0; j--) {
    const row: string[] = [];
    for (let i = 0; i < nx; i++) row.push(z[j * nx + i].toFixed(3));
    lines.push(row.join(' '));
  }
  return lines.join('\n') + '\n';
}

const README = `# Taman Kyra sample site package (synthetic)

These files are **synthetic**. They describe the FloodOps demo township, Taman Kyra, which is not a real place.
The coordinates are illustrative projected metres (built-in coordinates + ${SAMPLE_OFFSET.x}, ${SAMPLE_OFFSET.y}), not a real location.

| File | What it is |
|---|---|
| \`taman_kyra.inp\` | EPA SWMM 5 model of the drainage network: Tay Zheheng's illustrative model, with its coordinates moved into the sample coordinate system |
| \`taman_kyra_p07_750.inp\` | The same model with PIPE-P07 upsized from Ø600 to Ø750 |
| \`taman_kyra_layout.geojson\` | Buildings, roads, trees, pond, canal, inlets and the J07 hotspot, from TEH JIA JIE's scene layout. Every building has \`height_m: ${SAMPLE_BUILDING_HEIGHT_M}\`, an illustrative synthetic height (not a survey value) |
| \`taman_kyra_ground.asc\` | Ground heights, 2 m grid (ESRI ASCII grid) |

## Demo
1. Start the app with the local API running on port 8000 (see md/UPLOAD_FIRST_WALKTHROUGH.md) and open the upload portal: **Choose your site files** → pick the three files \`taman_kyra.inp\`, \`taman_kyra_layout.geojson\` and \`taman_kyra_ground.asc\`. They are converted to a site bundle in your browser.
2. **Check my files**: expect 9 nodes, 8 pipes, 4 catchments, 18,125 terrain points, the roads and 35 buildings, with map and simulation ready.
3. **Build my township**.
4. **Compare actions**: run the baseline, then test PIPE-P07 at 0.75 m (the same change as \`taman_kyra_p07_750.inp\`): the network flooding loss drops.

Regenerate these files with \`npm -w @floodops/engine run sample\`.
`;

export function makeSampleFiles(baselineInp: string): Record<string, string> {
  const inp = withCoordinates(baselineInp);
  const p07 = inp
    .replace(/^(PIPE-P07\s+CIRCULAR\s+)0\.6(\s)/m, '$10.75$2')
    .replace(TITLE, `${TITLE}\n; Variant: PIPE-P07 upsized to 750 mm.`);
  return {
    'taman_kyra.inp': inp,
    'taman_kyra_p07_750.inp': p07,
    'taman_kyra_layout.geojson': geojson() + '\n',
    'taman_kyra_ground.asc': ground(),
    'README.md': README,
  };
}
