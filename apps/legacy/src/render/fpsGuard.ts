/** Detects a sustained low frame rate. Fires at most once. */
export class FpsGuard {
  private elapsed = 0;
  private frames = 0;
  private fired = false;

  constructor(
    private readonly minFps = 30,
    private readonly windowS = 3,
    private readonly maxGapS = 0.5,
  ) {}

  /** Feed one rendered frame's dt (s). True exactly once: the first full window averaging below minFps. */
  tick(dtS: number): boolean {
    if (this.fired) return false;
    if (!(dtS > 0) || dtS > this.maxGapS) {
      // hidden tab or a one-off hitch: start a fresh window
      this.elapsed = 0;
      this.frames = 0;
      return false;
    }
    this.elapsed += dtS;
    this.frames++;
    if (this.elapsed < this.windowS - 1e-9) return false;
    const fps = this.frames / this.elapsed;
    this.elapsed = 0;
    this.frames = 0;
    if (fps < this.minFps) {
      this.fired = true;
      return true;
    }
    return false;
  }
}
