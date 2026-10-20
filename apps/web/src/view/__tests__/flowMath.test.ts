import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SimulationFrame } from '../../types';
import { advancePhase, arrowSpeed, arrowsVisible, loadColorBetween, pipeLoad } from '../flowMath';

const frame = (states: Array<Record<string, unknown>>) => ({ timestamp_s: 0, pipe_states: states, node_states: [], inlet_states: [] }) as unknown as SimulationFrame;

describe('flowMath', () => {
  it('speeds up with load and hides arrows on dry pipes', () => {
    expect(arrowSpeed(0)).toBeCloseTo(0.2);
    expect(arrowSpeed(1)).toBeCloseTo(2.0);
    expect(arrowsVisible(0.01)).toBe(false);
    expect(arrowsVisible(0.5)).toBe(true);
  });
  it('advances the phase and wraps into [0, 1)', () => {
    const p = advancePhase(0.9, 1, 1, 1);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
    expect(p).toBeCloseTo((0.9 + 2.0) % 1, 6);
  });
  it('colours low → mid → high', () => {
    const low = new THREE.Color('#00ff00');
    const mid = new THREE.Color('#ffff00');
    const high = new THREE.Color('#ff0000');
    const out = new THREE.Color();
    expect(loadColorBetween(0, low, mid, high, out).getHexString()).toBe('00ff00');
    expect(loadColorBetween(0.5, low, mid, high, out).getHexString()).toBe('ffff00');
    expect(loadColorBetween(1, low, mid, high, out).getHexString()).toBe('ff0000');
  });
  it('reads capacity_fraction, falls back to status, and is 0 for unknown pipes', () => {
    const f = frame([
      { conduit_id: 'A', flow_m3s: 0, depth_m: 0, status: 'normal', capacity_fraction: 0.3 },
      { conduit_id: 'B', flow_m3s: 0, depth_m: 0, status: 'surcharged' },
      { conduit_id: 'C', flow_m3s: 0, depth_m: 0, status: 'near_capacity' },
      { conduit_id: 'D', flow_m3s: 0, depth_m: 0, status: 'normal' },
    ]);
    expect(pipeLoad(f, 'A')).toBe(0.3);
    expect(pipeLoad(f, 'B')).toBe(1);
    expect(pipeLoad(f, 'C')).toBe(0.85);
    expect(pipeLoad(f, 'D')).toBe(0.4);
    expect(pipeLoad(f, 'Z')).toBe(0);
    expect(pipeLoad(null, 'A')).toBe(0);
  });
});
