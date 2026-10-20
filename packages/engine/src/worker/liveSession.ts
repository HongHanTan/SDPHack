import { buildScenario, type CustomPipe, type ScenarioOptions } from '../scenario/index';
import type { InterventionId } from '../scenario/interventions';
import { rainIntensityAt, type StormId } from '../scenario/storms';
import { balanceError, createEngine, makeFrame, patchEngine, stepEngine, type EngineState } from '../sim/engine';
import type { Frame, Scenario } from '../sim/types';

export const LIVE_FRAME_EVERY_S = 10;
/** Upper bound on storm time simulated per worker tick, so a slow machine slows playback instead of freezing. */
export const MAX_ADVANCE_PER_TICK_S = 120;

export interface LiveReadouts {
  sagNow: number;
  sagPeak: number;
  homesNow: number;
  balanceError: number;
}

export interface LiveFrame {
  t: number;
  frame: Frame;
  rainMmHr: number;
  readouts: LiveReadouts;
}

/** Storm seconds to simulate for a wall-clock interval. 1× = one storm-minute per wall-second. */
export function advanceBy(speed: number, wallDtS: number, capS: number): number {
  if (!(speed > 0) || !(wallDtS > 0)) return 0;
  return Math.min(speed * wallDtS * 60, capS);
}

/** One long-running storm that can be patched mid-run. Pure: no worker or DOM APIs. */
export class LiveSession {
  readonly endT: number;
  private sc: Scenario;
  private readonly st: EngineState;
  private sagPeak = 0;
  private nextFrameT = LIVE_FRAME_EVERY_S;
  private homeCells = new Int32Array(0);
  private homeIds = new Int32Array(0);

  constructor(
    readonly stormId: StormId,
    interventions: InterventionId[],
    custom: CustomPipe[],
    /** Tailwater and blockage case; kept for the session's lifetime, including patches. */
    readonly opts: ScenarioOptions = {},
  ) {
    this.sc = buildScenario(interventions, stormId, custom, opts);
    this.st = createEngine(this.sc);
    this.endT = this.sc.storm.intensity.length * this.sc.storm.blockS + this.sc.recessionS;
    this.indexHomes();
  }

  get t(): number {
    return this.st.t;
  }

  /** The scenario currently being simulated (read-only view). */
  get scenario(): Readonly<Scenario> {
    return this.sc;
  }

  get ended(): boolean {
    return this.st.t >= this.endT - 1e-9;
  }

  /** Simulates up to `stormSeconds` more. Returns the latest snapshot if a 10-second frame boundary was crossed. */
  advance(stormSeconds: number): LiveFrame | null {
    const target = Math.min(this.endT, this.st.t + stormSeconds);
    let crossed = false;
    while (this.st.t < target - this.sc.dt / 2) {
      stepEngine(this.sc, this.st);
      const d = this.st.surf.h[this.sc.sagCell];
      if (d > this.sagPeak) this.sagPeak = d;
      if (this.st.t >= this.nextFrameT - 1e-9) {
        this.nextFrameT += LIVE_FRAME_EVERY_S;
        crossed = true;
      }
    }
    return crossed ? this.snapshot() : null;
  }

  snapshot(): LiveFrame {
    const h = this.st.surf.h;
    const homes = new Set<number>();
    for (let k = 0; k < this.homeCells.length; k++) {
      if (h[this.homeCells[k]] >= this.sc.thresholds.home) homes.add(this.homeIds[k]);
    }
    return {
      t: this.st.t,
      frame: makeFrame(this.st),
      rainMmHr: rainIntensityAt(this.sc.storm, this.st.t),
      readouts: {
        sagNow: h[this.sc.sagCell],
        sagPeak: this.sagPeak,
        homesNow: homes.size,
        balanceError: balanceError(this.sc, this.st).error,
      },
    };
  }

  patch(interventions: InterventionId[], custom: CustomPipe[]): void {
    const next = buildScenario(interventions, this.stormId, custom, this.opts);
    patchEngine(this.sc, this.st, next);
    this.sc = next;
    this.indexHomes();
  }

  private indexHomes(): void {
    const cells: number[] = [];
    const ids: number[] = [];
    this.sc.grid.building.forEach((b, c) => {
      if (b >= 0) {
        cells.push(c);
        ids.push(b);
      }
    });
    this.homeCells = Int32Array.from(cells);
    this.homeIds = Int32Array.from(ids);
  }
}
