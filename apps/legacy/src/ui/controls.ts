import { STORMS, type StormId } from '@floodops/engine/scenario/storms';

/** Fills the storm dropdown (default 100-yr) and returns a getter for the selected storm. */
export function renderStormSelect(stormSel: HTMLSelectElement): () => StormId {
  stormSel.innerHTML = (Object.keys(STORMS) as StormId[])
    .map((id) => `<option value="${id}" ${id === '100yr' ? 'selected' : ''}>${STORMS[id].label}</option>`)
    .join('');
  return () => stormSel.value as StormId;
}
