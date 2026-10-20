import type { SceneHandle } from '../render/scene';
import { buildTownship } from '@floodops/engine/scenario/index';
import type { StormId } from '@floodops/engine/scenario/storms';
import { clearSagChart, renderSagChart } from './chart';
import { Player } from './player';
import { clearResults, renderBalance, renderResults } from './results';
import { SimRunError, SimRunner, type WorkerLike } from '@floodops/engine/client/runner';
import { activePipes, selectionCost, type Selection } from './selection';

export interface CompareMode {
  enter(): void;
  leave(): void;
  isBusy(): boolean;
}

export interface CompareOptions {
  view: SceneHandle;
  selection: Selection;
  storm: () => StormId;
  status: (text: string, error?: boolean) => void;
  /** Called with true while a run is in progress so the shell can lock shared controls. */
  setBusy: (busy: boolean) => void;
  showRain: (storm: StormId, t: number) => void;
}

/** Fair baseline-vs-scenario runs (the original Run storm flow). */
export function createCompareMode(o: CompareOptions): CompareMode {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const runner = new SimRunner(
    () => new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
  );
  let shownStorm: StormId = o.storm();
  const player = new Player($('scrubber'), $('clock'), $('play'), (f) => {
    o.view.showFrame(f);
    o.showRain(shownStorm, f.t);
  });
  const runBtn = $<HTMLButtonElement>('run');
  let busy = false;
  let lastRunKey: string | null = null;
  const runKey = () => {
    const st = o.selection.state;
    return JSON.stringify([st.interventions, activePipes(st), o.storm()]);
  };

  const setBusy = (b: boolean) => {
    busy = b;
    runBtn.disabled = b;
    o.setBusy(b);
  };

  const errorStatus = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    o.status(
      e instanceof SimRunError && e.step >= 0
        ? `Simulation stopped at step ${e.step}: ${msg}`
        : `Simulation failed: ${msg}. Click Run to retry; cached results still replay.`,
      true,
    );
  };

  const preloadBaseline = () => {
    const storm = o.storm();
    if (busy || runner.isCached([], storm)) return;
    setBusy(true);
    o.status('Simulating baseline…');
    shownStorm = storm;
    player.reset();
    runner
      .run([], storm, (f) => player.push(f))
      .then(() => o.status('Baseline ready. Pick interventions and click Run storm.'))
      .catch(errorStatus)
      .finally(() => setBusy(false));
  };

  runBtn.addEventListener('click', async () => {
    if (busy) return;
    // Snapshot inputs so later edits cannot corrupt this run.
    const state = o.selection.state;
    const ids = state.interventions;
    const pipes = activePipes(state);
    const storm = o.storm();
    const key = runKey();
    lastRunKey = null;
    setBusy(true);
    clearResults($('cards'), $('balance'));
    clearSagChart();
    try {
      if (!runner.isCached([], storm)) o.status('Simulating baseline…');
      const base = await runner.run([], storm);
      o.view.setTownship(buildTownship(ids, pipes));
      shownStorm = storm;
      player.reset();
      o.status(ids.length || pipes.length ? 'Simulating scenario…' : 'Replaying baseline…');
      const cur = await runner.run(ids, storm, (f) => player.push(f), pipes);
      renderResults($('cards'), base.metrics, cur.metrics, selectionCost({ interventions: ids, custom: pipes }));
      renderSagChart($('chart'), base.metrics, cur.metrics);
      renderBalance($('balance'), base.metrics.balance.error, cur.metrics.balance.error);
      lastRunKey = key;
      o.status('Done.');
    } catch (e) {
      errorStatus(e);
    } finally {
      setBusy(false);
    }
  });

  return {
    enter() {
      player.setEnabled(true);
      if (lastRunKey !== null && lastRunKey !== runKey()) {
        lastRunKey = null;
        clearResults($('cards'), $('balance'), 'Selection changed � click Run storm.');
        clearSagChart();
      }
      preloadBaseline();
    },
    leave() {
      player.setEnabled(false);
    },
    isBusy: () => busy,
  };
}
