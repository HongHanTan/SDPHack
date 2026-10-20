import { INTERVENTIONS, type InterventionId } from '../scenario/interventions';
import { STORMS, type StormId } from '../scenario/storms';
import { formatRM } from './format';

export function renderControls(stormSel: HTMLSelectElement, list: HTMLElement, onChange: () => void) {
  stormSel.innerHTML = (Object.keys(STORMS) as StormId[])
    .map((id) => `<option value="${id}" ${id === '100yr' ? 'selected' : ''}>${STORMS[id].label}</option>`)
    .join('');
  list.innerHTML = INTERVENTIONS.map(
    (iv, k) => `
      <label class="iv">
        <input type="checkbox" value="${iv.id}" />
        <span class="iv-name">#${k + 1} ${iv.name}</span>
        <span class="iv-meta">${formatRM(iv.costRM)} · ${iv.disruption} disruption</span>
        <span class="iv-desc">${iv.description}</span>
      </label>`,
  ).join('');
  stormSel.addEventListener('change', onChange);
  list.addEventListener('change', onChange);
  return {
    selected: (): InterventionId[] =>
      Array.from(list.querySelectorAll<HTMLInputElement>('input:checked')).map((i) => i.value as InterventionId),
    storm: (): StormId => stormSel.value as StormId,
  };
}

/** Fills the storm dropdown (default 100-yr) and returns a getter for the selected storm. */
export function renderStormSelect(stormSel: HTMLSelectElement): () => StormId {
  stormSel.innerHTML = (Object.keys(STORMS) as StormId[])
    .map((id) => `<option value="${id}" ${id === '100yr' ? 'selected' : ''}>${STORMS[id].label}</option>`)
    .join('');
  return () => stormSel.value as StormId;
}
