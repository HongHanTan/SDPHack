export type Tone = 'better' | 'worse' | 'same';

export function describeChange(base: number, cur: number, digits: number, lowerIsBetter = true): { text: string; tone: Tone } {
  const d = cur - base;
  if (Math.abs(d) < 10 ** -digits / 2) return { text: 'no change', tone: 'same' };
  const sign = d > 0 ? '+' : '';
  const pct = base !== 0 ? ` (${sign}${Math.round((d / base) * 100)}%)` : '';
  const improved = lowerIsBetter ? d < 0 : d > 0;
  return { text: `${sign}${d.toFixed(digits)}${pct}`, tone: improved ? 'better' : 'worse' };
}

export function formatRM(n: number): string {
  return n === 0 ? 'RM 0' : `RM ${(n / 1e6).toFixed(2)}M`;
}
