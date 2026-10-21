import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { stormFromInp } from '../../src/import/stormFromInp';
import { MMHR } from '../../src/scenario/config';

const inp = readFileSync(resolve(__dirname, '../../../../data/samples/taman_kyra_site/taman_kyra.inp'), 'utf8');

describe('stormFromInp', () => {
  it('reads the sample rainfall: 12 blocks at 80 mm/h then dry', () => {
    const { storm, errors } = stormFromInp(inp);
    expect(errors).toEqual([]);
    expect(storm!.intensity).toHaveLength(25);
    expect(storm!.intensity.slice(0, 12).every((v) => Math.abs(v - 80 * MMHR) < 1e-12)).toBe(true);
    expect(storm!.intensity.slice(12).every((v) => v === 0)).toBe(true);
    expect(storm).toMatchObject({ id: 'uploaded_rainfall', label: 'Uploaded rainfall', returnPeriod: 0, blockS: 300, provisional: false, peakMinute: 0 });
  });
  it('rejects non-SI flow units', () => {
    const r = stormFromInp(inp.replace(/FLOW_UNITS\s+\S+/, 'FLOW_UNITS CFS'));
    expect(r.storm).toBeNull();
    expect(r.errors.join(' ')).toMatch(/CFS/);
  });
  it('rejects a 10-minute gage', () => {
    const gageLine = inp.split('\n').find((l) => /INTENSITY/i.test(l) && /TIMESERIES/i.test(l))!;
    const r = stormFromInp(inp.replace(gageLine, gageLine.replace(/\b0?:?0?5(:00)?\b/, '0:10')));
    expect(r.storm).toBeNull();
    expect(r.errors.join(' ')).toMatch(/records every 10 minutes/);
  });
  const D = '01/01/2026';
  const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`;
  const row = (min: number, v: number) => `RAIN-TS ${D} ${clock(min)} ${v}`;
  const withTs = (lines: string[]) =>
    inp
      .split('\n')
      .filter((l) => !l.startsWith('RAIN-TS '))
      .join('\n')
      .replace('[TIMESERIES]\n', '[TIMESERIES]\n' + lines.join('\n') + '\n');
  it('rejects a gapped series', () => {
    const r = stormFromInp(withTs([row(0, 80), row(5, 80), row(15, 80)]));
    expect(r.storm).toBeNull();
    expect(r.errors.join(' ')).toMatch(/consecutive 5-minute steps/);
  });
  it('rejects an uneven step', () => {
    const r = stormFromInp(withTs([row(0, 80), row(5, 80), row(12, 80)]));
    expect(r.storm).toBeNull();
    expect(r.errors.join(' ')).toMatch(/consecutive 5-minute steps/);
  });
  it('rejects intensity above 300 mm/h', () => {
    const r = stormFromInp(withTs([row(0, 301)]));
    expect(r.errors.join(' ')).toMatch(/outside 0.+300/);
  });
  it('rejects more than 72 intervals', () => {
    const r = stormFromInp(withTs(Array.from({ length: 73 }, (_, i) => row(i * 5, 10))));
    expect(r.errors.join(' ')).toMatch(/at most 72/);
  });
  it('returns no storm and no error when there is no rainfall', () => {
    expect(stormFromInp('[TITLE]\nx\n')).toEqual({ storm: null, errors: [] });
  });
});
