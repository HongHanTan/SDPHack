import { rainIntensityAt } from '../scenario/storms';
import type { Storm } from '../sim/types';

/** "🌧 NN mm/hr" readout plus a mini hyetograph with the current 5-minute block highlighted. */
export function mountRainGauge(el: HTMLElement): { set(storm: Storm, t: number): void; clear(): void } {
  let lastKey = '';
  return {
    set(storm, t) {
      const mm = Math.round(rainIntensityAt(storm, t));
      const block = Math.floor(t / storm.blockS);
      const key = `${storm.id}|${mm}|${block}`;
      if (key === lastKey) return;
      lastKey = key;
      const max = Math.max(...storm.intensity);
      const bars = storm.intensity
        .map((v, k) => `<i class="${k === block ? 'now' : ''}" style="height:${Math.max(2, (v / max) * 28).toFixed(1)}px"></i>`)
        .join('');
      el.hidden = false;
      el.innerHTML = `<div class="rg-value">🌧 ${mm} mm/hr</div><div class="rg-bars">${bars}</div>`;
    },
    clear() {
      lastKey = '';
      el.hidden = true;
      el.innerHTML = '';
    },
  };
}
