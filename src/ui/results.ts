import { SIM, THRESHOLDS } from '../scenario/config';
import type { Metrics } from '../sim/types';
import { describeChange, formatRM, type Tone } from './format';

interface Row {
  label: string;
  base: number | null;
  cur: number | null;
  digits: number;
  unit: string;
  lowerIsBetter: boolean;
}

const fmt = (v: number | null, digits: number, unit: string) =>
  v === null ? `> ${SIM.recessionS / 60} ${unit}` : `${v.toFixed(digits)} ${unit}`.trim();

function delta(r: Row): { text: string; tone: Tone } {
  if (r.base !== null && r.cur !== null) return describeChange(r.base, r.cur, r.digits, r.lowerIsBetter);
  if (r.base === null && r.cur === null) return { text: 'no change', tone: 'same' };
  return r.cur === null ? { text: 'still flooded at end', tone: 'worse' } : { text: 'now clears', tone: 'better' };
}

export function renderResults(el: HTMLElement, base: Metrics, cur: Metrics, costRM: number): void {
  const rows: Row[] = [
    { label: 'Peak depth at the sag', base: base.peakSagDepth, cur: cur.peakSagDepth, digits: 2, unit: 'm', lowerIsBetter: true },
    { label: `Homes flooded (≥ ${THRESHOLDS.home.toFixed(2)} m)`, base: base.homesFlooded, cur: cur.homesFlooded, digits: 0, unit: '', lowerIsBetter: true },
    { label: `Flooded road area (≥ ${THRESHOLDS.road.toFixed(2)} m)`, base: base.floodedRoadArea, cur: cur.floodedRoadArea, digits: 0, unit: 'm²', lowerIsBetter: true },
    { label: 'Minutes until roads passable', base: base.minutesToPassable, cur: cur.minutesToPassable, digits: 0, unit: 'min', lowerIsBetter: true },
    { label: 'Peak gravity outfall flow (excl. pump)', base: base.peakOutfallFlow, cur: cur.peakOutfallFlow, digits: 2, unit: 'm³/s', lowerIsBetter: false },
  ];
  el.innerHTML =
    rows
      .map((r) => {
        const d = delta(r);
        return `<div class="card"><div class="label">${r.label}</div>
          <div class="value">${fmt(r.cur, r.digits, r.unit)}</div>
          <div class="base">baseline ${fmt(r.base, r.digits, r.unit)}</div>
          <div class="delta ${d.tone}">${d.text}</div></div>`;
      })
      .join('') +
    `<div class="card"><div class="label">Indicative cost</div><div class="value">${formatRM(costRM)}</div>
      <div class="delta same">placeholder rates</div></div>`;
}

export function renderBalance(el: HTMLElement, baseError: number, curError: number): void {
  const ok = baseError < 0.01 && curError < 0.01;
  const pct = (e: number) => `${(e * 100).toFixed(3)}%`;
  el.className = `badge ${ok ? 'ok' : 'warn'}`;
  el.textContent = `Water balance ${ok ? '✓' : '⚠'} baseline ${pct(baseError)} · scenario ${pct(curError)}`;
}

export function clearResults(cards: HTMLElement, balance: HTMLElement, text = 'Running…'): void {
  cards.innerHTML = `<p class="note">${text}</p>`;
  balance.textContent = '';
  balance.className = '';
}
