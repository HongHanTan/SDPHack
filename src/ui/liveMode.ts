import type { SceneHandle } from '../render/scene';
import type { StormId } from '../scenario/storms';
import type { LiveCommand, LiveMessage } from '../worker/liveProtocol';
import { formatRM } from './format';
import { createLiveChart } from './liveChart';
import { activePipes, selectionCost, type Selection } from './selection';

export interface LiveMode {
  enter(): void;
  leave(): void;
  onSelectionChange(label: string): void;
  onStormChange(): void;
}

export interface LiveOptions {
  view: SceneHandle;
  selection: Selection;
  storm: () => StormId;
  status: (text: string, error?: boolean) => void;
  showRain: (storm: StormId, t: number) => void;
}

type FrameMsg = Extract<LiveMessage, { type: 'frame' }>;

/** Continuous storm; changes apply mid-run via patch so the water responds where it is. */
export function createLiveMode(o: LiveOptions): LiveMode {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const chart = createLiveChart($('live-chart'));
  const playBtn = $<HTMLButtonElement>('live-play');
  const clock = $('live-clock');
  const cards = $('live-cards');
  const balance = $('live-balance');

  let active = false;
  let started = false;
  let userPaused = false;
  let ended = false;
  let seeking = false;
  let dirtyLabel: string | null = null;
  let runStorm: StormId = o.storm();
  let speed = 1;
  let cost = selectionCost(o.selection.state);

  let worker = spawn();

  function spawn(): Worker {
    const w = new Worker(new URL('../worker/live.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<LiveMessage>) => onMessage(e.data);
    w.onerror = (e) => {
      w.terminate();
      worker = spawn();
      started = false;
      o.status(`Live simulation crashed: ${e.message || 'unknown error'}. Click Restart.`, true);
    };
    return w;
  }

  const send = (c: LiveCommand) => worker.postMessage(c);

  const updatePlay = () => {
    playBtn.textContent = ended ? 'Restart' : userPaused ? 'Resume' : 'Pause';
  };

  const start = () => {
    const st = o.selection.state;
    runStorm = o.storm();
    cost = selectionCost(st);
    chart.reset();
    ended = false;
    userPaused = false;
    dirtyLabel = null;
    send({ type: 'start', stormId: runStorm, interventions: st.interventions, custom: activePipes(st) });
    send({ type: 'setSpeed', speed });
    started = true;
    updatePlay();
    o.status('Live: the storm is running. Switch interventions or draw pipes to see the water respond.');
  };

  const sendPatch = (label: string) => {
    const st = o.selection.state;
    send({ type: 'patch', interventions: st.interventions, custom: activePipes(st), label });
  };

  const renderReadouts = (m: FrameMsg) => {
    const r = m.readouts;
    const rows: Array<[string, string]> = [
      ['Sag depth now', `${r.sagNow.toFixed(2)} m`],
      ['Highest so far', `${r.sagPeak.toFixed(2)} m`],
      ['Homes flooded now', `${r.homesNow}`],
      ['Rain now', `${Math.round(m.rainMmHr)} mm/hr`],
      ['Storm clock', `${Math.floor(m.t / 60)} min`],
      ['Installed cost', formatRM(cost)],
    ];
    cards.innerHTML = rows.map(([l, v]) => `<div class="card"><div class="label">${l}</div><div class="value">${v}</div></div>`).join('');
    const ok = r.balanceError < 0.01;
    balance.className = `badge ${ok ? 'ok' : 'warn'}`;
    balance.textContent = `Water balance ${ok ? '✓' : '⚠'} ${(r.balanceError * 100).toFixed(3)}%`;
  };

  function onMessage(m: LiveMessage): void {
    if (!active) return;
    switch (m.type) {
      case 'frame':
        if (seeking) {
          seeking = false;
          o.status(userPaused ? 'Live: paused.' : 'Live: the storm is running.');
        }
        o.view.showFrame(m.frame);
        o.showRain(runStorm, m.t);
        clock.textContent = `${Math.floor(m.t / 60)} min`;
        chart.push(m.t / 60, m.readouts.sagNow);
        renderReadouts(m);
        break;
      case 'patched':
        chart.annotate(m.t / 60, `${m.label} @ ${Math.round(m.t / 60)} min`);
        break;
      case 'ended':
        ended = true;
        updatePlay();
        o.status('Storm over — click Restart to run it again.');
        break;
      case 'error':
        userPaused = true;
        updatePlay();
        o.status(`Simulation stopped at step ${m.step}: ${m.message}. Click Restart.`, true);
        break;
    }
  }

  playBtn.addEventListener('click', () => {
    if (ended || !started) return start();
    userPaused = !userPaused;
    send({ type: userPaused ? 'pause' : 'resume' });
    updatePlay();
  });
  $('live-restart').addEventListener('click', start);

  $('live-speed').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-speed]');
    if (!btn) return;
    speed = Number(btn.dataset.speed);
    send({ type: 'setSpeed', speed });
    $('live-speed').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  });

  $('live-seek').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-seek]');
    if (!btn || !started) return;
    const minute = Number(btn.dataset.seek);
    chart.reset();
    ended = false;
    updatePlay();
    seeking = true;
    o.status(minute > 0 ? `Fast-forwarding to ${minute} min…` : 'Restarting from 0 min…');
    send({ type: 'seek', minute });
  });

  return {
    enter() {
      active = true;
      if (!started || runStorm !== o.storm()) return start();
      if (dirtyLabel) {
        sendPatch(dirtyLabel);
        dirtyLabel = null;
      }
      if (!userPaused && !ended) send({ type: 'resume' });
    },
    leave() {
      active = false;
      send({ type: 'pause' });
    },
    onSelectionChange(label) {
      cost = selectionCost(o.selection.state);
      if (!started) return;
      if (active) sendPatch(label);
      else dirtyLabel = dirtyLabel ? 'changes' : label;
    },
    onStormChange() {
      if (active) start();
    },
  };
}
