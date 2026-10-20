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
  { id: 'north_street', kind: 'straight', x: 45, y: 120, width: 13, length: 145, angleDeg: roadAngle(Math.PI / 2), surfaceZ: 12.15 },
  { id: 'mid_street', kind: 'straight', x: 65, y: 80, width: 11, length: 105, angleDeg: roadAngle(Math.PI / 2), surfaceZ: 11.85 },
  { id: 'main_avenue', kind: 'straight', x: 45, y: 0, width: 15, length: 155, angleDeg: roadAngle(Math.PI / 2), surfaceZ: 10.98 },
  { id: 'drainage_boulevard', kind: 'straight', x: 40, y: 35, width: 13, length: 195, angleDeg: roadAngle(0), surfaceZ: 11.2 },
  { id: 'east_connector', kind: 'straight', x: 85, y: 40, width: 10, length: 95, angleDeg: roadAngle(Math.PI / 4), surfaceZ: 11.5 },
  { id: 'cul-de-sac', kind: 'circle', x: 120, y: 80, radius: 10.5, surfaceZ: 11.86 },
];

const roofStyles = ['#334155', '#7c2d12', '#1e293b', '#475569', '#991b1b', '#0369a1'];
const wallStyles = ['#f8fafc', '#f1f5f9', '#fef3c7', '#fdf4ff', '#e2e8f0'];
const carColors = ['#2563eb', '#dc2626', '#1e293b', '#f8fafc', '#ca8a04', '#475569'];

const houses: Array<{
  id: string; x: number; y: number; rotationDeg: number; scale: number;
  sceneY: number; roof: string; wall: string; hasCar: boolean; carColor: string;
}> = [];
const house = (sx: number, sy: number, sz: number, rotY: number, scale: number, roof: string, wall: string, hasCar: boolean, carColor: string) =>
  houses.push({ id: `H${String(houses.length + 1).padStart(2, '0')}`, x: sx, y: -sz, rotationDeg: Math.round((rotY * 180) / Math.PI), scale, sceneY: sy, roof, wall, hasCar, carColor });
for (let x = -20; x <= 105; x += 18)
  house(x, 12.2, -138, 0, 1.05,
    roofStyles[Math.abs(Math.floor(x / 17)) % roofStyles.length],
    wallStyles[Math.abs(Math.floor(x / 13)) % wallStyles.length],
    x % 2 === 0,
    carColors[Math.abs(Math.floor(x / 11)) % carColors.length]);
for (let x = -10; x <= 95; x += 18)
  house(x, 12.0, -102, Math.PI, 1.0,
    roofStyles[(Math.abs(Math.floor(x / 15)) + 1) % roofStyles.length],
    wallStyles[(Math.abs(Math.floor(x / 14)) + 1) % wallStyles.length],
    x % 3 === 0,
    carColors[Math.abs(Math.floor(x / 7)) % carColors.length]);
for (let x = -30; x <= 95; x += 18) {
  if (Math.abs(x - 40) < 10) continue;
  house(x, 11.0, -22, 0, 1.05,
    roofStyles[Math.abs(Math.floor(x / 14)) % roofStyles.length],
    wallStyles[Math.abs(Math.floor(x / 12)) % wallStyles.length],
    x % 2 === 1,
    carColors[Math.abs(Math.floor(x / 9)) % carColors.length]);
}
for (let x = -30; x <= 95; x += 18) {
  if (Math.abs(x - 40) < 10) continue;
  house(x, 10.9, 22, Math.PI, 1.05,
    roofStyles[(Math.abs(Math.floor(x / 16)) + 2) % roofStyles.length],
    wallStyles[(Math.abs(Math.floor(x / 13)) + 2) % wallStyles.length],
    x % 2 === 0,
    carColors[Math.abs(Math.floor(x / 8)) % carColors.length]);
}
for (let z = -85; z <= 45; z += 20)
  house(-28, 11.3, z, Math.PI / 2, 1.0,
    roofStyles[(Math.abs(Math.floor(z / 18)) + 3) % roofStyles.length],
    wallStyles[(Math.abs(Math.floor(z / 15)) + 1) % wallStyles.length],
    true,
    carColors[Math.abs(Math.floor(z / 10)) % carColors.length]);
for (let x = 65; x <= 105; x += 18)
  house(x, 10.5, 70, 0, 1.0,
    roofStyles[Math.abs(Math.floor(x / 16)) % roofStyles.length],
    wallStyles[Math.abs(Math.floor(x / 14)) % wallStyles.length],
    true,
    carColors[Math.abs(Math.floor(x / 5)) % carColors.length]);

const treeColors = ['#15803d', '#16a34a', '#14532d', '#166534', '#15803d'];
const trees: Array<{ x: number; y: number; scale: number; sceneY: number; color: string }> = [];
const tree = (sx: number, sy: number, sz: number, scale: number, color: string) =>
  trees.push({ x: r2(sx), y: r2(-sz), scale: r2(scale), sceneY: sy, color });
for (let x = -25; x <= 115; x += 14) tree(x, 12.2, -128, 1.0 + (x % 3) * 0.1, treeColors[Math.abs(x) % treeColors.length]);
for (let x = -35; x <= 105; x += 12) {
  tree(x, 11.0, -10, 0.95 + (x % 2) * 0.15, treeColors[Math.abs(x) % treeColors.length]);
  tree(x, 10.9, 10, 0.9 + (x % 3) * 0.15, treeColors[(Math.abs(x) + 1) % treeColors.length]);
}
for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
  const dist = 22 + Math.sin(angle * 3) * 3;
  tree(130 + Math.cos(angle) * dist, 11.2, -30 + Math.sin(angle) * (dist * 0.85), 1.1 + Math.sin(angle * 5) * 0.25, treeColors[Math.floor(angle * 2) % treeColors.length]);
}
for (let x = -15; x <= 85; x += 22) {
  tree(x, 12.1, -150, 1.3, '#14532d');
  tree(x, 10.8, 35, 1.25, '#166534');
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
