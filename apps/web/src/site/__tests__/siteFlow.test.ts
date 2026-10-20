import { describe, expect, it } from 'vitest';
import { initialStage, stageOnModeSwitch } from '../siteFlow';

describe('siteFlow', () => {
  it('starts on the import page in engine mode only', () => {
    expect(initialStage('engine')).toBe('import');
    expect(initialStage('mock')).toBe('dashboard');
    expect(initialStage('api')).toBe('dashboard');
  });
  it('shows the import page when entering engine mode before a city is chosen', () => {
    expect(stageOnModeSwitch('engine', false, 'dashboard')).toBe('import');
    expect(stageOnModeSwitch('engine', true, 'dashboard')).toBe('dashboard');
    expect(stageOnModeSwitch('mock', false, 'import')).toBe('dashboard');
    expect(stageOnModeSwitch('api', true, 'import')).toBe('dashboard');
  });
});
