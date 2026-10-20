import { useRef, useState } from 'react';
import { buildSiteFromFiles, type ImportFiles, type ImportReport } from '@floodops/engine/import/buildSite';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { classifySiteFiles } from './siteFiles';
import { MAX_WATCH_FAILURES, useSiteFiles } from './useSiteFiles';

export interface Checked {
  site?: SiteSpec;
  report: ImportReport;
}

export interface ImportStatus {
  kind: 'ok' | 'bad';
  text: string;
  firstError?: string;
}

const clock = (d: Date) => d.toLocaleTimeString('en-GB', { hour12: false });

/** App-level site import state: picking, checking and watching files. Lives as long as the app, so watching continues on the dashboard. */
export function useSiteImport({ activeSiteKey, onApply }: { activeSiteKey: string; onApply: (site: SiteSpec) => void }) {
  const [checked, setChecked] = useState<Checked | null>(null);
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const readRef = useRef<() => Promise<ImportFiles | null>>(async () => null);
  const stopWatchRef = useRef<() => void>(() => undefined);
  const seqRef = useRef(0);
  const activeKeyRef = useRef(activeSiteKey);
  activeKeyRef.current = activeSiteKey;
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;
  const readFailuresRef = useRef(0);
  const retryRef = useRef<(names: string[]) => void>(() => undefined);

  const handleChange = async (names: string[]) => {
    const seq = ++seqRef.current;
    try {
      const files = await readRef.current();
      if (!files || seq !== seqRef.current) return;
      readFailuresRef.current = 0;
      const result = buildSiteFromFiles(files);
      setChecked(result);
      setReadErrors([]);
      if (result.report.ok && result.site && result.site.key === activeKeyRef.current) {
        // Saved without a content change: keep the current run.
        setStatus({ kind: 'ok', text: `${names.join(', ')} saved with no changes at ${clock(new Date())}` });
      } else if (result.report.ok && result.site) {
        onApplyRef.current(result.site);
        setStatus({ kind: 'ok', text: `Updated from ${names.join(', ')} at ${clock(new Date())}` });
      } else {
        setStatus({
          kind: 'bad',
          text: `Changes in ${names.join(', ')} have errors; the current city is kept.`,
          firstError: result.report.errors[0],
        });
      }
    } catch (err) {
      if (seq !== seqRef.current) return;
      // A file can be briefly unreadable mid-save: try again on the next tick, stop after a run of failures.
      if (++readFailuresRef.current < MAX_WATCH_FAILURES) {
        retryRef.current(names);
        return;
      }
      readFailuresRef.current = 0;
      const message = err instanceof Error ? err.message : String(err);
      setReadErrors([message]);
      setStatus({ kind: 'bad', text: `Could not read ${names.join(', ')}; watching stopped.`, firstError: message });
      stopWatchRef.current();
    }
  };

  const siteFiles = useSiteFiles({
    onChange: (names) => void handleChange(names),
    onWatchError: (m) => {
      setReadErrors([m]);
      setStatus({ kind: 'bad', text: m });
    },
  });
  readRef.current = siteFiles.read;
  retryRef.current = siteFiles.retry;
  stopWatchRef.current = () => siteFiles.setWatching(false);

  const cls = classifySiteFiles(siteFiles.files.map((e) => e.name));
  const roleOf = (n: string) =>
    n === cls.inp
      ? 'SWMM model'
      : n === cls.geojson
        ? 'Layout'
        : n === cls.asc
          ? 'Height'
          : cls.duplicates.includes(n)
            ? 'Duplicate (ignored)'
            : 'Unknown (ignored)';
  const warnName = (n: string) => cls.unknown.includes(n) || cls.duplicates.includes(n);

  const pick = async () => {
    if (!(await siteFiles.pick())) return;
    setChecked(null);
    setStatus(null);
    setReadErrors([]);
  };

  const check = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const files = await siteFiles.read();
      if (!files) {
        setChecked(null);
        setReadErrors(['Choose a SWMM .inp file first.']);
      } else {
        setReadErrors([]);
        setChecked(buildSiteFromFiles(files));
      }
    } catch (err) {
      setChecked(null);
      setReadErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setBusy(false);
    }
  };

  const report = checked?.report;
  const errors = [...readErrors, ...(report?.errors ?? [])];

  return {
    files: siteFiles.files,
    roleOf,
    warnName,
    pick,
    check,
    checked,
    errors,
    report,
    status,
    busy,
    canWatch: siteFiles.canWatch,
    watchedCount: [cls.inp, cls.geojson, cls.asc].filter(Boolean).length,
    watching: siteFiles.watching,
    setWatching: siteFiles.setWatching,
    lastChange: siteFiles.lastChange,
    dismissStatus: () => setStatus(null),
  };
}

export type SiteImport = ReturnType<typeof useSiteImport>;
