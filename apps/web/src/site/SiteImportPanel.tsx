import { useRef, useState } from 'react';
import { buildSiteFromFiles, type ImportFiles, type ImportReport } from '@floodops/engine/import/buildSite';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { classifySiteFiles } from './siteFiles';
import { useSiteFiles } from './useSiteFiles';

interface Props {
  activeSite: SiteSpec;
  onApply: (site: SiteSpec) => void;
  onReset: () => void;
  onClose: () => void;
}

interface Checked {
  site?: SiteSpec;
  report: ImportReport;
}

const clock = (d: Date) => d.toLocaleTimeString('en-GB', { hour12: false });

export function SiteImportPanel({ activeSite, onApply, onReset, onClose }: Props) {
  const [checked, setChecked] = useState<Checked | null>(null);
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const readRef = useRef<() => Promise<ImportFiles | null>>(async () => null);
  const stopWatchRef = useRef<() => void>(() => undefined);

  const handleChange = async (names: string[]) => {
    try {
      const files = await readRef.current();
      if (!files) return;
      const result = buildSiteFromFiles(files);
      setChecked(result);
      setReadErrors([]);
      if (result.report.ok && result.site) {
        onApply(result.site);
        setStatus({ kind: 'ok', text: `Updated from ${names.join(', ')} at ${clock(new Date())}` });
      } else {
        setStatus({ kind: 'bad', text: `Changes in ${names.join(', ')} have errors; the current city is kept.` });
      }
    } catch (err) {
      setReadErrors([err instanceof Error ? err.message : String(err)]);
      stopWatchRef.current();
    }
  };

  const siteFiles = useSiteFiles({
    onChange: (names) => void handleChange(names),
    onWatchError: (m) => setReadErrors([`Watching stopped: ${m}`]),
  });
  readRef.current = siteFiles.read;
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

  const doPick = async () => {
    await siteFiles.pick();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm select-text">
      <div className="w-[34rem] max-w-[95vw] max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl text-xs text-slate-700">
        <div className="px-5 py-3 border-b border-slate-200">
          <div className="text-base font-extrabold text-slate-900">Import site</div>
          <div className="text-[11px] text-slate-500">Active site: {activeSite.label}</div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <button onClick={doPick} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-medium cursor-pointer">
              Choose files…
            </button>
            {siteFiles.files.length > 0 && (
              <ul className="space-y-1">
                {siteFiles.files.map((e) => (
                  <li
                    key={e.name}
                    className={`flex justify-between rounded-lg border px-2.5 py-1 ${warnName(e.name) ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <span className="font-mono">{e.name}</span>
                    <span>{roleOf(e.name)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500">
              All files must use the same projected coordinate system (metres). Files are read in your browser and are not uploaded.
            </p>
            <button
              onClick={check}
              disabled={busy || siteFiles.files.length === 0}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white font-medium disabled:opacity-40 cursor-pointer"
            >
              Check files
            </button>
          </div>

          {report && report.summary.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {report.summary.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-800">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {errors.length > 0 && (
            <div>
              <div className="font-bold text-red-700 mb-1">Errors</div>
              <ul className="list-disc pl-5 text-red-700 space-y-0.5">
                {errors.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {report && report.warnings.length > 0 && (
            <div>
              <div className="font-bold text-amber-700 mb-1">Warnings</div>
              <ul className="list-disc pl-5 text-amber-700 space-y-0.5">
                {report.warnings.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {report && report.assumptions.length > 0 && (
            <div>
              <div className="font-bold text-slate-700 mb-1">Assumptions</div>
              <ul className="list-disc pl-5 text-slate-600 space-y-0.5">
                {report.assumptions.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          {status && <div className={status.kind === 'ok' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>{status.text}</div>}
        </div>

        <div className="px-5 py-3 border-t border-slate-200 space-y-2">
          {siteFiles.canWatch && (
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={siteFiles.watching} onChange={(e) => siteFiles.setWatching(e.target.checked)} />
                <span>Watch for changes (Chrome/Edge)</span>
              </label>
              <div className="text-[11px] text-slate-500 ml-6">Closing this panel stops watching.</div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => checked?.site && onApply(checked.site)}
              disabled={!report?.ok || !checked?.site}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40 cursor-pointer"
            >
              Generate city
            </button>
            <button onClick={onReset} className="px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 cursor-pointer">
              Reset to built-in Taman Kyra
            </button>
            <button onClick={onClose} className="ml-auto px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 cursor-pointer">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
