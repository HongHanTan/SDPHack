import type { InpModel } from './inp';

export const RAIN_STEP_S = 300;
export const MAX_RAIN_INTERVALS = 72;
export const MAX_RAIN_MMH = 300;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The one rainfall reader: the rain gage the subcatchments use, as 5-minute INTENSITY (mm/h) rows.
 * No rainfall gives no rows and a note; anything unreadable is an error (nothing is guessed).
 */
export function readRainfall(m: InpModel): { rows: Array<{ time_s: number; intensity_mmh: number }>; errors: string[]; notes: string[] } {
  const rows: Array<{ time_s: number; intensity_mmh: number }> = [];
  const errors: string[] = [];
  const notes: string[] = [];
  const gageNames = [...new Set(m.subcatchments.map((s) => s.rainGage))];
  if (!gageNames.length) {
    notes.push('No subcatchments, so no rain gage: the bundle has no rainfall.');
  } else if (new Set(gageNames.map((g) => JSON.stringify(m.rainGages.get(g) ?? g))).size > 1) {
    errors.push(`SWMM file: subcatchments use different rain gages (${gageNames.join(', ')}); the site format holds one rainfall series.`);
  } else {
    const gName = gageNames[0];
    const gage = m.rainGages.get(gName);
    if (!gage) {
      notes.push(`Rain gage ${gName} is not in [RAINGAGES]: the bundle has no rainfall.`);
    } else if (!gage.series) {
      notes.push(`Rain gage ${gName} does not read a [TIMESERIES] (external rainfall files are not read): the bundle has no rainfall.`);
    } else {
      if (gage.format !== 'INTENSITY') errors.push(`SWMM file: rain gage ${gName} is ${gage.format || 'missing its format'}; the site format needs INTENSITY rainfall (mm/h).`);
      if (gage.intervalS !== RAIN_STEP_S) errors.push(`SWMM file: rain gage ${gName} records every ${Number.isFinite(gage.intervalS) ? `${gage.intervalS / 60} minutes` : '(unreadable interval)'}; the site format needs a 5-minute interval.`);
      const series = m.timeseries.get(gage.series);
      if (!series || !series.length) {
        notes.push(`Time series ${gage.series} (rain gage ${gName}) is not in [TIMESERIES]: the bundle has no rainfall.`);
      } else if (gage.format === 'INTENSITY' && gage.intervalS === RAIN_STEP_S) {
        if (series.length > MAX_RAIN_INTERVALS) errors.push(`SWMM file: time series ${gage.series} has ${series.length} intervals; the site format holds at most ${MAX_RAIN_INTERVALS} (6 hours).`);
        series.forEach((r, i) => {
          if (Math.abs(r.t - i * RAIN_STEP_S) > 1e-6) errors.push(`SWMM file: time series ${gage.series} entry ${i + 1} is at ${r.t} s; the site format needs consecutive 5-minute steps (0, 300, 600 … s).`);
          else if (!(r.v >= 0 && r.v <= MAX_RAIN_MMH)) errors.push(`SWMM file: time series ${gage.series} entry ${i + 1} has intensity ${r.v} mm/h, outside 0–${MAX_RAIN_MMH}.`);
          rows.push({ time_s: i * RAIN_STEP_S, intensity_mmh: r.v });
        });
        notes.push(`Rainfall: ${plural(series.length, '5-minute interval')} from time series ${gage.series} (rain gage ${gName}); each intensity applies to the following 5 minutes.`);
      }
    }
  }
  return { rows, errors, notes };
}
