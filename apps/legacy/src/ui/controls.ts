import { DEFAULT_STORM, STORMS, type StormId } from '@floodops/engine/scenario/storms';

/** Fills the storm dropdown (default synthetic 80 mm/h) and returns a getter for the selected storm. */
export function renderStormSelect(stormSel: HTMLSelectElement): () => StormId {
  stormSel.innerHTML = (Object.keys(STORMS) as StormId[])
    .map((id) => `<option value="${id}" ${id === DEFAULT_STORM ? 'selected' : ''}>${STORMS[id].label}</option>`)
    .join('');
  return () => stormSel.value as StormId;
}
