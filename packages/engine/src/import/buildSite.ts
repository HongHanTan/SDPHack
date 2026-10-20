import { HOUSE, TAILWATER } from '../scenario/config';
import type { AssetConduit, AssetInlet, AssetNode, Assets, RoadCircle, RoadStraight } from '../scenario/layout';
import { buildCatchments } from '../scenario/catchments';
import { buildNetwork } from '../scenario/network';
import { buildTerrain } from '../scenario/terrain';
import { LandUse, type Grid } from '../sim/types';
import { cellIn, medianJunctionGround, siteToLocal, TAMAN_KYRA, type SiteHouse, type SitePond, type SiteRiver, type SiteSpec } from '../scenario/site';
import { parseAsciiGrid, type AsciiGrid } from './asciiGrid';
import { fitRect, type Ring } from './geometry';
import { parseLayoutGeoJson, type LayoutDefaults, type LayoutFeatures } from './geojson';
import { parseInp } from './inp';

export const MAX_CELLS = 40_000;
export const DEFAULT_DX = 2;
export const MARGIN_M = 30;
export const DEFAULT_GRATE_M2 = 0.6;
export const DEFAULT_ROAD_WIDTH_M = 8;
export const DEFAULT_OUTFALL_DEPTH_M = 2;
export const SINK_SIZE_M = 10;
const HIGH_RISE_M = TAILWATER.high - TAILWATER.normal; // 1.2
const POND_BED_BELOW_MEDIAN_M = 2.4;
const POND_WATER_ABOVE_BED_M = 0.6;
const RIVER_BED_BELOW_OUTFALL_M = 0.6;
const UNSUPPORTED = ['PUMPS', 'ORIFICES', 'WEIRS', 'OUTLETS'];
const IGNORED = ['TIMESERIES', 'RAINGAGES'];

export interface ImportFiles {
  inp: { name: string; text: string };
  geojson?: { name: string; text: string };
  asc?: { name: string; text: string };
}
export interface ImportReport {
  ok: boolean;
  errors: string[];
  warnings: string[];
  assumptions: string[];
  summary: Array<[string, string]>;
}

/** FNV-1a 32-bit, hex. */
function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const TK_CENTRE = {
  x: TAMAN_KYRA.datum.x0 + (TAMAN_KYRA.gridSpec.nx * TAMAN_KYRA.gridSpec.dx) / 2,
  y: TAMAN_KYRA.datum.y0 + (TAMAN_KYRA.gridSpec.ny * TAMAN_KYRA.gridSpec.dx) / 2,
};
const TK_MEDIAN_GROUND = medianJunctionGround(TAMAN_KYRA.assets);

/** True when a RIVER cell centre lies within r metres of team point (x, y). */
function riverCellWithin(grid: Grid, site: SiteSpec, x: number, y: number, r: number): boolean {
  const { nx, ny, dx } = site.gridSpec;
  const p = siteToLocal(site, x, y);
  const c = cellIn(site.gridSpec, p.x, p.y);
  if (grid.land[c] === LandUse.RIVER) return true;
  for (let j = 0; j < ny; j++) {
    const dy = (j + 0.5) * dx - p.y;
    if (Math.abs(dy) > r) continue;
    for (let i = 0; i < nx; i++) {
      if (grid.land[j * nx + i] === LandUse.RIVER && Math.hypot((i + 0.5) * dx - p.x, dy) <= r) return true;
    }
  }
  return false;
}

