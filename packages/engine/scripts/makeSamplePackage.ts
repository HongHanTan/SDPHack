import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeSampleFiles } from './samplePackage';

import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const out = resolve(root, 'data/samples/taman_kyra_site');
mkdirSync(out, { recursive: true });
const files = makeSampleFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
for (const [name, text] of Object.entries(files)) writeFileSync(resolve(out, name), text);
console.log(`wrote ${Object.keys(files).length} files to ${out}`);
