import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScenarioOptions } from '@floodops/engine/scenario/index';
import { buildScenario, effectiveBlockage } from '@floodops/engine/scenario/index';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import { STORMS, type StormId } from '@floodops/engine/scenario/storms';
import type { LiveCommand, LiveMessage } from '@floodops/engine/worker/liveProtocol';
import type { SimulationFrame } from '../types';
import { makeContext, toTeamFrame, type AdapterContext } from './frameAdapter';

export type LiveSeekTarget = 'start' | 'peak' | 'end';
export const LIVE_SPEEDS = [0.5, 1, 2, 4] as const;

/** Storm minute for a jump button: start, peak rain, or the moment the rain stops. */
export function liveSeekMinute(stormId: StormId, target: LiveSeekTarget): number {
  const s = STORMS[stormId];
  if (target === 'peak') return s.peakMinute;
  if (target === 'end') return (s.intensity.length * s.blockS) / 60;
  return 0;
}

function contextFor(ids: InterventionId[], stormId: StormId, opts: ScenarioOptions): AdapterContext {
  const sc = buildScenario(ids, stormId, [], opts);
  return makeContext(sc.network, sc.grid, effectiveBlockage(ids, opts));
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** One continuous engine storm in a Web Worker, patchable mid-run. Engine mode only. */
export function useLiveEngine() {
  const worker = useRef<Worker | null>(null);
  const session = useRef(0);
  const ctx = useRef<AdapterContext | null>(null);
  /** Context for a patch the worker hasn't acknowledged yet; swapped in on 'patched' so in-flight frames keep the old network. */
  const pendingCtx = useRef<AdapterContext | null>(null);
  const cfg = useRef<{ stormId: StormId; ids: InterventionId[]; opts: ScenarioOptions } | null>(null);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  const [on, setOn] = useState(false);
  const [frame, setFrame] = useState<SimulationFrame | null>(null);
  const [depth, setDepth] = useState<Float32Array | null>(null);
  const [t, setT] = useState(0);
  const [rainMmHr, setRainMmHr] = useState(0);
  const [readouts, setReadouts] = useState<{ sagNow: number; sagPeak: number; homesNow: number } | null>(null);
  const [paused, setPausedState] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const send = (c: LiveCommand) => worker.current?.postMessage(c);
  const setPaused = (p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
  };

  const ensureWorker = useCallback(() => {
    if (worker.current) return;
    const w = new Worker(new URL('./workers/live.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<LiveMessage>) => {
      const m = e.data;
      if (m.session !== session.current) return;
      if (m.type === 'patched') {
        if (pendingCtx.current) ctx.current = pendingCtx.current;
        pendingCtx.current = null;
      } else if (m.type === 'frame' && ctx.current) {
        setFrame(toTeamFrame(m.frame, ctx.current));
        setDepth(m.frame.depth);
        setT(m.t);
        setRainMmHr(m.rainMmHr);
        setReadouts({ sagNow: m.readouts.sagNow, sagPeak: m.readouts.sagPeak, homesNow: m.readouts.homesNow });
      } else if (m.type === 'error') {
        setError(`Live engine stopped at step ${m.step}: ${m.message}`);
        setPaused(true);
      }
    };
    w.onerror = (e) => {
      setError(`Live engine crashed: ${e.message || 'unknown error'}`);
      setPaused(true);
      w.terminate();
      worker.current = null;
    };
    worker.current = w;
  }, []);

  const start = useCallback(
    (stormId: StormId, ids: InterventionId[], opts: ScenarioOptions) => {
      try {
        ensureWorker();
        cfg.current = { stormId, ids, opts };
        ctx.current = contextFor(ids, stormId, opts);
        pendingCtx.current = null;
        session.current += 1;
        setError(null);
        setPaused(false);
        send({ type: 'setSpeed', speed: speedRef.current });
        send({ type: 'start', session: session.current, stormId, interventions: ids, custom: [], opts });
      } catch (e) {
        setError(`Live engine failed to start: ${errText(e)}`);
      }
    },
    [ensureWorker],
  );

  const errored = useRef(false);
  useEffect(() => {
    errored.current = error !== null;
  }, [error]);

  const patch = useCallback((ids: InterventionId[], label: string) => {
    if (!cfg.current) return;
    // A stopped or crashed session can't take a patch: begin a fresh storm with the new interventions.
    if (errored.current || !worker.current) {
      start(cfg.current.stormId, ids, cfg.current.opts);
      return;
    }
    try {
      cfg.current = { ...cfg.current, ids };
      pendingCtx.current = contextFor(ids, cfg.current.stormId, cfg.current.opts);
      send({ type: 'patch', interventions: ids, custom: [], label });
    } catch (e) {
      setError(`Live engine patch failed: ${errText(e)}`);
    }
  }, [start]);

  const setSpeed = useCallback((s: number) => {
    speedRef.current = s;
    setSpeedState(s);
    send({ type: 'setSpeed', speed: s });
  }, []);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    send({ type: next ? 'pause' : 'resume' });
    setPaused(next);
  }, []);

  const seek = useCallback((target: LiveSeekTarget) => {
    if (!cfg.current) return;
    session.current += 1;
    setError(null);
    // The worker rebuilds from the current interventions, so any unacknowledged patch is already in effect.
    if (pendingCtx.current) ctx.current = pendingCtx.current;
    pendingCtx.current = null;
    send({ type: 'seek', session: session.current, minute: liveSeekMinute(cfg.current.stormId, target) });
  }, []);

  /** Stops simulating (Live off or leaving engine mode). A later start() begins a fresh storm. */
  const stop = useCallback(() => send({ type: 'stop' }), []);

  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
    },
    [],
  );

  return { on, setOn, frame, depth, t, rainMmHr, readouts, paused, speed, error, start, patch, setSpeed, togglePause, seek, stop };
}
