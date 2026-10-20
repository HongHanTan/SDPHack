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
    const next = new Set(ids);
    if (next.size === this.ids.size && [...next].every((id) => this.ids.has(id))) return;
    this.ids = next;
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
