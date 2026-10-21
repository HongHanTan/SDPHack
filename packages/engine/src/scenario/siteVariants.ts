import type { SiteSpec } from './site';

/** A copy of the site with one pipe's diameter changed; the cache key records the change. */
export function withPipeDiameter(site: SiteSpec, pipeId: string, diameterM: number): SiteSpec {
  if (!(Number.isFinite(diameterM) && diameterM > 0)) throw new Error(`Invalid pipe diameter ${diameterM}`);
  const copy = structuredClone(site);
  const pipe = copy.assets.conduits.find((c) => c.conduit_id === pipeId);
  if (!pipe) throw new Error(`Unknown pipe ${pipeId}`);
  pipe.diameter_m = diameterM;
  copy.key = `${site.key}|${pipeId}@${diameterM}`;
  return copy;
}
