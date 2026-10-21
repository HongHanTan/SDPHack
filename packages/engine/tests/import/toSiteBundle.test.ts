import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseInp } from '../../src/import/inp';
import { swmmPackageToBundle } from '../../src/import/toSiteBundle';
import { LAYOUT } from '../../src/scenario/layout';

const dir = resolve(__dirname, '../../../../data/samples/taman_kyra_site');
const read = (name: string) => ({ name, text: readFileSync(resolve(dir, name), 'utf8') });

type Row = Record<string, unknown>;
type Feature = { type: string; properties: Row; geometry: { type: string; coordinates: unknown } };

describe('swmmPackageToBundle: the Taman Kyra sample package', () => {
  const r = swmmPackageToBundle({ inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') }, 'test reference');
  const b = r.bundle as Record<string, unknown>;
  const rows = (k: string) => b[k] as Row[];
  const byId = (k: string, key: string, id: string) => rows(k).find((x) => x[key] === id)!;

  it('converts without errors into a floodops-site-v1 bundle', () => {
    expect(r.errors).toEqual([]);
    expect(b.format).toBe('floodops-site-v1');
    const p = b.project as Row;
    expect(p.name).toBe('taman_kyra');
    expect(p.source_type).toBe('synthetic');
    expect(p.coordinate_units).toBe('m');
    expect(p.source_reference).toBe('test reference');
    expect(p.coordinate_system).toBe('SWMM model coordinates (projected metres); layout and height files in the same reference');
    expect(p.vertical_datum).toBe('Elevations as given in the SWMM model');
  });

  it('carries nodes, pipes, inlets and catchments unchanged', () => {
    expect(rows('nodes')).toHaveLength(9);
    expect(byId('nodes', 'node_id', 'NODE-OUT01')).toMatchObject({ node_type: 'outfall', outfall_type: 'FIXED', water_level_m: 8.2, invert_elevation_m: 8.2, ground_elevation_m: 10.2 });
    expect(byId('nodes', 'node_id', 'NODE-J07')).toEqual({ node_id: 'NODE-J07', node_type: 'junction', x: 412040, y: 336000, ground_elevation_m: 11, invert_elevation_m: 9 });
    expect(rows('pipes')).toHaveLength(8);
    expect(byId('pipes', 'conduit_id', 'PIPE-P07')).toEqual({ conduit_id: 'PIPE-P07', from_node_id: 'NODE-J07', to_node_id: 'NODE-J08', diameter_m: 0.6, length_m: 50, manning_n: 0.013 });
    expect(rows('inlets')).toHaveLength(4);
    expect(byId('inlets', 'inlet_id', 'INLET-D07')).toMatchObject({ node_id: 'NODE-J07', grate_area_m2: 0.6, ground_elevation_m: 11 });
    expect(rows('catchments')).toHaveLength(4);
    for (const c of rows('catchments')) expect(c).toMatchObject({ width_m: 100, slope_percent: 1, area_ha: 1, impervious_percent: 80 });
  });

  it('takes the rainfall from the rain gage time series', () => {
    const rain = rows('rainfall');
    expect(rain).toHaveLength(25);
    expect(rain.map((x) => x.time_s)).toEqual(Array.from({ length: 25 }, (_, i) => i * 300));
    expect(rain.map((x) => x.intensity_mmh)).toEqual([...Array(12).fill(80), ...Array(13).fill(0)]);
  });

  it('turns the height grid into cell-centre terrain points', () => {
    const t = rows('terrain');
    expect(t).toHaveLength(125 * 145);
    expect(t[0]).toMatchObject({ x: 411921, y: 335861 });
    expect(t[0].z).toBe(Number(read('taman_kyra_ground.asc').text.split(/\r?\n/)[6 + 144].split(' ')[0]));
  });

  it('keeps roads with a width and buildings with a height', () => {
    const roads = b.roads as Feature[];
    expect(roads).toHaveLength(LAYOUT.roads.filter((x) => x.kind === 'straight').length);
    for (const f of roads) {
      expect(f.geometry.type).toBe('LineString');
      expect(f.properties.width_m).toBeGreaterThan(0);
      expect(f.properties.kind).toBeUndefined();
    }
    const buildings = b.buildings as Feature[];
    expect(buildings).toHaveLength(35);
    for (const f of buildings) expect(f.properties.height_m).toBe(7);
  });

  it('carries the shared hydrology', () => {
    const h = b.hydrology as { surface_parameters: Row; horton_parameters: Row };
    expect(h.surface_parameters).toEqual({ n_impervious: 0.015, n_pervious: 0.15, storage_impervious_mm: 1, storage_pervious_mm: 4, zero_storage_impervious_percent: 25 });
    expect(h.horton_parameters).toEqual({ max_infiltration_mmh: 75, min_infiltration_mmh: 5, decay_per_hour: 4, drying_time_days: 7, max_infiltration_mm: 0 });
  });

  it('lists what it left out and the counts', () => {
    const all = r.notes.join('\n');
    for (const word of ['tree', 'pond', 'canal', 'hotspot', 'roundabout', 'Outfall ground elevation = invert + 2.0 m']) expect(all).toContain(word);
    expect(r.counts).toEqual({ nodes: 9, pipes: 8, inlets: 4, catchments: 4, rainfall: 25, terrain: 18125, roads: (b.roads as unknown[]).length, buildings: 35 });
  });
});

const NET = (o: { units?: string; gage?: string; series?: boolean; outfall?: string } = {}) => `[TITLE]
; a small test network
[OPTIONS]
FLOW_UNITS ${o.units ?? 'CMS'}
INFILTRATION HORTON
[RAINGAGES]
G1 INTENSITY ${o.gage ?? '0:05'} 1 TIMESERIES TS1
[SUBCATCHMENTS]
S1 G1 J1 1.5 70 100 1 0
[JUNCTIONS]
J1 10.0 2.0 0 0 0
J2 9.5 2.5 0 0 0
[OUTFALLS]
O1 9.0 ${o.outfall ?? 'FREE'}
[CONDUITS]
P1 J1 J2 50 0.013 0 0 0 0
P2 J2 O1 40 0.013 0 0 0 0
[XSECTIONS]
P1 CIRCULAR 0.45 0 0 0 1
P2 CIRCULAR 0.6 0 0 0 1
${o.series === false ? '' : `[TIMESERIES]
TS1 0:00 50
TS1 0:05 20
TS1 0:10 0
`}[COORDINATES]
J1 1000 2000
J2 1050 2000
O1 1090 2000
`;
const convert = (inp: string, geojson?: string) => swmmPackageToBundle({ inp: { name: 'net.inp', text: inp }, ...(geojson ? { geojson: { name: 'layout.geojson', text: geojson } } : {}) }, 'ref');

describe('swmmPackageToBundle: rules', () => {
  it('converts a small network, with an assumed source type', () => {
    const r = convert(NET());
    expect(r.errors).toEqual([]);
    expect((r.bundle!.project as Row).source_type).toBe('assumed');
    expect(r.bundle!.rainfall).toEqual([
      { time_s: 0, intensity_mmh: 50 },
      { time_s: 300, intensity_mmh: 20 },
      { time_s: 600, intensity_mmh: 0 },
    ]);
    expect(r.bundle!.hydrology).toBeUndefined();
    expect(r.notes.join('\n')).toContain('assumed');
  });
  it('rejects non-SI flow units', () => {
    const r = convert(NET({ units: 'CFS' }));
    expect(r.bundle).toBeNull();
    expect(r.errors.join('\n')).toContain('SI');
  });
  it('rejects a rain gage that is not 5-minute', () => {
    const r = convert(NET({ gage: '0:10' }));
    expect(r.bundle).toBeNull();
    expect(r.errors.join('\n')).toContain('5-minute');
  });
  it('gives no rainfall, with a note, without [TIMESERIES]', () => {
    const r = convert(NET({ series: false }));
    expect(r.errors).toEqual([]);
    expect(r.bundle!.rainfall).toEqual([]);
    expect(r.notes.join('\n')).toMatch(/TS1.*no rainfall/);
  });
  it('omits a building without height_m, with a note', () => {
    const ring = [[1000, 2010], [1010, 2010], [1010, 2020], [1000, 2020], [1000, 2010]];
    const layout = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'building', id: 'B1' } },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'building', id: 'B2', height_m: 6 } },
      ],
    });
    const r = convert(NET(), layout);
    expect(r.errors).toEqual([]);
    expect((r.bundle!.buildings as Feature[]).map((f) => f.properties.id)).toEqual(['B2']);
    expect(r.notes.join('\n')).toContain('1 building without height_m was left out');
  });
  it('turns a NORMAL outfall into FREE, with a warning', () => {
    const r = convert(NET({ outfall: 'NORMAL' }));
    expect(r.errors).toEqual([]);
    expect((r.bundle!.nodes as Row[]).find((n) => n.node_id === 'O1')).toMatchObject({ outfall_type: 'FREE' });
    expect(r.warnings.join('\n')).toMatch(/O1.*NORMAL.*FREE/);
  });
});

