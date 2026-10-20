import { describe, expect, it } from 'vitest';
import layout from '../../../../data/synthetic/taman_kyra_layout.json';

describe('taman_kyra_layout.json (derived from TownshipEnvironment.tsx by TEH JIA JIE)', () => {
  it('reproduces the six house rows', () => {
    expect(layout.houses.length).toBe(35);
    expect(layout.houses[0]).toMatchObject({ id: 'H01', x: -20, y: 138, rotationDeg: 0, scale: 1.05 });
    expect(layout.houses[34]).toMatchObject({ id: 'H35', x: 101, y: -70, rotationDeg: 0, scale: 1 });
    expect(layout.houses.some((h) => Math.abs(h.x - 40) < 10 && Math.abs(h.y) === 22)).toBe(false); // D07 opening
  });
  it('has the roads, lake and canal', () => {
    expect(layout.roads.map((r) => r.id)).toEqual(['north_street', 'mid_street', 'main_avenue', 'drainage_boulevard', 'east_connector', 'cul-de-sac']);
    expect(layout.roads.find((r) => r.id === 'main_avenue')).toMatchObject({ angleDeg: 0, width: 15 });
    expect(Math.abs(Math.abs((layout.roads.find((r) => r.id === 'drainage_boulevard') as { angleDeg: number }).angleDeg) - 90)).toBeLessThan(1e-9);
    expect(layout.lake).toMatchObject({ x: 130, y: 30, radius: 20 });
    expect(layout.canal).toMatchObject({ x: 40, yFrom: -127.5, yTo: -52.5 });
    expect(layout.source).toContain('TEH JIA JIE');
  });

  it('carries Jiajie scene heights and colours', () => {
    const z = Object.fromEntries(layout.roads.map((r) => [r.id, (r as { surfaceZ: number }).surfaceZ]));
    expect(z).toEqual({ north_street: 12.15, mid_street: 11.85, main_avenue: 10.98, drainage_boulevard: 11.2, east_connector: 11.5, 'cul-de-sac': 11.86 });
    const h0 = layout.houses[0] as { sceneY: number; roof: string; wall: string; hasCar: boolean; carColor: string };
    expect(h0.sceneY).toBe(12.2);
    expect(h0.roof).toBe('#1e293b'); // x=-20: |floor(-20/17)| = 2
    expect(typeof h0.hasCar).toBe('boolean');
    expect((layout.trees[0] as { color: string }).color).toMatch(/^#/);
  });
});
