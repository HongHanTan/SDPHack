import type { CustomPipe } from '../scenario/index';
import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';
import type { Frame } from '../sim/types';
import type { LiveReadouts } from './liveSession';

export type LiveCommand =
  | { type: 'start'; stormId: StormId; interventions: InterventionId[]; custom: CustomPipe[] }
  | { type: 'patch'; interventions: InterventionId[]; custom: CustomPipe[]; label: string }
  | { type: 'setSpeed'; speed: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'seek'; minute: number }
  | { type: 'stop' };

export type LiveMessage =
  | { type: 'frame'; t: number; frame: Frame; rainMmHr: number; readouts: LiveReadouts }
  | { type: 'patched'; label: string; t: number }
  | { type: 'ended' }
  | { type: 'error'; message: string; step: number };
