/** Every colour/number that differs between the day look and the x-ray look. Colours are lowercase #rrggbb. */
export interface Theme {
  skyTop: string;
  skyHorizon: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunColor: string;
  sunIntensity: number;
  terrainOpacity: number;
  treeScale: number;
  skirtTop: string;
  skirtBottom: string;
  skirtRiver: string;
  waterShallow: string;
  waterDeep: string;
  waterOpacityMin: number;
  waterOpacityMax: number;
  waterEmissive: number;
  pipeLow: string;
  pipeMid: string;
  pipeHigh: string;
  bloom: number;
}

export const DAY: Theme = {
  skyTop: '#f6f3ee',
  skyHorizon: '#dde9f2',
  fog: '#e9eef2',
  fogNear: 900,
  fogFar: 1800,
  hemiSky: '#ffffff',
  hemiGround: '#d8d2c4',
  hemiIntensity: 0.9,
  sunColor: '#fff2df',
  sunIntensity: 1.6,
  terrainOpacity: 1,
  treeScale: 1,
  skirtTop: '#b9a887',
  skirtBottom: '#cbbfa8',
  skirtRiver: '#7fb8cf',
  waterShallow: '#bfe3ec',
  waterDeep: '#2b7fb8',
  waterOpacityMin: 0.25,
  waterOpacityMax: 0.85,
  waterEmissive: 0,
  pipeLow: '#2ecc71',
  pipeMid: '#f1c40f',
  pipeHigh: '#e74c3c',
  bloom: 0,
};

export const XRAY: Theme = {
  skyTop: '#0a111c',
  skyHorizon: '#1b2a41',
  fog: '#0a111c',
  fogNear: 100000,
  fogFar: 200000,
  hemiSky: '#9fb4cc',
  hemiGround: '#0a111c',
  hemiIntensity: 0.6,
  sunColor: '#9fb4cc',
  sunIntensity: 0.3,
  terrainOpacity: 0.35,
  treeScale: 0,
  skirtTop: '#1c2c44',
  skirtBottom: '#1c2c44',
  skirtRiver: '#1c2c44',
  waterShallow: '#19c3ff',
  waterDeep: '#0d6fb5',
  waterOpacityMin: 0.55,
  waterOpacityMax: 0.55,
  waterEmissive: 1,
  pipeLow: '#39ffb0',
  pipeMid: '#ffd84d',
  pipeHigh: '#ff4d6d',
  bloom: 1,
};

export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const mix = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + [16, 8, 0].map((s) => mix(s).toString(16).padStart(2, '0')).join('');
}

/** t = 0 → DAY, t = 1 → XRAY; colours per channel, numbers linearly. */
export function blendTheme(t: number): Theme {
  if (!(t > 0)) return { ...DAY };
  if (t >= 1) return { ...XRAY };
  const out: Record<string, string | number> = {};
  for (const key of Object.keys(DAY) as Array<keyof Theme>) {
    const a = DAY[key];
    const b = XRAY[key];
    out[key] = typeof a === 'string' ? lerpHex(a, b as string, t) : a + ((b as number) - a) * t;
  }
  return out as unknown as Theme;
}
