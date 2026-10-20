import type { SiteSpec } from '@floodops/engine/scenario/site';
import type { SiteImport } from './useSiteImport';

interface Props {
  imp: SiteImport;
  activeSite: SiteSpec;
  onGenerate: (site: SiteSpec) => void;
  onUseBuiltIn: () => void;
  onBack?: () => void;
}

export function SiteImportPage({ imp, activeSite, onGenerate, onUseBuiltIn, onBack }: Props) {
  const report = imp.report;
  const site = imp.checked?.site;
  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-100 select-text text-xs text-slate-700">
      <div className="max-w-3xl mx-auto my-10 rounded-2xl border border-slate-200 shadow-xl bg-white">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="text-xl font-extrabold text-slate-900">Import site</div>
          <div className="text-[12px] text-slate-600 mt-1">
            Upload a SWMM model (.inp), and optionally a GIS layout (.geojson) and a height grid (.asc). The city is generated to scale from these files.
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Active city: {activeSite.label}</div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <button onClick={imp.pick} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 font-medium cursor-pointer">
              Choose files…
            </button>
            {imp.files.length > 0 && (
              <ul className="space-y-1">
                {imp.files.map((e) => (
                  <li
                    key={e.name}
                    className={`flex justify-between rounded-lg border px-2.5 py-1 ${imp.warnName(e.name) ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <span className="font-mono">{e.name}</span>
                    <span>{imp.roleOf(e.name)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-slate-500">
              All files must use the same projected coordinate system (metres). Files are read in your browser and are not uploaded.
            </p>
            <button
              onClick={imp.check}
              disabled={imp.busy || imp.files.length === 0}
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
          {imp.errors.length > 0 && (
            <div>
              <div className="font-bold text-red-700 mb-1">Errors</div>
              <ul className="list-disc pl-5 text-red-700 space-y-0.5">
                {imp.errors.map((m, i) => (
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
          {imp.status && (
            <div className={imp.status.kind === 'ok' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>{imp.status.text}</div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 space-y-2">
          {imp.canWatch && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={imp.watching} onChange={(e) => imp.setWatching(e.target.checked)} />
              <span>Watch for changes (Chrome/Edge): keeps running on the dashboard</span>
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => site && onGenerate(site)}
              disabled={!report?.ok || !site}
              className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40 cursor-pointer"
            >
              Generate city
            </button>
            {onBack && (
              <button onClick={onBack} className="ml-auto px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 cursor-pointer">
                Back to dashboard
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="text-center pb-10">
        <button onClick={onUseBuiltIn} className="text-[12px] text-slate-600 underline hover:text-slate-900 cursor-pointer">
          Use built-in demo township (Taman Kyra)
        </button>
      </div>
    </div>
  );
}
