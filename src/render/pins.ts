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

  closePopover(): void {
    this.close();
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
