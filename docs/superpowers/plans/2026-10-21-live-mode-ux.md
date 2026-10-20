# Live Mode, Rain & Intervention UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Live sandbox mode in which interventions and pipes can be changed mid-storm and the flood responds where it is. Also add rain visuals with a gauge, and replace the intervention checklist with a grouped, plain-language panel plus map pins.

**Architecture:**
- **Live worker:** a new worker owns one long-running `LiveSession`, built on `createEngine`/`stepEngine` plus a new `patchEngine`. It is paced against the wall clock.
- **Shared selection:** a `Selection` store is shared by both modes, the new intervention panel, the map pins and draw-pipes.
- **Compare mode:** the existing behaviour, moved out of `main.ts` unchanged.
- **Rendering additions:** rain, a gauge, and CSS2D pins, all added to the existing three.js scene.

**Tech Stack:** TypeScript 5, Vite 5, three.js 0.169 (incl. `CSS2DRenderer`), uPlot 1.6, Vitest 2, tsx.

**Spec:** `docs/superpowers/specs/2026-10-21-live-mode-ux-design.md`

## Global Constraints

- `src/sim/` must never import `three`, `uplot`, or DOM APIs. Hydraulics and tuned values in `src/scenario/config.ts` must not change (results in `docs/tuning.md` must stay valid).
- **Live mode:**
  - Speeds are ½×, 1×, 2× and 4×; 1× is one storm-minute per wall-second; the default is 1×.
  - A frame is sent every 10 storm-seconds.
  - Jump targets: Start 0, Peak rain 60, Rain stops 120 (minutes).
  - The run ends at rain + recession = 180 min.
- Wall clock affects pacing only, never physics. The simulation stays deterministic in storm time.
- `patchEngine` conserves volume. Surface `h` is kept unchanged. Node volumes carry over by id, clamped to the new `vmax`, with the excess spilled to the node's cell. Nodes that no longer exist spill their whole volume to their cell.
- **Effect badge:** shows the sag peak-depth change vs baseline for the selected storm, formatted `−0.11 m`. It is green if < −0.005, red if > +0.005, grey otherwise.
- **Cost scale:**

  | costRM | Scale |
  |---|---|
  | < 0.5M | $ |
  | < 2M | $$ |
  | < 4M | $$$ |
  | otherwise | $$$$ |

- **Combos:**

  | Combo | Interventions |
  |---|---|
  | "Cheapest fix: valve + tank" | flap-gate + detention-tank |
  | "Clear the roads: grates + pump" | sag-inlets + pump |

  A combo replaces the interventions and keeps custom pipes.
- **Rain:** about 6000 streaks; all of them are visible at 150 mm/hr; none at 0.
- **Pre-computed effects:** `src/scenario/effects.json`, shaped `{ stormId: { interventionId: { dSag, dHomes } } }`, rounded to 0.001 m. The drift tolerance is 0.005 m for `dSag`; `dHomes` must match exactly.
- Only one simulation runs at a time. The Live worker is paused while Compare is active.
- Costs stay labelled as indicative placeholders. The provisional IDF note stays.
- Keep the existing demo-safety behaviour:
  - custom pipes are validated (uphill, duplicate, reverse, self, missing node);
  - drag-clicks are filtered out;
  - controls are disabled during Compare runs;
  - both water balances are shown.
- Display metadata (labels, icons, groups, sites) lives in `src/ui/catalog.ts` (a UI concern), not in `src/scenario/`.
- Commit after every task, with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

```
src/scenario/storms.ts          + rainIntensityAt
src/scenario/effects.json       generated badge data
src/sim/engine.ts               + patchEngine
src/worker/liveSession.ts       LiveSession + advanceBy (pure, node-testable)
src/worker/liveProtocol.ts      live worker message types
src/worker/live.worker.ts       thin worker loop around LiveSession
scripts/computeEffects.ts       computeEffects() (used by script + drift test)
scripts/effects.ts              npm run effects → writes effects.json
src/render/rain.ts              Rain streaks
src/render/pins.ts              PinLayer (CSS2D pins + popover)
src/render/scene.ts             + rain, pins, new SceneHandle methods
src/ui/catalog.ts               display metadata, groups, combos, costScale, formatEffect
src/ui/effects.ts               effectOf(storm, id)
src/ui/selection.ts             Selection store, activePipes, selectionCost
src/ui/interventionPanel.ts     grouped panel
src/ui/rainGauge.ts             gauge overlay
src/ui/drawPipes.ts             draw-a-pipe (moved from main.ts)
src/ui/compareMode.ts           compare flow (moved from main.ts)
src/ui/liveChart.ts             uPlot live chart with annotations
src/ui/liveMode.ts              live controls + readouts
src/ui/controls.ts              storm select only
src/ui/player.ts                + setEnabled
src/main.ts                     shell: scene, selection, panel, pins, tabs, modes
index.html, src/ui/styles.css
tests/ui/catalog.test.ts, tests/sim/patch.test.ts, tests/worker/liveSession.test.ts,
tests/ui/effects.test.ts, tests/effects.drift.test.ts, tests/ui/selection.test.ts, tests/render/rain.test.ts
```

---

### Task 1: Rain intensity lookup and intervention catalog

**Files:**
- Modify: `src/scenario/storms.ts` (append)
- Create: `src/ui/catalog.ts`
- Test: `tests/scenario/storms.test.ts` (append), `tests/ui/catalog.test.ts`

**Interfaces:**
- Consumes:
  - `Storm` (`src/sim/types.ts`), `INTERVENTIONS`, `Intervention`, `InterventionId` (`src/scenario/interventions.ts`);
  - `NODE_LAYOUT`, `TANK`, `POND`, `BIOSWALE`, `GRID` (`src/scenario/config.ts`);
  - `baseTownship` (`src/scenario/index.ts`, tests only).
- Produces:
  - `rainIntensityAt(storm: Storm, t: number): number` (mm/hr);
  - `GROUPS`, `type Group`, `InterventionDisplay { label; short; icon; group; site: {x; y} }`, `DISPLAY: Record<InterventionId, InterventionDisplay>`;
  - `Combo { label; hint; ids }`, `COMBOS`;
  - `costScale(costRM): 1|2|3|4`;
  - `groupedInterventions(): Array<{ group: Group; items: Intervention[] }>`;
  - `formatEffect(dSag): { text; tone: 'better'|'worse'|'same' }`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/scenario/storms.test.ts`, and add `rainIntensityAt` and `STORMS` to its import from `../../src/scenario/storms` if they are not there yet:

```ts
describe('rainIntensityAt', () => {
  const s = STORMS['100yr'];
  it('returns the block intensity in mm/hr', () => {
    expect(rainIntensityAt(s, 0)).toBeCloseTo(s.intensity[0] * 3.6e6, 9);
    expect(rainIntensityAt(s, 299.9)).toBeCloseTo(s.intensity[0] * 3.6e6, 9);
    expect(rainIntensityAt(s, 300)).toBeCloseTo(s.intensity[1] * 3.6e6, 9);
  });
  it('is zero before the start and after the storm ends', () => {
    expect(rainIntensityAt(s, -1)).toBe(0);
    expect(rainIntensityAt(s, 7200)).toBe(0);
  });
});
```

Create `tests/ui/catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baseTownship } from '../../src/scenario/index';
import { INTERVENTIONS } from '../../src/scenario/interventions';
import { COMBOS, costScale, DISPLAY, formatEffect, GROUPS, groupedInterventions } from '../../src/ui/catalog';

