import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEMO_DIRS, makeDemoFiles, makeSampleFiles, SAMPLE_DIRS } from './samplePackage';

import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const baseline = readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8');
const packages: Array<[readonly string[], Record<string, string>]> = [
  [SAMPLE_DIRS, makeSampleFiles(baseline)],
  [DEMO_DIRS, makeDemoFiles(baseline)],
];
for (const [dirs, files] of packages) {
  for (const dir of dirs) {
    const out = resolve(root, dir);
    mkdirSync(out, { recursive: true });
    for (const [name, text] of Object.entries(files)) writeFileSync(resolve(out, name), text);
    console.log(`wrote ${Object.keys(files).length} files to ${out}`);
  }
}
