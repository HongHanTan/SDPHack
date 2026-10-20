import type { Storm } from '../sim/types';

/** MSMA 2nd Ed. IDF form: i (mm/hr) = λ·T^κ / (d + θ)^η, with d in hours. */
export interface IdfCoefficients {
  station: string;
  lambda: number;
  kappa: number;
  theta: number;
  eta: number;
  provisional: boolean;
}

/**
 * PROVISIONAL coefficients of plausible Klang Valley magnitude, so the app runs.
 * Before the pitch: copy the coefficients for a Klang Valley station from
 * MSMA 2nd Edition (2012), Table 2.B1, set `station`, and set provisional: false.
 */
export const IDF: IdfCoefficients = {
  station: 'Provisional — replace from MSMA 2nd Ed. Table 2.B1',
  lambda: 60,
  kappa: 0.17,
  theta: 0.25,
  eta: 0.8,
  provisional: true,
};

export const STORM_DURATION_S = 7200;
export const BLOCK_S = 300;

export function idfIntensity(c: IdfCoefficients, returnPeriod: number, durationHours: number): number {
  return (c.lambda * Math.pow(returnPeriod, c.kappa)) / Math.pow(durationHours + c.theta, c.eta);
}

/** Alternating-block hyetograph (mm/hr per block), largest block at the centre. */
export function alternatingBlock(c: IdfCoefficients, returnPeriod: number, durationS: number, blockS: number): number[] {
  const n = Math.round(durationS / blockS);
  const increments: number[] = [];
  let prev = 0;
  for (let k = 1; k <= n; k++) {
    const dH = (k * blockS) / 3600;
    const cum = idfIntensity(c, returnPeriod, dH) * dH;
    increments.push(cum - prev);
    prev = cum;
  }
  increments.sort((a, b) => b - a);
  const out = new Array<number>(n).fill(0);
  const mid = Math.floor(n / 2);
  increments.forEach((d, k) => {
    const offset = k % 2 === 1 ? -(k + 1) / 2 : k / 2;
    out[mid + offset] = d / (blockS / 3600);
  });
  return out;
}

export function designStorm(returnPeriod: number, c: IdfCoefficients = IDF): Storm {
  return {
    id: `${returnPeriod}yr`,
    label: `${returnPeriod}-year ARI, 2 h`,
    returnPeriod,
    blockS: BLOCK_S,
    intensity: alternatingBlock(c, returnPeriod, STORM_DURATION_S, BLOCK_S).map((mmhr) => mmhr / 3.6e6),
    provisional: c.provisional,
    peakMinute: STORM_DURATION_S / 120,
  };
}

/** Constant-intensity storm in 5-minute blocks (the team's synthetic SWMM storms). */
export function constantStorm(id: string, label: string, mmhr: number, minutes: number): Storm {
  const blocks = Math.round((minutes * 60) / BLOCK_S);
  return {
    id,
    label,
    returnPeriod: 0,
    blockS: BLOCK_S,
    intensity: new Array<number>(blocks).fill(mmhr / 3.6e6),
    provisional: false,
    peakMinute: minutes / 2,
  };
}

export const STORMS = {
  synthetic_80mmh_60min: constantStorm('synthetic_80mmh_60min', 'Constant 80 mm/h, 60 min (team SWMM storm)', 80, 60),
  synthetic_120mmh_60min: constantStorm('synthetic_120mmh_60min', 'Constant 120 mm/h, 60 min (team SWMM storm)', 120, 60),
  '10yr': designStorm(10),
  '100yr': designStorm(100),
};
export type StormId = keyof typeof STORMS;
export const DEFAULT_STORM: StormId = 'synthetic_80mmh_60min';

/** Rain intensity in mm/hr at storm time t (s); 0 before the start and after the storm ends. */
export function rainIntensityAt(storm: Storm, t: number): number {
  if (t < 0) return 0;
  const k = Math.floor(t / storm.blockS);
  return k < storm.intensity.length ? storm.intensity[k] * 3.6e6 : 0;
}
