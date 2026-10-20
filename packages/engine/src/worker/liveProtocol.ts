import type { CustomPipe, ScenarioOptions } from '../scenario/index';
import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';
import type { Frame } from '../sim/types';
import type { LiveReadouts } from './liveSession';

/** `session` increments on every start/seek; the worker echoes it so the UI can drop stale messages. */
export type LiveCommand =
  | { type: 'start'; session: number; stormId: StormId; interventions: InterventionId[]; custom: CustomPipe[]; opts?: ScenarioOptions }
  | { type: 'patch'; interventions: InterventionId[]; custom: CustomPipe[]; label: string }
  | { type: 'setSpeed'; speed: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'seek'; session: number; minute: number }
  | { type: 'stop' };

export type LiveMessage =
  | { type: 'frame'; session: number; t: number; frame: Frame; rainMmHr: number; readouts: LiveReadouts }
  | { type: 'patched'; session: number; label: string; t: number }
  | { type: 'ended'; session: number }
  | { type: 'error'; session: number; message: string; step: number };
