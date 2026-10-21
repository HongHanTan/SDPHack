import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSiteFromFiles } from '../src/import/buildSite';
import { stormFromInp } from '../src/import/stormFromInp';
import { applyFix, type FixAction } from '../src/scenario/fixActions';
import { buildScenario } from '../src/scenario/index';
import { runSimulation } from '../src/sim/engine';

const dir = resolve(__dirname, '../../../data/samples/taman_kyra_site');
const read = (name: string) => ({ name, text: readFileSync(resolve(dir, name), 'utf8') });

describe('fix actions simulate on the sample package', () => {
  const { site } = buildSiteFromFiles({ inp: read('taman_kyra.inp'), geojson: read('taman_kyra_layout.geojson'), asc: read('taman_kyra_ground.asc') });
  const { storm } = stormFromInp(read('taman_kyra.inp').text);
  const run = (s: typeof site) => runSimulation(buildScenario([], 'synthetic_80mmh_60min', [], { site: s!, storm: storm!, blockage: { 'INLET-D07': 0.4 } })).metrics;
  const base = run(site);
  const j07 = site!.assets.nodes.find((n) => n.node_id === 'NODE-J07')!;
  const down = site!.assets.nodes.find((n) => n.invert_elevation_m < j07.invert_elevation_m - 0.1 && !site!.assets.conduits.some((c) => c.from_node_id === j07.node_id && c.to_node_id === n.node_id))!;
  const fixes: FixAction[] = [
    { kind: 'upsize', pipeId: 'PIPE-P07', diameterM: 0.75 },
    { kind: 'relief', fromNode: j07.node_id, toNode: down.node_id, diameterM: 0.6 },
    { kind: 'storage', nodeId: 'NODE-J05', volumeM3: 800 },
    { kind: 'inlet', nodeId: 'NODE-J07', grates: 1 },
  ];
  const results: Record<string, number> = { baseline: base.peakSagDepth };
  it.each(fixes)('runs %j', async (fix) => {
    const m = run(applyFix(site!, fix));
    results[fix.kind] = m.peakSagDepth;
    console.log('J07 sag peak', fix.kind, results[fix.kind], 'baseline', results.baseline);
    if (fix.kind === 'upsize') expect(m.peakSagDepth).toBeLessThan(base.peakSagDepth);
    else expect(Number.isFinite(m.peakSagDepth)).toBe(true);
  }, 300_000);
});
