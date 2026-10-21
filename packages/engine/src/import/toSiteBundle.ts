import { parseAsciiGrid } from './asciiGrid';
import { buildSiteFromFiles, DEFAULT_OUTFALL_DEPTH_M, type ImportFiles } from './buildSite';
import { parseInp } from './inp';

/**
 * Converts a SWMM package (.inp + optional layout .geojson + optional height .asc) into Tay Zheheng's
 * `floodops-site-v1` site bundle (see simulation/site_import.py).
 *
 * No value is inferred: anything the bundle can't hold, or that the files don't give, is left out and
 * listed in `notes` (or `warnings` when it changes the model). The one default is an outfall's ground
 * (invert + DEFAULT_OUTFALL_DEPTH_M), which is listed as a note.
 */
export interface SiteBundleResult {
  bundle: Record<string, unknown> | null;
  errors: string[];
  warnings: string[];
  notes: string[];
  counts: Record<string, number>;
}

export const BUNDLE_FORMAT = 'floodops-site-v1';
export const RAIN_STEP_S = 300;
export const MAX_RAIN_INTERVALS = 72;
export const MAX_RAIN_MMH = 300;
export const MAX_TERRAIN_POINTS = 40_000;
const SI_FLOW_UNITS = ['CMS', 'LPS', 'MLD'];
const ID = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const SECTIONS = ['nodes', 'pipes', 'inlets', 'catchments', 'rainfall', 'terrain', 'roads', 'buildings'] as const;

/** Removes floating-point noise from sums of decimal inputs (e.g. 10.1 + 2). */
const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
/** Height-grid values are stored as float32: give back the decimal they were read from. */
const f32 = (v: number) => Number(v.toPrecision(7));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Feature = { type?: string; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> | null };

