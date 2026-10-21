import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeSampleFiles, SAMPLE_DIRS } from './samplePackage';

import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const files = makeSampleFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
for (const dir of SAMPLE_DIRS) {
  const out = resolve(root, dir);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(resolve(out, name), text);
  console.log(`wrote ${Object.keys(files).length} files to ${out}`);
}
