import type { Storm } from '../sim/types';
import { MMHR } from '../scenario/config';
import { parseInp } from './inp';

const SI_FLOW_UNITS = ['CMS', 'LPS', 'MLD'];
const STEP_S = 300;

/**
 * The storm a SWMM .inp describes: the rain gage used by the first subcatchment, read as 5-minute INTENSITY
 * (mm/h) values. No rainfall gives `storm: null` with no error; anything unreadable is an error (nothing is guessed).
 */
export function stormFromInp(text: string): { storm: Storm | null; errors: string[] } {
  const m = parseInp(text);
  const none = { storm: null, errors: [] as string[] };
  const first = m.subcatchments[0];
  if (!first) return none;
  const gage = m.rainGages.get(first.rainGage);
  if (!gage || !gage.series) return none;
  const series = m.timeseries.get(gage.series);
  if (!series || !series.length) return none;

  const errors: string[] = [];
  if (!m.flowUnits || !SI_FLOW_UNITS.includes(m.flowUnits)) {
    errors.push(`SWMM file: FLOW_UNITS is ${m.flowUnits ?? 'not set (SWMM then uses CFS)'}; SI units (CMS, LPS or MLD) are needed so that rainfall is in mm/h.`);
  }
  if (gage.format !== 'INTENSITY') errors.push(`SWMM file: rain gage ${first.rainGage} is ${gage.format || 'missing its format'}; INTENSITY rainfall (mm/h) is needed.`);
  if (gage.intervalS !== STEP_S) errors.push(`SWMM file: rain gage ${first.rainGage} records every ${Number.isFinite(gage.intervalS) ? `${gage.intervalS / 60} minutes` : '(unreadable interval)'}; a 5-minute interval is needed.`);
  series.forEach((r, i) => {
    if (!(r.v >= 0)) errors.push(`SWMM file: time series ${gage.series} entry ${i + 1} has intensity ${r.v} mm/h; it must be 0 or more.`);
  });
  if (errors.length) return { storm: null, errors };

  const intensity = series.map((r) => r.v * MMHR);
  let peak = 0;
  intensity.forEach((v, i) => {
    if (v > intensity[peak]) peak = i;
  });
  return {
    storm: { id: 'uploaded_rainfall', label: 'Uploaded rainfall', returnPeriod: 0, blockS: STEP_S, intensity, provisional: false, peakMinute: (peak * STEP_S) / 60 },
    errors,
  };
}
