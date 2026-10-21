import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMO_DIRS, makeDemoFiles, makeSampleFiles, SAMPLE_DIRS } from '../scripts/samplePackage';

const root = resolve(__dirname, '../../..');

describe('sample site package', () => {
  it('matches the generator (run `npm -w @floodops/engine run sample` after changing the built-in township)', () => {
    const files = makeSampleFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
    expect(SAMPLE_DIRS).toEqual(['data/samples/taman_kyra_site', 'apps/web/public/site-examples/taman-kyra-swmm']);
    for (const dir of SAMPLE_DIRS) {
      for (const [name, text] of Object.entries(files)) {
        expect(readFileSync(resolve(root, dir, name), 'utf8').replace(/\r\n/g, '\n'), `${dir}/${name}`).toBe(text.replace(/\r\n/g, '\n'));
      }
    }
  });

  it('the 3-zone demo package matches the generator', () => {
    const files = makeDemoFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
    expect(DEMO_DIRS).toEqual(['data/samples/taman_kyra_demo', 'apps/web/public/site-examples/taman-kyra-demo']);
    expect(Object.keys(files).sort()).toEqual(['README.md', 'taman_kyra_demo.inp', 'taman_kyra_demo_ground.asc', 'taman_kyra_demo_layout.geojson']);
    for (const dir of DEMO_DIRS) {
      for (const [name, text] of Object.entries(files)) {
        expect(readFileSync(resolve(root, dir, name), 'utf8').replace(/\r\n/g, '\n'), `${dir}/${name}`).toBe(text.replace(/\r\n/g, '\n'));
      }
    }
  });

  it('the demo keeps the sample ground and scene (only the network, inlets and hotspot differ)', () => {
    const baseline = readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8');
    const sample = makeSampleFiles(baseline);
    const demo = makeDemoFiles(baseline);
    expect(demo['taman_kyra_demo_ground.asc']).toBe(sample['taman_kyra_ground.asc']);
    const scene = (text: string) => (JSON.parse(text).features as Array<{ properties: { kind: string } }>).filter((f) => !['inlet', 'hotspot'].includes(f.properties.kind));
    expect(scene(demo['taman_kyra_demo_layout.geojson'])).toEqual(scene(sample['taman_kyra_layout.geojson']));
    expect(demo['taman_kyra_demo.inp']).toMatch(/SYNTHETIC/);
    expect(demo['README.md']).toMatch(/synthetic/i);
  });
});
