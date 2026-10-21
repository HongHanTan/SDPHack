// Automated fix analysis for the uploaded-site Compare tab (spec 2026-10-21 automated fix finder, §9): starts on its
// own for the shown baseline run, streams the optimisation engine's log, and feeds the playback-timed map pins.
// Simulation-based optimisation with the FloodOps engine; no AI model is involved. Added to Tay Zheheng's workspace.
import { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, RotateCcw, Square } from 'lucide-react';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import type { Diagnosis } from '@floodops/engine/analysis/fixFinder';
import type { SimulationFramesResponse, SimulationMetricsResponse } from '../types';
import type { AnalysisEvent, AnalysisResult } from './local/localSiteApi';
import type { DepthGrids } from './local/store';
import { browserAnalysisWorkers } from './local/runs';
import { siteAcceptFix, siteAnalyse, siteDiscardAnalysis, siteRequest } from './api';
import { hasIntervention } from './compare';
import { indicativeCost, pinView, previewDiagnosis, visibleProblems, type AnalysisPhase } from './fixPinText';
import { FixPinCard, type MapPin } from './FixPins';
import type { SiteResult } from './types';

export const FIX_FOOTER = 'Every option was simulated by the FloodOps engine on your uploaded storm. Costs are indicative placeholders; engineering and site checks still required.';

type EngineMetrics = SimulationMetricsResponse & { j07_peak_depth_m?: number; homes_flooded?: number };
export interface TestedFix { index: number; label: string; costRM: number; improved: boolean; metrics: EngineMetrics }
interface State {
  phase: AnalysisPhase | 'idle';
  progress: { done: number; total: number } | null;
  log: string[];
  tested: TestedFix[];
  result: AnalysisResult | null;
  error: string;
  startedAt: number | null;
  finishedAt: number | null;
}
const IDLE: State = { phase: 'idle', progress: null, log: [], tested: [], result: null, error: '', startedAt: null, finishedAt: null };

function reduce(s: State, e: AnalysisEvent): State {
  if (e.type === 'log') return { ...s, log: [...s.log, e.text] };
  if (e.type === 'progress') return { ...s, progress: { done: e.done, total: e.total } };
  return { ...s, tested: [...s.tested, { index: e.index, label: e.label, costRM: e.costRM, improved: e.improved, metrics: e.metrics as EngineMetrics }].sort((a, b) => a.index - b.index) };
}

export interface FixAnalysis extends State {
  problemsKnown: boolean;
  stop(): void;
  restart(): void;
  /** Map pins for the problems whose onset is at or before playback time `t`. */
  mapPins(t: number | undefined): MapPin[];
}

/**
 * Runs the automated analysis for `baseline` while `active` (the Compare tab is open). A new baseline, leaving the tab
 * or leaving the project aborts it and discards its in-memory results.
 */
