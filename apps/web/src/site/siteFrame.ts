import { medianJunctionGround, type SiteSpec } from '@floodops/engine/scenario/site';

export interface SiteFrame {
  cx: number;
  cz: number;
  w: number;
  h: number;
  groundY: number;
}

/** Site extent in scene coordinates (x east, z = −north) and a representative ground height for cameras. */
export function siteFrame(site: SiteSpec): SiteFrame {
  const w = site.gridSpec.nx * site.gridSpec.dx;
  const h = site.gridSpec.ny * site.gridSpec.dx;
  return { cx: site.datum.x0 + w / 2, cz: -(site.datum.y0 + h / 2), w, h, groundY: medianJunctionGround(site.assets) };
}
