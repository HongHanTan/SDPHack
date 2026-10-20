import { polygonCentroidArea, type Ring } from './geometry';

export interface LayoutFeatures {
  buildings: Array<{ id: string | null; ring: Ring; rotationDeg?: number; props: Record<string, unknown> }>;
  roads: Array<{ id: string | null; line: Ring; width: number; widthDefaulted: boolean; surfaceZ: number | null }>;
  roundabouts: Array<{ id: string | null; x: number; y: number; radius: number; surfaceZ: number | null }>;
  trees: Array<{ x: number; y: number; scale: number }>;
  ponds: Array<{ id: string | null; x: number; y: number; radius: number; waterLevel: number | null; bedZ: number | null }>;
  rivers: Array<{ id: string | null; line: Ring; width: number; bedZ: number | null }>;
  inlets: Array<{ x: number; y: number; inletId: string; nodeId: string; grateArea: number | null }>;
  hotspots: Array<{ nodeId: string }>;
}

/** How many features took a default value (each kind becomes one import assumption). */
export interface LayoutDefaults {
  roundaboutRadius: number;
  treeScale: number;
  pondRadius: number;
  pondFromPolygon: number;
  riverWidth: number;
}

const numOr = (v: unknown, d: number | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strOr = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Parses the FloodOps layout GeoJSON (features typed by properties.kind). Coordinates stay in the file's metres. */
export function parseLayoutGeoJson(text: string): { features: LayoutFeatures; errors: string[]; warnings: string[]; defaults: LayoutDefaults } {
  const features: LayoutFeatures = { buildings: [], roads: [], roundabouts: [], trees: [], ponds: [], rivers: [], inlets: [], hotspots: [] };
  const defaults: LayoutDefaults = { roundaboutRadius: 0, treeScale: 0, pondRadius: 0, pondFromPolygon: 0, riverWidth: 0 };
  const isNum = (v: unknown) => numOr(v, null) !== null;
  const errors: string[] = [];
  const warnings: string[] = [];
  let doc: { type?: string; features?: Array<{ geometry?: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }> };
  try {
    doc = JSON.parse(text);
  } catch {
    return { features, errors: ['Layout file is not valid JSON.'], warnings, defaults };
  }
  if (doc.type !== 'FeatureCollection' || !Array.isArray(doc.features)) return { features, errors: ['Layout file must be a GeoJSON FeatureCollection.'], warnings, defaults };
  const unknown = new Set<string>();
  let unknownCount = 0;
  doc.features.forEach((ft, idx) => {
    const p = ft.properties ?? {};
    const g = ft.geometry;
    const kind = strOr(p.kind);
    if (!kind) {
      errors.push(`Layout feature #${idx + 1} has no properties.kind.`);
      return;
    }
    const want = (type: string) => {
      if (g?.type !== type) {
        errors.push(`Layout feature #${idx + 1} (${kind}) must be a ${type}, found ${g?.type ?? 'none'}.`);
        return false;
      }
      return true;
    };
    const point = () => g!.coordinates as [number, number];
    const line = () => (g!.coordinates as Ring).map(([x, y]) => [x, y] as [number, number]);
    const ring = () => ((g!.coordinates as Ring[])[0] ?? []).map(([x, y]) => [x, y] as [number, number]);
    const id = strOr(p.id);
    switch (kind) {
      case 'building':
        if (want('Polygon')) features.buildings.push({ id, ring: ring(), rotationDeg: numOr(p.rotation_deg, null) ?? undefined, props: p });
        break;
      case 'road':
        if (want('LineString')) features.roads.push({ id, line: line(), width: numOr(p.width_m, 8)!, widthDefaulted: numOr(p.width_m, null) === null, surfaceZ: numOr(p.surface_z, null) });
        break;
      case 'roundabout':
        if (want('Point')) {
          if (!isNum(p.radius_m)) defaults.roundaboutRadius++;
          features.roundabouts.push({ id, x: point()[0], y: point()[1], radius: numOr(p.radius_m, 10)!, surfaceZ: numOr(p.surface_z, null) });
        }
        break;
      case 'tree':
        if (want('Point')) {
          if (!isNum(p.scale)) defaults.treeScale++;
          features.trees.push({ x: point()[0], y: point()[1], scale: numOr(p.scale, 1)! });
        }
        break;
      case 'pond':
        if (g?.type === 'Point') {
          if (!isNum(p.radius_m)) defaults.pondRadius++;
          features.ponds.push({ id, x: point()[0], y: point()[1], radius: numOr(p.radius_m, 10)!, waterLevel: numOr(p.water_level_m, null), bedZ: numOr(p.bed_m, null) });
        } else if (want('Polygon')) {
          defaults.pondFromPolygon++;
          const { cx, cy, area } = polygonCentroidArea(ring());
          features.ponds.push({ id, x: cx, y: cy, radius: Math.sqrt(area / Math.PI), waterLevel: numOr(p.water_level_m, null), bedZ: numOr(p.bed_m, null) });
        }
        break;
      case 'river':
        if (want('LineString')) {
          if (!isNum(p.width_m)) defaults.riverWidth++;
          features.rivers.push({ id, line: line(), width: numOr(p.width_m, 10)!, bedZ: numOr(p.bed_m, null) });
        }
        break;
      case 'inlet':
        if (want('Point')) {
          const inletId = strOr(p.inlet_id);
          const nodeId = strOr(p.node_id);
          if (!inletId || !nodeId) errors.push(`Layout inlet #${idx + 1} needs inlet_id and node_id.`);
          else features.inlets.push({ x: point()[0], y: point()[1], inletId, nodeId, grateArea: numOr(p.grate_area_m2, null) });
        }
        break;
      case 'hotspot': {
        const nodeId = strOr(p.node_id);
        if (!nodeId) errors.push(`Layout hotspot #${idx + 1} needs node_id.`);
        else features.hotspots.push({ nodeId });
        break;
      }
      default:
        unknownCount++;
        unknown.add(kind);
    }
  });
  if (unknownCount) warnings.push(`${unknownCount} feature(s) with an unknown kind were ignored (${[...unknown].join(', ')}).`);
  return { features, errors, warnings, defaults };
}
