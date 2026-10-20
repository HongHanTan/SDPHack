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

const draw = mountDrawPipes({
  view,
  selection,
  status,
  onDrawingChange: (d) => {
    drawingNow = d;
    applyPinVisibility();
  },
});

const setBusy = (b: boolean) => {
  stormSel.disabled = b;
  panel.setDisabled(b);
  draw.setDisabled(b);
  view.setPinsDisabled(b);
};

const compare = createCompareMode({ view, selection, storm, status, setBusy, showRain });

selection.subscribe(() => {
  syncTownship();
  panel.refresh();
  draw.renderList();
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
});
updateStormNote();

renderAssumptions($('assumptions-body'));
$('assumptions-btn').addEventListener('click', () => $<HTMLDialogElement>('assumptions').showModal());
$('assumptions-close').addEventListener('click', () => $<HTMLDialogElement>('assumptions').close());

compare.enter();
