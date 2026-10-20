export interface InpModel {
  junctions: Array<{ id: string; invert: number; maxDepth: number; storage: boolean }>;
  outfalls: Array<{ id: string; invert: number; type: string; stage: number | null }>;
  conduits: Array<{ id: string; from: string; to: string; length: number; n: number; inOffset: number; outOffset: number }>;
  xsections: Map<string, { shape: string; geom1: number }>;
  subcatchments: Array<{ id: string; outlet: string; areaHa: number; imperviousPercent: number }>;
  coordinates: Map<string, [number, number]>;
  polygons: Map<string, Array<[number, number]>>;
  /** Upper-case names of every section present. */
  sections: string[];
}

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));

/** Parses the EPA SWMM 5 sections FloodOps uses. Comments (;) and blank lines are ignored. */
export function parseInp(text: string): InpModel {
  const m: InpModel = { junctions: [], outfalls: [], conduits: [], xsections: new Map(), subcatchments: [], coordinates: new Map(), polygons: new Map(), sections: [] };
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/;.*$/, '').trim();
    if (!line) continue;
    const head = /^\[([^\]]+)\]$/.exec(line);
    if (head) {
      section = head[1].trim().toUpperCase();
      if (!m.sections.includes(section)) m.sections.push(section);
      continue;
    }
    const t = line.split(/\s+/);
    switch (section) {
      case 'JUNCTIONS':
        m.junctions.push({ id: t[0], invert: num(t[1]), maxDepth: num(t[2]), storage: false });
        break;
      case 'STORAGE':
        m.junctions.push({ id: t[0], invert: num(t[1]), maxDepth: num(t[2]), storage: true });
        break;
      case 'OUTFALLS':
        m.outfalls.push({ id: t[0], invert: num(t[1]), type: (t[2] ?? 'FREE').toUpperCase(), stage: (t[2] ?? '').toUpperCase() === 'FIXED' ? num(t[3]) : null });
        break;
      case 'CONDUITS':
        m.conduits.push({ id: t[0], from: t[1], to: t[2], length: num(t[3]), n: num(t[4]), inOffset: num(t[5] ?? '0'), outOffset: num(t[6] ?? '0') });
        break;
      case 'XSECTIONS':
        m.xsections.set(t[0], { shape: (t[1] ?? '').toUpperCase(), geom1: num(t[2]) });
        break;
      case 'SUBCATCHMENTS':
        m.subcatchments.push({ id: t[0], outlet: t[2], areaHa: num(t[3]), imperviousPercent: num(t[4]) });
        break;
      case 'COORDINATES':
        m.coordinates.set(t[0], [num(t[1]), num(t[2])]);
        break;
      case 'POLYGONS': {
        const ring = m.polygons.get(t[0]) ?? [];
        ring.push([num(t[1]), num(t[2])]);
        m.polygons.set(t[0], ring);
        break;
      }
      default:
        break;
    }
  }
  return m;
}
