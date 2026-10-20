import { scenarioKey, type CustomPipe } from '@floodops/engine/scenario/index';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import type { StormId } from '@floodops/engine/scenario/storms';
import type { Frame, Metrics } from '@floodops/engine/sim/types';
import type { RunRequest, WorkerMessage } from '@floodops/engine/worker/protocol';

export const MAX_CACHE = 6;

export interface RunResult {
  frames: Frame[];
  metrics: Metrics;
}

export interface WorkerLike {
  postMessage(m: RunRequest): void;
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
  onmessageerror?: ((e: MessageEvent) => void) | null;
  terminate(): void;
}

export class SimRunError extends Error {
  constructor(
    message: string,
    public readonly step: number,
  ) {
    super(message);
    this.name = 'SimRunError';
  }
}

/** Runs one simulation at a time on a worker; caches results (LRU) by scenario key. */
export class SimRunner {
  private cache = new Map<string, RunResult>();
  private queue: Promise<unknown> = Promise.resolve();
  private worker: WorkerLike;

  constructor(private readonly createWorker: () => WorkerLike) {
    this.worker = createWorker();
  }

  run(ids: InterventionId[], stormId: StormId, onFrame?: (f: Frame) => void, custom: CustomPipe[] = []): Promise<RunResult> {
    const job = this.queue.then(() => this.execute(ids, stormId, onFrame, custom));
    this.queue = job.catch(() => undefined);
    return job;
  }

  isCached(ids: InterventionId[], stormId: StormId, custom: CustomPipe[] = []): boolean {
    return this.cache.has(scenarioKey(ids, stormId, custom));
  }

  private execute(ids: InterventionId[], stormId: StormId, onFrame: ((f: Frame) => void) | undefined, custom: CustomPipe[]): Promise<RunResult> {
    const key = scenarioKey(ids, stormId, custom);
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      hit.frames.forEach((f) => onFrame?.(f));
      return Promise.resolve(hit);
    }
    return new Promise<RunResult>((resolve, reject) => {
      const frames: Frame[] = [];
      this.worker.onmessage = (e) => {
        const m = e.data;
        if (m.key !== key) return;
        if (m.type === 'frame') {
          frames.push(m.frame);
          onFrame?.(m.frame);
        } else if (m.type === 'done') {
          const result = { frames, metrics: m.metrics };
          this.remember(key, result);
          resolve(result);
        } else {
          reject(new SimRunError(m.message, m.step));
        }
      };
      const replaceWorker = (message: string) => {
        this.worker.terminate();
        this.worker = this.createWorker();
        reject(new SimRunError(message, -1));
      };
      this.worker.onerror = (e) => replaceWorker(e.message || 'Simulation worker crashed');
      this.worker.onmessageerror = () => replaceWorker('Simulation worker sent an unreadable message');
      this.worker.postMessage({ type: 'run', key, interventions: [...ids].sort(), stormId, custom });
    });
  }

  private remember(key: string, result: RunResult): void {
    this.cache.set(key, result);
    while (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value!);
  }
}
