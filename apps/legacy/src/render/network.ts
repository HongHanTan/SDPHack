import * as THREE from 'three';
import type { DrainNode, Frame, Grid, Network } from '@floodops/engine/sim/types';
import { worldX, worldY, worldZ } from './coords';
import { FlowRibbons } from './flowRibbons';

const GREEN = new THREE.Color('#2ecc71');
const YELLOW = new THREE.Color('#f1c40f');
const RED = new THREE.Color('#e74c3c');
const NODE_OK = new THREE.Color('#34495e');
const NODE_XRAY = new THREE.Color('#e8f6ff');
const LIFT = 3; // day mode: draw the network 3 world units above ground so it is visible

export type NetworkMode = 'day' | 'xray' | 'plan';

export function loadColor(load: number, out = new THREE.Color()): THREE.Color {
  const t = Math.min(1, Math.max(0, load));
  return t < 0.5 ? out.copy(GREEN).lerp(YELLOW, t * 2) : out.copy(YELLOW).lerp(RED, (t - 0.5) * 2);
}

export class NetworkView {
  readonly group = new THREE.Group();
  readonly nodeMeshes: THREE.Mesh[] = [];
  private readonly pipeMeshes: THREE.Mesh[] = [];
  private readonly xray: FlowRibbons;
  private readonly plan: FlowRibbons;
  private readonly nodePos: Record<NetworkMode, THREE.Vector3[]> = { day: [], xray: [], plan: [] };
  private mode: NetworkMode = 'day';
  private lastTime: number | null = null;

  constructor(grid: Grid, net: Network) {
    const ground = (n: DrainNode, lift: number) => new THREE.Vector3(worldX(grid, n.x), worldY(grid.z[n.cell]) + lift, worldZ(grid, n.y));
    const byId = new Map(net.nodes.map((n) => [n.id, n]));
    const up = new THREE.Vector3(0, 1, 0);

    for (const p of net.pipes) {
      const a = ground(byId.get(p.from)!, LIFT);
      const b = ground(byId.get(p.to)!, LIFT);
      const dir = b.clone().sub(a);
      const r = Math.max(1.5, p.diameter * 4);
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, dir.length(), 8),
        new THREE.MeshBasicMaterial({ color: GREEN.clone(), transparent: true, opacity: 0.95, depthTest: false }),
      );
      mesh.position.copy(a).addScaledVector(dir, 0.5);
      mesh.quaternion.setFromUnitVectors(up, dir.normalize());
      mesh.renderOrder = 10;
      this.pipeMeshes.push(mesh);
      this.group.add(mesh);
    }

    for (const n of net.nodes) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 8),
        new THREE.MeshBasicMaterial({ color: NODE_OK.clone(), transparent: true, opacity: 0.95, depthTest: false }),
      );
      mesh.userData.nodeId = n.id;
      mesh.renderOrder = 12;
      this.nodeMeshes.push(mesh);
      this.group.add(mesh);
      this.nodePos.day.push(ground(n, LIFT));
      this.nodePos.xray.push(new THREE.Vector3(worldX(grid, n.x), worldY(n.invert), worldZ(grid, n.y)));
      this.nodePos.plan.push(new THREE.Vector3(worldX(grid, n.x), worldY(grid.z[n.cell] + 1), worldZ(grid, n.y)));
    }

    this.xray = new FlowRibbons(grid, net, 'xray');
    this.plan = new FlowRibbons(grid, net, 'plan');
    this.group.add(this.xray.group, this.plan.group);
    this.setMode('day');
  }

  setMode(mode: NetworkMode): void {
    this.mode = mode;
    for (const m of this.pipeMeshes) m.visible = mode === 'day';
    this.xray.group.visible = mode === 'xray';
    this.plan.group.visible = mode === 'plan';
    this.nodeMeshes.forEach((m, k) => m.position.copy(this.nodePos[mode][k]));
  }

  setPipeColors(low: string, mid: string, high: string): void {
    this.xray.setColors(low, mid, high);
    this.plan.setColors(low, mid, high);
  }

  update(frame: Frame | null, time: number): void {
    const dt = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
    this.lastTime = time;
    if (frame && (frame.pipeLoad.length !== this.pipeMeshes.length || frame.nodeFill.length !== this.nodeMeshes.length)) frame = null;
    if (this.mode === 'day') {
      this.pipeMeshes.forEach((m, p) => loadColor(frame ? frame.pipeLoad[p] : 0, (m.material as THREE.MeshBasicMaterial).color));
    } else {
      (this.mode === 'xray' ? this.xray : this.plan).update(frame, dt);
    }
    const okColor = this.mode === 'xray' ? NODE_XRAY : NODE_OK;
    this.nodeMeshes.forEach((m, k) => {
      const surcharged = frame !== null && frame.nodeFill[k] >= 0.999;
      (m.material as THREE.MeshBasicMaterial).color.copy(surcharged ? RED : okColor);
      m.scale.setScalar(surcharged ? 1 + 0.35 * Math.sin(time * 6) : 1);
    });
  }

  dispose(): void {
    for (const m of [...this.pipeMeshes, ...this.nodeMeshes]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
    this.xray.dispose();
    this.plan.dispose();
  }
}
