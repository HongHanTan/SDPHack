import { writeFileSync } from 'node:fs';
import { computeEffects } from './computeEffects';

const effects = computeEffects((line) => console.log(line));
writeFileSync(new URL('../src/scenario/effects.json', import.meta.url), JSON.stringify(effects, null, 2) + '\n');
console.log('Wrote src/scenario/effects.json');
