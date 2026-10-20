import { describe, expect, it } from 'vitest';
import { parseLayoutGeoJson } from '../../src/import/geojson';

const fc = (features: unknown[]) => JSON.stringify({ type: 'FeatureCollection', features });
const f = (kind: string, geometry: unknown, props: Record<string, unknown> = {}) => ({ type: 'Feature', geometry, properties: { kind, ...props } });

describe('parseLayoutGeoJson', () => {
  it('sorts features by kind with defaults', () => {
    const { features, errors, warnings } = parseLayoutGeoJson(
      fc([
        f('building', { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]]] }, { id: 'B1', rotation_deg: 0 }),
        f('road', { type: 'LineString', coordinates: [[0, 0], [100, 0], [100, 50]] }),
        f('roundabout', { type: 'Point', coordinates: [5, 5] }, { radius_m: 9 }),
        f('tree', { type: 'Point', coordinates: [1, 2] }),
        f('pond', { type: 'Polygon', coordinates: [[[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]] }, { water_level_m: 9.8 }),
        f('river', { type: 'LineString', coordinates: [[0, 0], [0, 80]] }, { width_m: 12, bed_m: 7 }),
        f('inlet', { type: 'Point', coordinates: [3, 3] }, { inlet_id: 'I1', node_id: 'J1' }),
        f('hotspot', { type: 'Point', coordinates: [3, 3] }, { node_id: 'J1' }),
        f('lamppost', { type: 'Point', coordinates: [0, 0] }),
      ]),
    );
    expect(errors).toEqual([]);
    expect(warnings).toEqual(['1 feature(s) with an unknown kind were ignored (lamppost).']);
    expect(features.buildings[0]).toMatchObject({ id: 'B1', rotationDeg: 0 });
    expect(features.roads[0]).toMatchObject({ width: 8, line: [[0, 0], [100, 0], [100, 50]] });
    expect(features.roundabouts[0]).toMatchObject({ x: 5, y: 5, radius: 9 });
    expect(features.trees[0]).toEqual({ x: 1, y: 2, scale: 1 });
    expect(features.ponds[0]).toMatchObject({ x: 2, y: 2, waterLevel: 9.8 });
    expect(features.ponds[0].radius).toBeCloseTo(Math.sqrt(16 / Math.PI));
    expect(features.rivers[0]).toMatchObject({ width: 12, bedZ: 7 });
    expect(features.inlets[0]).toMatchObject({ x: 3, y: 3, inletId: 'I1', nodeId: 'J1' });
    expect(features.hotspots).toEqual([{ nodeId: 'J1' }]);
  });
  it('reports invalid JSON and missing kinds as errors', () => {
    expect(parseLayoutGeoJson('{').errors[0]).toMatch(/not valid JSON/);
    expect(parseLayoutGeoJson(fc([{ type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] }, properties: {} }])).errors[0]).toMatch(/kind/);
  });
});
