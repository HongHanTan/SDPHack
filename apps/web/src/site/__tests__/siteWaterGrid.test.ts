import { describe, expect, it } from 'vitest';
import { TAMAN_KYRA, type SiteSpec } from '@floodops/engine/scenario/site';
import { LandUse } from '@floodops/engine/sim/types';
import { depthAt } from '../local/runs';
import { cellFilePoint, siteWaterBase } from '../siteWaterGrid';

const site: SiteSpec = { ...TAMAN_KYRA, datum: { x0: 100, y0: 200 }, gridSpec: { nx: 3, ny: 2, dx: 2 }, shift: { dx: 1000, dy: 5000, dz: 10 } };
const b = { x: 1100, y: 5200, z: 5 };
/** Tay's scene mapping (SiteScene `point`). */
const point = (x: number, y: number, z: number): [number, number, number] => [x - b.x, z - b.z, -(y - b.y)];

describe('street water on the site map', () => {
  it('maps a cell centre team → file → scene', () => {
    // Cell (1, 1): local (3, 3) → team (103, 203) → file (1103, 5203).
    expect(cellFilePoint(site, 1, 1)).toEqual({ x: 1103, y: 5203 });
    const z = Float32Array.from([1, 2, 3, 4, 5, 6]);
    const land = Uint8Array.from([0, LandUse.POND, 0, LandUse.RIVER, 0, 0]);
    const base = siteWaterBase(site, { z, land }, point);
    const c = 1 * 3 + 1;
    // file z = team z + dz = 5 + 10; scene y = 15 − b.z.
    expect([base.sceneX[c], base.groundY[c], base.sceneZ[c]]).toEqual(point(1103, 5203, 15));
    expect([base.sceneX[c], base.groundY[c], base.sceneZ[c]]).toEqual([3, 10, -3]);
    expect([...base.mask]).toEqual([1, 0, 1, 0, 1, 1]);
  });

  it('picks the stored grid with the greatest time at or before the frame', () => {
    const cells = 2;
    const data = Float32Array.from([0, 0, 1, 1, 2, 2]).buffer;
    const depth = { times: [0, 60, 120], cells, data };
    expect(depthAt(depth, 0)?.[0]).toBe(0);
    expect(depthAt(depth, 30)?.[0]).toBe(0);
    expect(depthAt(depth, 60)?.[0]).toBe(1);
    expect(depthAt(depth, 119)?.[1]).toBe(1);
    expect(depthAt(depth, 600)?.[0]).toBe(2);
    expect(depthAt({ times: [60], cells, data }, 30)).toBeNull();
    expect(depthAt(null, 30)).toBeNull();
  });
});
