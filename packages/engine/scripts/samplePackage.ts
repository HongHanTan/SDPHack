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

interface LayoutOptions {
  name: string;
  description: string;
  inlets: ReadonlyArray<{ inlet_id: string; node_id: string; x: number; y: number; grate_area_m2: number }>;
  hotspot: { node_id: string; x: number; y: number };
}
const hotspotNode = TAMAN_KYRA.assets.nodes.find((n) => n.node_id === TAMAN_KYRA.hotspotNodeId)!;
const SAMPLE_LAYOUT: LayoutOptions = {
  name: 'taman_kyra_layout',
  description: "FloodOps synthetic sample layout (illustrative projected metres, not a real location). Derived from TEH JIA JIE's scene layout; inlets from Tay Zheheng's synthetic assets.",
  inlets: TAMAN_KYRA.assets.inlets.map((i) => ({ inlet_id: i.inlet_id, node_id: i.node_id, x: i.position_m.x, y: i.position_m.y, grate_area_m2: i.grate_area_m2 })),
  hotspot: { node_id: hotspotNode.node_id, x: hotspotNode.position_m.x, y: hotspotNode.position_m.y },
};

function geojson(opts: LayoutOptions = SAMPLE_LAYOUT): string {
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
  for (const i of opts.inlets) add('inlet', { type: 'Point', coordinates: [X(i.x), Y(i.y)] }, { inlet_id: i.inlet_id, node_id: i.node_id, grate_area_m2: i.grate_area_m2 });
  add('hotspot', { type: 'Point', coordinates: [X(opts.hotspot.x), Y(opts.hotspot.y)] }, { node_id: opts.hotspot.node_id });
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      name: opts.name,
      description: opts.description,
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
1. Open the app → choose the three files in their slots (\`taman_kyra.inp\`, \`taman_kyra_layout.geojson\`, \`taman_kyra_ground.asc\`) → Check my files → Build my township → Compare actions.
2. **Check my files**: expect 9 nodes, 8 pipes, 4 catchments, 18,125 terrain points, the roads and 35 buildings, with map and simulation ready.
3. **Build my township**.
4. **Compare actions**: run the baseline, then test PIPE-P07 at 0.75 m (the same change as \`taman_kyra_p07_750.inp\`): the street flood volume drops.

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

// ---------------------------------------------------------------------------------------------------------------------
// 3-zone demo package (synthetic): the same Taman Kyra layout and ground, with a modified drainage network that has three
// independent problem zones. The fix finder's results on it come from engine runs only (tests/demoZones.slow.test.ts).

/** Where the 3-zone demo package is written (relative to the repo root): the data copy and the copy the web app serves. */
export const DEMO_DIRS = ['data/samples/taman_kyra_demo', 'apps/web/public/site-examples/taman-kyra-demo'] as const;

/** A synthetic drainage network in built-in (team) metres; pipe lengths are the distances between their nodes. */
export interface DemoNetwork {
  junctions: ReadonlyArray<{ id: string; x: number; y: number; invert: number; depth: number }>;
  outfalls: ReadonlyArray<{ id: string; x: number; y: number; invert: number }>;
  conduits: ReadonlyArray<{ id: string; from: string; to: string; diameter: number }>;
  catchments: ReadonlyArray<{ id: string; outlet: string; areaHa: number; imperviousPercent: number }>;
  /** Street grates (at their node). */
  inlets: ReadonlyArray<{ id: string; node: string; grateAreaM2: number }>;
  hotspot: string;
}

/**
 * The demo network (synthetic, tuned with engine runs). Zone A (north): trunk PIPE-P02 J02 → J03 is undersized for the
 * two catchments above it. Zone B (east): PIPE-P04 and PIPE-P09 in series below the J04 cul-de-sac are both undersized.
 * Zone C (centre, the low street at J07): a small grate (part of it blocked) with spare pipe capacity below.
 */
export const DEMO_NETWORK: DemoNetwork = {
  junctions: [
    { id: 'NODE-J01', x: 0, y: 120, invert: 10.4, depth: 1.3 },
    { id: 'NODE-J02', x: 80, y: 120, invert: 10.1, depth: 1.6 },
    { id: 'NODE-J03', x: 40, y: 80, invert: 9.8, depth: 2 },
    { id: 'NODE-J04', x: 120, y: 80, invert: 10, depth: 1.2 },
    { id: 'NODE-J05', x: 80, y: 40, invert: 9.7, depth: 1.7 },
    { id: 'NODE-J06', x: 0, y: 0, invert: 9.5, depth: 1.6 },
    { id: 'NODE-J07', x: 40, y: 0, invert: 9, depth: 0.8 },
    { id: 'NODE-J08', x: 40, y: -50, invert: 8.6, depth: 2 },
    { id: 'NODE-J09', x: 100, y: 30, invert: 9.7, depth: 1.6 },
    { id: 'NODE-J10', x: 100, y: -20, invert: 9.45, depth: 1.45 },
  ],
  outfalls: [{ id: 'NODE-OUT01', x: 40, y: -100, invert: 8.2 }],
  conduits: [
    { id: 'PIPE-P01', from: 'NODE-J01', to: 'NODE-J02', diameter: 0.6 },
    { id: 'PIPE-P02', from: 'NODE-J02', to: 'NODE-J03', diameter: 0.375 },
    { id: 'PIPE-P03', from: 'NODE-J03', to: 'NODE-J05', diameter: 0.75 },
    { id: 'PIPE-P05', from: 'NODE-J05', to: 'NODE-J08', diameter: 0.75 },
    { id: 'PIPE-P04', from: 'NODE-J04', to: 'NODE-J09', diameter: 0.375 },
    { id: 'PIPE-P09', from: 'NODE-J09', to: 'NODE-J10', diameter: 0.375 },
    { id: 'PIPE-P10', from: 'NODE-J10', to: 'NODE-J08', diameter: 0.6 },
    { id: 'PIPE-P06', from: 'NODE-J06', to: 'NODE-J07', diameter: 0.45 },
    { id: 'PIPE-P07', from: 'NODE-J07', to: 'NODE-J08', diameter: 0.75 },
    { id: 'PIPE-P08', from: 'NODE-J08', to: 'NODE-OUT01', diameter: 1.05 },
  ],
  catchments: [
    { id: 'CATCH-D01', outlet: 'NODE-J01', areaHa: 1, imperviousPercent: 80 },
    { id: 'CATCH-D02', outlet: 'NODE-J02', areaHa: 1, imperviousPercent: 80 },
    { id: 'CATCH-D04', outlet: 'NODE-J04', areaHa: 1.5, imperviousPercent: 80 },
    { id: 'CATCH-D07', outlet: 'NODE-J07', areaHa: 2.5, imperviousPercent: 80 },
  ],
  inlets: [
    { id: 'INLET-D01', node: 'NODE-J01', grateAreaM2: 0.6 },
    { id: 'INLET-D02', node: 'NODE-J02', grateAreaM2: 0.6 },
    { id: 'INLET-D04', node: 'NODE-J04', grateAreaM2: 0.6 },
    { id: 'INLET-D07', node: 'NODE-J07', grateAreaM2: 0.15 },
  ],
  hotspot: 'NODE-J07',
};

const DEMO_TITLE =
  '; FloodOps SYNTHETIC 3-zone demo site package (Taman Kyra layout). Not a real location and not a real drainage network:\n' +
  '; coordinates are illustrative projected metres. The network is a modified copy of Tay Zheheng\'s illustrative SWMM model\n' +
  '; (models/illustrative_taman_kyra/baseline.inp) with three problem zones: A trunk PIPE-P02, B series PIPE-P04 + PIPE-P09,\n' +
  '; C low street NODE-J07 with a small grate.';

const f3 = (v: number) => String(r3(v));

/** The demo .inp: the baseline's options, rain gage and rainfall, with the demo network's sections written in. */
function demoInp(baselineInp: string, net: DemoNetwork): string {
  const pos = new Map([...net.junctions, ...net.outfalls].map((n) => [n.id, n]));
  const len = (a: string, b: string) => Math.hypot(pos.get(a)!.x - pos.get(b)!.x, pos.get(a)!.y - pos.get(b)!.y);
  const body: Record<string, string[]> = {
    SUBCATCHMENTS: net.catchments.map((c) => `${c.id} RAIN-G01 ${c.outlet} ${c.areaHa} ${c.imperviousPercent} 100 1 0`),
    SUBAREAS: net.catchments.map((c) => `${c.id} 0.015 0.15 1 4 25 OUTLET 100`),
    INFILTRATION: net.catchments.map((c) => `${c.id} 75 5 4 7 0`),
    JUNCTIONS: net.junctions.map((j) => `${j.id} ${j.invert} ${j.depth} 0 0 0`),
    OUTFALLS: net.outfalls.map((o) => `${o.id} ${o.invert} FIXED ${o.invert} NO`),
    CONDUITS: net.conduits.map((c) => `${c.id} ${c.from} ${c.to} ${f3(len(c.from, c.to))} 0.013 0 0 0 0`),
    XSECTIONS: net.conduits.map((c) => `${c.id} CIRCULAR ${c.diameter} 0 0 0 1`),
    COORDINATES: [...net.junctions, ...net.outfalls].map((n) => `${n.id} ${X(n.x)} ${Y(n.y)}`),
  };
  const out: string[] = [];
  let section = '';
  for (const line of baselineInp.split(/\r?\n/)) {
    const head = /^\[([^\]]+)\]/.exec(line.trim());
    if (head) {
      section = head[1].toUpperCase();
      out.push(line);
      if (section === 'TITLE') out.push(DEMO_TITLE);
      if (body[section]) out.push(...body[section], '');
      continue;
    }
    if (section === 'TITLE' || body[section]) continue;
    out.push(line);
  }
  return out.join('\n');
}

function demoLayout(net: DemoNetwork): LayoutOptions {
  const node = (id: string) => net.junctions.find((j) => j.id === id)!;
  return {
    name: 'taman_kyra_demo_layout',
    description:
      "FloodOps SYNTHETIC 3-zone demo layout (illustrative projected metres, not a real location). Buildings, roads, pond and canal from TEH JIA JIE's scene layout; inlets and hotspot belong to the synthetic demo network.",
    inlets: net.inlets.map((i) => ({ inlet_id: i.id, node_id: i.node, x: node(i.node).x, y: node(i.node).y, grate_area_m2: i.grateAreaM2 })),
    hotspot: { node_id: net.hotspot, x: node(net.hotspot).x, y: node(net.hotspot).y },
  };
}

export function makeDemoFiles(baselineInp: string, net: DemoNetwork = DEMO_NETWORK): Record<string, string> {
  return {
    'taman_kyra_demo.inp': demoInp(baselineInp, net),
    'taman_kyra_demo_layout.geojson': geojson(demoLayout(net)) + '\n',
    'taman_kyra_demo_ground.asc': ground(),
    'README.md': DEMO_README,
  };
}

const DEMO_README = `# Taman Kyra 3-zone demo package (synthetic)

These files are **synthetic**: a demonstration package for the FloodOps automated fix finder. Taman Kyra is not a real
place, and this drainage network is not a real or surveyed one. The coordinates are illustrative projected metres
(built-in coordinates + ${SAMPLE_OFFSET.x}, ${SAMPLE_OFFSET.y}), not a real location.

| File | What it is |
|---|---|
| \`taman_kyra_demo.inp\` | EPA SWMM 5 model of a **modified, synthetic** drainage network with three problem zones (rainfall: the sample's 80 mm/h for 60 min) |
| \`taman_kyra_demo_layout.geojson\` | The Taman Kyra sample's buildings, roads, trees, pond and canal, with this network's inlets and the NODE-J07 hotspot |
| \`taman_kyra_demo_ground.asc\` | The Taman Kyra sample's ground heights, 2 m grid (ESRI ASCII grid), unchanged |

## The three zones

| Zone | Where | What is wrong | What the fix finder should find |
|---|---|---|---|
| A, trunk | North: PIPE-P02, NODE-J02 → NODE-J03 | One undersized trunk pipe (Ø375) below the J01 and J02 catchments | An **upsize** of PIPE-P02 |
| B, series branch | East: PIPE-P04 + PIPE-P09, NODE-J04 → NODE-J09 → NODE-J10 | Two undersized pipes (Ø375) in series below the J04 cul-de-sac; upsizing either one alone moves the water to the other | A **relief pipe** bypassing both |
| C, low street | Centre: NODE-J07 (the hotspot) | The street sag has a small grate (0.15 m², a quarter of a standard 0.6 m² grate) for a 2.5 ha catchment; the pipe below (PIPE-P07, Ø750) has spare capacity | **Extra inlet grates** at NODE-J07 |

The site format has no field for a partly blocked grate, so zone C's small, partly blocked grate is written as a small
\`grate_area_m2\` (0.15 m²).

These outcomes are not stored anywhere: the fix finder must arrive at them by simulating its candidate fixes.
\`packages/engine/tests/demoZones.slow.test.ts\` (\`npm -w @floodops/engine run story\`) runs the full pipeline on these
files and checks that it does. All costs the app shows are indicative placeholders.

## Demo
1. Open the app → choose the three files in their slots → Check my files → Build my township → Compare actions.
2. Run the baseline. The fix analysis starts on its own and tests the candidate fixes.
3. Play the baseline: pins appear at PIPE-P02 (zone A), PIPE-P04 + PIPE-P09 (zone B) and NODE-J07 (zone C), each with its own best fix.

## Credits
- Base network: Tay Zheheng's illustrative SWMM model (\`models/illustrative_taman_kyra/baseline.inp\`), modified here.
- Layout: TEH JIA JIE's scene layout.

Regenerate these files with \`npm -w @floodops/engine run sample\`.
`;
