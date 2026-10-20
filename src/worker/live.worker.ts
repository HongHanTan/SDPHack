import { SimError } from '../sim/types';
import type { LiveCommand, LiveMessage } from './liveProtocol';
import { advanceBy, LiveSession, MAX_ADVANCE_PER_TICK_S } from './liveSession';

const post = (m: LiveMessage, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage(m: LiveMessage, t: Transferable[]): void }).postMessage(m, transfer);
/** Each snapshot's depth array is freshly allocated, so its buffer can be handed over without a copy. */
const postFrame = (f: ReturnType<LiveSession['snapshot']>) =>
  post({ type: 'frame', session: sid, ...f }, [f.frame.depth.buffer]);
const TICK_MS = 50;

let session: LiveSession | null = null;
let current: Extract<LiveCommand, { type: 'start' }> | null = null;
let sid = 0;
let speed = 1;
let paused = false;
let endedSent = false;
let last = performance.now();

function fail(err: unknown): void {
  paused = true;
  session = null;
  post({ type: 'error', session: sid, message: err instanceof Error ? err.message : String(err), step: err instanceof SimError ? err.step : -1 });
}

function startSession(seekMinute: number): void {
  if (!current) return;
  session = new LiveSession(current.stormId, current.interventions, current.custom);
  endedSent = false;
  if (seekMinute > 0) session.advance(seekMinute * 60);
  last = performance.now();
  postFrame(session.snapshot());
}

setInterval(() => {
  const now = performance.now();
  const wall = (now - last) / 1000;
  last = now;
  if (!session || paused) return;
  if (session.ended) {
    if (!endedSent) {
      endedSent = true;
      post({ type: 'ended', session: sid });
    }
    return;
  }
  try {
    const f = session.advance(advanceBy(speed, wall, MAX_ADVANCE_PER_TICK_S));
    if (f) postFrame(f);
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
        sid = cmd.session;
        paused = false;
        startSession(0);
        break;
      case 'patch':
        if (session) {
          session.patch(cmd.interventions, cmd.custom);
          if (current) current = { ...current, interventions: cmd.interventions, custom: cmd.custom };
          post({ type: 'patched', session: sid, label: cmd.label, t: session.t });
          postFrame(session.snapshot());
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
        sid = cmd.session;
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
