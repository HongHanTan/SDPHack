import { SimError } from '../sim/types';
import type { LiveCommand, LiveMessage } from './liveProtocol';
import { advanceBy, LiveSession, MAX_ADVANCE_PER_TICK_S } from './liveSession';

const post = (m: LiveMessage) => (self as unknown as { postMessage(m: LiveMessage): void }).postMessage(m);
const TICK_MS = 50;

let session: LiveSession | null = null;
let current: Extract<LiveCommand, { type: 'start' }> | null = null;
let speed = 1;
let paused = false;
let endedSent = false;
let last = performance.now();

function fail(err: unknown): void {
  paused = true;
  post({ type: 'error', message: err instanceof Error ? err.message : String(err), step: err instanceof SimError ? err.step : -1 });
}

function startSession(seekMinute: number): void {
  if (!current) return;
  session = new LiveSession(current.stormId, current.interventions, current.custom);
  endedSent = false;
  if (seekMinute > 0) session.advance(seekMinute * 60);
  last = performance.now();
  post({ type: 'frame', ...session.snapshot() });
}

setInterval(() => {
  const now = performance.now();
  const wall = (now - last) / 1000;
  last = now;
  if (!session || paused) return;
  if (session.ended) {
    if (!endedSent) {
      endedSent = true;
      post({ type: 'ended' });
    }
    return;
  }
  try {
    const f = session.advance(advanceBy(speed, wall, MAX_ADVANCE_PER_TICK_S));
    if (f) post({ type: 'frame', ...f });
  } catch (err) {
    fail(err);
  }
}, TICK_MS);

addEventListener('message', (e: MessageEvent<LiveCommand>) => {
  const cmd = e.data;
  try {
    switch (cmd.type) {
      case 'start':
        current = cmd;
        paused = false;
        startSession(0);
        break;
      case 'patch':
        if (current) current = { ...current, interventions: cmd.interventions, custom: cmd.custom };
        if (session) {
          session.patch(cmd.interventions, cmd.custom);
          post({ type: 'patched', label: cmd.label, t: session.t });
          post({ type: 'frame', ...session.snapshot() });
        }
        break;
      case 'setSpeed':
        speed = cmd.speed;
        break;
      case 'pause':
        paused = true;
        break;
      case 'resume':
        paused = false;
        last = performance.now();
        break;
      case 'seek':
        startSession(cmd.minute);
        break;
      case 'stop':
        session = null;
        break;
    }
  } catch (err) {
    fail(err);
  }
});
