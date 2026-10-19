import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { Metrics } from '../sim/types';

let plot: uPlot | null = null;

export function renderSagChart(el: HTMLElement, base: Metrics, cur: Metrics): void {
  plot?.destroy();
  plot = new uPlot(
    {
      width: Math.max(260, el.clientWidth),
      height: 200,
      scales: { x: { time: false } },
      series: [
        { label: 'min' },
        { label: 'Baseline', stroke: '#8a8f98', width: 1.5 },
        { label: 'Scenario', stroke: '#0b62c4', width: 2 },
      ],
      axes: [{ label: 'minutes' }, { label: 'depth (m)' }],
    },
    [base.sagSeries.t, base.sagSeries.depth, cur.sagSeries.depth],
    el,
  );
}
