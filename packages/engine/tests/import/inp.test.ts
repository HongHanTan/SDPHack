import { describe, expect, it } from 'vitest';
import { parseInp } from '../../src/import/inp';

const INP = `[TITLE]
; demo
[JUNCTIONS]
;;Name Elev MaxDepth
J1 10.0 2.0 0 0 0
J2 9.5  2.5 0 0 0   ; comment
[OUTFALLS]
O1 9.0 FIXED 9.2 NO
[CONDUITS]
P1 J1 J2 50 0.013 0 0 0 0
P2 J2 O1 40 0.013 0.1 0 0 0
[XSECTIONS]
P1 CIRCULAR 0.45 0 0 0 1
P2 RECT_CLOSED 0.6 0.9 0 0 1
[SUBCATCHMENTS]
S1 G1 J1 1.5 70 100 1 0
[COORDINATES]
J1 1000 2000
J2 1050 2000
O1 1090 2000
[POLYGONS]
S1 990 1990
S1 1010 1990
S1 1010 2010
[PUMPS]
PU1 J2 O1 * ON 0 0
`;

describe('parseInp', () => {
  const m = parseInp(INP);
  it('reads junctions, outfalls, conduits and cross-sections, ignoring comments', () => {
    expect(m.junctions).toEqual([
      { id: 'J1', invert: 10, maxDepth: 2, storage: false },
      { id: 'J2', invert: 9.5, maxDepth: 2.5, storage: false },
    ]);
    expect(m.outfalls).toEqual([{ id: 'O1', invert: 9, type: 'FIXED', stage: 9.2 }]);
    expect(m.conduits[1]).toEqual({ id: 'P2', from: 'J2', to: 'O1', length: 40, n: 0.013, inOffset: 0.1, outOffset: 0 });
    expect(m.xsections.get('P1')).toEqual({ shape: 'CIRCULAR', geom1: 0.45 });
    expect(m.xsections.get('P2')).toEqual({ shape: 'RECT_CLOSED', geom1: 0.6 });
  });
  it('reads subcatchments, coordinates, polygons and the list of sections', () => {
    expect(m.subcatchments).toEqual([{ id: 'S1', outlet: 'J1', areaHa: 1.5, imperviousPercent: 70 }]);
    expect(m.coordinates.get('J2')).toEqual([1050, 2000]);
    expect(m.polygons.get('S1')).toHaveLength(3);
    expect(m.sections).toContain('PUMPS');
  });
  it('treats STORAGE as a junction flagged storage', () => {
    const s = parseInp('[STORAGE]\nT1 8.0 3.0 0 FUNCTIONAL 1000 0 0\n');
    expect(s.junctions).toEqual([{ id: 'T1', invert: 8, maxDepth: 3, storage: true }]);
  });
});
