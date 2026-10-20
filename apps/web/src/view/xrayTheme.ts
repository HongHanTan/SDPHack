// Ported from apps/legacy/src/render/theme.ts (Hong Han): the day ↔ x-ray look, re-based on the team scene's day values.

/** Every colour/number that differs between the day look and the x-ray look. Colours are lowercase #rrggbb. */
export interface Theme {
  background: string;
  fog: string;
  fogNear: number;
  fogFar: number;
  ambient: number;
  ambientColor: string;
  key: number;
  keyColor: string;
  fill: number;
  waterShallow: string;
  waterDeep: string;
  waterOpMin: number;
  waterOpMax: number;
  waterEmissive: number;
  pipeLow: string;
  pipeMid: string;
  pipeHigh: string;
}

/** The team scene as TEH JIA JIE built it (SceneViewer lights/fog, EngineWater colours, ConduitMesh status colours). */
export const DAY: Theme = {
  background: '#f1f5f9',
  fog: '#f1f5f9',
  fogNear: 200,
  fogFar: 480,
  ambient: 1.3,
  ambientColor: '#ffffff',
  key: 2.4,
  keyColor: '#ffffff',
  fill: 0.8,
  waterShallow: '#bfe3ec',
  waterDeep: '#2b7fb8',
  waterOpMin: 0.25,
  waterOpMax: 0.85,
  waterEmissive: 0,
  pipeLow: '#0284c7',
  pipeMid: '#f59e0b',
  pipeHigh: '#ef4444',
};

export const XRAY: Theme = {
  background: '#0a111c',
  fog: '#0a111c',
  fogNear: 100000,
  fogFar: 200000,
  ambient: 0.6,
  ambientColor: '#9fb4cc',
  key: 0.3,
  keyColor: '#9fb4cc',
  fill: 0.3,
  waterShallow: '#19c3ff',
  waterDeep: '#0d6fb5',
  waterOpMin: 0.55,
  waterOpMax: 0.55,
  waterEmissive: 1,
  pipeLow: '#39ffb0',
  pipeMid: '#ffd84d',
  pipeHigh: '#ff4d6d',
};

export const XRAY_FADE_S = 0.6;

export function lerpHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const mix = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return '#' + [16, 8, 0].map((s) => mix(s).toString(16).padStart(2, '0')).join('');
}

/** t = 0 → DAY, t = 1 → XRAY; colours per channel, numbers linearly. */
export function blendThemeInto(t: number, out: Theme): Theme {
  const o = out as unknown as Record<string, string | number>;
  const k = !(t > 0) ? 0 : t >= 1 ? 1 : t;
  for (const key of Object.keys(DAY) as Array<keyof Theme>) {
    const a = DAY[key];
    const b = XRAY[key];
    o[key] = k === 0 ? a : k === 1 ? b : typeof a === 'string' ? lerpHex(a, b as string, k) : a + ((b as number) - a) * k;
  }
  return out;
}

export function blendTheme(t: number): Theme {
  return blendThemeInto(t, { ...DAY });
}

/** Moves the x-ray blend toward `target` (0 or 1) by dtS / XRAY_FADE_S, clamped. */
export function stepXray(t: number, target: number, dtS: number): number {
  if (t === target) return t;
  const d = Math.max(0, dtS) / XRAY_FADE_S;
  return target > t ? Math.min(target, t + d) : Math.max(target, t - d);
}
