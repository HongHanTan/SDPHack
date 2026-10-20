import { describe, expect, it } from 'vitest';
import type { Frame, Metrics } from '@floodops/engine/sim/types';
import { MAX_CACHE, SimRunError, SimRunner, type WorkerLike } from '../../src/ui/runner';
import type { InterventionId } from '@floodops/engine/scenario/interventions';
import type { StormId } from '@floodops/engine/scenario/storms';
import type { RunRequest, WorkerMessage } from '@floodops/engine/worker/protocol';

const frame: Frame = { t: 30, depth: new Float32Array(1), nodeFill: new Float32Array(0), pipeLoad: new Float32Array(0) };
const metrics = { homesFlooded: 3 } as Metrics;

class FakeWorker implements WorkerLike {
  posted: RunRequest[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<WorkerMessage>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  constructor(private mode: 'ok' | 'simerror' | 'crash' | 'badmsg' = 'ok') {}
  postMessage(m: RunRequest) {
    this.posted.push(m);
    queueMicrotask(() => {
      const send = (data: WorkerMessage) => this.onmessage?.({ data } as MessageEvent<WorkerMessage>);
      if (this.mode === 'crash') return this.onerror?.({ message: 'boom' } as ErrorEvent);
      if (this.mode === 'badmsg') return this.onmessageerror?.({} as MessageEvent);
      if (this.mode === 'simerror') return send({ type: 'error', key: m.key, message: 'NaN', step: 42 });
      send({ type: 'frame', key: m.key, frame });
      send({ type: 'done', key: m.key, metrics });
    });
  }
  terminate() {
    this.terminated = true;
  }
}

describe('SimRunner', () => {
  it('runs once per scenario and replays from cache', async () => {
    const w = new FakeWorker();
    const runner = new SimRunner(() => w);
    const seen: number[] = [];
    const a = await runner.run(['desilt-d07'], 'synthetic_80mmh_60min', (f) => seen.push(f.t));
    const b = await runner.run(['desilt-d07'], 'synthetic_80mmh_60min', (f) => seen.push(f.t));
    expect(w.posted.length).toBe(1);
    expect(b).toBe(a);
    expect(seen).toEqual([30, 30]);
    expect(runner.isCached(['desilt-d07'], 'synthetic_80mmh_60min')).toBe(true);
  });

  it('serialises runs in request order', async () => {
    const w = new FakeWorker();
    const runner = new SimRunner(() => w);
    await Promise.all([runner.run([], 'synthetic_80mmh_60min'), runner.run(['upsize-p07'], 'synthetic_80mmh_60min')]);
    expect(w.posted.map((m) => m.interventions)).toEqual([[], ['upsize-p07']]);
  });

  it('rejects with the failing step on a simulation error', async () => {
    const runner = new SimRunner(() => new FakeWorker('simerror'));
    await expect(runner.run([], 'synthetic_120mmh_60min')).rejects.toMatchObject({ step: 42, message: 'NaN' });
  });

  it('replaces a crashed worker', async () => {
    const workers: FakeWorker[] = [];
    const runner = new SimRunner(() => {
      const w = new FakeWorker(workers.length === 0 ? 'crash' : 'ok');
      workers.push(w);
      return w;
    });
    await expect(runner.run([], 'synthetic_120mmh_60min')).rejects.toBeInstanceOf(SimRunError);
    expect(workers[0].terminated).toBe(true);
    await expect(runner.run([], 'synthetic_120mmh_60min')).resolves.toBeDefined();
  });

  it('replaces the worker on a message deserialisation error', async () => {
    const workers: FakeWorker[] = [];
    const runner = new SimRunner(() => {
      const w = new FakeWorker(workers.length === 0 ? 'badmsg' : 'ok');
      workers.push(w);
      return w;
    });
    await expect(runner.run([], 'synthetic_120mmh_60min')).rejects.toBeInstanceOf(SimRunError);
    expect(workers[0].terminated).toBe(true);
    await expect(runner.run([], 'synthetic_120mmh_60min')).resolves.toBeDefined();
  });

  it('evicts the least recently used result beyond MAX_CACHE', async () => {
    const runner = new SimRunner(() => new FakeWorker());
    const keys: Array<[InterventionId[], StormId]> = (['desilt-d07', 'upsize-p07', 'storage-tank', 'lake-overflow'] as InterventionId[])
      .flatMap((id) => (['synthetic_80mmh_60min', 'synthetic_120mmh_60min'] as StormId[]).map((s): [InterventionId[], StormId] => [[id], s]))
      .slice(0, 7);
    for (const [ids, s] of keys) await runner.run(ids, s);
    expect(keys.length).toBe(MAX_CACHE + 1);
    expect(runner.isCached(keys[0][0], keys[0][1])).toBe(false);
    expect(runner.isCached(keys[6][0], keys[6][1])).toBe(true);
  });
});
