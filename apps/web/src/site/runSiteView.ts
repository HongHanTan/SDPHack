import { applyFix } from '@floodops/engine/scenario/fixActions';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import type { SimulationRun } from '../types';
import { runChange } from './compare';

export interface RunSiteView {
  site: SiteSpec | null;
  addedConduitIds: string[];
  error?: string;
}

/** Rebuild displayed pipe geometry from the saved run, including runs saved before this view existed. */
export function runSiteView(site: SiteSpec | null, run?: SimulationRun): RunSiteView {
  const unchanged = { site, addedConduitIds: [] };
  if (!site) return unchanged;
  const intervention = (run?.input_snapshot as { intervention?: { kind?: string; asset_id?: string } } | undefined)?.intervention;
  if (!intervention) return unchanged;
  try {
    const change = runChange(run);
    if (intervention.kind === 'relief') {
      if (!change) throw new Error('The relief pipe has no saved geometry.');
      // Node IDs can contain hyphens. Match the recorded ID against actual nodes rather than splitting it or its label.
      const from = site.assets.nodes.find((n) => n.node_id === intervention.asset_id);
      const targets = from ? site.assets.nodes.filter((n) => change.asset_id === `RELIEF-${from.node_id}-${n.node_id}`) : [];
      if (!from || targets.length !== 1) throw new Error('The saved relief pipe endpoints do not match this site.');
      return {
        site: applyFix(site, { kind: 'relief', fromNode: from.node_id, toNode: targets[0].node_id, diameterM: change.after }),
        addedConduitIds: [change.asset_id],
      };
    }
    if (intervention.kind === 'upsize' || intervention.kind === undefined) {
      if (!change) throw new Error('The pipe option has no saved diameter.');
      return { site: applyFix(site, { kind: 'upsize', pipeId: change.asset_id, diameterM: change.after }), addedConduitIds: [] };
    }
    return unchanged;
  } catch (e) {
    return { site: null, addedConduitIds: [], error: `Cannot draw this run's pipe layout: ${e instanceof Error ? e.message : String(e)}` };
  }
}
