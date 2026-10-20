import { describe, expect, it } from 'vitest';
import { parseAsciiGrid } from '../../src/import/asciiGrid';

describe('parseAsciiGrid', () => {
  it('reads the header and stores rows south-first', () => {
    const g = parseAsciiGrid('ncols 2\nnrows 3\nxllcorner 100\nyllcorner 200\ncellsize 2\nNODATA_value -9999\n1 2\n3 4\n5 -9999\n');
    expect(g).toMatchObject({ ncols: 2, nrows: 3, xll: 100, yll: 200, cellsize: 2, nodata: -9999 });
    expect(Array.from(g.values)).toEqual([5, -9999, 3, 4, 1, 2]);
  });
  it('accepts xllcenter/yllcenter', () => {
    const g = parseAsciiGrid('ncols 1\nnrows 1\nxllcenter 101\nyllcenter 201\ncellsize 2\n7\n');
    expect(g.xll).toBe(100);
    expect(g.yll).toBe(200);
    expect(g.nodata).toBeNull();
  });
  it('rejects a short body', () => {
    expect(() => parseAsciiGrid('ncols 2\nnrows 2\nxllcorner 0\nyllcorner 0\ncellsize 1\n1 2 3\n')).toThrow(/expected 4 values/);
  });
});
