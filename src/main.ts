import './ui/styles.css';
import { createScene } from './render/scene';
import { baseTownship, buildTownship, customPipeCost, type CustomPipe } from './scenario/index';
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

const custom: CustomPipe[] = [];
let drawing = false;
let pending: string | null = null;
const drawBtn = $<HTMLButtonElement>('draw');

const renderCustom = () => {
  const t = buildTownship(controls.selected(), custom);
  view.setTownship(t);
  $('custom-list').innerHTML = custom
    .map(
      (c, k) =>
        `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm · RM ${(customPipeCost(t, c) / 1e6).toFixed(2)}M <button data-k="${k}">✕</button></li>`,
    )
    .join('');
};

drawBtn.addEventListener('click', () => {
  drawing = !drawing;
  pending = null;
  drawBtn.textContent = `Draw pipe: ${drawing ? 'click two manholes' : 'off'}`;
  drawBtn.classList.toggle('active', drawing);
});

$('custom-list').addEventListener('click', (e) => {
  const k = (e.target as HTMLElement).dataset.k;
  if (k === undefined) return;
  custom.splice(Number(k), 1);
  renderCustom();
});

view.canvas.addEventListener('click', (e) => {
  if (!drawing) return;
  const r = view.canvas.getBoundingClientRect();
  const id = view.pickNode(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  if (!id) return;
  if (pending === null) {
    pending = id;
    status(`From ${id} — now click the downstream manhole.`);
  } else if (id !== pending) {
    custom.push({ from: pending, to: id, diameter: Number($<HTMLSelectElement>('pipe-d').value) });
    pending = null;
    status('Pipe added. Click Run storm to simulate.');
    renderCustom();
  }
});

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
    const township = buildTownship(ids, custom);
    view.setTownship(township);
    player.reset();
    status(ids.length || custom.length ? 'Simulating scenario…' : 'Replaying baseline…');
    const cur = await runner.run(ids, storm, (f) => player.push(f), custom);
    renderResults(
      $('cards'),
      base.metrics,
      cur.metrics,
      totalCost(ids) + custom.reduce((s, c) => s + customPipeCost(township, c), 0),
    );
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
