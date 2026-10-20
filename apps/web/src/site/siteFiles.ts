const KIND: Array<[RegExp, 'inp' | 'geojson' | 'asc']> = [
  [/\.inp$/i, 'inp'],
  [/\.(geo)?json$/i, 'geojson'],
  [/\.asc$/i, 'asc'],
];

/** Sorts picked file names into the three inputs; a second file of the same kind is a duplicate. */
export function classifySiteFiles(names: string[]): { inp?: string; geojson?: string; asc?: string; unknown: string[]; duplicates: string[] } {
  const out: { inp?: string; geojson?: string; asc?: string; unknown: string[]; duplicates: string[] } = { unknown: [], duplicates: [] };
  for (const n of names) {
    const kind = KIND.find(([re]) => re.test(n))?.[1];
    if (!kind) out.unknown.push(n);
    else if (out[kind]) out.duplicates.push(n);
    else out[kind] = n;
  }
  return out;
}

/** Names whose lastModified differs between two snapshots. */
export function changedFiles(prev: Record<string, number>, next: Record<string, number>): string[] {
  return Object.keys(next).filter((n) => prev[n] !== next[n]);
}

export const WATCH_INTERVAL_MS = 1500;