describe('parseInp: fields used by the bundle', () => {
  const m = parseInp(`[TITLE]
; Synthetic demo
Plain title line
[OPTIONS]
FLOW_UNITS lps
[RAINGAGES]
G1 INTENSITY 0.0833333 1 TIMESERIES TS1
[TIMESERIES]
TS1 12/31/2025 23:55 10
TS1 01/01/2026 0:00:00 20 0.1 30
TS2 0.5 4
TS2 1.0 5
[SUBCATCHMENTS]
S1 G1 J1 1.5 70 120 0.5 0
[SUBAREAS]
S1 0.012 0.1 1.5 5 20 IMPERVIOUS 40
[INFILTRATION]
S1 70 4 3 6 0
`);
  it('reads title, options, gages, series, subareas and infiltration', () => {
    expect(m.title).toEqual(['Synthetic demo', 'Plain title line']);
    expect(m.flowUnits).toBe('LPS');
    expect(m.infiltrationModel).toBeNull();
    expect(m.rainGages.get('G1')).toEqual({ format: 'INTENSITY', intervalS: 300, series: 'TS1' });
    expect(m.timeseries.get('TS1')).toEqual([
      { t: 0, v: 10 },
      { t: 300, v: 20 },
      { t: 660, v: 30 },
    ]);
    expect(m.timeseries.get('TS2')).toEqual([
      { t: 0, v: 4 },
      { t: 1800, v: 5 },
    ]);
    expect(m.subcatchments[0]).toEqual({ id: 'S1', outlet: 'J1', areaHa: 1.5, imperviousPercent: 70 });
    expect([m.subcatchments[0].rainGage, m.subcatchments[0].widthM, m.subcatchments[0].slopePercent]).toEqual(['G1', 120, 0.5]);
    expect(m.subareas.get('S1')).toEqual([0.012, 0.1, 1.5, 5, 20]);
    expect(m.subareaRouting.get('S1')).toEqual({ routeTo: 'IMPERVIOUS', pctRouted: 40 });
    expect(m.infiltration.get('S1')).toEqual([70, 4, 3, 6, 0]);
  });
});