export function buildSiteFromFiles(files: ImportFiles): { site?: SiteSpec; report: ImportReport } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const assumptions: string[] = [];
  const report = (): ImportReport => ({ ok: errors.length === 0, errors, warnings, assumptions, summary });
  const summary: Array<[string, string]> = [];

  // 1. SWMM model.
  const m = parseInp(files.inp.text);
  for (const s of ['JUNCTIONS', 'OUTFALLS', 'CONDUITS', 'XSECTIONS', 'COORDINATES']) if (!m.sections.includes(s)) errors.push(`SWMM file: missing [${s}] section.`);
  for (const s of UNSUPPORTED) if (m.sections.includes(s)) warnings.push(`SWMM file: [${s}] is not supported yet and was skipped.`);
  for (const s of IGNORED) if (m.sections.includes(s)) assumptions.push(`SWMM [${s}] is not used: rainfall comes from the storm selector.`);
  if (m.junctions.some((j) => j.storage)) warnings.push('SWMM file: [STORAGE] nodes are treated as junctions (storage curves not modelled yet).');
  const ids = new Set<string>();
  for (const id of [...m.junctions.map((j) => j.id), ...m.outfalls.map((o) => o.id), ...m.conduits.map((c) => c.id)]) {
    if (ids.has(id)) errors.push(`SWMM file: duplicate id ${id}.`);
    ids.add(id);
  }
  const nodeIds = new Set([...m.junctions.map((j) => j.id), ...m.outfalls.map((o) => o.id)]);
  if (!m.junctions.length) errors.push('SWMM file: no junctions.');
  if (!m.outfalls.length) errors.push('SWMM file: no outfall.');
  for (const o of m.outfalls) {
    if (!Number.isFinite(o.invert)) errors.push(`SWMM file: outfall ${o.id} has an invalid invert elevation.`);
    if (o.type === 'FIXED' && !Number.isFinite(o.stage)) errors.push(`SWMM file: outfall ${o.id} has an invalid fixed stage.`);
  }
  for (const id of nodeIds) {
    const c = m.coordinates.get(id);
    if (!c) errors.push(`SWMM file: node ${id} has no [COORDINATES] entry.`);
    else if (!(Number.isFinite(c[0]) && Number.isFinite(c[1]))) errors.push(`SWMM file: node ${id} has invalid coordinates.`);
  }
  for (const j of m.junctions) if (!(Number.isFinite(j.invert) && j.maxDepth > 0)) errors.push(`SWMM file: junction ${j.id} needs an invert and a positive max depth.`);
  for (const c of m.conduits) {
    for (const end of [c.from, c.to]) if (!nodeIds.has(end)) errors.push(`SWMM file: conduit ${c.id} refers to unknown node ${end}.`);
    if (!(Number.isFinite(c.length) && c.length > 0)) errors.push(`SWMM file: conduit ${c.id} has an invalid length.`);
    if (!(Number.isFinite(c.n) && c.n > 0)) errors.push(`SWMM file: conduit ${c.id} has an invalid roughness.`);
    if (!m.xsections.has(c.id)) errors.push(`SWMM file: conduit ${c.id} has no [XSECTIONS] entry.`);
    else if (!(Number.isFinite(m.xsections.get(c.id)!.geom1) && m.xsections.get(c.id)!.geom1 > 0)) errors.push(`SWMM file: conduit ${c.id} has an invalid diameter.`);
    else if (m.xsections.get(c.id)!.shape !== 'CIRCULAR') warnings.push(`SWMM file: conduit ${c.id} is ${m.xsections.get(c.id)!.shape}; modelled as circular with diameter = Geom1.`);
    if (c.inOffset || c.outOffset) warnings.push(`SWMM file: conduit ${c.id} offsets are ignored.`);
  }
  for (const o of m.outfalls) if (!m.conduits.some((c) => c.to === o.id)) errors.push(`SWMM file: outfall ${o.id} has no incoming conduit.`);
  for (const s of m.subcatchments) {
    if (!nodeIds.has(s.outlet)) errors.push(`SWMM file: subcatchment ${s.id} drains to unknown node ${s.outlet}.`);
    if (!(Number.isFinite(s.areaHa) && s.areaHa > 0)) errors.push(`SWMM file: subcatchment ${s.id} has an invalid area.`);
    if (!(Number.isFinite(s.imperviousPercent) && s.imperviousPercent >= 0 && s.imperviousPercent <= 100)) errors.push(`SWMM file: subcatchment ${s.id} has an invalid % impervious.`);
  }
  // Every node must reach an outfall through conduits.
  const outIds = new Set(m.outfalls.map((o) => o.id));
  const down = new Map<string, string[]>();
  for (const c of m.conduits) down.set(c.from, [...(down.get(c.from) ?? []), c.to]);
  for (const j of m.junctions) {
    const seen = new Set<string>([j.id]);
    const stack = [j.id];
    let ok = false;
    while (stack.length && !ok) {
      for (const nx of down.get(stack.pop()!) ?? []) {
        if (outIds.has(nx)) ok = true;
        else if (!seen.has(nx)) {
          seen.add(nx);
          stack.push(nx);
        }
      }
    }
    if (!ok) errors.push(`SWMM file: node ${j.id} has no route to an outfall.`);
  }
  const coords = [...m.coordinates.values()];
  if (coords.length && coords.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90)) {
    errors.push('Coordinates look like longitude/latitude: export in the same projected metric CRS as the SWMM model.');
  }

  // 2. Layout and height files.
  let layout: LayoutFeatures | null = null;
  let layoutDefaults: LayoutDefaults | null = null;
  if (files.geojson) {
    const r = parseLayoutGeoJson(files.geojson.text);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
    layout = r.features;
    layoutDefaults = r.defaults;
  } else {
    assumptions.push('No layout file: no buildings, roads, trees, ponds or rivers.');
  }
  let asc: AsciiGrid | null = null;
  if (files.asc) {
    try {
      asc = parseAsciiGrid(files.asc.text);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  } else {
    assumptions.push('No height file: ground is a plane through manhole cover levels with grate funnels and a road kerb drop.');
  }
  if (errors.length) return { report: report() };

  // 3. Extent and grid (file coordinates).
  const layoutPts: Array<[number, number]> = layout
    ? [
        ...layout.buildings.flatMap((b) => b.ring),
        ...layout.roads.flatMap((r) => r.line),
        ...layout.roundabouts.map((r) => [r.x, r.y] as [number, number]),
        ...layout.trees.map((t) => [t.x, t.y] as [number, number]),
        ...layout.ponds.map((p) => [p.x, p.y] as [number, number]),
        ...layout.rivers.flatMap((r) => r.line),
      ]
    : [];
  const polyPts = [...m.polygons.values()].flat();
  if (layoutPts.length && layoutPts.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90)) {
    errors.push('Layout coordinates look like longitude/latitude: export in the same projected metric CRS as the SWMM model.');
    return { report: report() };
  }
  let minX: number;
  let minY: number;
  let nx: number;
  let ny: number;
  let dx: number;
  let k = 1;
  if (asc) {
    minX = asc.xll;
    minY = asc.yll;
    for (const id of nodeIds) {
      const [x, y] = m.coordinates.get(id)!;
      if (x < asc.xll || y < asc.yll || x > asc.xll + asc.ncols * asc.cellsize || y > asc.yll + asc.nrows * asc.cellsize) {
        errors.push(`Node ${id} lies outside the height file.`);
      }
    }
    if (errors.length) return { report: report() };
    while (Math.floor(asc.ncols / k) * Math.floor(asc.nrows / k) > MAX_CELLS) k++;
    dx = asc.cellsize * k;
    nx = Math.floor(asc.ncols / k);
    ny = Math.floor(asc.nrows / k);
    if (k > 1) {
      for (const id of nodeIds) {
        const [x, y] = m.coordinates.get(id)!;
        if (x > asc.xll + nx * dx || y > asc.yll + ny * dx) errors.push(`Node ${id} lies outside the coarsened height grid.`);
      }
      if (errors.length) return { report: report() };
    }
  } else {
    const all = [...coords, ...layoutPts, ...polyPts];
    let loX = Infinity;
    let loY = Infinity;
    let hiX = -Infinity;
    let hiY = -Infinity;
    for (const [x, y] of all) {
      if (x < loX) loX = x;
      if (x > hiX) hiX = x;
      if (y < loY) loY = y;
      if (y > hiY) hiY = y;
    }
    minX = loX - MARGIN_M;
    minY = loY - MARGIN_M;
    const w = hiX + MARGIN_M - minX;
    const h = hiY + MARGIN_M - minY;
    while (Math.ceil(w / (DEFAULT_DX * k)) * Math.ceil(h / (DEFAULT_DX * k)) > MAX_CELLS) k++;
    dx = DEFAULT_DX * k;
    nx = Math.ceil(w / dx);
    ny = Math.ceil(h / dx);
    assumptions.push(`Grid: feature extent + ${MARGIN_M} m margin at ${DEFAULT_DX} m cells.`);
  }
  if (k > 1) warnings.push(`Grid coarsened to ${dx} m cells to stay within ${MAX_CELLS.toLocaleString('en')} cells.`);

  // 4. Placement: translate only.
  const shift = { dx: minX + (nx * dx) / 2 - TK_CENTRE.x, dy: minY + (ny * dx) / 2 - TK_CENTRE.y, dz: 0 };
  const groundOf = (j: { invert: number; maxDepth: number }) => j.invert + j.maxDepth;
  const jg = m.junctions.map(groundOf).sort((a, b) => a - b);
  const med = jg.length % 2 ? jg[jg.length >> 1] : (jg[(jg.length >> 1) - 1] + jg[jg.length >> 1]) / 2;
  shift.dz = round(med - TK_MEDIAN_GROUND, 2);
  const T = (x: number, y: number) => ({ x: x - shift.dx, y: y - shift.dy });
  const Z = (z: number) => z - shift.dz;

  // 5. Ground raster (team z), resampled k × k.
  let ground: Float32Array | undefined;
  if (asc) {
    const valid = Array.from(asc.values).filter((v) => asc!.nodata === null || v !== asc!.nodata).sort((a, b) => a - b);
    const fill = valid[valid.length >> 1] ?? 0;
    let filled = 0;
    ground = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let s = 0;
        for (let bj = 0; bj < k; bj++) {
          for (let bi = 0; bi < k; bi++) {
            let v = asc.values[(j * k + bj) * asc.ncols + (i * k + bi)];
            if (asc.nodata !== null && v === asc.nodata) {
              v = fill;
              filled++;
            }
            s += v;
          }
        }
        ground[j * nx + i] = Z(s / (k * k));
      }
    }
    if (filled) warnings.push(`Height file: ${filled} NODATA cell(s) filled with the median ground (${round(fill, 2)} m).`);
  }

  // 6. Assets (team coordinates).
  const nodes: AssetNode[] = [
    ...m.junctions.map((j) => {
      const p = T(...m.coordinates.get(j.id)!);
      return { node_id: j.id, node_type: 'junction' as const, position_m: { x: p.x, y: p.y, z: Z(j.invert) }, invert_elevation_m: Z(j.invert), ground_elevation_m: Z(groundOf(j)), max_depth_m: j.maxDepth };
    }),
    ...m.outfalls.map((o) => {
      const p = T(...m.coordinates.get(o.id)!);
      return { node_id: o.id, node_type: 'outfall' as const, position_m: { x: p.x, y: p.y, z: Z(o.invert) }, invert_elevation_m: Z(o.invert), ground_elevation_m: Z(o.invert + DEFAULT_OUTFALL_DEPTH_M), max_depth_m: DEFAULT_OUTFALL_DEPTH_M };
    }),
  ];
  assumptions.push(`Outfall chambers are ${DEFAULT_OUTFALL_DEPTH_M} m deep.`);
  const nodeById = new Map(nodes.map((n) => [n.node_id, n]));
  const conduits: AssetConduit[] = m.conduits.map((c) => {
    const a = nodeById.get(c.from)!;
    const b = nodeById.get(c.to)!;
    const dist = Math.hypot(a.position_m.x - b.position_m.x, a.position_m.y - b.position_m.y);
    if (dist > 0 && Math.abs(c.length - dist) / dist > 0.1) warnings.push(`Conduit ${c.id}: stated length ${round(c.length, 1)} m differs from the ${round(dist, 1)} m between its nodes by more than 10%.`);
    if (a.invert_elevation_m < b.invert_elevation_m) warnings.push(`Conduit ${c.id} runs uphill (${round(a.invert_elevation_m, 2)} → ${round(b.invert_elevation_m, 2)} m).`);
    const d = m.xsections.get(c.id)!.geom1;
    if (!(d >= 0.15 && d <= 3)) warnings.push(`Conduit ${c.id}: diameter ${d} m is outside 0.15–3.0 m.`);
    return { conduit_id: c.id, from_node_id: c.from, to_node_id: c.to, diameter_m: d, length_m: c.length, manning_n: c.n };
  });
  let inlets: AssetInlet[];
  if (layout?.inlets.length) {
    inlets = layout.inlets
      .filter((i) => {
        if (nodeById.has(i.nodeId)) return true;
        warnings.push(`Inlet ${i.inletId} refers to unknown node ${i.nodeId} and was skipped.`);
        return false;
      })
      .map((i) => {
        const p = T(i.x, i.y);
        return { inlet_id: i.inletId, node_id: i.nodeId, position_m: { x: p.x, y: p.y, z: nodeById.get(i.nodeId)!.ground_elevation_m }, grate_area_m2: i.grateArea ?? DEFAULT_GRATE_M2 };
      });
    const noGrate = layout.inlets.filter((i) => i.grateArea === null && nodeById.has(i.nodeId)).length;
    if (noGrate) assumptions.push(`Inlets without grate_area_m2 have a ${DEFAULT_GRATE_M2} m² grate (${noGrate}).`);
  } else {
    const outlets = [...new Set(m.subcatchments.map((s) => s.outlet))];
    inlets = outlets.map((id) => {
      const n = nodeById.get(id)!;
      return { inlet_id: `INLET-${id}`, node_id: id, position_m: { x: n.position_m.x, y: n.position_m.y, z: n.ground_elevation_m }, grate_area_m2: DEFAULT_GRATE_M2 };
    });
    if (inlets.length) assumptions.push(`No inlet points: one ${DEFAULT_GRATE_M2} m² grate at each subcatchment outlet (${inlets.length}).`);
  }
  const assets: Assets = { nodes, inlets, conduits };

  // 7. Layout (team coordinates).
  const roads: Array<RoadStraight | RoadCircle> = [];
  const houses: SiteHouse[] = [];
  const trees: Array<{ x: number; y: number; scale: number }> = [];
  const ponds: SitePond[] = [];
  const rivers: SiteRiver[] = [];
  const pondBed = TK_MEDIAN_GROUND - POND_BED_BELOW_MEDIAN_M;
  let lowOutfall = Infinity;
  for (const n of nodes) if (n.node_type === 'outfall' && n.invert_elevation_m < lowOutfall) lowOutfall = n.invert_elevation_m;
  const riverBed = lowOutfall - RIVER_BED_BELOW_OUTFALL_M;
  if (layout) {
    const segs = (line: Ring) => line.slice(1).map((b, s) => [line[s], b] as const);
    layout.roads.forEach((r, ri) =>
      segs(r.line).forEach(([a, b], s) => {
        const pa = T(...a);
        const pb = T(...b);
        roads.push({
          id: r.line.length === 2 && r.id ? r.id : `${r.id ?? `road-${ri + 1}`}-${s + 1}`,
          kind: 'straight',
          x: (pa.x + pb.x) / 2,
          y: (pa.y + pb.y) / 2,
          width: r.width,
          length: Math.hypot(pb.x - pa.x, pb.y - pa.y),
          angleDeg: (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI,
          ...(r.surfaceZ !== null ? { surfaceZ: Z(r.surfaceZ) } : {}),
        } as RoadStraight);
      }),
    );
    if (layout.roads.some((r) => r.widthDefaulted)) assumptions.push(`Roads without width_m are ${DEFAULT_ROAD_WIDTH_M} m wide.`);
    layout.roundabouts.forEach((r, i) => {
      const p = T(r.x, r.y);
      roads.push({ id: r.id ?? `roundabout-${i + 1}`, kind: 'circle', x: p.x, y: p.y, radius: r.radius, ...(r.surfaceZ !== null ? { surfaceZ: Z(r.surfaceZ) } : {}) } as RoadCircle);
    });
    layout.buildings.forEach((b, i) => {
      const ring = b.ring.map(([x, y]) => {
        const p = T(x, y);
        return [p.x, p.y] as [number, number];
      });
      const r = fitRect(ring, b.rotationDeg);
      const extras = Object.fromEntries(Object.entries(b.props).filter(([key]) => !['kind', 'id', 'rotation_deg'].includes(key)));
      houses.push({ ...extras, id: b.id ?? `B${i + 1}`, x: r.cx, y: r.cy, rotationDeg: r.rotationDeg, scale: Math.sqrt((r.width * r.depth) / (HOUSE.width * HOUSE.depth)), width: r.width, depth: r.depth });
    });
    if (layoutDefaults?.roundaboutRadius) assumptions.push(`Roundabouts without radius_m have a 10 m radius (${layoutDefaults.roundaboutRadius}).`);
    layout.trees.forEach((t) => trees.push({ ...T(t.x, t.y), scale: t.scale }));
    if (layoutDefaults?.treeScale) assumptions.push(`Trees without scale use scale 1 (${layoutDefaults.treeScale}).`);
    layout.ponds.forEach((p, i) => {
      const c = T(p.x, p.y);
      const bedZ = p.bedZ !== null ? Z(p.bedZ) : pondBed;
      ponds.push({ id: p.id ?? `pond-${i + 1}`, x: c.x, y: c.y, radius: p.radius, bedZ, waterLevel: p.waterLevel !== null ? Z(p.waterLevel) : bedZ + POND_WATER_ABOVE_BED_M });
    });
    if (layoutDefaults?.pondRadius) assumptions.push(`Point ponds without radius_m have a 10 m radius (${layoutDefaults.pondRadius}).`);
    if (layoutDefaults?.pondFromPolygon) assumptions.push(`Pond polygons are modelled as circles of equal area (${layoutDefaults.pondFromPolygon}).`);
    if (layout.ponds.some((p) => p.bedZ === null || p.waterLevel === null)) {
      assumptions.push(`Ponds without levels: bed ${round(pondBed, 2)} m, water ${round(pondBed + POND_WATER_ABOVE_BED_M, 2)} m.`);
    }
    layout.rivers.forEach((r, ri) =>
      segs(r.line).forEach(([a, b], s) => {
        const pa = T(...a);
        const pb = T(...b);
        rivers.push({
          id: r.line.length === 2 && r.id ? r.id : `${r.id ?? `river-${ri + 1}`}-${s + 1}`,
          cx: (pa.x + pb.x) / 2,
          cy: (pa.y + pb.y) / 2,
          length: Math.hypot(pb.x - pa.x, pb.y - pa.y),
          width: r.width,
          angleDeg: (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI,
          bedZ: r.bedZ !== null ? Z(r.bedZ) : riverBed,
        });
      }),
    );
    if (layoutDefaults?.riverWidth) assumptions.push(`Rivers without width_m are 10 m wide (${layoutDefaults.riverWidth}).`);
    if (layout.rivers.some((r) => r.bedZ === null)) assumptions.push(`Rivers without bed_m: bed ${round(riverBed, 2)} m (lowest outfall invert − ${RIVER_BED_BELOW_OUTFALL_M} m).`);
  }

  // 8. Hotspot, focus inlet, tailwater, catchments.
  const lowest = nodes.filter((n) => n.node_type === 'junction').sort((a, b) => a.ground_elevation_m - b.ground_elevation_m)[0];
  const isJunction = (id: string) => nodeById.get(id)?.node_type === 'junction';
  for (const h of layout?.hotspots ?? []) if (!isJunction(h.nodeId)) warnings.push(`Hotspot ${h.nodeId} is not a junction in the SWMM file and was ignored.`);
  const hotspotFromLayout = layout?.hotspots.find((h) => isJunction(h.nodeId))?.nodeId;
  const hotspotNodeId = hotspotFromLayout ?? lowest.node_id;
  if (!hotspotFromLayout) assumptions.push(`Hotspot: ${hotspotNodeId}, the junction with the lowest ground.`);
  const hotspotInlet = inlets.find((i) => i.node_id === hotspotNodeId)?.inlet_id;
  const focusInletId = hotspotInlet ?? inlets[0]?.inlet_id ?? null;
  if (focusInletId) assumptions.push(`Debris selector blocks ${focusInletId}${hotspotInlet ? `, the hotspot's inlet` : ` (fallback: the hotspot ${hotspotNodeId} has no inlet)`}.`);
  const o0 = m.outfalls[0];
  const normal = Z(o0.stage ?? o0.invert);
  if (o0.stage === null) assumptions.push(`Outfall ${o0.id} has no FIXED stage: normal tailwater at its invert.`);
  if (m.outfalls.length > 1) assumptions.push(`Tailwater is taken from outfall ${o0.id}; other outfalls use the same river level.`);
  assumptions.push(`High tailwater = normal + ${HIGH_RISE_M} m.`);
  assumptions.push("Inlet capture curve: Tay Zheheng's illustrative curve (80% of approach flow up to 0.20 m³/s); catchment lag 60 s.");
  const subcatchments = m.subcatchments.map((s) => {
    const ring = m.polygons.get(s.id);
    return {
      id: s.id,
      outletNodeId: s.outlet,
      areaHa: s.areaHa,
      imperviousPercent: s.imperviousPercent,
      ...(ring && ring.length >= 3 ? { polygon: ring.map(([x, y]) => {
        const p = T(x, y);
        return [p.x, p.y] as [number, number];
      }) } : {}),
    };
  });
  if (subcatchments.some((s) => !('polygon' in s))) assumptions.push('Subcatchments without polygons take the nearest cells to their outlet, up to their stated area.');

  const key = `import-${hash(files.inp.text)}${files.geojson ? hash(files.geojson.text) : ''}${files.asc ? hash(files.asc.text) : ''}`;
  const site: SiteSpec = {
    key,
    label: files.inp.name,
    builtIn: false,
    datum: { x0: minX - shift.dx, y0: minY - shift.dy },
    gridSpec: { nx, ny, dx },
    assets,
    layout: { roads, houses, trees },
    ponds,
    rivers,
    subcatchments,
    captureCurve: TAMAN_KYRA.captureCurve,
    ...(ground ? { ground } : {}),
    hotspotNodeId,
    focusInletId,
    tailwater: { normal, high: normal + HIGH_RISE_M },
    shift,
  };
  // 9. Outfall sinks where no river cell lies within SINK_SIZE_M of an outfall (no river, or one too narrow to cover a cell);
  // then build the township once so a site that would crash the engine is reported instead.
  try {
    let grid = buildTerrain(site);
    let added = false;
    for (const o of nodes.filter((n) => n.node_type === 'outfall')) {
      if (riverCellWithin(grid, site, o.position_m.x, o.position_m.y, SINK_SIZE_M)) continue;
      rivers.push({ id: `sink-${o.node_id}`, cx: o.position_m.x, cy: o.position_m.y, length: SINK_SIZE_M, width: SINK_SIZE_M, angleDeg: 0, bedZ: o.invert_elevation_m - RIVER_BED_BELOW_OUTFALL_M });
      assumptions.push(`No river within ${SINK_SIZE_M} m of outfall ${o.node_id}: a ${SINK_SIZE_M} × ${SINK_SIZE_M} m outfall sink was added.`);
      added = true;
    }
    if (added) grid = buildTerrain(site);
    buildNetwork(grid, {}, site);
    buildCatchments(grid, {}, site);
  } catch (e) {
    errors.push(`The site could not be built: ${e instanceof Error ? e.message : String(e)}`);
    return { report: report() };
  }

  summary.push(
    ['Network', `${m.junctions.length} junctions, ${m.outfalls.length} outfall(s), ${conduits.length} pipes, ${inlets.length} inlets`],
    ['Catchments', `${subcatchments.length}`],
    ['Layout', `${houses.length} buildings, ${roads.length} road pieces, ${trees.length} trees, ${ponds.length} ponds, ${rivers.length} river pieces`],
    ['Grid', `${nx} × ${ny} cells at ${dx} m (${round((nx * dx) / 1000, 2)} × ${round((ny * dx) / 1000, 2)} km)`],
    ['Placement', `moved by (${round(-shift.dx, 1)}, ${round(-shift.dy, 1)}) m and ${round(-shift.dz, 2)} m vertically; not scaled`],
    ['Hotspot', hotspotNodeId],
  );
  return { site, report: report() };
}