export function swmmPackageToBundle(files: ImportFiles, sourceReference: string): SiteBundleResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const fail = (): SiteBundleResult => ({ bundle: null, errors, warnings, notes, counts: {} });

  // 0. Same validation as the engine importer.
  const { report } = buildSiteFromFiles(files);
  // Its grid coarsening and NODATA fill describe the engine grid; the terrain section reports its own.
  warnings.push(...report.warnings.filter((w) => !/^Grid coarsened|NODATA cell/.test(w)));
  if (report.errors.length) {
    errors.push(...report.errors);
    return fail();
  }
  const m = parseInp(files.inp.text);
  if (!m.flowUnits || !SI_FLOW_UNITS.includes(m.flowUnits)) {
    errors.push(
      `SWMM file: FLOW_UNITS is ${m.flowUnits ?? 'not set (SWMM then uses CFS)'}. The site bundle needs SI units (CMS, LPS or MLD), so that lengths and elevations are metres.`,
    );
  }
  notes.push('Coordinates and elevations are taken unchanged from the files: no translation, no vertical shift.');
  const badId = (kind: string, id: string) => {
    if (!ID.test(id)) errors.push(`${kind} id "${id}" is not accepted by the site format (1–64 letters, digits, _ . -, starting with a letter or digit).`);
  };

  // 1. Nodes.
  const coord = (id: string) => m.coordinates.get(id)!;
  const ground = new Map<string, number>();
  const nodes: Array<Record<string, unknown>> = [];
  for (const j of m.junctions) {
    badId('Node', j.id);
    const [x, y] = coord(j.id);
    const g = r6(j.invert + j.maxDepth);
    ground.set(j.id, g);
    nodes.push({ node_id: j.id, node_type: 'junction', x, y, ground_elevation_m: g, invert_elevation_m: j.invert });
  }
  notes.push('Junction ground elevation = invert + max depth from [JUNCTIONS].');
  for (const o of m.outfalls) {
    badId('Node', o.id);
    const [x, y] = coord(o.id);
    const g = r6(o.invert + DEFAULT_OUTFALL_DEPTH_M);
    ground.set(o.id, g);
    const node: Record<string, unknown> = { node_id: o.id, node_type: 'outfall', x, y, ground_elevation_m: g, invert_elevation_m: o.invert };
    if (o.type === 'FIXED') {
      if (o.stage! < o.invert) errors.push(`SWMM file: outfall ${o.id} has a FIXED stage ${o.stage} m below its invert ${o.invert} m; the site format needs a water level at or above the invert.`);
      node.outfall_type = 'FIXED';
      node.water_level_m = o.stage;
    } else {
      node.outfall_type = 'FREE';
      if (o.type !== 'FREE') warnings.push(`Outfall ${o.id}: type ${o.type} cannot be held in the site format and became FREE.`);
    }
    nodes.push(node);
  }
  if (m.outfalls.length) {
    notes.push(`Outfall ground elevation = invert + ${DEFAULT_OUTFALL_DEPTH_M.toFixed(1)} m (a default: SWMM outfalls have no ground level) for ${m.outfalls.map((o) => o.id).join(', ')}.`);
  }

  // 2. Pipes. (Offsets and non-circular shapes are already warned about by the importer.)
  const pipes = m.conduits.map((c) => {
    badId('Pipe', c.id);
    if (!(c.n >= 0.005 && c.n <= 0.5)) errors.push(`SWMM file: conduit ${c.id} has Manning's n ${c.n}, outside the site format's 0.005–0.5.`);
    return { conduit_id: c.id, from_node_id: c.from, to_node_id: c.to, diameter_m: m.xsections.get(c.id)!.geom1, length_m: c.length, manning_n: c.n };
  });
  if (m.conduits.some((c) => c.inOffset || c.outOffset)) notes.push('Pipe offsets are dropped: the site format connects pipes at node inverts.');
  if (m.conduits.some((c) => m.xsections.get(c.id)!.shape !== 'CIRCULAR')) notes.push('Non-circular pipes are written as circular with diameter = Geom1.');

  // 3. Layout features (raw, so their properties are kept).
  let features: Feature[] = [];
  if (files.geojson) {
    features = (JSON.parse(files.geojson.text) as { features: Feature[] }).features;
  } else {
    notes.push('No layout file: no inlets, roads or buildings.');
  }
  const kindOf = (f: Feature) => (typeof f.properties?.kind === 'string' ? f.properties.kind : '');
  const ofKind = (kind: string, type: string) => features.filter((f) => kindOf(f) === kind && f.geometry?.type === type);
  const without = (p: Record<string, unknown> | null | undefined, drop: string[]) => Object.fromEntries(Object.entries(p ?? {}).filter(([k]) => !drop.includes(k)));

  // 4. Inlets.
  const inlets: Array<Record<string, unknown>> = [];
  let noGrate = 0;
  for (const f of ofKind('inlet', 'Point')) {
    const p = f.properties!;
    const nodeId = p.node_id as string;
    if (!ground.has(nodeId)) continue; // the importer warned
    badId('Inlet', p.inlet_id as string);
    const [x, y] = f.geometry!.coordinates as [number, number];
    const inlet: Record<string, unknown> = { inlet_id: p.inlet_id, node_id: nodeId, x, y, ground_elevation_m: ground.get(nodeId) };
    if (typeof p.grate_area_m2 === 'number' && Number.isFinite(p.grate_area_m2)) inlet.grate_area_m2 = p.grate_area_m2;
    else noGrate++;
    inlets.push(inlet);
  }
  if (inlets.length) notes.push("Inlet ground elevation = its node's ground elevation.");
  if (noGrate) notes.push(`${plural(noGrate, 'inlet')} without grate_area_m2 ${noGrate === 1 ? 'has' : 'have'} no grate area in the bundle (not invented).`);
  if (files.geojson && !inlets.length) notes.push('No inlet points in the layout: the bundle has no inlets (none are invented).');

  // 5. Catchments.
  const junctionIds = new Set(m.junctions.map((j) => j.id));
  const catchments = m.subcatchments.map((s) => {
    badId('Subcatchment', s.id);
    if (!junctionIds.has(s.outlet)) errors.push(`SWMM file: subcatchment ${s.id} drains to ${s.outlet}; the site format needs a junction outlet.`);
    if (!(s.widthM > 0)) errors.push(`SWMM file: subcatchment ${s.id} needs a positive width.`);
    if (!(s.slopePercent > 0)) errors.push(`SWMM file: subcatchment ${s.id} needs a positive % slope.`);
    return { subcatchment_id: s.id, outlet_node_id: s.outlet, area_ha: s.areaHa, impervious_percent: s.imperviousPercent, width_m: s.widthM, slope_percent: s.slopePercent };
  });
  if (m.subcatchments.some((s) => m.polygons.has(s.id))) notes.push('Subcatchment polygons are not carried: the site format has no catchment outlines.');

  // 6. Rainfall, from the rain gage the subcatchments use.
  const rainfall: Array<{ time_s: number; intensity_mmh: number }> = [];
  const gageNames = [...new Set(m.subcatchments.map((s) => s.rainGage))];
  if (!gageNames.length) {
    notes.push('No subcatchments, so no rain gage: the bundle has no rainfall.');
  } else if (new Set(gageNames.map((g) => JSON.stringify(m.rainGages.get(g) ?? g))).size > 1) {
    errors.push(`SWMM file: subcatchments use different rain gages (${gageNames.join(', ')}); the site format holds one rainfall series.`);
  } else {
    const gName = gageNames[0];
    const gage = m.rainGages.get(gName);
    if (!gage) {
      notes.push(`Rain gage ${gName} is not in [RAINGAGES]: the bundle has no rainfall.`);
    } else if (!gage.series) {
      notes.push(`Rain gage ${gName} does not read a [TIMESERIES] (external rainfall files are not read): the bundle has no rainfall.`);
    } else {
      if (gage.format !== 'INTENSITY') errors.push(`SWMM file: rain gage ${gName} is ${gage.format || 'missing its format'}; the site format needs INTENSITY rainfall (mm/h).`);
      if (gage.intervalS !== RAIN_STEP_S) errors.push(`SWMM file: rain gage ${gName} records every ${Number.isFinite(gage.intervalS) ? `${gage.intervalS / 60} minutes` : '(unreadable interval)'}; the site format needs a 5-minute interval.`);
      const series = m.timeseries.get(gage.series);
      if (!series || !series.length) {
        notes.push(`Time series ${gage.series} (rain gage ${gName}) is not in [TIMESERIES]: the bundle has no rainfall.`);
      } else if (gage.format === 'INTENSITY' && gage.intervalS === RAIN_STEP_S) {
        if (series.length > MAX_RAIN_INTERVALS) errors.push(`SWMM file: time series ${gage.series} has ${series.length} intervals; the site format holds at most ${MAX_RAIN_INTERVALS} (6 hours).`);
        series.forEach((r, i) => {
          if (Math.abs(r.t - i * RAIN_STEP_S) > 1e-6) errors.push(`SWMM file: time series ${gage.series} entry ${i + 1} is at ${r.t} s; the site format needs consecutive 5-minute steps (0, 300, 600 … s).`);
          else if (!(r.v >= 0 && r.v <= MAX_RAIN_MMH)) errors.push(`SWMM file: time series ${gage.series} entry ${i + 1} has intensity ${r.v} mm/h, outside 0–${MAX_RAIN_MMH}.`);
          rainfall.push({ time_s: i * RAIN_STEP_S, intensity_mmh: r.v });
        });
        notes.push(`Rainfall: ${plural(series.length, '5-minute interval')} from time series ${gage.series} (rain gage ${gName}); each intensity applies to the following 5 minutes.`);
      }
    }
  }

  // 7. Terrain: .asc cell centres in file coordinates.
  const terrain: Array<{ x: number; y: number; z: number }> = [];
  if (files.asc) {
    const asc = parseAsciiGrid(files.asc.text);
    let k = 1;
    while (Math.floor(asc.ncols / k) * Math.floor(asc.nrows / k) > MAX_TERRAIN_POINTS) k++;
    const nx = Math.floor(asc.ncols / k);
    const ny = Math.floor(asc.nrows / k);
    const size = asc.cellsize * k;
    const isNoData = (v: number) => asc.nodata !== null && v === asc.nodata;
    const valid = Array.from(asc.values).filter((v) => !isNoData(v)).sort((a, b) => a - b);
    const fill = valid[valid.length >> 1] ?? 0;
    let filled = 0;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let s = 0;
        for (let bj = 0; bj < k; bj++) {
          for (let bi = 0; bi < k; bi++) {
            let v = asc.values[(j * k + bj) * asc.ncols + (i * k + bi)];
            if (isNoData(v)) {
              v = fill;
              filled++;
            }
            s += v;
          }
        }
        terrain.push({ x: r6(asc.xll + (i + 0.5) * size), y: r6(asc.yll + (j + 0.5) * size), z: f32(s / (k * k)) });
      }
    }
    if (k > 1) warnings.push(`Height file: ${asc.ncols} × ${asc.nrows} cells exceed the site format's ${MAX_TERRAIN_POINTS.toLocaleString('en')} terrain points; coarsened to ${nx} × ${ny} points at ${size} m by an integer ${k} × ${k} block mean.`);
    if (filled) warnings.push(`Height file: ${filled} NODATA cell(s) filled with the median ground (${f32(fill)} m).`);
    notes.push(`Terrain: ${nx * ny} points at the height grid's cell centres (${size} m spacing).`);
    const x0 = asc.xll + size / 2;
    const y0 = asc.yll + size / 2;
    const x1 = x0 + (nx - 1) * size;
    const y1 = y0 + (ny - 1) * size;
    for (const n of nodes) {
      const x = n.x as number;
      const y = n.y as number;
      if (x < x0 || x > x1 || y < y0 || y > y1) errors.push(`Node ${n.node_id} lies outside the height grid's cell centres; the site format needs the terrain to cover every node.`);
    }
  } else {
    notes.push('No height file: the bundle has no terrain.');
  }

  // 8. Roads and buildings; everything else is listed as left out.
  const roads: Feature[] = [];
  let roadsNoWidth = 0;
  let roadSurface = 0;
  for (const f of ofKind('road', 'LineString')) {
    const w = f.properties?.width_m;
    if (!(typeof w === 'number' && w > 0)) {
      roadsNoWidth++;
      continue;
    }
    if (f.properties && 'surface_z' in f.properties) roadSurface++;
    roads.push({ type: 'Feature', properties: without(f.properties, ['kind', 'surface_z']), geometry: { type: 'LineString', coordinates: f.geometry!.coordinates } });
  }
  if (roadsNoWidth) notes.push(`${plural(roadsNoWidth, 'road')} without width_m ${roadsNoWidth === 1 ? 'was' : 'were'} left out (widths are not inferred).`);
  if (roadSurface) notes.push(`Road surface levels (surface_z) are not carried: the site format has no road levels (${plural(roadSurface, 'road')}).`);
  const buildings: Feature[] = [];
  let noHeight = 0;
  for (const f of ofKind('building', 'Polygon')) {
    const h = f.properties?.height_m;
    const id = typeof f.properties?.id === 'string' ? f.properties.id : `#${buildings.length + noHeight + 1}`;
    if (!(typeof h === 'number' && h > 0)) {
      noHeight++;
      continue;
    }
    const rings = f.geometry!.coordinates as Array<Array<[number, number]>>;
    const ring = rings[0] ?? [];
    const closed = ring.length >= 4 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
    if (!closed) {
      warnings.push(`Building ${id} is not a closed ring of at least 4 points and was left out.`);
      continue;
    }
    if (rings.length > 1) warnings.push(`Building ${id}: holes are not supported by the site format and were dropped.`);
    buildings.push({ type: 'Feature', properties: without(f.properties, ['kind']), geometry: { type: 'Polygon', coordinates: [ring] } });
  }
  if (noHeight) notes.push(`${plural(noHeight, 'building')} without height_m ${noHeight === 1 ? 'was' : 'were'} left out (heights are not inferred).`);
  const leftOut: Array<[string, string, string]> = [
    ['roundabout', 'roundabout', 'the site format has only LineString roads'],
    ['tree', 'tree', 'the site format has no trees'],
    ['pond', 'pond', 'the site format has no ponds'],
    ['river', 'river (canal)', 'the site format has no rivers or canals'],
    ['hotspot', 'hotspot', 'the site format has no hotspot marker'],
  ];
  for (const [kind, label, why] of leftOut) {
    const n = features.filter((f) => kindOf(f) === kind).length;
    if (n) notes.push(`${n} ${label} feature${n === 1 ? '' : 's'} left out: ${why}.`);
  }

  // 9. Hydrology.
  let hydrology: Record<string, unknown> | undefined;
  const ids = m.subcatchments.map((s) => s.id);
  const shared = (map: Map<string, number[]>, n: number, label: string): number[] | null => {
    const rows = ids.map((id) => map.get(id)?.slice(0, n));
    const first = rows[0];
    if (!first || first.length < n || first.some((v) => !Number.isFinite(v))) {
      errors.push(`SWMM file: [${label}] for ${ids[0]} needs ${n} numeric values.`);
      return null;
    }
    if (rows.some((r) => !r || r.length < n || r.some((v, i) => v !== first[i]))) {
      warnings.push(`SWMM file: [${label}] differs between subcatchments; the site format holds one set, so ${ids[0]}'s values are used for all.`);
    }
    return first;
  };
  if (ids.length && (m.subareas.size || m.infiltration.size)) {
    hydrology = {};
    if (m.subareas.size) {
      const v = shared(m.subareas, 5, 'SUBAREAS');
      if (v) {
        hydrology.surface_parameters = { n_impervious: v[0], n_pervious: v[1], storage_impervious_mm: v[2], storage_pervious_mm: v[3], zero_storage_impervious_percent: v[4] };
        notes.push('Surface parameters from [SUBAREAS] (Manning n, depression storage in mm, % impervious with no storage).');
      }
      if (ids.some((id) => { const r = m.subareaRouting.get(id); return r && (r.routeTo !== 'OUTLET' || r.pctRouted !== 100); })) {
        warnings.push('SWMM file: [SUBAREAS] internal routing (IMPERVIOUS/PERVIOUS) is not part of the site format; all runoff goes to the outlet.');
      }
    } else {
      notes.push("No [SUBAREAS]: the site's default surface parameters apply (its report lists them).");
    }
    const model = m.infiltrationModel ?? 'HORTON';
    if (!m.infiltration.size) {
      notes.push("No [INFILTRATION]: the site's default Horton parameters apply (its report lists them).");
    } else if (model !== 'HORTON') {
      warnings.push(`SWMM file: INFILTRATION ${model} is not part of the site format (Horton only); the site's default Horton parameters apply instead (its report lists them).`);
    } else {
      const v = shared(m.infiltration, 5, 'INFILTRATION');
      if (v) {
        hydrology.horton_parameters = { max_infiltration_mmh: v[0], min_infiltration_mmh: v[1], decay_per_hour: v[2], drying_time_days: v[3], max_infiltration_mm: v[4] };
        notes.push(`Horton infiltration from [INFILTRATION]${m.infiltrationModel ? '' : ' (no INFILTRATION option: SWMM uses HORTON)'}.`);
      }
    }
  } else {
    notes.push("No [SUBAREAS] or [INFILTRATION]: the site's default hydrology applies (its report lists the values).");
  }

  // 10. Project.
  const synthetic = m.title.some((l) => /synthetic/i.test(l));
  if (!synthetic) notes.push('source_type is "assumed": change it to "observed" if the data is measured.');
  const project = {
    name: files.inp.name.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, ''),
    coordinate_units: 'm',
    coordinate_system: 'SWMM model coordinates (projected metres); layout and height files in the same reference',
    vertical_datum: 'Elevations as given in the SWMM model',
    source_type: synthetic ? 'synthetic' : 'assumed',
    source_reference: sourceReference,
  };
  if (errors.length) return fail();

  const sections = { nodes, pipes, inlets, catchments, rainfall, terrain, roads, buildings };
  const counts = Object.fromEntries(SECTIONS.map((s) => [s, sections[s].length]));
  const bundle: Record<string, unknown> = { format: BUNDLE_FORMAT, project, ...sections, ...(hydrology ? { hydrology } : {}) };
  return { bundle, errors, warnings, notes, counts };
}
