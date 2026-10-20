import type { SceneHandle } from '../render/scene';
import { buildTownship, customPipeCost } from '../scenario/index';
import { activePipes, type Selection } from './selection';

export interface DrawPipes {
  setDisabled(disabled: boolean): void;
  renderList(): void;
}

export interface DrawPipesOptions {
  view: SceneHandle;
  selection: Selection;
  status: (text: string, error?: boolean) => void;
  onDrawingChange: (drawing: boolean) => void;
}

/** Draw-a-pipe: click two manholes; validates uphill, duplicate, reverse, self and missing-node pipes. */
export function mountDrawPipes(o: DrawPipesOptions): DrawPipes {
  const drawBtn = document.getElementById('draw') as HTMLButtonElement;
  const pipeSel = document.getElementById('pipe-d') as HTMLSelectElement;
  const list = document.getElementById('custom-list') as HTMLElement;
  let drawing = false;
  let pending: string | null = null;
  let disabled = false;
  let downAt: { x: number; y: number } | null = null;

  const setDrawing = (d: boolean) => {
    drawing = d;
    pending = null;
    drawBtn.textContent = `Draw pipe: ${d ? 'click two manholes' : 'off'}`;
    drawBtn.classList.toggle('active', d);
    o.onDrawingChange(d);
  };

  const renderList = () => {
    try {
      const state = o.selection.state;
      const active = activePipes(state);
      const t = buildTownship(state.interventions, active);
      list.innerHTML = state.custom
        .map((c, k) => {
          const btn = `<button data-k="${k}" ${disabled ? 'disabled' : ''}>✕</button>`;
          const isActive = active.some((a) => a.from === c.from && a.to === c.to);
          return isActive
            ? `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm · RM ${(customPipeCost(t, c) / 1e6).toFixed(2)}M ${btn}</li>`
            : `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm (inactive — node not in scenario) ${btn}</li>`;
        })
        .join('');
    } catch (e) {
      o.status(`Could not list custom pipes: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };

  drawBtn.addEventListener('click', () => {
    if (!disabled) setDrawing(!drawing);
  });

  list.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).dataset.k;
    if (disabled || k === undefined) return;
    o.selection.removePipe(Number(k));
  });

  o.view.canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });

  o.view.canvas.addEventListener('click', (e) => {
    if (!drawing || disabled) return;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // orbit drag, not a click
    const r = o.view.canvas.getBoundingClientRect();
    const id = o.view.pickNode(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!id) return;
    if (pending === null) {
      pending = id;
      o.status(`From ${id} — now click the downstream manhole.`);
      return;
    }
    if (id === pending) {
      o.status('A pipe needs two different manholes.', true);
      return;
    }
    const from = pending;
    const state = o.selection.state;
    const inverts = new Map(buildTownship(state.interventions).network.nodes.map((n) => [n.id, n.invert]));
    const fromInv = inverts.get(from);
    const toInv = inverts.get(id);
    if (fromInv === undefined || toInv === undefined) {
      pending = null;
      o.status('That manhole is not part of the current scenario.', true);
      return;
    }
    if (state.custom.some((c) => c.from === from && c.to === id)) {
      o.status(`Pipe ${from} → ${id} already exists.`, true);
      return;
    }
    if (state.custom.some((c) => c.from === id && c.to === from)) {
      o.status(`A pipe ${id} → ${from} already exists; a reverse pipe would be redundant.`, true);
      return;
    }
    if (toInv > fromInv) {
      o.status(`Pipe would run uphill (from invert ${fromInv.toFixed(2)} m to ${toInv.toFixed(2)} m) — pick a lower downstream manhole.`, true);
      return;
    }
    pending = null;
    o.selection.addPipe({ from, to: id, diameter: Number(pipeSel.value) });
    o.status('Pipe added.');
  });

  renderList();
  return {
    setDisabled(b) {
      disabled = b;
      drawBtn.disabled = b;
      pipeSel.disabled = b;
      if (b && drawing) setDrawing(false);
      renderList();
    },
    renderList,
  };
}
