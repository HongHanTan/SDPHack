/**
 * Writes data/synthetic/taman_kyra_layout.json from the placement loops in
 * apps/web/src/components/TownshipEnvironment.tsx (TEH JIA JIE): same ranges, skips, rotations and scales.
 * Scene coordinates are (x, elevation, z) with z = −y (team datum, metres east/north).
 * Run once with `npx tsx scripts/extractLayout.ts`; the committed JSON is the source of truth.
 */
import { writeFileSync } from 'node:fs';

const r2 = (v: number) => Math.round(v * 100) / 100 + 0; // + 0 turns -0 into 0
/** Direction of a DetailedRoadSegment's length axis (local +z, rotated by rotationY), in team degrees from east. */
const roadAngle = (rotY: number) => r2((Math.atan2(-Math.cos(rotY), Math.sin(rotY)) * 180) / Math.PI);

const roads = [
  { id: 'north_street', kind: 'straight', x: 45, y: 120, width: 13, length: 145, angleDeg: roadAngle(Math.PI / 2) },
  { id: 'mid_street', kind: 'straight', x: 65, y: 80, width: 11, length: 105, angleDeg: roadAngle(Math.PI / 2) },
  { id: 'main_avenue', kind: 'straight', x: 45, y: 0, width: 15, length: 155, angleDeg: roadAngle(Math.PI / 2) },
  { id: 'drainage_boulevard', kind: 'straight', x: 40, y: 35, width: 13, length: 195, angleDeg: roadAngle(0) },
  { id: 'east_connector', kind: 'straight', x: 85, y: 40, width: 10, length: 95, angleDeg: roadAngle(Math.PI / 4) },
  { id: 'cul-de-sac', kind: 'circle', x: 120, y: 80, radius: 10.5 },
];

const houses: Array<{ id: string; x: number; y: number; rotationDeg: number; scale: number }> = [];
const house = (sx: number, sz: number, rotY: number, scale: number) =>
  houses.push({ id: `H${String(houses.length + 1).padStart(2, '0')}`, x: sx, y: -sz, rotationDeg: Math.round((rotY * 180) / Math.PI), scale });
for (let x = -20; x <= 105; x += 18) house(x, -138, 0, 1.05);
for (let x = -10; x <= 95; x += 18) house(x, -102, Math.PI, 1.0);
for (let x = -30; x <= 95; x += 18) {
  if (Math.abs(x - 40) < 10) continue;
  house(x, -22, 0, 1.05);
}
for (let x = -30; x <= 95; x += 18) {
  if (Math.abs(x - 40) < 10) continue;
  house(x, 22, Math.PI, 1.05);
}
for (let z = -85; z <= 45; z += 20) house(-28, z, Math.PI / 2, 1.0);
for (let x = 65; x <= 105; x += 18) house(x, 70, 0, 1.0);

const trees: Array<{ x: number; y: number; scale: number }> = [];
const tree = (sx: number, sz: number, scale: number) => trees.push({ x: r2(sx), y: r2(-sz), scale: r2(scale) });
for (let x = -25; x <= 115; x += 14) tree(x, -128, 1.0 + (x % 3) * 0.1);
for (let x = -35; x <= 105; x += 12) {
  tree(x, -10, 0.95 + (x % 2) * 0.15);
  tree(x, 10, 0.9 + (x % 3) * 0.15);
}
for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
  const dist = 22 + Math.sin(angle * 3) * 3;
  tree(130 + Math.cos(angle) * dist, -30 + Math.sin(angle) * (dist * 0.85), 1.1 + Math.sin(angle * 5) * 0.25);
}
for (let x = -15; x <= 85; x += 22) {
  tree(x, -150, 1.3);
  tree(x, 35, 1.25);
}

const layout = {
  source: 'Derived from apps/web/src/components/TownshipEnvironment.tsx by TEH JIA JIE (team repo zerngx/sdphack).',
  datum: 'team local metres: x east, y north (scene z = -y)',
  roads,
  houses,
  lake: { id: 'maple_grove_pond', x: 130, y: 30, radius: 20 },
  canal: { id: 'east_outfall_canal', x: 40, yFrom: -127.5, yTo: -52.5, width: 15.6, wallHeight: 2.0 },
  trees,
};

writeFileSync(new URL('../../../data/synthetic/taman_kyra_layout.json', import.meta.url), JSON.stringify(layout, null, 2) + '\n');
console.log(`Wrote taman_kyra_layout.json: ${roads.length} roads, ${houses.length} houses, ${trees.length} trees`);