export function useFixAnalysis({ projectId, baseline, site, active, onAccepted, onError }: {
  projectId: string; baseline: SiteResult | null; site: SiteSpec | null; active: boolean;
  onAccepted: (candidate: SiteResult) => void; onError: (message: string) => void;
}): FixAnalysis {
  const [state, setState] = useState<State>(IDLE);
  const [nonce, setNonce] = useState(0);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [accepting, setAccepting] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const callbacks = useRef({ onAccepted, onError });
  callbacks.current = { onAccepted, onError };
  const runId = active && baseline && baseline.run.status === 'succeeded' && !hasIntervention(baseline.run) ? baseline.run.run_id : null;

  useEffect(() => {
    setDismissed(new Set());
    setAccepting(null);
    if (!runId) {
      setState(IDLE);
      return;
    }
    const c = new AbortController();
    ctrl.current = c;
    setState({ ...IDLE, phase: 'running', startedAt: Date.now() });
    siteAnalyse(projectId, (e) => { if (!c.signal.aborted) setState((s) => reduce(s, e)); }, c.signal, runId).then(
      (result) => { if (!c.signal.aborted) setState((s) => ({ ...s, phase: 'done', result, finishedAt: Date.now() })); },
      (e) => { if (!c.signal.aborted) setState((s) => ({ ...s, phase: 'failed', error: e instanceof Error ? e.message : String(e), finishedAt: Date.now() })); },
    );
    return () => {
      c.abort();
      siteDiscardAnalysis(projectId);
      if (ctrl.current === c) ctrl.current = null;
    };
  }, [projectId, runId, nonce]);

  // Problems: the analysis's diagnosis when finished, else the same diagnosis computed here from the baseline run.
  const preview = useMemo<Diagnosis | null>(() => {
    if (!runId || !baseline || !site) return null;
    try {
      return previewDiagnosis(baseline, site);
    } catch {
      return null;
    }
  }, [runId, baseline, site]);
  const diagnosis = state.result?.diagnosis ?? preview;

  const accept = async (resultKey: string) => {
    setAccepting(resultKey);
    try {
      const run = await siteAcceptFix(projectId, resultKey);
      const all = await siteRequest<{ frames: SimulationFramesResponse['frames']; metrics: SimulationMetricsResponse; depth: DepthGrids | null }>(`/api/simulations/${run.run_id}/results`);
      callbacks.current.onAccepted({ run, frames: all.frames, metrics: all.metrics, depth: all.depth });
    } catch (e) {
      callbacks.current.onError(`The fix run could not be opened: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAccepting(null);
    }
  };

  const phase = state.phase;
  return {
    ...state,
    problemsKnown: !!diagnosis,
    stop() {
      ctrl.current?.abort();
      siteDiscardAnalysis(projectId);
      setState((s) => (s.phase === 'running' ? { ...s, phase: 'stopped', finishedAt: Date.now() } : s));
    },
    restart: () => setNonce((n) => n + 1),
    mapPins(t) {
      if (phase === 'idle' || !diagnosis) return [];
      return visibleProblems(diagnosis.problems, t, dismissed).map((p) => ({
        id: p.id,
        x: p.location.x,
        y: p.location.y,
        content: <FixPinCard view={pinView(p, { phase, progress: state.progress, diagnosis: state.result?.diagnosis, ranked: state.result?.ranked })}
          busy={accepting !== null} onOk={(key) => void accept(key)} onDismiss={() => setDismissed((d) => new Set(d).add(p.id))}/>,
      }));
    },
  };
}

const fmt = (v: number | undefined, digits: number, unit: string) => (typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(digits)}${unit}` : '–');

/** The running-analysis hint: measured 25–61 s per candidate on the sample package; "in parallel" only with more than one worker. */
export const timingHint = (workers: number) =>
  `About 30–60 s per candidate${workers > 1 ? `; up to ${workers} run in parallel` : ''}. Problem pins appear on the map as the baseline plays.`;

/** Sidebar status ("Analysing fixes… i/n") and the collapsible "Analysis details" with the log and every tested fix. */
export function FixFinderPanel({ analysis, hasBaseline, workers = browserAnalysisWorkers() }: { analysis: FixAnalysis; hasBaseline: boolean; workers?: number }) {
  const { phase, progress, log, tested, result, error, startedAt, finishedAt } = analysis;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log.length]);
  if (phase === 'idle') return hasBaseline ? null : <small className="site-fix-hint">Automated analysis of possible fixes starts after the baseline run.</small>;
  const elapsed = startedAt ? Math.max(0, Math.round(((finishedAt ?? now) - startedAt) / 1000)) : 0;
  const best = result?.ranked[0]?.resultKey;
  const problems = result?.diagnosis.problems.length ?? 0;
  return <section className="site-fix" aria-live="polite">
    <span className="site-kicker">Automated analysis · optimisation engine</span>
    {phase === 'running' && <div className="site-fix-status"><LoaderCircle size={15} className="site-spin"/>
      <b>Analysing fixes… {progress ? `${progress.done}/${progress.total}` : ''}</b><span>{elapsed} s</span>
      <button onClick={analysis.stop} aria-label="Stop the automated analysis"><Square size={12}/> Stop</button>
      <small>{timingHint(workers)}</small></div>}
    {phase === 'done' && <div className="site-fix-status done"><b>{result && result.ranked.length ? `Analysis finished: ${result.ranked.length} of ${tested.length} tested fixes reduce flooding.` : problems ? 'Analysis finished: no tested fix reduced flooding.' : 'Analysis finished: no flooding found; nothing to fix.'}</b><span>{elapsed} s</span>
      {problems > 0 && <small>Play the baseline: a pin pops up where each problem starts, with the suggested fix.</small>}</div>}
    {phase === 'stopped' && <div className="site-fix-status"><b>Automated analysis stopped.</b><button onClick={analysis.restart}><RotateCcw size={12}/> Run again</button></div>}
    {phase === 'failed' && <div className="site-fix-status"><p role="alert" className="site-error">Automated analysis failed: {error}</p><button onClick={analysis.restart}><RotateCcw size={12}/> Run again</button></div>}
    <details className="site-help site-fix-details"><summary>Analysis details</summary>
      <pre ref={logRef} className="site-fix-log">{log.length ? log.join('\n') : 'Waiting for the first results…'}</pre>
      {tested.length > 0 && <ul className="site-fix-tested">{tested.map((f) => {
        const kept = result?.ranked.find((r) => r.label === f.label);
        return <li key={f.index} className={f.improved ? 'improved' : ''}>
          <b>{f.label}</b>{kept && kept.resultKey === best && <span className="site-tag good">Recommended</span>}
          <small>Homes {fmt(f.metrics.homes_flooded, 0, '')} · flood volume {fmt(f.metrics.total_flooding_volume_m3, 0, ' m³')} · peak {fmt(f.metrics.j07_peak_depth_m, 2, ' m')} · {indicativeCost(f.costRM)} · {f.improved ? '✓ improves' : 'no effect'}</small>
        </li>;
      })}</ul>}
      <small>{FIX_FOOTER}</small>
    </details>
  </section>;
}
