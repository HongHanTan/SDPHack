import './ui/styles.css';
import { createScene } from './render/scene';
import { buildTownship } from './scenario/index';
import { INTERVENTIONS } from './scenario/interventions';
import { rainIntensityAt, STORMS, type StormId } from './scenario/storms';
import { renderAssumptions } from './ui/assumptions';
import { DISPLAY } from './ui/catalog';
import { createCompareMode } from './ui/compareMode';
import { renderStormSelect } from './ui/controls';
import { mountDrawPipes } from './ui/drawPipes';
import { formatRM } from './ui/format';
import { mountInterventionPanel } from './ui/interventionPanel';
import { createLiveMode } from './ui/liveMode';
import { mountRainGauge } from './ui/rainGauge';
import { activePipes, Selection } from './ui/selection';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = createScene($('viewport'));
const selection = new Selection();
const stormSel = $<HTMLSelectElement>('storm');
const storm = renderStormSelect(stormSel);
const gauge = mountRainGauge($('rain-gauge'));

const status = (text: string, error = false) => {
  const el = $('status');
  el.textContent = text;
  el.className = `status${error ? ' error' : ''}`;
};

const showRain = (s: StormId, t: number) => {
  view.setRain(rainIntensityAt(STORMS[s], t));
  gauge.set(STORMS[s], t);
};

const syncTownship = () => {
  const st = selection.state;
  view.setTownship(buildTownship(st.interventions, activePipes(st)));
  view.setInstalled(new Set(st.interventions));
};

syncTownship();
view.setPins(
  INTERVENTIONS.map((iv) => ({
    id: iv.id,
    icon: DISPLAY[iv.id].icon,
    label: DISPLAY[iv.id].label,
    description: iv.description,
    costText: formatRM(iv.costRM),
    disruption: iv.disruption,
    x: DISPLAY[iv.id].site.x,
    y: DISPLAY[iv.id].site.y,
  })),
);
view.onPinToggle((id, on) => selection.set(id, on));

const panel = mountInterventionPanel($('interventions'), selection, storm);

let pinsOn = true;
let drawingNow = false;
const pinsBtn = $<HTMLButtonElement>('pins-toggle');
const applyPinVisibility = () => view.setPinsVisible(pinsOn && !drawingNow);
pinsBtn.addEventListener('click', () => {
  pinsOn = !pinsOn;
  pinsBtn.textContent = `📍 Pins: ${pinsOn ? 'on' : 'off'}`;
  applyPinVisibility();
});

const xrayBtn = $<HTMLButtonElement>('xray-toggle');
let xrayOn = false;
xrayBtn.addEventListener('click', () => {
  xrayOn = !xrayOn;
  xrayBtn.classList.toggle('active', xrayOn);
  view.setXray(xrayOn);
});

const planOverlay = $('plan-overlay');
const scaleBar = $('scalebar-bar');
let planOn = false;
const updateScaleBar = () => {
  if (!planOn) return;
  const px = 50 / Math.max(1e-6, view.planMetresPerPixel());
  scaleBar.style.width = `${Math.round(Math.min(240, px))}px`;
  requestAnimationFrame(updateScaleBar);
};
$('view-toggle').addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
  if (!btn) return;
  const v = btn.dataset.view as '3d' | 'plan';
  $('view-toggle').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  view.setView(v);
  planOn = v === 'plan';
  planOverlay.hidden = !planOn;
  if (planOn) requestAnimationFrame(updateScaleBar);
});

const qualityToggle = $('quality-toggle');
const markQuality = (q: 'high' | 'low') =>
  qualityToggle.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('active', b.dataset.q === q));
qualityToggle.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-q]');
  if (!btn) return;
  const q = btn.dataset.q as 'high' | 'low';
  markQuality(q);
  view.setQuality(q);
});
view.onQualityAutoDrop(() => markQuality('low'));
view.onNotice((text) => status(text));

const draw = mountDrawPipes({
  view,
  selection,
  status,
  onDrawingChange: (d) => {
    drawingNow = d;
    applyPinVisibility();
  },
});

const tabLive = $<HTMLButtonElement>('tab-live');
const tabCompare = $<HTMLButtonElement>('tab-compare');

/** Locks shared controls while a Compare run is in progress. */
const setBusy = (b: boolean) => {
  stormSel.disabled = b;
  tabLive.disabled = b;
  tabCompare.disabled = b;
  panel.setDisabled(b);
  draw.setDisabled(b);
  view.setPinsDisabled(b);
};

const compare = createCompareMode({ view, selection, storm, status, setBusy, showRain });
const live = createLiveMode({ view, selection, storm, status, showRain });

type Mode = 'live' | 'compare';
let mode: Mode = 'live';

const setMode = (m: Mode) => {
  if (m === mode || compare.isBusy()) return;
  (mode === 'live' ? live : compare).leave();
  mode = m;
  tabLive.classList.toggle('active', m === 'live');
  tabCompare.classList.toggle('active', m === 'compare');
  $('live-controls').hidden = m !== 'live';
  $('live-results').hidden = m !== 'live';
  $('compare-controls').hidden = m !== 'compare';
  $('compare-results').hidden = m !== 'compare';
  syncTownship();
  view.setRain(0);
  gauge.clear();
  (m === 'live' ? live : compare).enter();
};
tabLive.addEventListener('click', () => setMode('live'));
tabCompare.addEventListener('click', () => setMode('compare'));

selection.subscribe((_state, label) => {
  syncTownship();
  panel.refresh();
  draw.renderList();
  live.onSelectionChange(label);
});

const updateStormNote = () => {
  const note = $('storm-note');
  const provisional = STORMS[storm()].provisional;
  note.textContent = provisional ? 'Rainfall coefficients are PROVISIONAL — see assumptions.' : 'Rainfall from MSMA 2nd Ed.';
  note.className = `note${provisional ? ' warn' : ''}`;
};
stormSel.addEventListener('change', () => {
  updateStormNote();
  panel.refresh();
  if (mode === 'live') live.onStormChange();
});
updateStormNote();

renderAssumptions($('assumptions-body'));
$('assumptions-btn').addEventListener('click', () => $<HTMLDialogElement>('assumptions').showModal());
$('assumptions-close').addEventListener('click', () => $<HTMLDialogElement>('assumptions').close());

live.enter();
