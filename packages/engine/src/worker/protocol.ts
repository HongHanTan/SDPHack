import type { CustomPipe } from '../scenario/index';
import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';
import type { Frame, Metrics } from '../sim/types';

export interface RunRequest {
  type: 'run';
  key: string;
  interventions: InterventionId[];
  stormId: StormId;
  custom: CustomPipe[];
}

export type WorkerMessage =
  | { type: 'frame'; key: string; frame: Frame }
  | { type: 'done'; key: string; metrics: Metrics }
  | { type: 'error'; key: string; message: string; step: number };
