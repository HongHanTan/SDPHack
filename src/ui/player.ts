import type { Frame } from '../sim/types';

/** Plays frames at 10 fps as they arrive; the scrubber seeks; the button pauses/resumes. */
export class Player {
  private frames: Frame[] = [];
  private idx = 0;
  private playing = true;
  private enabled = true;

  constructor(
    private readonly scrubber: HTMLInputElement,
    private readonly clock: HTMLElement,
    private readonly playBtn: HTMLButtonElement,
    private readonly show: (f: Frame) => void,
  ) {
    scrubber.addEventListener('input', () => {
      this.setPlaying(false);
      this.seek(Number(scrubber.value));
    });
    playBtn.addEventListener('click', () => {
      if (!this.playing && this.idx >= this.frames.length - 1) this.idx = 0;
      this.setPlaying(!this.playing);
    });
    setInterval(() => this.tick(), 100);
  }

  reset(): void {
    this.frames = [];
    this.idx = 0;
    this.scrubber.max = '0';
    this.scrubber.value = '0';
    this.setPlaying(true);
  }

  push(f: Frame): void {
    this.frames.push(f);
    this.scrubber.max = String(this.frames.length - 1);
  }

  /** While disabled the player neither advances nor draws (the other mode owns the view). Re-enabling redraws the current frame. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on && this.frames.length) this.seek(Math.min(this.idx, this.frames.length - 1));
  }

  private tick(): void {
    if (!this.enabled) return;
    if (this.playing && this.idx < this.frames.length) {
      this.seek(this.idx);
      this.idx++;
    }
  }

  private seek(i: number): void {
    const f = this.frames[i];
    if (!f) return;
    this.idx = i;
    this.scrubber.value = String(i);
    this.clock.textContent = `${Math.round(f.t / 60)} min`;
    this.show(f);
  }

  private setPlaying(p: boolean): void {
    this.playing = p;
    this.playBtn.textContent = p ? 'Pause' : 'Play';
  }
}