describe('catalog', () => {
  it('lists every intervention in exactly one group, in group order', () => {
    const grouped = groupedInterventions();
    expect(grouped.map((g) => g.group)).toEqual([...GROUPS]);
    const ids = grouped.flatMap((g) => g.items.map((iv) => iv.id));
    expect([...ids].sort()).toEqual(INTERVENTIONS.map((iv) => iv.id).sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('combos reference real interventions', () => {
    const valid = new Set(INTERVENTIONS.map((iv) => iv.id));
    for (const c of COMBOS) for (const id of c.ids) expect(valid.has(id)).toBe(true);
    expect(COMBOS.map((c) => c.ids)).toEqual([
      ['flap-gate', 'detention-tank'],
      ['sag-inlets', 'pump'],
    ]);
  });

  it('maps cost to a 1–4 scale', () => {
    expect(costScale(150_000)).toBe(1);
    expect(costScale(499_999)).toBe(1);
    expect(costScale(500_000)).toBe(2);
    expect(costScale(1_999_999)).toBe(2);
    expect(costScale(2_000_000)).toBe(3);
    expect(costScale(3_999_999)).toBe(3);
    expect(costScale(4_000_000)).toBe(4);
  });

  it('formats effects with tone', () => {
    expect(formatEffect(-0.11)).toEqual({ text: '−0.11 m', tone: 'better' });
    expect(formatEffect(0.06)).toEqual({ text: '+0.06 m', tone: 'worse' });
    expect(formatEffect(0.003)).toEqual({ text: '≈ 0 m', tone: 'same' });
  });

  it('places node-based pins on their manholes', () => {
    const nodes = new Map(baseTownship().network.nodes.map((n) => [n.id, n]));
    for (const [id, node] of [['flap-gate', 'O'], ['sag-inlets', 'S1'], ['upsize-trunk', 'T4']] as const) {
      expect(DISPLAY[id].site).toEqual({ x: nodes.get(node)!.x, y: nodes.get(node)!.y });
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/scenario/storms.test.ts tests/ui/catalog.test.ts`
Expected: FAIL. `rainIntensityAt` is not exported, and `../../src/ui/catalog` cannot be resolved.

- [ ] **Step 3: Implement `rainIntensityAt`**

Append to `src/scenario/storms.ts`:

```ts
/** Rain intensity in mm/hr at storm time t (s); 0 before the start and after the storm ends. */
export function rainIntensityAt(storm: Storm, t: number): number {
  if (t < 0) return 0;
  const k = Math.floor(t / storm.blockS);
  return k < storm.intensity.length ? storm.intensity[k] * 3.6e6 : 0;
}
```

- [ ] **Step 4: Implement the catalog**

Create `src/ui/catalog.ts`:

```ts
import { BIOSWALE, GRID, NODE_LAYOUT, POND, TANK } from '../scenario/config';
import { INTERVENTIONS, type Intervention, type InterventionId } from '../scenario/interventions';

export const GROUPS = [
  'Stop the river coming back',
  'Store water for later',
  'Get water into the drains',
  'Move water out faster',
] as const;
export type Group = (typeof GROUPS)[number];

export interface InterventionDisplay {
  label: string;
  short: string; // used in live-chart annotations, e.g. "+ valve @ 64 min"
  icon: string;
  group: Group;
  site: { x: number; y: number }; // township metres: x east, y north
}

function nodeSite(id: string): { x: number; y: number } {
  const n = NODE_LAYOUT.find(([nid]) => nid === id);
  if (!n) throw new Error(`Unknown node ${id}`);
  return { x: n[1], y: n[2] };
}

const OUTFALL = nodeSite('O');

export const DISPLAY: Record<InterventionId, InterventionDisplay> = {
  'flap-gate': { label: 'One-way valve at the river', short: 'valve', icon: '🚪', group: 'Stop the river coming back', site: OUTFALL },
  'detention-tank': { label: 'Underground storage tank', short: 'tank', icon: '🛢️', group: 'Store water for later', site: { x: TANK.x, y: TANK.y } },
  'relief-pond': { label: 'Overflow pipe to pond', short: 'overflow pipe', icon: '↪️', group: 'Store water for later', site: { x: POND.x, y: POND.y } },
  'sag-inlets': { label: 'More drain grates in the low area', short: 'grates', icon: '🕳️', group: 'Get water into the drains', site: nodeSite('S1') },
  bioswales: {
    label: 'Rain gardens on the slope',
    short: 'rain gardens',
    icon: '🌿',
    group: 'Get water into the drains',
    site: { x: BIOSWALE.xMax / 2, y: (BIOSWALE.roadJ + 0.5) * GRID.dx },
  },
  'upsize-trunk': { label: 'Bigger main drain', short: 'bigger drain', icon: '⬇️', group: 'Move water out faster', site: nodeSite('T4') },
  pump: { label: 'Pump station', short: 'pump', icon: '⚡', group: 'Move water out faster', site: { x: OUTFALL.x + 12, y: OUTFALL.y } },
};

export interface Combo {
  label: string;
  hint: string;
  ids: InterventionId[];
}

export const COMBOS: Combo[] = [
  { label: 'Cheapest fix', hint: 'valve + tank', ids: ['flap-gate', 'detention-tank'] },
  { label: 'Clear the roads', hint: 'grates + pump', ids: ['sag-inlets', 'pump'] },
];

export function costScale(costRM: number): 1 | 2 | 3 | 4 {
  if (costRM < 500_000) return 1;
  if (costRM < 2_000_000) return 2;
  if (costRM < 4_000_000) return 3;
  return 4;
}

export function groupedInterventions(): Array<{ group: Group; items: Intervention[] }> {
  return GROUPS.map((group) => ({ group, items: INTERVENTIONS.filter((iv) => DISPLAY[iv.id].group === group) }));
}

export function formatEffect(dSag: number): { text: string; tone: 'better' | 'worse' | 'same' } {
  if (dSag < -0.005) return { text: `−${Math.abs(dSag).toFixed(2)} m`, tone: 'better' };
  if (dSag > 0.005) return { text: `+${dSag.toFixed(2)} m`, tone: 'worse' };
  return { text: '≈ 0 m', tone: 'same' };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/scenario/storms.test.ts tests/ui/catalog.test.ts`
Expected: PASS.

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass and tsc prints nothing.

- [ ] **Step 6: Commit**

```bash
git add src/scenario/storms.ts src/ui/catalog.ts tests/scenario/storms.test.ts tests/ui/catalog.test.ts
git commit -m "feat: rain intensity lookup and plain-language intervention catalog"
```

---

### Task 2: `patchEngine` — change the network mid-run without losing water

**Files:**
- Modify: `src/sim/engine.ts` (append `patchEngine`)
- Test: `tests/sim/patch.test.ts`

**Interfaces:**
- Consumes: `EngineState`, `createEngine`, `stepEngine`, `balanceError`, `totalStorage` (`src/sim/engine.ts`); `createNetworkState` (`src/sim/pipes.ts`); `makeScenario` (`tests/helpers.ts`), which builds a 20×20 test township with nodes `A` (cell 12·20+10) and `B` (cell 3·20+10), pipe `A-B` and options `{ diameter, flapGate, riverLevels, rainMmHr }`.
- Produces: `patchEngine(oldSc: Scenario, st: EngineState, newSc: Scenario): void`. After the call, the caller must use `newSc` for every subsequent `stepEngine`, `balanceError` and `makeFrame`.

- [ ] **Step 1: Write the failing tests**

Create `tests/sim/patch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { balanceError, createEngine, patchEngine, stepEngine, totalStorage } from '../../src/sim/engine';
import { makeScenario } from '../helpers';

const AREA = 16; // 4 m cells

describe('patchEngine', () => {
  it('keeps surface depths and carries node volumes over by id', () => {
    const sc = makeScenario();
    const st = createEngine(sc);
    for (let k = 0; k < 300; k++) stepEngine(sc, st);
    const h = Array.from(st.surf.h);
    const vol = Array.from(st.net.vol);
    const next = makeScenario({ diameter: 0.6 });
    patchEngine(sc, st, next);
    expect(Array.from(st.surf.h)).toEqual(h);
    expect(Array.from(st.net.vol)).toEqual(vol);
    expect(st.net.qFull[0]).toBeGreaterThan(0);
  });

  it('spills the water of nodes that no longer exist onto their cell', () => {
    const sc = makeScenario();
    const cellC = 15 * 20 + 3;
    sc.network.nodes.push({ id: 'C', x: 0, y: 0, cell: cellC, invert: 1, area: 1, maxDepth: 2, inletPerimeter: 0 });
    const st = createEngine(sc);
    st.net.vol[2] = 1.5;
    const before = totalStorage(sc, st);
    const hC = st.surf.h[cellC];
    const next = makeScenario();
    patchEngine(sc, st, next);
    expect(st.net.vol.length).toBe(2);
    expect(st.surf.h[cellC]).toBeCloseTo(hC + 1.5 / AREA, 12);
    expect(totalStorage(next, st)).toBeCloseTo(before, 9);
  });

  it('spills volume above a smaller new capacity', () => {
    const sc = makeScenario();
    const st = createEngine(sc);
    st.net.vol[1] = 1.2;
    const next = makeScenario();
    next.network.nodes[1].maxDepth = 0.5; // vmax 0.5 m³
    const cellB = next.network.nodes[1].cell;
    const hB = st.surf.h[cellB];
    patchEngine(sc, st, next);
    expect(st.net.vol[1]).toBeCloseTo(0.5, 12);
    expect(st.surf.h[cellB]).toBeCloseTo(hB + 0.7 / AREA, 12);
  });

  function patchedRun(): { error: number; h: number[] } {
    const sc = makeScenario({ rainMmHr: 200 });
    const st = createEngine(sc);
    for (let k = 0; k < 600; k++) stepEngine(sc, st);
    const next = makeScenario({ rainMmHr: 200, diameter: 0.6, flapGate: true });
    patchEngine(sc, st, next);
    for (let k = 0; k < 1200; k++) stepEngine(next, st);
    return { error: balanceError(next, st).error, h: Array.from(st.surf.h) };
  }

  it('keeps the water balance within 1% across a mid-storm patch', () => {
    expect(patchedRun().error).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    expect(patchedRun().h).toEqual(patchedRun().h);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/sim/patch.test.ts`
Expected: FAIL with `patchEngine is not a function` / not exported.

- [ ] **Step 3: Implement `patchEngine`**

Append to `src/sim/engine.ts`:

```ts
/**
 * Swaps in a new scenario mid-run (interventions or custom pipes changed) without creating or losing water.
 * Surface depths and fluxes are kept as they are. Node volumes carry over by node id; volume above a node's
 * new capacity, and the whole volume of nodes that no longer exist, spills onto the surface at that node's
 * cell. Pipe flows restart from 0. Use `newSc` for every later step.
 */
export function patchEngine(oldSc: Scenario, st: EngineState, newSc: Scenario): void {
  if (oldSc.grid.nx !== newSc.grid.nx || oldSc.grid.ny !== newSc.grid.ny) throw new Error('patchEngine: grid size changed');
  const area = newSc.grid.dx * newSc.grid.dx;
  const next = createNetworkState(newSc.network);
  oldSc.network.nodes.forEach((node, k) => {
    const v = st.net.vol[k];
    if (v <= 0) return;
    const j = next.index.get(node.id);
    if (j === undefined) {
      st.surf.h[node.cell] += v / area;
      return;
    }
    const keep = Math.min(v, next.vmax[j]);
    next.vol[j] = keep;
    if (v > keep) st.surf.h[newSc.network.nodes[j].cell] += (v - keep) / area;
  });
  st.net = next;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/sim/patch.test.ts`
Expected: PASS, 5 tests.

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass and tsc prints nothing.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts tests/sim/patch.test.ts
git commit -m "feat(sim): patchEngine swaps the network mid-run while conserving water"
```

---

### Task 3: Live session and live worker

**Files:**
- Create: `src/worker/liveSession.ts`, `src/worker/liveProtocol.ts`, `src/worker/live.worker.ts`
- Test: `tests/worker/liveSession.test.ts`

**Interfaces:**
- Consumes:
  - `buildScenario`, `CustomPipe` (`src/scenario/index.ts`); `InterventionId`; `rainIntensityAt`, `StormId`, `STORMS`;
  - `createEngine`, `stepEngine`, `makeFrame`, `balanceError`, `patchEngine`, `EngineState`; `Frame`, `Scenario`, `SimError`.
- Produces:
  - `LIVE_FRAME_EVERY_S = 10` and `MAX_ADVANCE_PER_TICK_S = 120`;
  - `LiveReadouts { sagNow; sagPeak; homesNow; balanceError }` and `LiveFrame { t; frame; rainMmHr; readouts }`;
  - `advanceBy(speed, wallDtS, capS): number`;
  - `class LiveSession(stormId, interventions, custom)` with `t`, `ended`, `endT`, `advance(stormSeconds): LiveFrame | null`, `snapshot(): LiveFrame` and `patch(interventions, custom)`;
  - `LiveCommand` and `LiveMessage` (protocol below).

- [ ] **Step 1: Write the failing tests**

Create `tests/worker/liveSession.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rainIntensityAt, STORMS } from '../../src/scenario/storms';
import { advanceBy, LiveSession } from '../../src/worker/liveSession';

describe('advanceBy', () => {
  it('maps 1× to one storm-minute per wall-second, capped', () => {
    expect(advanceBy(1, 0.05, 120)).toBeCloseTo(3, 12);
    expect(advanceBy(0.5, 2, 120)).toBeCloseTo(60, 12);
    expect(advanceBy(4, 1, 120)).toBe(120);
  });
  it('never goes backwards', () => {
    expect(advanceBy(0, 1, 120)).toBe(0);
    expect(advanceBy(1, -1, 120)).toBe(0);
  });
});

describe('LiveSession', () => {
  it('emits a frame every 10 storm-seconds', () => {
    const s = new LiveSession('100yr', [], []);
    expect(s.advance(5)).toBeNull();
    const f = s.advance(5);
    expect(f).not.toBeNull();
    expect(f!.t).toBeCloseTo(10, 9);
    expect(s.endT).toBe(10800);
  });

  it('reports rain, readouts and a closed water balance', () => {
    const s = new LiveSession('100yr', [], []);
    s.advance(600);
    const f = s.snapshot();
    expect(f.rainMmHr).toBeCloseTo(rainIntensityAt(STORMS['100yr'], f.t), 9);
    expect(f.readouts.sagPeak).toBeGreaterThanOrEqual(f.readouts.sagNow);
    expect(f.readouts.balanceError).toBeLessThan(0.01);
  });

  it('keeps the water where it is when patched', () => {
    const s = new LiveSession('100yr', [], []);
    s.advance(600);
    const before = Array.from(s.snapshot().frame.depth);
    s.patch(['flap-gate'], []);
    expect(Array.from(s.snapshot().frame.depth)).toEqual(before);
    s.advance(60);
    expect(s.snapshot().readouts.balanceError).toBeLessThan(0.01);
  });

  it('removing the tank mid-storm loses no water', () => {
    const s = new LiveSession('100yr', ['detention-tank'], []);
    s.advance(1200);
    s.patch([], []);
    s.advance(10);
    expect(s.snapshot().readouts.balanceError).toBeLessThan(0.01);
  });

  it('is deterministic', () => {
    const a = new LiveSession('100yr', ['pump'], []);
    const b = new LiveSession('100yr', ['pump'], []);
    a.advance(120);
    b.advance(60);
    b.advance(60);
    expect(Array.from(a.snapshot().frame.depth)).toEqual(Array.from(b.snapshot().frame.depth));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/worker/liveSession.test.ts`
Expected: FAIL. `../../src/worker/liveSession` cannot be resolved.

- [ ] **Step 3: Implement the session**

Create `src/worker/liveSession.ts`:

```ts
import { buildScenario, type CustomPipe } from '../scenario/index';
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
  ) {
    this.sc = buildScenario(interventions, stormId, custom);
    this.st = createEngine(this.sc);
    this.endT = this.sc.storm.intensity.length * this.sc.storm.blockS + this.sc.recessionS;
    this.indexHomes();
  }

  get t(): number {
    return this.st.t;
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
    const next = buildScenario(interventions, this.stormId, custom);
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/worker/liveSession.test.ts`
Expected: PASS, 7 tests (about 30–60 s in total on this laptop).

- [ ] **Step 5: Protocol and worker**

Create `src/worker/liveProtocol.ts`:

```ts
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
```

Create `src/worker/live.worker.ts`:

```ts
import { SimError } from '../sim/types';
import type { LiveCommand, LiveMessage } from './liveProtocol';
import { advanceBy, LiveSession, MAX_ADVANCE_PER_TICK_S } from './liveSession';

const post = (m: LiveMessage) => (self as unknown as { postMessage(m: LiveMessage): void }).postMessage(m);
const TICK_MS = 50;

let session: LiveSession | null = null;
let current: Extract<LiveCommand, { type: 'start' }> | null = null;
let speed = 1;
let paused = false;
let endedSent = false;
let last = performance.now();

function fail(err: unknown): void {
  paused = true;
  post({ type: 'error', message: err instanceof Error ? err.message : String(err), step: err instanceof SimError ? err.step : -1 });
}

function startSession(seekMinute: number): void {
  if (!current) return;
  session = new LiveSession(current.stormId, current.interventions, current.custom);
  endedSent = false;
  if (seekMinute > 0) session.advance(seekMinute * 60);
  last = performance.now();
  post({ type: 'frame', ...session.snapshot() });
}

setInterval(() => {
  const now = performance.now();
  const wall = (now - last) / 1000;
  last = now;
  if (!session || paused) return;
  if (session.ended) {
    if (!endedSent) {
      endedSent = true;
      post({ type: 'ended' });
    }
    return;
  }
  try {
    const f = session.advance(advanceBy(speed, wall, MAX_ADVANCE_PER_TICK_S));
    if (f) post({ type: 'frame', ...f });
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
        paused = false;
        startSession(0);
        break;
      case 'patch':
        if (current) current = { ...current, interventions: cmd.interventions, custom: cmd.custom };
        if (session) {
          session.patch(cmd.interventions, cmd.custom);
          post({ type: 'patched', label: cmd.label, t: session.t });
          post({ type: 'frame', ...session.snapshot() });
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
```

- [ ] **Step 6: Verify and commit**

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass and tsc prints nothing.

```bash
git add src/worker/liveSession.ts src/worker/liveProtocol.ts src/worker/live.worker.ts tests/worker/liveSession.test.ts
git commit -m "feat: live session and paced live worker with mid-run patching"
```

---

### Task 4: Pre-computed intervention effects

**Files:**
- Create: `scripts/computeEffects.ts`, `scripts/effects.ts`, `src/scenario/effects.json` (generated), `src/ui/effects.ts`
- Test: `tests/ui/effects.test.ts` (fast), `tests/effects.drift.test.ts` (slow)
- Modify: `package.json` scripts

**Interfaces:**
- Consumes: `buildScenario`, `runSimulation`, `INTERVENTIONS`, `STORMS`, `StormId`, `InterventionId`.
- Produces:
  - `type Effects = Record<StormId, Record<InterventionId, { dSag: number; dHomes: number }>>`;
  - `computeEffects(log?): Effects`;
  - `Effect { dSag; dHomes }` and `effectOf(storm: StormId, id: InterventionId): Effect | null`.

- [ ] **Step 1: Write the compute function and script**

Create `scripts/computeEffects.ts`:

```ts
import { buildScenario } from '../src/scenario/index';
import { INTERVENTIONS, type InterventionId } from '../src/scenario/interventions';
import { STORMS, type StormId } from '../src/scenario/storms';
import { runSimulation } from '../src/sim/engine';

export type Effects = Record<StormId, Record<InterventionId, { dSag: number; dHomes: number }>>;

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** Runs the baseline and each single intervention for every storm (16 runs) and returns the change vs baseline. */
export function computeEffects(log: (line: string) => void = () => {}): Effects {
  const out = {} as Effects;
  for (const storm of Object.keys(STORMS) as StormId[]) {
    const base = runSimulation(buildScenario([], storm)).metrics;
    log(`${storm} baseline: sag ${base.peakSagDepth.toFixed(3)} m, homes ${base.homesFlooded}`);
    const row = {} as Effects[StormId];
    for (const iv of INTERVENTIONS) {
      const m = runSimulation(buildScenario([iv.id], storm)).metrics;
      row[iv.id] = { dSag: round3(m.peakSagDepth - base.peakSagDepth), dHomes: m.homesFlooded - base.homesFlooded };
      log(`${storm} ${iv.id}: dSag ${row[iv.id].dSag}, dHomes ${row[iv.id].dHomes}`);
    }
    out[storm] = row;
  }
  return out;
}
```

Create `scripts/effects.ts`:

```ts
import { writeFileSync } from 'node:fs';
import { computeEffects } from './computeEffects';

const effects = computeEffects((line) => console.log(line));
writeFileSync(new URL('../src/scenario/effects.json', import.meta.url), JSON.stringify(effects, null, 2) + '\n');
console.log('Wrote src/scenario/effects.json');
```

In `package.json`, replace the `test` and `story` scripts and add `effects`:

```json
    "test": "vitest run --exclude tests/story.test.ts --exclude tests/effects.drift.test.ts",
    "story": "vitest run tests/story.test.ts tests/effects.drift.test.ts",
    "effects": "tsx scripts/effects.ts",
```

- [ ] **Step 2: Generate the data**

Run `npm run effects` in the background. It takes about 16 × 30 s ≈ 8–9 minutes; give the shell a timeout of at least 600000 ms, or run it in the background and wait for it.
Expected: 18 log lines, then `Wrote src/scenario/effects.json`. Open the file and check it has `10yr` and `100yr` keys, each with 7 intervention entries. For `100yr`, `flap-gate.dSag` should be about −0.11 and `upsize-trunk.dSag` about +0.06 (see `docs/tuning.md`).

- [ ] **Step 3: Write the failing loader test**

Create `tests/ui/effects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { INTERVENTIONS } from '../../src/scenario/interventions';
import type { StormId } from '../../src/scenario/storms';
import { effectOf } from '../../src/ui/effects';

describe('effectOf', () => {
  it('returns a stored effect for every storm and intervention', () => {
    for (const storm of ['10yr', '100yr'] as StormId[]) {
      for (const iv of INTERVENTIONS) {
        const e = effectOf(storm, iv.id);
        expect(e).not.toBeNull();
        expect(Number.isFinite(e!.dSag)).toBe(true);
        expect(Number.isInteger(e!.dHomes)).toBe(true);
      }
    }
  });

  it('returns null for unknown storms instead of crashing', () => {
    expect(effectOf('500yr' as StormId, 'pump')).toBeNull();
  });
});
```

Run: `npx vitest run tests/ui/effects.test.ts`
Expected: FAIL. `../../src/ui/effects` cannot be resolved.

- [ ] **Step 4: Implement the loader**

Create `src/ui/effects.ts`:

```ts
import data from '../scenario/effects.json';
import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';

export interface Effect {
  dSag: number;
  dHomes: number;
}

const table = data as Partial<Record<string, Partial<Record<string, Effect>>>>;

/** Pre-computed change vs baseline (from `npm run effects`), or null if missing. */
export function effectOf(storm: StormId, id: InterventionId): Effect | null {
  return table[storm]?.[id] ?? null;
}
```

Run: `npx vitest run tests/ui/effects.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Add the slow drift test**

Create `tests/effects.drift.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeEffects } from '../scripts/computeEffects';
import stored from '../src/scenario/effects.json';

type Table = Record<string, Record<string, { dSag: number; dHomes: number }>>;

describe('pre-computed intervention effects', () => {
  it('still match the live model (re-run `npm run effects` after retuning)', () => {
    const fresh = computeEffects() as unknown as Table;
    const saved = stored as Table;
    for (const [storm, row] of Object.entries(fresh)) {
      for (const [id, e] of Object.entries(row)) {
        expect(Math.abs(saved[storm][id].dSag - e.dSag), `${storm} ${id} dSag`).toBeLessThanOrEqual(0.005);
        expect(saved[storm][id].dHomes, `${storm} ${id} dHomes`).toBe(e.dHomes);
      }
    }
  }, 1_500_000);
});
```

- [ ] **Step 6: Verify and commit**

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass (the drift test is excluded) and tsc prints nothing.

Run `npx vitest run tests/effects.drift.test.ts` in the background (about 9 minutes).
Expected: PASS.

```bash
git add scripts/computeEffects.ts scripts/effects.ts src/scenario/effects.json src/ui/effects.ts tests/ui/effects.test.ts tests/effects.drift.test.ts package.json
git commit -m "feat: pre-computed per-intervention effects with drift test"
```

---

### Task 5: Selection store, intervention panel, storm select

**Files:**
- Create: `src/ui/selection.ts`, `src/ui/interventionPanel.ts`
- Modify: `src/ui/controls.ts` (add `renderStormSelect`; keep `renderControls` for now, since Task 7 removes it), `src/ui/styles.css` (append)
- Test: `tests/ui/selection.test.ts`

**Interfaces:**
- Consumes:
  - `buildTownship`, `customPipeCost`, `CustomPipe`; `INTERVENTIONS`, `totalCost`, `InterventionId`; `StormId`, `STORMS`;
  - `DISPLAY`, `COMBOS`, `costScale`, `formatEffect`, `groupedInterventions` (Task 1); `effectOf` (Task 4); `formatRM` (`src/ui/format.ts`).
- Produces:
  - `SelectionState { interventions: InterventionId[]; custom: CustomPipe[] }` and `SelectionListener = (state, label) => void`;
  - `class Selection` with `state`, `has(id)`, `set(id, on)`, `applyCombo(ids, label)`, `addPipe(p)`, `removePipe(index)` and `subscribe(fn): () => void`;
  - `activePipes(state): CustomPipe[]` and `selectionCost(state): number`;
  - `mountInterventionPanel(el, selection, storm: () => StormId): { refresh(): void; setDisabled(b: boolean): void }`;
  - `renderStormSelect(sel: HTMLSelectElement): () => StormId`.

Labels emitted by `Selection`:

| Action | Label |
|---|---|
| Install | `+ <short>` |
| Remove | `− <short>` (U+2212) |
| Add pipe | `+ pipe A→B` |
| Remove pipe | `− pipe A→B` |
| Combo | the combo label |

- [ ] **Step 1: Write the failing tests**

Create `tests/ui/selection.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { totalCost } from '../../src/scenario/interventions';
import { activePipes, Selection, selectionCost } from '../../src/ui/selection';

describe('Selection', () => {
  it('emits a readable label on change and ignores no-op sets', () => {
    const s = new Selection();
    const labels: string[] = [];
    s.subscribe((_st, label) => labels.push(label));
    s.set('flap-gate', true);
    s.set('flap-gate', true);
    s.set('flap-gate', false);
    expect(labels).toEqual(['+ valve', '− valve']);
  });

  it('orders interventions like INTERVENTIONS regardless of click order', () => {
    const s = new Selection();
    s.set('pump', true);
    s.set('upsize-trunk', true);
    expect(s.state.interventions).toEqual(['upsize-trunk', 'pump']);
  });

  it('applying a combo replaces interventions and keeps custom pipes', () => {
    const s = new Selection();
    s.set('upsize-trunk', true);
    s.addPipe({ from: 'SL0', to: 'O', diameter: 0.6 });
    s.applyCombo(['flap-gate', 'detention-tank'], 'Cheapest fix');
    expect(s.state.interventions).toEqual(['detention-tank', 'flap-gate']);
    expect(s.state.custom).toEqual([{ from: 'SL0', to: 'O', diameter: 0.6 }]);
  });

  it('state is a copy', () => {
    const s = new Selection();
    s.addPipe({ from: 'SL0', to: 'O', diameter: 0.6 });
    s.state.custom.pop();
    expect(s.state.custom.length).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    const s = new Selection();
    let n = 0;
    const off = s.subscribe(() => n++);
    off();
    s.set('pump', true);
    expect(n).toBe(0);
  });
});

describe('activePipes / selectionCost', () => {
  it('drops pipes whose node is not in the scenario', () => {
    const state = { interventions: [], custom: [{ from: 'S3', to: 'P', diameter: 0.6 }, { from: 'SL0', to: 'O', diameter: 0.6 }] };
    expect(activePipes(state)).toEqual([{ from: 'SL0', to: 'O', diameter: 0.6 }]);
    expect(activePipes({ ...state, interventions: ['relief-pond'] }).length).toBe(2);
  });

  it('costs interventions plus active pipes', () => {
    expect(selectionCost({ interventions: ['flap-gate', 'pump'], custom: [] })).toBe(totalCost(['flap-gate', 'pump']));
    expect(selectionCost({ interventions: [], custom: [{ from: 'SL0', to: 'O', diameter: 0.6 }] })).toBeGreaterThan(0);
  });
});
```

Run: `npx vitest run tests/ui/selection.test.ts`
Expected: FAIL. `../../src/ui/selection` cannot be resolved.

- [ ] **Step 2: Implement the selection store**

Create `src/ui/selection.ts`:

```ts
import { buildTownship, customPipeCost, type CustomPipe } from '../scenario/index';
import { INTERVENTIONS, totalCost, type InterventionId } from '../scenario/interventions';
import { DISPLAY } from './catalog';

export interface SelectionState {
  interventions: InterventionId[];
  custom: CustomPipe[];
}

export type SelectionListener = (state: SelectionState, label: string) => void;

/** Installed interventions + custom pipes, shared by both modes, the panel, the pins and draw-pipes. */
export class Selection {
  private ids = new Set<InterventionId>();
  private pipes: CustomPipe[] = [];
  private listeners: SelectionListener[] = [];

  get state(): SelectionState {
    return {
      interventions: INTERVENTIONS.map((iv) => iv.id).filter((id) => this.ids.has(id)),
      custom: this.pipes.map((p) => ({ ...p })),
    };
  }

  has(id: InterventionId): boolean {
    return this.ids.has(id);
  }

  set(id: InterventionId, on: boolean): void {
    if (this.ids.has(id) === on) return;
    if (on) this.ids.add(id);
    else this.ids.delete(id);
    this.emit(`${on ? '+' : '−'} ${DISPLAY[id].short}`);
  }

  applyCombo(ids: readonly InterventionId[], label: string): void {
    this.ids = new Set(ids);
    this.emit(label);
  }

  addPipe(p: CustomPipe): void {
    this.pipes.push({ ...p });
    this.emit(`+ pipe ${p.from}→${p.to}`);
  }

  removePipe(index: number): void {
    const [p] = this.pipes.splice(index, 1);
    if (p) this.emit(`− pipe ${p.from}→${p.to}`);
  }

  subscribe(fn: SelectionListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private emit(label: string): void {
    const s = this.state;
    for (const l of this.listeners) l(s, label);
  }
}

/** Custom pipes whose endpoints exist with these interventions. Others stay listed but inactive. */
export function activePipes(state: SelectionState): CustomPipe[] {
  const nodes = new Set(buildTownship(state.interventions).network.nodes.map((n) => n.id));
  return state.custom.filter((c) => nodes.has(c.from) && nodes.has(c.to));
}

export function selectionCost(state: SelectionState): number {
  const pipes = activePipes(state);
  const t = buildTownship(state.interventions, pipes);
  return totalCost(state.interventions) + pipes.reduce((s, c) => s + customPipeCost(t, c), 0);
}
```

Run: `npx vitest run tests/ui/selection.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 3: Storm select helper**

Append to `src/ui/controls.ts`:

```ts
/** Fills the storm dropdown (default 100-yr) and returns a getter for the selected storm. */
export function renderStormSelect(stormSel: HTMLSelectElement): () => StormId {
  stormSel.innerHTML = (Object.keys(STORMS) as StormId[])
    .map((id) => `<option value="${id}" ${id === '100yr' ? 'selected' : ''}>${STORMS[id].label}</option>`)
    .join('');
  return () => stormSel.value as StormId;
}
```

- [ ] **Step 4: Intervention panel**

Create `src/ui/interventionPanel.ts`:

```ts
import type { InterventionId } from '../scenario/interventions';
import type { StormId } from '../scenario/storms';
import { COMBOS, costScale, DISPLAY, formatEffect, groupedInterventions } from './catalog';
import { effectOf } from './effects';
import { formatRM } from './format';
import { activePipes, selectionCost, type Selection } from './selection';

export interface InterventionPanel {
  refresh(): void;
  setDisabled(disabled: boolean): void;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Grouped, plain-language intervention list with effect badges, combos and a cost footer. */
export function mountInterventionPanel(el: HTMLElement, selection: Selection, storm: () => StormId): InterventionPanel {
  let disabled = false;

  const render = () => {
    const state = selection.state;
    const s = storm();
    const dis = disabled ? 'disabled' : '';
    const combos = COMBOS.map(
      (c, k) =>
        `<button class="combo" data-combo="${k}" ${dis} title="${esc(c.ids.map((id) => DISPLAY[id].label).join(' + '))}">${c.label}: ${c.hint}</button>`,
    ).join('');
    const groups = groupedInterventions()
      .map(({ group, items }) => {
        const rows = items
          .map((iv) => {
            const d = DISPLAY[iv.id];
            const eff = effectOf(s, iv.id);
            const f = eff ? formatEffect(eff.dSag) : null;
            const badge = f ? `<span class="effect ${f.tone}">${f.text}</span>` : '';
            const homes = eff ? ` · homes flooded ${eff.dHomes > 0 ? '+' : ''}${eff.dHomes} vs baseline` : '';
            const tip = esc(`${iv.description} · ${formatRM(iv.costRM)} (indicative)${homes}`);
            const on = state.interventions.includes(iv.id);
            return `<label class="iv-row${on ? ' on' : ''}" title="${tip}">
              <span class="iv-icon">${d.icon}</span>
              <span class="iv-text">
                <span class="iv-label">${d.label}</span>
                <span class="iv-sub"><span class="cost-scale">${'$'.repeat(costScale(iv.costRM))}</span> · ${iv.disruption.toLowerCase()} disruption <span class="info">ⓘ</span></span>
              </span>
              ${badge}
              <input type="checkbox" class="switch" data-id="${iv.id}" ${on ? 'checked' : ''} ${dis} />
            </label>`;
          })
          .join('');
        return `<div class="iv-group">${group}</div>${rows}`;
      })
      .join('');
    const installed = state.interventions.length + activePipes(state).length;
    el.innerHTML = `<div class="combos">${combos}</div>${groups}
      <div class="iv-footer"><span>${installed} installed</span><span>${formatRM(selectionCost(state))}</span></div>
      <p class="note">Badges: sag peak depth vs baseline for this storm. Costs are indicative placeholders.</p>`;
  };

  el.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const id = input.dataset.id as InterventionId | undefined;
    if (id && !disabled) selection.set(id, input.checked);
  });
  el.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-combo]');
    if (!btn || disabled) return;
    const combo = COMBOS[Number(btn.dataset.combo)];
    selection.applyCombo(combo.ids, combo.label);
  });

  render();
  return {
    refresh: render,
    setDisabled(b) {
      disabled = b;
      render();
    },
  };
}
```

- [ ] **Step 5: Panel styles**

Append to `src/ui/styles.css`:

```css
.combos { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.combo { font: inherit; font-size: 12px; padding: 4px 10px; border: 1px dashed #0b62c4; border-radius: 999px; background: #fff; color: #0b62c4; cursor: pointer; }
.combo:disabled { opacity: 0.5; cursor: default; }
.iv-group { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin: 10px 0 4px; }
.iv-row { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--line); border-radius: 8px; margin-bottom: 6px; cursor: pointer; }
.iv-row.on { border-color: #0b62c4; background: #f0f6ff; }
.iv-icon { width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; background: #eef2f6; flex: none; font-size: 15px; }
.iv-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.iv-label { font-weight: 600; }
.iv-sub { font-size: 11.5px; color: var(--muted); }
.cost-scale { color: #b38600; letter-spacing: 1px; font-weight: 600; }
.info { cursor: help; }
.effect { font-size: 11px; padding: 1px 6px; border-radius: 999px; white-space: nowrap; background: #eef2f6; color: #44505e; }
.effect.better { background: #e6f4ea; color: var(--better); }
.effect.worse { background: #fde8e7; color: var(--worse); }
input.switch { appearance: none; width: 32px; height: 18px; border-radius: 9px; background: #cfd6de; position: relative; flex: none; cursor: pointer; margin: 0; transition: background 0.15s; }
input.switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left 0.15s; }
input.switch:checked { background: #0b62c4; }
input.switch:checked::after { left: 16px; }
input.switch:disabled { opacity: 0.5; cursor: default; }
.iv-footer { display: flex; justify-content: space-between; margin-top: 8px; padding: 8px 10px; border-radius: 8px; background: var(--navy); color: #fff; font-size: 12.5px; }
```

- [ ] **Step 6: Verify and commit**

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass and tsc prints nothing. The panel isn't mounted yet; Task 7 does that.

```bash
git add src/ui/selection.ts src/ui/interventionPanel.ts src/ui/controls.ts src/ui/styles.css tests/ui/selection.test.ts
git commit -m "feat(ui): selection store and grouped intervention panel"
```

---

### Task 6: Rain, rain gauge and map pins in the scene

**Files:**
- Create: `src/render/rain.ts`, `src/render/pins.ts`, `src/ui/rainGauge.ts`
- Modify: `src/render/scene.ts` (full replacement below), `src/ui/styles.css` (append)
- Test: `tests/render/rain.test.ts`

**Interfaces:**
- Consumes: `Township`, `InterventionId`; `cellAt` (`src/scenario/terrain.ts`); `worldX/worldY/worldZ` (`src/render/coords.ts`); `rainIntensityAt`; `Storm`.
- Produces:
  - `RAIN_FULL_MMHR = 150`, `visibleStreaks(mmHr, count): number`, `class Rain`;
  - `PinItem`, `class PinLayer`;
  - `PinSpec = Omit<PinItem, 'position'> & { x; y }`;
  - `SceneHandle` gains `setRain(mmHr)`, `setPins(specs)`, `setInstalled(ids)`, `setPinsVisible(v)`, `setPinsDisabled(b)` and `onPinToggle(fn)`;
  - `mountRainGauge(el): { set(storm: Storm, t: number): void; clear(): void }`.

- [ ] **Step 1: Write the failing test**

Create `tests/render/rain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RAIN_FULL_MMHR, visibleStreaks } from '../../src/render/rain';

describe('visibleStreaks', () => {
  it('scales linearly with intensity and saturates at full rain', () => {
    expect(visibleStreaks(0, 6000)).toBe(0);
    expect(visibleStreaks(RAIN_FULL_MMHR / 2, 6000)).toBe(3000);
    expect(visibleStreaks(RAIN_FULL_MMHR, 6000)).toBe(6000);
    expect(visibleStreaks(400, 6000)).toBe(6000);
    expect(visibleStreaks(-5, 6000)).toBe(0);
  });
});
```

Run: `npx vitest run tests/render/rain.test.ts`
Expected: FAIL. `../../src/render/rain` cannot be resolved.

- [ ] **Step 2: Rain**

Create `src/render/rain.ts`:

```ts
import * as THREE from 'three';

export const RAIN_FULL_MMHR = 150;
const FALL_SPEED = 220; // world units per second
const STREAK = 7;

/** Number of streaks to draw: linear in intensity, all of them at RAIN_FULL_MMHR, none at 0. */
export function visibleStreaks(mmHr: number, count: number): number {
  return Math.round((Math.min(RAIN_FULL_MMHR, Math.max(0, mmHr)) / RAIN_FULL_MMHR) * count);
}

/** Falling rain streaks in a box over the township. Purely visual. */
export class Rain {
  readonly object: THREE.LineSegments;
  private readonly pos: Float32Array;
  private readonly geom = new THREE.BufferGeometry();
  private visible = 0;

  constructor(
    private readonly width: number,
    private readonly depth: number,
    private readonly top = 250,
    private readonly count = 6000,
  ) {
    this.pos = new Float32Array(count * 6);
    for (let k = 0; k < count; k++) this.respawn(k, Math.random() * top);
    this.geom.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geom.setDrawRange(0, 0);
    this.object = new THREE.LineSegments(this.geom, new THREE.LineBasicMaterial({ color: '#9ec3e6', transparent: true, opacity: 0.55 }));
    this.object.frustumCulled = false;
  }

  setIntensity(mmHr: number): void {
    this.visible = visibleStreaks(mmHr, this.count);
    this.geom.setDrawRange(0, this.visible * 2);
  }

  update(dtS: number): void {
    if (this.visible === 0) return;
    const dy = FALL_SPEED * Math.min(dtS, 0.1);
    for (let k = 0; k < this.visible; k++) {
      const o = k * 6;
      this.pos[o + 1] -= dy;
      this.pos[o + 4] -= dy;
      if (this.pos[o + 4] < 0) this.respawn(k, this.top);
    }
    (this.geom.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  private respawn(k: number, y: number): void {
    const x = (Math.random() - 0.5) * this.width;
    const z = (Math.random() - 0.5) * this.depth;
    const o = k * 6;
    this.pos[o] = x;
    this.pos[o + 1] = y + STREAK;
    this.pos[o + 2] = z;
    this.pos[o + 3] = x - 0.6;
    this.pos[o + 4] = y;
    this.pos[o + 5] = z;
  }
}
```

Run: `npx vitest run tests/render/rain.test.ts`
Expected: PASS.

- [ ] **Step 3: Pins**

Create `src/render/pins.ts`:

```ts
import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { InterventionId } from '../scenario/interventions';

export interface PinItem {
  id: InterventionId;
  icon: string;
  label: string;
  description: string;
  costText: string;
  disruption: string;
  position: THREE.Vector3;
}

/** HTML pins anchored to 3D positions, plus a single popover with an Install switch. */
export class PinLayer {
  readonly renderer = new CSS2DRenderer();
  readonly group = new THREE.Group();
  private readonly objects = new Map<InterventionId, CSS2DObject>();
  private readonly items = new Map<InterventionId, PinItem>();
  private installed = new Set<InterventionId>();
  private readonly popover: HTMLDivElement;
  private openId: InterventionId | null = null;
  private disabled = false;
  private visible = true;
  private onToggle: (id: InterventionId, on: boolean) => void = () => {};

  constructor(private readonly container: HTMLElement) {
    const dom = this.renderer.domElement;
    dom.className = 'pin-layer';
    Object.assign(dom.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    container.appendChild(dom);

    this.popover = document.createElement('div');
    this.popover.className = 'pin-popover';
    this.popover.hidden = true;
    container.appendChild(this.popover);

    this.popover.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (this.openId && input.matches('input.switch') && !this.disabled) this.onToggle(this.openId, input.checked);
    });
    document.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (this.openId && !this.popover.contains(target) && !target.closest('.pin')) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  setOnToggle(fn: (id: InterventionId, on: boolean) => void): void {
    this.onToggle = fn;
  }

  setItems(items: PinItem[]): void {
    for (const obj of this.objects.values()) this.group.remove(obj);
    this.objects.clear();
    this.items.clear();
    for (const it of items) {
      const btn = document.createElement('button');
      btn.className = 'pin';
      btn.title = it.label;
      btn.innerHTML = `<span class="pin-head"><span>${it.icon}</span></span>`;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.open(it.id, btn);
      });
      const obj = new CSS2DObject(btn);
      obj.position.copy(it.position);
      obj.visible = this.visible;
      this.group.add(obj);
      this.objects.set(it.id, obj);
      this.items.set(it.id, it);
    }
    this.applyInstalled();
  }

  setInstalled(ids: ReadonlySet<InterventionId>): void {
    this.installed = new Set(ids);
    this.applyInstalled();
    if (this.openId) this.renderPopover();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const obj of this.objects.values()) obj.visible = visible;
    if (!visible) this.close();
  }

  setDisabled(disabled: boolean): void {
    this.disabled = disabled;
    if (this.openId) this.renderPopover();
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  private applyInstalled(): void {
    for (const [id, obj] of this.objects) obj.element.classList.toggle('installed', this.installed.has(id));
  }

  private open(id: InterventionId, anchor: HTMLElement): void {
    this.openId = id;
    this.renderPopover();
    const a = anchor.getBoundingClientRect();
    const c = this.container.getBoundingClientRect();
    const left = Math.min(a.left - c.left + 24, c.width - 250);
    this.popover.style.left = `${Math.max(8, left)}px`;
    this.popover.style.top = `${Math.max(8, a.top - c.top - 10)}px`;
    this.popover.hidden = false;
  }

  private close(): void {
    this.openId = null;
    this.popover.hidden = true;
  }

  private renderPopover(): void {
    const it = this.openId ? this.items.get(this.openId) : undefined;
    if (!it) return;
    const on = this.installed.has(it.id);
    this.popover.innerHTML = `<h3>${it.icon} ${it.label}</h3>
      <div>${it.description}</div>
      <div class="chips"><span class="chip">${it.costText} (indicative)</span><span class="chip">${it.disruption} disruption</span></div>
      <label><input type="checkbox" class="switch" ${on ? 'checked' : ''} ${this.disabled ? 'disabled' : ''} /> ${on ? 'Installed' : 'Install'}</label>`;
  }
}
```

- [ ] **Step 4: Scene integration**

Replace `src/render/scene.ts` with:

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { InterventionId, Township } from '../scenario/interventions';
import { cellAt } from '../scenario/terrain';
import type { Frame } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';
import { NetworkView } from './network';
import { PinLayer, type PinItem } from './pins';
import { Rain } from './rain';
import { createTerrainMesh } from './terrain';
import { WaterSurface } from './water';

export type PinSpec = Omit<PinItem, 'position'> & { x: number; y: number };

export interface SceneHandle {
  canvas: HTMLCanvasElement;
  setTownship(t: Township): void;
  showFrame(f: Frame | null): void;
  /** ndc in [-1, 1]; returns the id of the drain node under the pointer, if any. */
  pickNode(ndcX: number, ndcY: number): string | null;
  setRain(mmHr: number): void;
  setPins(specs: PinSpec[]): void;
  setInstalled(ids: ReadonlySet<InterventionId>): void;
  setPinsVisible(visible: boolean): void;
  setPinsDisabled(disabled: boolean): void;
  onPinToggle(fn: (id: InterventionId, on: boolean) => void): void;
}

const PIN_LIFT = 14; // world units above ground

export function createScene(container: HTMLElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#cfe3f3');
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 5000);
  camera.position.set(-120, 380, 520);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 20, 0);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(200, 400, 100);
  scene.add(sun);

  const pins = new PinLayer(container);
  scene.add(pins.group);

  let township: Township | null = null;
  let terrain: THREE.Mesh | null = null;
  let water: WaterSurface | null = null;
  let network: NetworkView | null = null;
  let rain: Rain | null = null;
  let frame: Frame | null = null;
  let pinSpecs: PinSpec[] | null = null;
  let pinsBuilt = false;

  const buildPins = () => {
    if (!township || !pinSpecs) return;
    const g = township.grid;
    pins.setItems(
      pinSpecs.map(({ x, y, ...rest }) => ({
        ...rest,
        position: new THREE.Vector3(worldX(g, x), worldY(g.z[cellAt(x, y)]) + PIN_LIFT, worldZ(g, y)),
      })),
    );
    pinsBuilt = true;
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h);
    pins.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(container);
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    controls.update();
    rain?.update(dt);
    network?.update(frame, clock.elapsedTime);
    renderer.render(scene, camera);
    pins.render(scene, camera);
  });

  const raycaster = new THREE.Raycaster();

  return {
    canvas: renderer.domElement,
    setTownship(t) {
      if (terrain) {
        scene.remove(terrain);
        terrain.geometry.dispose();
      }
      if (water) {
        scene.remove(water.mesh);
        water.dispose();
      }
      if (network) {
        scene.remove(network.group);
        network.dispose();
      }
      township = t;
      terrain = createTerrainMesh(t.grid);
      water = new WaterSurface(t.grid);
      network = new NetworkView(t.grid, t.network);
      scene.add(terrain, water.mesh, network.group);
      if (!rain) {
        rain = new Rain(t.grid.nx * t.grid.dx, t.grid.ny * t.grid.dx);
        scene.add(rain.object);
      }
      if (!pinsBuilt) buildPins();
      frame = null;
    },
    showFrame(f) {
      frame = f;
      if (water && township) water.update(f ? f.depth : township.grid.h0);
    },
    pickNode(ndcX, ndcY) {
      if (!network) return null;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
      const hit = raycaster.intersectObjects(network.nodeMeshes, false)[0];
      return hit ? (hit.object.userData.nodeId as string) : null;
    },
    setRain(mmHr) {
      rain?.setIntensity(mmHr);
    },
    setPins(specs) {
      pinSpecs = specs;
      buildPins();
    },
    setInstalled(ids) {
      pins.setInstalled(ids);
    },
    setPinsVisible(v) {
      pins.setVisible(v);
    },
    setPinsDisabled(b) {
      pins.setDisabled(b);
    },
    onPinToggle(fn) {
      pins.setOnToggle(fn);
    },
  };
}
```

- [ ] **Step 5: Rain gauge**

Create `src/ui/rainGauge.ts`:

```ts
import { rainIntensityAt } from '../scenario/storms';
import type { Storm } from '../sim/types';

/** "🌧 NN mm/hr" readout plus a mini hyetograph with the current 5-minute block highlighted. */
export function mountRainGauge(el: HTMLElement): { set(storm: Storm, t: number): void; clear(): void } {
  let lastKey = '';
  return {
    set(storm, t) {
      const mm = Math.round(rainIntensityAt(storm, t));
      const block = Math.floor(t / storm.blockS);
      const key = `${storm.id}|${mm}|${block}`;
      if (key === lastKey) return;
      lastKey = key;
      const max = Math.max(...storm.intensity);
      const bars = storm.intensity
        .map((v, k) => `<i class="${k === block ? 'now' : ''}" style="height:${Math.max(2, (v / max) * 28).toFixed(1)}px"></i>`)
        .join('');
      el.hidden = false;
      el.innerHTML = `<div class="rg-value">🌧 ${mm} mm/hr</div><div class="rg-bars">${bars}</div>`;
    },
    clear() {
      lastKey = '';
      el.hidden = true;
      el.innerHTML = '';
    },
  };
}
```

- [ ] **Step 6: Styles**

Append to `src/ui/styles.css`:

```css
.pin { background: none; border: 0; padding: 0; cursor: pointer; pointer-events: auto; }
.pin-head { width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid #8a94a3; background: #ffffffd9; display: grid; place-items: center; box-shadow: 0 2px 6px #0003; }
.pin-head > span { transform: rotate(45deg); font-size: 14px; }
.pin.installed .pin-head { background: #0b62c4; border-color: #0b62c4; }
.pin-popover { position: absolute; z-index: 5; width: 240px; background: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 6px 20px #0003; font-size: 12.5px; }
.pin-popover h3 { margin: 0 0 4px; font-size: 14px; }
.pin-popover .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.pin-popover .chip { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: #eef2f6; }
.pin-popover label { display: flex; align-items: center; gap: 8px; font-weight: 600; cursor: pointer; }
.rain-gauge { position: absolute; right: 12px; top: 12px; background: #ffffffdd; border-radius: 8px; padding: 6px 10px; font-size: 12px; z-index: 4; }
.rg-value { font-weight: 600; font-variant-numeric: tabular-nums; }
.rg-bars { display: flex; align-items: flex-end; gap: 1px; height: 30px; margin-top: 4px; }
.rg-bars i { width: 4px; background: #9ec3e6; border-radius: 1px; }
.rg-bars i.now { background: #0b62c4; }
.pins-toggle { position: absolute; right: 12px; bottom: 12px; z-index: 4; background: #ffffffdd; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; font: inherit; font-size: 12px; cursor: pointer; }
[hidden] { display: none !important; }
```

- [ ] **Step 7: Verify and commit**

Run: `npm test`, `npx tsc --noEmit` and `npx vite build` (then delete `dist/`).
Expected: all pass. `main.ts` still compiles, because only methods were added to `SceneHandle`.

```bash
git add src/render/rain.ts src/render/pins.ts src/render/scene.ts src/ui/rainGauge.ts src/ui/styles.css tests/render/rain.test.ts
git commit -m "feat(render): rain streaks, rain gauge, intervention map pins"
```

---

### Task 7: Split `main.ts`; wire the panel, pins and rain into Compare

This is a behaviour-preserving refactor plus the new panel, pins and rain. Compare is still the only mode; Task 8 adds the tabs.

**Files:**
- Create: `src/ui/drawPipes.ts`, `src/ui/compareMode.ts`
- Modify: `src/ui/player.ts` (add `setEnabled`), `src/ui/controls.ts` (delete `renderControls`), `index.html` (viewport overlays), `src/main.ts` (full replacement)

**Interfaces:**
- Consumes: everything from Tasks 1, 5 and 6; `SimRunner`, `SimRunError`, `WorkerLike` (`src/ui/runner.ts`); `Player`; `renderResults`, `renderBalance`, `clearResults`; `renderSagChart`, `clearSagChart`.
- Produces:
  - `mountDrawPipes(opts): { setDisabled(b): void; renderList(): void }`;
  - `createCompareMode(opts): { enter(): void; leave(): void; isBusy(): boolean }`;
  - `Player.setEnabled(on: boolean)`.

- [ ] **Step 1: `Player.setEnabled`**

In `src/ui/player.ts`, add the field `private enabled = true;` next to the other fields, and add this method after `push`:

```ts
  /** While disabled the player neither advances nor draws (the other mode owns the view). Re-enabling redraws the current frame. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (on && this.frames.length) this.seek(Math.min(this.idx, this.frames.length - 1));
  }
```

Change the first line of `tick()` to:

```ts
    if (!this.enabled) return;
```

so that it is followed by the existing `if (this.playing && this.idx < this.frames.length) { … }`.

- [ ] **Step 2: Draw pipes module**

Create `src/ui/drawPipes.ts`:

```ts
import type { SceneHandle } from '../render/scene';
import { buildTownship, customPipeCost } from '../scenario/index';
import { activePipes, type Selection } from './selection';

export interface DrawPipes {
  setDisabled(disabled: boolean): void;
  renderList(): void;
}

export interface DrawPipesOptions {
  view: SceneHandle;
  selection: Selection;
  status: (text: string, error?: boolean) => void;
  onDrawingChange: (drawing: boolean) => void;
}

/** Draw-a-pipe: click two manholes; validates uphill, duplicate, reverse, self and missing-node pipes. */
export function mountDrawPipes(o: DrawPipesOptions): DrawPipes {
  const drawBtn = document.getElementById('draw') as HTMLButtonElement;
  const pipeSel = document.getElementById('pipe-d') as HTMLSelectElement;
  const list = document.getElementById('custom-list') as HTMLElement;
  let drawing = false;
  let pending: string | null = null;
  let disabled = false;
  let downAt: { x: number; y: number } | null = null;

  const setDrawing = (d: boolean) => {
    drawing = d;
    pending = null;
    drawBtn.textContent = `Draw pipe: ${d ? 'click two manholes' : 'off'}`;
    drawBtn.classList.toggle('active', d);
    o.onDrawingChange(d);
  };

  const renderList = () => {
    try {
      const state = o.selection.state;
      const active = activePipes(state);
      const t = buildTownship(state.interventions, active);
      list.innerHTML = state.custom
        .map((c, k) => {
          const btn = `<button data-k="${k}" ${disabled ? 'disabled' : ''}>✕</button>`;
          const isActive = active.some((a) => a.from === c.from && a.to === c.to);
          return isActive
            ? `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm · RM ${(customPipeCost(t, c) / 1e6).toFixed(2)}M ${btn}</li>`
            : `<li>${c.from} → ${c.to}, ${c.diameter * 1000} mm (inactive — node not in scenario) ${btn}</li>`;
        })
        .join('');
    } catch (e) {
      o.status(`Could not list custom pipes: ${e instanceof Error ? e.message : String(e)}`, true);
    }
  };

  drawBtn.addEventListener('click', () => {
    if (!disabled) setDrawing(!drawing);
  });

  list.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).dataset.k;
    if (disabled || k === undefined) return;
    o.selection.removePipe(Number(k));
  });

  o.view.canvas.addEventListener('pointerdown', (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });

  o.view.canvas.addEventListener('click', (e) => {
    if (!drawing || disabled) return;
    if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 5) return; // orbit drag, not a click
    const r = o.view.canvas.getBoundingClientRect();
    const id = o.view.pickNode(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (!id) return;
    if (pending === null) {
      pending = id;
      o.status(`From ${id} — now click the downstream manhole.`);
      return;
    }
    if (id === pending) {
      o.status('A pipe needs two different manholes.', true);
      return;
    }
    const from = pending;
    const state = o.selection.state;
    const inverts = new Map(buildTownship(state.interventions).network.nodes.map((n) => [n.id, n.invert]));
    const fromInv = inverts.get(from);
    const toInv = inverts.get(id);
    if (fromInv === undefined || toInv === undefined) {
      pending = null;
      o.status('That manhole is not part of the current scenario.', true);
      return;
    }
    if (state.custom.some((c) => c.from === from && c.to === id)) {
      o.status(`Pipe ${from} → ${id} already exists.`, true);
      return;
    }
    if (state.custom.some((c) => c.from === id && c.to === from)) {
      o.status(`A pipe ${id} → ${from} already exists; a reverse pipe would be redundant.`, true);
      return;
    }
    if (toInv > fromInv) {
      o.status(`Pipe would run uphill (from invert ${fromInv.toFixed(2)} m to ${toInv.toFixed(2)} m) — pick a lower downstream manhole.`, true);
      return;
    }
    pending = null;
    o.selection.addPipe({ from, to: id, diameter: Number(pipeSel.value) });
    o.status('Pipe added.');
  });

  renderList();
  return {
    setDisabled(b) {
      disabled = b;
      drawBtn.disabled = b;
      pipeSel.disabled = b;
      if (b && drawing) setDrawing(false);
      renderList();
    },
    renderList,
  };
}
```

- [ ] **Step 3: Compare mode module**

Create `src/ui/compareMode.ts`:

```ts
import type { SceneHandle } from '../render/scene';
import { buildTownship } from '../scenario/index';
import type { StormId } from '../scenario/storms';
import { clearSagChart, renderSagChart } from './chart';
import { Player } from './player';
import { clearResults, renderBalance, renderResults } from './results';
import { SimRunError, SimRunner, type WorkerLike } from './runner';
import { activePipes, selectionCost, type Selection } from './selection';

export interface CompareMode {
  enter(): void;
  leave(): void;
  isBusy(): boolean;
}

export interface CompareOptions {
  view: SceneHandle;
  selection: Selection;
  storm: () => StormId;
  status: (text: string, error?: boolean) => void;
  /** Called with true while a run is in progress so the shell can lock shared controls. */
  setBusy: (busy: boolean) => void;
  showRain: (storm: StormId, t: number) => void;
}

/** Fair baseline-vs-scenario runs (the original Run storm flow). */
export function createCompareMode(o: CompareOptions): CompareMode {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const runner = new SimRunner(
    () => new Worker(new URL('../worker/sim.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike,
  );
  let shownStorm: StormId = o.storm();
  const player = new Player($('scrubber'), $('clock'), $('play'), (f) => {
    o.view.showFrame(f);
    o.showRain(shownStorm, f.t);
  });
  const runBtn = $<HTMLButtonElement>('run');
  let busy = false;

  const setBusy = (b: boolean) => {
    busy = b;
    runBtn.disabled = b;
    o.setBusy(b);
  };

  const errorStatus = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    o.status(
      e instanceof SimRunError && e.step >= 0
        ? `Simulation stopped at step ${e.step}: ${msg}`
        : `Simulation failed: ${msg}. Click Run to retry; cached results still replay.`,
      true,
    );
  };

  const preloadBaseline = () => {
    const storm = o.storm();
    if (busy || runner.isCached([], storm)) return;
    setBusy(true);
    o.status('Simulating baseline…');
    shownStorm = storm;
    player.reset();
    runner
      .run([], storm, (f) => player.push(f))
      .then(() => o.status('Baseline ready. Pick interventions and click Run storm.'))
      .catch(errorStatus)
      .finally(() => setBusy(false));
  };

  runBtn.addEventListener('click', async () => {
    if (busy) return;
    // Snapshot inputs so later edits cannot corrupt this run.
    const state = o.selection.state;
    const ids = state.interventions;
    const pipes = activePipes(state);
    const storm = o.storm();
    setBusy(true);
    clearResults($('cards'), $('balance'));
    clearSagChart();
    try {
      if (!runner.isCached([], storm)) o.status('Simulating baseline…');
      const base = await runner.run([], storm);
      o.view.setTownship(buildTownship(ids, pipes));
      shownStorm = storm;
      player.reset();
      o.status(ids.length || pipes.length ? 'Simulating scenario…' : 'Replaying baseline…');
      const cur = await runner.run(ids, storm, (f) => player.push(f), pipes);
      renderResults($('cards'), base.metrics, cur.metrics, selectionCost({ interventions: ids, custom: pipes }));
      renderSagChart($('chart'), base.metrics, cur.metrics);
      renderBalance($('balance'), base.metrics.balance.error, cur.metrics.balance.error);
      o.status('Done.');
    } catch (e) {
      errorStatus(e);
    } finally {
      setBusy(false);
    }
  });

  return {
    enter() {
      player.setEnabled(true);
      preloadBaseline();
    },
    leave() {
      player.setEnabled(false);
    },
    isBusy: () => busy,
  };
}
```

- [ ] **Step 4: Remove `renderControls`**

In `src/ui/controls.ts`, delete the `renderControls` function and any imports only it used (`INTERVENTIONS`, `InterventionId`, `formatRM`). Keep `renderStormSelect`.

- [ ] **Step 5: Viewport overlays**

In `index.html`, inside `<div id="viewport">` and after the legend `</div>`, add:

```html
        <div id="rain-gauge" class="rain-gauge" hidden></div>
        <button id="pins-toggle" class="pins-toggle">📍 Pins: on</button>
```

- [ ] **Step 6: New `main.ts`**

Replace `src/main.ts` with:

```ts
import './ui/styles.css';
import { createScene } from './render/scene';
import { buildTownship } from './scenario/index';
import { INTERVENTIONS } from './scenario/interventions';
import { rainIntensityAt, STORMS, type StormId } from './scenario/storms';
import { renderAssumptions } from './ui/assumptions';
import { DISPLAY } from './ui/catalog';
import { createCompareMode } from './ui/compareMode';
import { renderStormSelect } from './ui/controls';
import { mountDrawPipes } from './ui/drawPipes';
import { formatRM } from './ui/format';
import { mountInterventionPanel } from './ui/interventionPanel';
import { mountRainGauge } from './ui/rainGauge';
import { activePipes, Selection } from './ui/selection';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = createScene($('viewport'));
const selection = new Selection();
const stormSel = $<HTMLSelectElement>('storm');
const storm = renderStormSelect(stormSel);
const gauge = mountRainGauge($('rain-gauge'));

const status = (text: string, error = false) => {
  const el = $('status');
  el.textContent = text;
  el.className = `status${error ? ' error' : ''}`;
};

const showRain = (s: StormId, t: number) => {
  view.setRain(rainIntensityAt(STORMS[s], t));
  gauge.set(STORMS[s], t);
};

const syncTownship = () => {
  const st = selection.state;
  view.setTownship(buildTownship(st.interventions, activePipes(st)));
  view.setInstalled(new Set(st.interventions));
};

syncTownship();
view.setPins(
  INTERVENTIONS.map((iv) => ({
    id: iv.id,
    icon: DISPLAY[iv.id].icon,
    label: DISPLAY[iv.id].label,
    description: iv.description,
    costText: formatRM(iv.costRM),
    disruption: iv.disruption,
    x: DISPLAY[iv.id].site.x,
    y: DISPLAY[iv.id].site.y,
  })),
);
view.onPinToggle((id, on) => selection.set(id, on));

const panel = mountInterventionPanel($('interventions'), selection, storm);

let pinsOn = true;
let drawingNow = false;
const pinsBtn = $<HTMLButtonElement>('pins-toggle');
const applyPinVisibility = () => view.setPinsVisible(pinsOn && !drawingNow);
pinsBtn.addEventListener('click', () => {
  pinsOn = !pinsOn;
  pinsBtn.textContent = `📍 Pins: ${pinsOn ? 'on' : 'off'}`;
  applyPinVisibility();
});

const draw = mountDrawPipes({
  view,
  selection,
  status,
  onDrawingChange: (d) => {
    drawingNow = d;
    applyPinVisibility();
  },
});

const setBusy = (b: boolean) => {
  stormSel.disabled = b;
  panel.setDisabled(b);
  draw.setDisabled(b);
  view.setPinsDisabled(b);
};

const compare = createCompareMode({ view, selection, storm, status, setBusy, showRain });

selection.subscribe(() => {
  syncTownship();
  panel.refresh();
  draw.renderList();
});

const updateStormNote = () => {
  const note = $('storm-note');
  const provisional = STORMS[storm()].provisional;
  note.textContent = provisional ? 'Rainfall coefficients are PROVISIONAL — see assumptions.' : 'Rainfall from MSMA 2nd Ed.';
  note.className = `note${provisional ? ' warn' : ''}`;
};
stormSel.addEventListener('change', () => {
  updateStormNote();
  panel.refresh();
});
updateStormNote();

renderAssumptions($('assumptions-body'));
$('assumptions-btn').addEventListener('click', () => $<HTMLDialogElement>('assumptions').showModal());
$('assumptions-close').addEventListener('click', () => $<HTMLDialogElement>('assumptions').close());

compare.enter();
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit`, `npm test` and `npx vite build` (then delete `dist/`).
Expected: all pass.

Check by reading that every id used is present in `index.html`:

| Used by | Ids |
|---|---|
| `main.ts` | `viewport`, `storm`, `rain-gauge`, `status`, `interventions`, `pins-toggle`, `storm-note`, `assumptions-body`, `assumptions-btn`, `assumptions-close`, `assumptions` |
| `compareMode.ts` | `scrubber`, `clock`, `play`, `run`, `cards`, `balance`, `chart` |
| `drawPipes.ts` | `draw`, `pipe-d`, `custom-list` |

```bash
git add src/ui/player.ts src/ui/drawPipes.ts src/ui/compareMode.ts src/ui/controls.ts index.html src/main.ts
git commit -m "refactor(ui): split main into compare mode and draw-pipes; mount panel, pins and rain"
```

---

### Task 8: Live mode and the Live | Compare tabs

**Files:**
- Create: `src/ui/liveChart.ts`, `src/ui/liveMode.ts`
- Modify: `index.html` (full replacement), `src/ui/styles.css` (append), `src/main.ts` (full replacement)

**Interfaces:**
- Consumes: `LiveCommand`, `LiveMessage` (Task 3); `Selection`, `activePipes`, `selectionCost` (Task 5); `SceneHandle` (Task 6); `createCompareMode`, `mountDrawPipes` (Task 7); `formatRM`.
- Produces:
  - `createLiveChart(el): { reset(): void; push(tMin, depth): void; annotate(tMin, label): void }`;
  - `createLiveMode(opts): { enter(): void; leave(): void; onSelectionChange(label: string): void; onStormChange(): void }`.

- [ ] **Step 1: Live chart**

Create `src/ui/liveChart.ts`:

```ts
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
```

- [ ] **Step 2: Live mode**

Create `src/ui/liveMode.ts`:

```ts
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
```

- [ ] **Step 3: Final `index.html`**

Replace `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Township Flood Simulator</title>
  </head>
  <body>
    <header class="top">
      <h1>Township Flood Simulator</h1>
      <span class="tag">Sime Darby Property University Hackathon 2026 · Planet · Climate Resilience</span>
      <button id="assumptions-btn">Show assumptions</button>
    </header>
    <main class="layout">
      <aside class="panel">
        <div class="tabs">
          <button id="tab-live" class="tab active">Live</button>
          <button id="tab-compare" class="tab">Compare</button>
        </div>
        <h2>Storm</h2>
        <select id="storm"></select>
        <p id="storm-note" class="note"></p>

        <section id="live-controls">
          <div id="live-clock" class="big-clock">0 min</div>
          <div class="live-row">
            <button id="live-play" class="secondary">Pause</button>
            <button id="live-restart" class="secondary">Restart</button>
          </div>
          <div id="live-speed" class="seg">
            <button data-speed="0.5">½×</button>
            <button data-speed="1" class="active">1×</button>
            <button data-speed="2">2×</button>
            <button data-speed="4">4×</button>
          </div>
          <div id="live-seek" class="seg seg3">
            <button data-seek="0">Start</button>
            <button data-seek="60">Peak rain</button>
            <button data-seek="120">Rain stops</button>
          </div>
        </section>

        <section id="compare-controls" hidden>
          <button id="run" class="primary">Run storm</button>
          <h2>Timeline</h2>
          <input id="scrubber" type="range" min="0" max="0" value="0" />
          <div id="clock">0 min</div>
          <button id="play" class="secondary">Pause</button>
        </section>

        <h2>Interventions</h2>
        <div id="interventions"></div>

        <h2>Custom pipes</h2>
        <select id="pipe-d">
          <option value="0.3">300 mm</option>
          <option value="0.45">450 mm</option>
          <option value="0.6" selected>600 mm</option>
          <option value="0.9">900 mm</option>
        </select>
        <button id="draw" class="secondary">Draw pipe: off</button>
        <ul id="custom-list" class="custom-list"></ul>
        <p id="status" class="status"></p>
      </aside>
      <div id="viewport">
        <div class="legend">
          <div><i style="background: linear-gradient(90deg, #9fd3ff, #08306b)"></i>Water depth 0 → 1 m+</div>
          <div><i style="background: linear-gradient(90deg, #2ecc71, #f1c40f, #e74c3c)"></i>Pipe load 0 → full</div>
          <div><i style="background: #e74c3c"></i>Pulsing = manhole overflowing</div>
        </div>
        <div id="rain-gauge" class="rain-gauge" hidden></div>
        <button id="pins-toggle" class="pins-toggle">📍 Pins: on</button>
      </div>
      <aside class="panel right">
        <section id="live-results">
          <h2>Live readouts</h2>
          <div id="live-cards"><p class="note">Starting the storm…</p></div>
          <h2>Sag depth so far</h2>
          <div id="live-chart"></div>
          <div id="live-balance"></div>
        </section>
        <section id="compare-results" hidden>
          <h2>Results vs baseline</h2>
          <div id="cards"><p class="note">Run a storm to see results.</p></div>
          <h2>Water depth at the sag</h2>
          <div id="chart"></div>
          <div id="balance"></div>
        </section>
      </aside>
    </main>
    <dialog id="assumptions">
      <div id="assumptions-body"></div>
      <button id="assumptions-close" class="secondary">Close</button>
    </dialog>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 4: Styles**

Append to `src/ui/styles.css`:

```css
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: #eef2f6; padding: 4px; border-radius: 8px; }
.tab { border: 0; background: none; padding: 7px; border-radius: 6px; font: inherit; font-weight: 600; color: var(--muted); cursor: pointer; }
.tab.active { background: #fff; color: var(--ink); box-shadow: 0 1px 3px #0002; }
.tab:disabled { cursor: default; opacity: 0.6; }
.big-clock { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; margin: 10px 0 4px; }
.live-row { display: flex; gap: 6px; }
.live-row button { flex: 1; }
.seg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 6px; }
.seg.seg3 { grid-template-columns: repeat(3, 1fr); }
.seg button { padding: 5px; border: 1px solid var(--line); border-radius: 6px; background: #fff; cursor: pointer; font: inherit; font-size: 12.5px; }
.seg button.active { background: var(--navy); color: #fff; border-color: var(--navy); }
#live-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
```

- [ ] **Step 5: Final `main.ts`**

Replace `src/main.ts` with:

```ts
import './ui/styles.css';
import { createScene } from './render/scene';
import { buildTownship } from './scenario/index';
import { INTERVENTIONS } from './scenario/interventions';
import { rainIntensityAt, STORMS, type StormId } from './scenario/storms';
import { renderAssumptions } from './ui/assumptions';
import { DISPLAY } from './ui/catalog';
import { createCompareMode } from './ui/compareMode';
import { renderStormSelect } from './ui/controls';
import { mountDrawPipes } from './ui/drawPipes';
import { formatRM } from './ui/format';
import { mountInterventionPanel } from './ui/interventionPanel';
import { createLiveMode } from './ui/liveMode';
import { mountRainGauge } from './ui/rainGauge';
import { activePipes, Selection } from './ui/selection';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const view = createScene($('viewport'));
const selection = new Selection();
const stormSel = $<HTMLSelectElement>('storm');
const storm = renderStormSelect(stormSel);
const gauge = mountRainGauge($('rain-gauge'));

const status = (text: string, error = false) => {
  const el = $('status');
  el.textContent = text;
  el.className = `status${error ? ' error' : ''}`;
};

const showRain = (s: StormId, t: number) => {
  view.setRain(rainIntensityAt(STORMS[s], t));
  gauge.set(STORMS[s], t);
};

const syncTownship = () => {
  const st = selection.state;
  view.setTownship(buildTownship(st.interventions, activePipes(st)));
  view.setInstalled(new Set(st.interventions));
};

syncTownship();
view.setPins(
  INTERVENTIONS.map((iv) => ({
    id: iv.id,
    icon: DISPLAY[iv.id].icon,
    label: DISPLAY[iv.id].label,
    description: iv.description,
    costText: formatRM(iv.costRM),
    disruption: iv.disruption,
    x: DISPLAY[iv.id].site.x,
    y: DISPLAY[iv.id].site.y,
  })),
);
view.onPinToggle((id, on) => selection.set(id, on));

const panel = mountInterventionPanel($('interventions'), selection, storm);

let pinsOn = true;
let drawingNow = false;
const pinsBtn = $<HTMLButtonElement>('pins-toggle');
const applyPinVisibility = () => view.setPinsVisible(pinsOn && !drawingNow);
pinsBtn.addEventListener('click', () => {
  pinsOn = !pinsOn;
  pinsBtn.textContent = `📍 Pins: ${pinsOn ? 'on' : 'off'}`;
  applyPinVisibility();
});

const draw = mountDrawPipes({
  view,
  selection,
  status,
  onDrawingChange: (d) => {
    drawingNow = d;
    applyPinVisibility();
  },
});

const tabLive = $<HTMLButtonElement>('tab-live');
const tabCompare = $<HTMLButtonElement>('tab-compare');

/** Locks shared controls while a Compare run is in progress. */
const setBusy = (b: boolean) => {
  stormSel.disabled = b;
  tabLive.disabled = b;
  tabCompare.disabled = b;
  panel.setDisabled(b);
  draw.setDisabled(b);
  view.setPinsDisabled(b);
};

const compare = createCompareMode({ view, selection, storm, status, setBusy, showRain });
const live = createLiveMode({ view, selection, storm, status, showRain });

type Mode = 'live' | 'compare';
let mode: Mode = 'live';

const setMode = (m: Mode) => {
  if (m === mode || compare.isBusy()) return;
  (mode === 'live' ? live : compare).leave();
  mode = m;
  tabLive.classList.toggle('active', m === 'live');
  tabCompare.classList.toggle('active', m === 'compare');
  $('live-controls').hidden = m !== 'live';
  $('live-results').hidden = m !== 'live';
  $('compare-controls').hidden = m !== 'compare';
  $('compare-results').hidden = m !== 'compare';
  syncTownship();
  view.setRain(0);
  gauge.clear();
  (m === 'live' ? live : compare).enter();
};
tabLive.addEventListener('click', () => setMode('live'));
tabCompare.addEventListener('click', () => setMode('compare'));

selection.subscribe((_state, label) => {
  syncTownship();
  panel.refresh();
  draw.renderList();
  live.onSelectionChange(label);
});

const updateStormNote = () => {
  const note = $('storm-note');
  const provisional = STORMS[storm()].provisional;
  note.textContent = provisional ? 'Rainfall coefficients are PROVISIONAL — see assumptions.' : 'Rainfall from MSMA 2nd Ed.';
  note.className = `note${provisional ? ' warn' : ''}`;
};
stormSel.addEventListener('change', () => {
  updateStormNote();
  panel.refresh();
  if (mode === 'live') live.onStormChange();
});
updateStormNote();

renderAssumptions($('assumptions-body'));
$('assumptions-btn').addEventListener('click', () => $<HTMLDialogElement>('assumptions').showModal());
$('assumptions-close').addEventListener('click', () => $<HTMLDialogElement>('assumptions').close());

live.enter();
```

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`, `npm test` and `npx vite build` (then delete `dist/`).
Expected: all pass. The build emits both `sim.worker-*.js` and `live.worker-*.js`.

Check by reading that every `getElementById` id in `main.ts`, `liveMode.ts`, `compareMode.ts` and `drawPipes.ts` exists in `index.html`.

```bash
git add src/ui/liveChart.ts src/ui/liveMode.ts index.html src/ui/styles.css src/main.ts
git commit -m "feat(ui): live sandbox mode with mid-storm changes and Live | Compare tabs"
```

---

### Task 9: README, assumptions and browser checklist

**Files:**
- Modify: `README.md`, `src/ui/assumptions.ts`
- Create: `docs/browser-checklist.md`

- [ ] **Step 1: Assumptions row**

In `src/ui/assumptions.ts`, add this row to the `rows` array, before the `Costs` row:

```ts
    ['Live mode', 'Changes made mid-storm are applied in place (water kept where it is); use Compare for fair before/after numbers. Effect badges are pre-computed single-intervention runs (npm run effects).'],
```

- [ ] **Step 2: README**

In `README.md`:
- Under the first paragraph, add a **Modes** section:
  - **Live:** the storm plays continuously at ½–4×; switching interventions or drawing pipes changes the flood in place.
  - **Compare:** fair baseline vs scenario runs with cost.
- Add `npm run effects   # regenerate intervention effect badges (~9 min)` to the Run block.
- Change the `npm run story` comment to `# demo-story + effects drift checks (~15 min)`.

- [ ] **Step 3: Browser checklist**

Create `docs/browser-checklist.md` containing:

```markdown
# Browser checklist

Run `npm run dev`, open http://localhost:5173.

## Live (default)
1. Page load: storm starts immediately; rain streaks fall; gauge shows mm/hr with the current bar highlighted; clock counts up ~1 min/s.
2. Speed ½× / 2× / 4×: clock rate changes accordingly.
3. Pause / Resume: water and clock freeze and continue.
4. "Peak rain": status says fast-forwarding, then the clock shows 60 min and rain is heaviest.
5. "Rain stops": at 120 min rain streaks disappear; water keeps draining.
6. Toggle "One-way valve" around 60–80 min: chart gets a "+ valve @ N min" marker and the sag depth trend changes within a few seconds.
7. Toggle the tank off mid-storm: no error; water balance badge stays ✓.
8. Draw a pipe (SL0 → O) mid-storm: it appears and the chart gets a "+ pipe SL0→O" marker.
9. Click "Cheapest fix" combo: valve + tank switch on, footer shows 2 installed · RM 2.65M.
10. Storm reaches 180 min: status "Storm over", Play button reads Restart.
11. Change storm to 10-year: run restarts; badges update.

## Panel and pins
12. Groups appear in order; badges green/red/grey as expected (bigger drain red).
13. Hover ⓘ: tooltip shows description, RM cost, homes change.
14. Click a map pin: popover with Install switch; toggling it updates the panel switch and pin colour (blue = installed). Esc / outside click closes it.
15. "Pins: off" hides pins; Draw mode hides them temporarily.

## Compare
16. Switch to Compare: live pauses; baseline preloads; Run storm works exactly as before (cards, chart, both balances).
17. During a Compare run tabs, panel, pins and draw are disabled.
18. Back to Live: resumes; any changes made in Compare are applied with a "changes" marker.

## Build
19. `npm run build && npm run preview`: both workers load; Live and Compare work.
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`, `npm test` and `npm run build` (then delete `dist/`).
Expected: all pass.

```bash
git add README.md src/ui/assumptions.ts docs/browser-checklist.md
git commit -m "docs: live mode in README, assumptions row, browser checklist"
```
