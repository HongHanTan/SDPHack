import './ui/styles.css';
import { createScene } from './render/scene';
import { baseTownship, buildTownship, customPipeCost, type CustomPipe } from './scenario/index';
import { totalCost, type InterventionId } from './scenario/interventions';
import { STORMS } from './scenario/storms';
import { renderAssumptions } from './ui/assumptions';
import { clearSagChart, renderSagChart } from './ui/chart';
import { renderControls } from './ui/controls';
import { Player } from './ui/player';
import { clearResults, renderBalance, renderResults } from './ui/results';
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
let busy = false;
const drawBtn = $<HTMLButtonElement>('draw');
const runBtn = $<HTMLButtonElement>('run');
const stormSel = $<HTMLSelectElement>('storm');
const pipeSel = $<HTMLSelectElement>('pipe-d');

const nodeInverts = (ids: InterventionId[]): Map<string, number> =>
  new Map(buildTownship(ids).network.nodes.map((n) => [n.id, n.invert]));

const isActive = (c: CustomPipe, nodes: Map<string, number>) => nodes.has(c.from) && nodes.has(c.to);

const setBusy = (b: boolean) => {
  busy = b;
  runBtn.disabled = b;
  drawBtn.disabled = b;
  stormSel.disabled = b;
  pipeSel.disabled = b;
  $('interventions').querySelectorAll<HTMLInputElement>('input').forEach((i) => (i.disabled = b));
  $('custom-list').querySelectorAll<HTMLButtonElement>('button').forEach((x) => (x.disabled = b));
};

const renderCustom = () => {
  try {
    const ids = controls.selected();
    const nodes = nodeInverts(ids);
    const t = buildTownship(ids, custom.filter((c) => isActive(c, nodes)));
    view.setTownship(t);
    $('custom-list').innerHTML = custom
      .map((c, k) => {
        const btn = `<button data-k="${k}" ${busy ? 'disabled' : ''}>✕</button>`;
        return isActive(c, nodes)
          ? `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm · RM ${(customPipeCost(t, c) / 1e6).toFixed(2)}M ${btn}</li>`
          : `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm (inactive — node not in scenario) ${btn}</li>`;
      })
      .join('');
  } catch (e) {
    status(`Could not update the township view: ${e instanceof Error ? e.message : String(e)}`, true);
  }
};

$('interventions').addEventListener('change', () => {
  if (!busy) renderCustom();
});

drawBtn.addEventListener('click', () => {
  if (busy) return;
  drawing = !drawing;
  pending = null;
  drawBtn.textContent = `Draw pipe: ${drawing ? 'click two manholes' : 'off'}`;
  drawBtn.classList.toggle('active', drawing);
});

$('custom-list').addEventListener('click', (e) => {
  if (busy) return;
  const k = (e.target as HTMLElement).dataset.k;
  if (k === undefined) return;
  custom.splice(Number(k), 1);
  renderCustom();
});

let downAt: { x: number; y: number } | null = null;
view.canvas.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});

view.canvas.addEventListener('click', (e) => {
  if (!drawing || busy) return;
  if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // orbit drag
  const r = view.canvas.getBoundingClientRect();
  const id = view.pickNode(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  if (!id) return;
  if (pending === null) {
    pending = id;
    status(`From ${id} — now click the downstream manhole.`);
    return;
  }
  if (id === pending) {
    status('A pipe needs two different manholes.', true);
    return;
  }
  const from = pending;
  const nodes = nodeInverts(controls.selected());
  const fromInv = nodes.get(from);
  const toInv = nodes.get(id);
  if (fromInv === undefined || toInv === undefined) {
    pending = null;
    status('That manhole is not part of the current scenario.', true);
    return;
  }
  if (custom.some((c) => c.from === from && c.to === id)) {
    status(`Pipe ${from} → ${id} already exists.`, true);
    return;
  }
  if (custom.some((c) => c.from === id && c.to === from)) {
    status(`A pipe ${id} → ${from} already exists; a reverse pipe would be redundant.`, true);
    return;
  }
  if (toInv > fromInv) {
    status(
      `Pipe would run uphill (from invert ${fromInv.toFixed(2)} m to ${toInv.toFixed(2)} m) — pick a lower downstream manhole.`,
      true,
    );
    return;
  }
  custom.push({ from, to: id, diameter: Number(pipeSel.value) });
  pending = null;
  status('Pipe added. Click Run storm to simulate.');
  renderCustom();
});

renderAssumptions($('assumptions-body'));
$('assumptions-btn').addEventListener('click', () => $<HTMLDialogElement>('assumptions').showModal());
$('assumptions-close').addEventListener('click', () => $<HTMLDialogElement>('assumptions').close());

const errorStatus = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  status(
    e instanceof SimRunError && e.step >= 0
      ? `Simulation stopped at step ${e.step}: ${msg}`
      : `Simulation failed: ${msg}. Click Run to retry; cached results still replay.`,
    true,
  );
};

// Baseline for the default storm runs in the background; Run stays disabled until it settles.
setBusy(true);
status('Simulating baseline…');
player.reset();
runner
  .run([], controls.storm(), (f) => player.push(f))
  .then(() => status('Baseline ready. Pick interventions and click Run storm.'))
  .catch(errorStatus)
  .finally(() => setBusy(false));

runBtn.addEventListener('click', async () => {
  if (busy) return;
  // Snapshot inputs so edits made while running cannot corrupt this run.
  const ids = controls.selected();
  const storm = controls.storm();
  const nodes = nodeInverts(ids);
  const pipes = custom.filter((c) => isActive(c, nodes));
  setBusy(true);
  clearResults($('cards'), $('balance'));
  clearSagChart();
  try {
    if (!runner.isCached([], storm)) status('Simulating baseline…');
    const base = await runner.run([], storm);
    const township = buildTownship(ids, pipes);
    view.setTownship(township);
    player.reset();
    status(ids.length || pipes.length ? 'Simulating scenario…' : 'Replaying baseline…');
    const cur = await runner.run(ids, storm, (f) => player.push(f), pipes);
    renderResults(
      $('cards'),
      base.metrics,
      cur.metrics,
      totalCost(ids) + pipes.reduce((s, c) => s + customPipeCost(township, c), 0),
    );
    renderSagChart($('chart'), base.metrics, cur.metrics);
    renderBalance($('balance'), base.metrics.balance.error, cur.metrics.balance.error);
    status('Done.');
  } catch (e) {
    errorStatus(e);
  } finally {
    setBusy(false);
  }
});
