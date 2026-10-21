import type { Storm } from '../sim/types';
import { MMHR } from '../scenario/config';
import { parseInp } from './inp';
import { RAIN_STEP_S, readRainfall } from './rainfall';

const SI_FLOW_UNITS = ['CMS', 'LPS', 'MLD'];

/**
 * The storm a SWMM .inp describes, read by the same rainfall reader as the site bundle.
 * No rainfall gives `storm: null` with no error; anything unreadable is an error (nothing is guessed).
 */
export function stormFromInp(text: string): { storm: Storm | null; errors: string[] } {
  const m = parseInp(text);
  const { rows, errors } = readRainfall(m);
  if (!rows.length && !errors.length) return { storm: null, errors: [] };
  if (!m.flowUnits || !SI_FLOW_UNITS.includes(m.flowUnits)) {
    errors.unshift(`SWMM file: FLOW_UNITS is ${m.flowUnits ?? 'not set (SWMM then uses CFS)'}; SI units (CMS, LPS or MLD) are needed so that rainfall is in mm/h.`);
  }
  if (errors.length) return { storm: null, errors };

  const intensity = rows.map((r) => r.intensity_mmh * MMHR);
  let peak = 0;
  intensity.forEach((v, i) => {
    if (v > intensity[peak]) peak = i;
  });
  return {
    storm: { id: 'uploaded_rainfall', label: 'Uploaded rainfall', returnPeriod: 0, blockS: RAIN_STEP_S, intensity, provisional: false, peakMinute: (peak * RAIN_STEP_S) / 60 },
    errors,
  };
}
