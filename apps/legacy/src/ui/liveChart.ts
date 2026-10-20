import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface LiveChart {
  reset(): void;
  push(tMin: number, depth: number): void;
  annotate(tMin: number, label: string): void;
}

/** Sag depth so far, with a vertical marker for every change made during the run. */
export function createLiveChart(el: HTMLElement): LiveChart {
  let xs: number[] = [];
  let ys: number[] = [];
  let notes: Array<{ t: number; label: string }> = [];
  const plot = new uPlot(
    {
      width: Math.max(260, el.clientWidth),
      height: 190,
      scales: { x: { time: false, range: (_u, _min, max) => [0, Math.max(30, max ?? 30)] } },
      series: [{ label: 'min' }, { label: 'Sag depth (m)', stroke: '#0b62c4', width: 2 }],
      axes: [{ label: 'minutes' }, { label: 'depth (m)' }],
      hooks: {
        draw: [
          (u) => {
            const ctx = u.ctx;
            const px = devicePixelRatio;
            ctx.save();
            ctx.strokeStyle = '#c8102e';
            ctx.fillStyle = '#c8102e';
            ctx.font = `${11 * px}px system-ui`;
            notes.forEach((n, k) => {
              const x = u.valToPos(n.t, 'x', true);
              ctx.beginPath();
              ctx.moveTo(x, u.bbox.top);
              ctx.lineTo(x, u.bbox.top + u.bbox.height);
              ctx.stroke();
              ctx.fillText(n.label, x + 3 * px, u.bbox.top + (12 + 12 * (k % 3)) * px);
            });
            ctx.restore();
          },
        ],
      },
    },
    [[], []],
    el,
  );
  return {
    reset() {
      xs = [];
      ys = [];
      notes = [];
      plot.setData([xs, ys]);
    },
    push(t, d) {
      if (xs.length && t <= xs[xs.length - 1]) return;
      xs.push(t);
      ys.push(d);
      plot.setData([xs, ys]);
    },
    annotate(t, label) {
      notes.push({ t, label });
      plot.redraw();
    },
  };
}
