import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';
import { COMBOS, costScale, DISPLAY, formatEffect, groupedInterventions } from './catalog';
import { effectOf } from './effects';
import { formatRM } from './format';
import { activePipes, selectionCost, type Selection } from './selection';

export interface InterventionPanel {
  refresh(): void;
  setDisabled(disabled: boolean): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Grouped, plain-language intervention list with effect badges, combos and a cost footer. */
export function mountInterventionPanel(el: HTMLElement, selection: Selection, storm: () => StormId): InterventionPanel {
  let disabled = false;

  const render = () => {
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset?.id;
    const hadFocus = !!focusedId && el.contains(document.activeElement);
    const state = selection.state;
    const s = storm();
    const dis = disabled ? 'disabled' : '';
    const combos = COMBOS.map(
      (c, k) =>
        `<button class="combo" data-combo="${k}" ${dis} title="${esc(c.ids.map((id) => DISPLAY[id].label).join(' + '))}">${c.label}: ${c.hint}</button>`,
    ).join('');
    const groups = groupedInterventions()
      .map(({ group, items }) => {
        const rows = items
          .map((iv) => {
            const d = DISPLAY[iv.id];
            const eff = effectOf(s, iv.id);
            const f = eff ? formatEffect(eff.dSag) : null;
            const badge = f ? `<span class="effect ${f.tone}">${f.text}</span>` : '';
            const homes = eff ? ` · homes flooded ${eff.dHomes > 0 ? '+' : ''}${eff.dHomes} vs baseline` : '';
            const tip = esc(`${iv.description} · ${formatRM(iv.costRM)} (indicative)${homes}`);
            const on = state.interventions.includes(iv.id);
            return `<label class="iv-row${on ? ' on' : ''}" title="${tip}">
              <span class="iv-icon">${d.icon}</span>
              <span class="iv-text">
                <span class="iv-label">${d.label}</span>
                <span class="iv-sub"><span class="cost-scale">${'$'.repeat(costScale(iv.costRM))}</span> · ${iv.disruption.toLowerCase()} disruption <span class="info">ⓘ</span></span>
              </span>
              ${badge}
              <input type="checkbox" class="switch" data-id="${iv.id}" ${on ? 'checked' : ''} ${dis} />
            </label>`;
          })
          .join('');
        return `<div class="iv-group">${group}</div>${rows}`;
      })
      .join('');
    const installed = state.interventions.length + activePipes(state).length;
    el.innerHTML = `<div class="combos">${combos}</div>${groups}
      <div class="iv-footer"><span>${installed} installed</span><span>${formatRM(selectionCost(state))}</span></div>
      <p class="note">Badges: sag peak depth vs baseline for this storm. Costs are indicative placeholders.</p>`;
    if (hadFocus) el.querySelector<HTMLInputElement>(`input.switch[data-id="${focusedId}"]`)?.focus();
  };

  el.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.id as InterventionId | undefined;
    if (id && !disabled) selection.set(id, input.checked);
  });
  el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-combo]');
    if (!btn || disabled) return;
    const combo = COMBOS[Number(btn.dataset.combo)];
    selection.applyCombo(combo.ids, combo.label);
  });

  render();
  return {
    refresh: render,
    setDisabled(b) {
      disabled = b;
      render();
    },
  };
}
