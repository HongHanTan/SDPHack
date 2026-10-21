import { buildSiteFromFiles } from '@floodops/engine/import/buildSite';
import { stormFromInp } from '@floodops/engine/import/stormFromInp';
import { swmmPackageToBundle } from '@floodops/engine/import/toSiteBundle';
import type { ImportedSite, SitePreview } from '../types';
import type { SiteSources, SourceText } from './store';

type Issue = SitePreview['issues'][number];
const SECTIONS = ['nodes', 'pipes', 'inlets', 'catchments', 'rainfall', 'terrain', 'roads', 'buildings'];
const ROLES = { inp: 'swmm', geojson: 'layout', asc: 'height' } as const;
const STORM_SELECTOR = /rainfall comes from the storm selector/;

export async function sha256Hex(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Checking files needs the app opened over https or localhost (Web Crypto is unavailable).');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(bytes = 16): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON with object keys sorted, so equal values always hash the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const isSource = (f: unknown): f is SourceText => !!f && typeof (f as SourceText).name === 'string' && typeof (f as SourceText).text === 'string';

/** Validates the inspect/create body: `{ name, files: { inp, geojson?, asc? } }`. */
export function readSources(body: unknown): { name: string; files: SiteSources } {
  const b = (body ?? {}) as { name?: unknown; files?: Record<string, unknown> };
  const f = b.files;
  if (!f || Array.isArray(f) || !isSource(f.inp)) throw new Error('Choose a SWMM model (.inp). A layout (.geojson) and height grid (.asc) are optional.');
  const files: SiteSources = { inp: { name: f.inp.name, text: f.inp.text } };
  for (const key of ['geojson', 'asc'] as const) {
    if (f[key] === undefined || f[key] === null) continue;
    if (!isSource(f[key])) throw new Error(`The ${key === 'geojson' ? 'layout (.geojson)' : 'height grid (.asc)'} file could not be read.`);
    files[key] = { name: f[key].name, text: f[key].text };
  }
  return { name: typeof b.name === 'string' ? b.name.trim() : '', files };
}

const emptySite = (name: string): ImportedSite => ({
  project: { name, coordinate_system: '', coordinate_units: 'm' },
  nodes: [], pipes: [], inlets: [], terrain: [], roads: [], buildings: [], catchments: [], rainfall: [],
});

/** Readiness review of the three files: Tay's `SitePreview`, built by the FloodOps importer and converter. */
export async function inspectFiles(name: string, files: SiteSources): Promise<SitePreview> {
  const locate = (message: string) =>
    /^(SWMM file|Conduit|Node|Outfall|Pipe|Coordinates look)/.test(message) ? files.inp.name
    : /^Layout/.test(message) ? files.geojson?.name ?? 'Layout file'
    : /^Height/.test(message) ? files.asc?.name ?? 'Height file'
    : 'Site files';
  const issues: Issue[] = [];
  const add = (level: Issue['level'], message: string) => {
    if (!issues.some((i) => i.level === level && i.message === message)) issues.push({ level, location: locate(message), message });
  };
  const assumptions: string[] = [];
  let bundle: Record<string, unknown> | null = null;
  let counts: Record<string, number> = {};
  const parts = { inp: files.inp, geojson: files.geojson, asc: files.asc };
  try {
    const { report } = buildSiteFromFiles(parts);
    const converted = swmmPackageToBundle(parts, `SWMM package checked in this browser: ${Object.values(parts).filter(Boolean).map((f) => f!.name).join(', ')}`);
    for (const e of [...report.errors, ...converted.errors]) add('map', e);
    for (const w of [...report.warnings, ...converted.warnings]) add('warning', w);
    assumptions.push(...report.assumptions.filter((a) => !STORM_SELECTOR.test(a)), ...converted.notes);
    bundle = converted.errors.length ? null : converted.bundle;
    counts = converted.counts;
    if (bundle) {
      if (!counts.catchments) add('simulation', 'SWMM file: no [SUBCATCHMENTS], so no rain reaches the network. Add subcatchments to run a calculation.');
      if (!counts.rainfall) add('simulation', 'SWMM file: no rainfall the subcatchments use (a rain gage reading a [TIMESERIES] of 5-minute intensities in mm/h).');
      const storm = stormFromInp(files.inp.text);
      storm.errors.forEach((e) => add('simulation', e));
      if (storm.storm) assumptions.push('Rainfall comes from the SWMM file\'s rain gage (5-minute intensities), followed by one hour of drainage.');
    }
  } catch (e) {
    add('map', `The files could not be read: ${e instanceof Error ? e.message : String(e)}`);
  }
  const site = (bundle ?? emptySite(files.inp.name.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, ''))) as unknown as ImportedSite;
  if (name) site.project = { ...site.project, name };
  const manifest = await Promise.all(
    (Object.keys(ROLES) as (keyof typeof ROLES)[])
      .filter((k) => files[k])
      .map(async (k) => ({ name: files[k]!.name, sha256: await sha256Hex(files[k]!.text), bytes: new TextEncoder().encode(files[k]!.text).length, role: ROLES[k], headers: [] as string[] })),
  );
  const mapReady = !issues.some((i) => i.level === 'map');
  return {
    site,
    manifest,
    issues,
    assumptions,
    map_ready: mapReady,
    simulation_ready: mapReady && !issues.some((i) => i.level === 'simulation'),
    counts: Object.fromEntries(SECTIONS.map((s) => [s, counts[s] ?? 0])),
    fields: {},
  };
}
