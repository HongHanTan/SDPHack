import './ui/styles.css';
import { createScene } from './render/scene';
import { baseTownship, buildTownship } from './scenario/index';
import { totalCost } from './scenario/interventions';
import { STORMS } from './scenario/storms';
import { renderAssumptions } from './ui/assumptions';
import { renderSagChart } from './ui/chart';
import { renderControls } from './ui/controls';
import { Player } from './ui/player';
import { renderBalance, renderResults } from './ui/results';
import { SimRunError, SimRunner, type WorkerLike } from './ui/runner';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = createScene($('viewport'));
view.setTownship(baseTownship());

const runner = new SimRunner(
  () => new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
);
const player = new Player($('scrubber'), $('clock'), $('play'), (f) => view.showFrame(f));

const status = (text: string, error = false) => {
  const el = $('status');
  el.textContent = text;
  el.className = `status${error ? ' error' : ''}`;
};

const updateStormNote = () => {
  const note = $('storm-note');
  const provisional = STORMS[controls.storm()].provisional;
  note.textContent = provisional ? 'Rainfall coefficients are PROVISIONAL — see assumptions.' : 'Rainfall from MSMA 2nd Ed.';
  note.className = `note${provisional ? ' warn' : ''}`;
};
const controls = renderControls($('storm'), $('interventions'), updateStormNote);
updateStormNote();

renderAssumptions($('assumptions-body'));
$('assumptions-btn').addEventListener('click', () => $<HTMLDialogElement>('assumptions').showModal());
$('assumptions-close').addEventListener('click', () => $<HTMLDialogElement>('assumptions').close());

const runBtn = $<HTMLButtonElement>('run');
runBtn.addEventListener('click', async () => {
  const ids = controls.selected();
  const storm = controls.storm();
  runBtn.disabled = true;
  try {
    if (!runner.isCached([], storm)) status('Simulating baseline…');
    const base = await runner.run([], storm);
    view.setTownship(buildTownship(ids));
    player.reset();
    status(ids.length ? 'Simulating scenario…' : 'Replaying baseline…');
    const cur = await runner.run(ids, storm, (f) => player.push(f));
    renderResults($('cards'), base.metrics, cur.metrics, totalCost(ids));
    renderSagChart($('chart'), base.metrics, cur.metrics);
    renderBalance($('balance'), cur.metrics.balance.error);
    status('Done.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    status(
      e instanceof SimRunError && e.step >= 0
        ? `Simulation stopped at step ${e.step}: ${msg}`
        : `Simulation failed: ${msg}. Click Run to retry; cached results still replay.`,
      true,
    );
  } finally {
    runBtn.disabled = false;
  }
});
