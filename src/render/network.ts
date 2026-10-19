import * as THREE from 'three';
import type { DrainNode, Frame, Grid, Network } from '../sim/types';
import { worldX, worldY, worldZ } from './coords';

const GREEN = new THREE.Color('#2ecc71');
const YELLOW = new THREE.Color('#f1c40f');
const RED = new THREE.Color('#e74c3c');
const NODE_OK = new THREE.Color('#34495e');
const LIFT = 3; // draw the network 3 world units above ground so it is visible

export function loadColor(load: number, out = new THREE.Color()): THREE.Color {
  const t = Math.min(1, Math.max(0, load));
  return t < 0.5 ? out.copy(GREEN).lerp(YELLOW, t * 2) : out.copy(YELLOW).lerp(RED, (t - 0.5) * 2);
}

export class NetworkView {
  readonly group = new THREE.Group();
  readonly nodeMeshes: THREE.Mesh[] = [];
  private readonly pipeMeshes: THREE.Mesh[] = [];

  constructor(grid: Grid, net: Network) {
    const at = (n: DrainNode) => new THREE.Vector3(worldX(grid, n.x), worldY(grid.z[n.cell]) + LIFT, worldZ(grid, n.y));
    const byId = new Map(net.nodes.map((n) => [n.id, n]));
    const up = new THREE.Vector3(0, 1, 0);

    for (const p of net.pipes) {
      const a = at(byId.get(p.from)!);
      const b = at(byId.get(p.to)!);
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
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8), new THREE.MeshBasicMaterial({ color: NODE_OK.clone(), transparent: true, opacity: 0.95, depthTest: false }));
      mesh.position.copy(at(n));
      mesh.userData.nodeId = n.id;
      mesh.renderOrder = 10;
      this.nodeMeshes.push(mesh);
      this.group.add(mesh);
    }
  }

  update(frame: Frame | null, time: number): void {
    this.pipeMeshes.forEach((m, p) => loadColor(frame ? frame.pipeLoad[p] : 0, (m.material as THREE.MeshBasicMaterial).color));
    this.nodeMeshes.forEach((m, k) => {
      const surcharged = frame !== null && frame.nodeFill[k] >= 0.999;
      (m.material as THREE.MeshBasicMaterial).color.copy(surcharged ? RED : NODE_OK);
      m.scale.setScalar(surcharged ? 1 + 0.35 * Math.sin(time * 6) : 1);
    });
  }

  dispose(): void {
    for (const m of [...this.pipeMeshes, ...this.nodeMeshes]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
