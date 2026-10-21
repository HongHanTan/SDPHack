export interface InpSubcatchment {
  id: string;
  outlet: string;
  areaHa: number;
  imperviousPercent: number;
  rainGage: string;
  widthM: number;
  slopePercent: number;
}

export interface InpModel {
  junctions: Array<{ id: string; invert: number; maxDepth: number; storage: boolean }>;
  outfalls: Array<{ id: string; invert: number; type: string; stage: number | null }>;
  conduits: Array<{ id: string; from: string; to: string; length: number; n: number; inOffset: number; outOffset: number }>;
  xsections: Map<string, { shape: string; geom1: number }>;
  subcatchments: InpSubcatchment[];
  coordinates: Map<string, [number, number]>;
  polygons: Map<string, Array<[number, number]>>;
  /** [TITLE] lines, with any leading `;` comment prefix stripped. */
  title: string[];
  /** [OPTIONS] FLOW_UNITS, upper-case (null when absent). */
  flowUnits: string | null;
  /** [OPTIONS] INFILTRATION, upper-case (null when absent). */
  infiltrationModel: string | null;
  /** [RAINGAGES]: format (upper-case), recording interval in seconds, and the TIMESERIES name ('' for other sources). */
  rainGages: Map<string, { format: string; intervalS: number; series: string }>;
  /** [TIMESERIES]: `t` in seconds from the series' first entry. External FILE series are not read. */
  timeseries: Map<string, Array<{ t: number; v: number }>>;
  /** [SUBAREAS]: N-Imperv, N-Perv, S-Imperv, S-Perv, PctZero. */
  subareas: Map<string, number[]>;
  /** [SUBAREAS]: RouteTo (upper-case) and PctRouted (100 when absent). */
  subareaRouting: Map<string, { routeTo: string; pctRouted: number }>;
  /** [INFILTRATION]: the numeric parameters of each subcatchment. */
  infiltration: Map<string, number[]>;
  /** Upper-case names of every section present. */
  sections: string[];
}

const num = (s: string | undefined) => (s === undefined ? NaN : Number(s));

/** SWMM clock time `h:mm[:ss]` or decimal hours, in seconds (NaN when malformed). */
export function parseClock(s: string | undefined): number {
  if (s === undefined) return NaN;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return NaN;
    const [h, mm, ss] = parts.map(Number);
    return h * 3600 + (mm ?? 0) * 60 + (ss ?? 0);
  }
  return /^(\d+(\.\d*)?|\.\d+)$/.test(s) ? Math.round(Number(s) * 3600 * 1000) / 1000 : NaN;
}

/** SWMM date `MM/DD/YYYY` as UTC seconds (NaN when malformed). */
function parseDate(s: string): number {
  const d = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return d ? Date.UTC(Number(d[3]), Number(d[1]) - 1, Number(d[2])) / 1000 : NaN;
}

/** Parses the EPA SWMM 5 sections FloodOps uses. Comments (;) and blank lines are ignored (except in [TITLE]). */
export function parseInp(text: string): InpModel {
  const m: InpModel = {
    junctions: [],
    outfalls: [],
    conduits: [],
    xsections: new Map(),
    subcatchments: [],
    coordinates: new Map(),
    polygons: new Map(),
    title: [],
    flowUnits: null,
    infiltrationModel: null,
    rainGages: new Map(),
    timeseries: new Map(),
    subareas: new Map(),
    subareaRouting: new Map(),
    infiltration: new Map(),
    sections: [],
  };
  let section = '';
  // Absolute time (s) of each series' first entry, and the last date seen in each series.
  const seriesStart = new Map<string, number>();
  const seriesDate = new Map<string, number>();
  for (const raw of text.split(/\r?\n/)) {
    if (section === 'TITLE' && !/^\s*\[/.test(raw)) {
      const titleLine = raw.trim().replace(/^;+\s*/, '');
      if (titleLine) m.title.push(titleLine);
      continue;
    }
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
      case 'OPTIONS': {
        const key = t[0].toUpperCase();
        if (key === 'FLOW_UNITS' && t[1]) m.flowUnits = t[1].toUpperCase();
        if (key === 'INFILTRATION' && t[1]) m.infiltrationModel = t[1].toUpperCase();
        break;
      }
      case 'RAINGAGES':
        m.rainGages.set(t[0], { format: (t[1] ?? '').toUpperCase(), intervalS: parseClock(t[2]), series: (t[4] ?? '').toUpperCase() === 'TIMESERIES' ? (t[5] ?? '') : '' });
        break;
      case 'TIMESERIES': {
        const name = t[0];
        if ((t[1] ?? '').toUpperCase() === 'FILE') break;
        const rows = m.timeseries.get(name) ?? [];
        m.timeseries.set(name, rows);
        let k = 1;
        while (k < t.length) {
          if (t[k].includes('/')) {
            seriesDate.set(name, parseDate(t[k]));
            k++;
            continue;
          }
          const abs = (seriesDate.get(name) ?? 0) + parseClock(t[k]);
          const v = num(t[k + 1]);
          k += 2;
          if (!seriesStart.has(name)) seriesStart.set(name, abs);
          rows.push({ t: abs - seriesStart.get(name)!, v });
        }
        break;
      }
      case 'SUBAREAS':
        m.subareas.set(t[0], t.slice(1, 6).map(num));
        m.subareaRouting.set(t[0], { routeTo: (t[6] ?? 'OUTLET').toUpperCase(), pctRouted: t[7] === undefined ? 100 : num(t[7]) });
        break;
      case 'INFILTRATION':
        m.infiltration.set(t[0], t.slice(1).filter((x) => Number.isFinite(Number(x))).map(Number));
        break;
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
        m.subcatchments.push({ id: t[0], outlet: t[2], areaHa: num(t[3]), imperviousPercent: num(t[4]), rainGage: t[1], widthM: num(t[5]), slopePercent: num(t[6]) });
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
