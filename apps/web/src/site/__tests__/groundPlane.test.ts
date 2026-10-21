import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { TAMAN_KYRA, type SiteSpec } from '@floodops/engine/scenario/site';
import { groundPlane, vertexTeam } from '../groundPlane';
import { siteFrame } from '../siteFrame';

describe('groundPlane', () => {
  it('lies on the site, not at the scene origin', () => {
    const site: SiteSpec = { ...TAMAN_KYRA, datum: { x0: 100, y0: -200 }, gridSpec: { nx: 10, ny: 6, dx: 2 } };
    const f = siteFrame(site);
    const geom = groundPlane(f, site.gridSpec.nx, site.gridSpec.ny);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    // First vertex: the site's west/north corner.
    const first = vertexTeam(pos, 0);
    expect(first.tx).toBeCloseTo(site.datum.x0, 9);
    expect(first.ty).toBeCloseTo(site.datum.y0 + f.h, 9);
    // Last vertex: the east/south corner.
    const last = vertexTeam(pos, pos.count - 1);
    expect(last.tx).toBeCloseTo(site.datum.x0 + f.w, 9);
    expect(last.ty).toBeCloseTo(site.datum.y0, 9);
    geom.computeBoundingBox();
    expect((geom.boundingBox!.min.x + geom.boundingBox!.max.x) / 2).toBeCloseTo(f.cx, 9);
    expect((geom.boundingBox!.min.z + geom.boundingBox!.max.z) / 2).toBeCloseTo(f.cz, 9);
  });
});
