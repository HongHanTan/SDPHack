import { buildScenario } from '../scenario/index';
import { runSimulation } from '../sim/engine';
import { SimError } from '../sim/types';
import type { RunRequest, WorkerMessage } from './protocol';

const post = (m: WorkerMessage) => (self as unknown as { postMessage(m: WorkerMessage): void }).postMessage(m);

addEventListener('message', (e: MessageEvent<RunRequest>) => {
  const { key, interventions, stormId, custom } = e.data;
  try {
    const sc = buildScenario(interventions, stormId, custom);
    const { metrics } = runSimulation(sc, (frame) => post({ type: 'frame', key, frame }));
    post({ type: 'done', key, metrics });
  } catch (err) {
    post({
      type: 'error',
      key,
      message: err instanceof Error ? err.message : String(err),
      step: err instanceof SimError ? err.step : -1,
    });
  }
});
