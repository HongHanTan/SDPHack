import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TAMAN_KYRA, type SiteSpec } from '@floodops/engine/scenario/site';
import type { SimulationRun } from '../../types';
import type { SiteResult } from '../types';
import { runSiteView } from '../runSiteView';
import { SiteSideBySide } from '../SiteSideBySide';

const captured = vi.hoisted(() => ({ scenes: [] as { site: SiteSpec; addedConduitIds: string[] }[] }));
vi.mock('../SiteCityScene', () => ({
  SiteCityScene: (props: { site: SiteSpec; addedConduitIds: string[] }) => {
    captured.scenes.push(props);
    return createElement('div', { 'data-pipe-count': props.site.assets.conduits.length });
  },
}));

const reliefId = 'RELIEF-NODE-J04-NODE-J08';
const run = (intervention: unknown) => ({ input_snapshot: { intervention } } as unknown as SimulationRun);
// This is the existing retained-run format: no new metadata or rerun is required.
const relief = run({ kind: 'relief', asset_id: 'NODE-J04', label: 'Relief pipe NODE-J04 → NODE-J08', changes: [{ asset_id: reliefId, before: null, after: 0.45 }] });
const result = (r: SimulationRun) => ({ run: r, frames: [], metrics: {} } as unknown as SiteResult);

beforeEach(() => { captured.scenes.length = 0; });

describe('run pipe geometry', () => {
  it('draws the added J04 → J08 pipe only in the after pane, including retained runs', () => {
    const original = structuredClone(TAMAN_KYRA);
    const props = { baseline: result(run(null)), candidate: result(relief), timeS: 0, site: TAMAN_KYRA, cameraLink: { pose: { position: [62, 38, 46] as [number, number, number], target: [40, 11, 4] as [number, number, number] }, applying: false, listeners: new Set<(pose: import('../../story/LinkedCamera').CameraPose) => void>() }, phase: 4, xray: true, selected: null, onSelect: () => {}, storm: null, playing: false };
    const html = renderToStaticMarkup(createElement(SiteSideBySide, props));
    const [before, after] = captured.scenes;
    expect(before.site).toBe(TAMAN_KYRA);
    expect(before.site.assets.conduits.some((p) => p.conduit_id === reliefId)).toBe(false);
    expect(before.addedConduitIds).toEqual([]);
    expect(after.site.assets.conduits).toHaveLength(before.site.assets.conduits.length + 1);
    expect(after.site.assets.conduits.find((p) => p.conduit_id === reliefId)).toMatchObject({ from_node_id: 'NODE-J04', to_node_id: 'NODE-J08', diameter_m: 0.45 });
    expect(after.addedConduitIds).toEqual([reliefId]);
    expect(html).toContain('New relief pipe');
    expect(TAMAN_KYRA).toEqual(original);
    // Playback renders derive geometry afresh from the baseline, never adding the same connection twice.
    renderToStaticMarkup(createElement(SiteSideBySide, props));
    expect(captured.scenes[3].site.assets.conduits).toHaveLength(after.site.assets.conduits.length);
  });

  it('also displays the saved upsize diameter without changing the baseline', () => {
    const before = TAMAN_KYRA.assets.conduits.find((p) => p.conduit_id === 'PIPE-P07')!.diameter_m;
    const view = runSiteView(TAMAN_KYRA, run({ changes: [{ asset_id: 'PIPE-P07', before, after: 0.9 }] }));
    expect(view.site!.assets.conduits.find((p) => p.conduit_id === 'PIPE-P07')!.diameter_m).toBe(0.9);
    expect(TAMAN_KYRA.assets.conduits.find((p) => p.conduit_id === 'PIPE-P07')!.diameter_m).toBe(before);
    expect(view.addedConduitIds).toEqual([]);
  });

  it('reports missing relief endpoints instead of showing the original layout as the after network', () => {
    const view = runSiteView(TAMAN_KYRA, run({ kind: 'relief', asset_id: 'NODE-J04', changes: [{ asset_id: 'RELIEF-NODE-J04-missing', after: 0.45 }] }));
    expect(view.site).toBeNull();
    expect(view.error).toContain('endpoints');
  });
});
