import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeSampleFiles } from '../scripts/samplePackage';

const root = resolve(__dirname, '../../..');

describe('sample site package', () => {
  it('matches the generator (run `npm -w @floodops/engine run sample` after changing the built-in township)', () => {
    const files = makeSampleFiles(readFileSync(resolve(root, 'models/illustrative_taman_kyra/baseline.inp'), 'utf8'));
    for (const [name, text] of Object.entries(files)) {
      expect(readFileSync(resolve(root, 'data/samples/taman_kyra_site', name), 'utf8').replace(/\r\n/g, '\n')).toBe(text.replace(/\r\n/g, '\n'));
    }
  });
});
