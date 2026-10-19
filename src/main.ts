import { createScene } from './render/scene';
import { baseTownship } from './scenario/index';
import { SimRunner, type WorkerLike } from './ui/runner';

const view = createScene(document.getElementById('viewport')!);
view.setTownship(baseTownship());
const runner = new SimRunner(
  () => new Worker(new URL('./worker/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
);
const frames: Parameters<typeof view.showFrame>[0][] = [];
let i = 0;
setInterval(() => {
  if (i < frames.length) view.showFrame(frames[i++]);
}, 100);
runner.run([], '100yr', (f) => frames.push(f)).then((r) => console.log('baseline metrics', r.metrics));
