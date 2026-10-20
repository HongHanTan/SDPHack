import type { DataMode } from '../api/client';

export type Stage = 'import' | 'dashboard';

/** Engine mode opens on the Import site page; Mock and SWMM API open on the dashboard. */
export function initialStage(mode: DataMode): Stage {
  return mode === 'engine' ? 'import' : 'dashboard';
}

/** Entering engine mode before any city has been chosen shows the Import site page. */
export function stageOnModeSwitch(newMode: DataMode, siteChosen: boolean, current: Stage): Stage {
  if (newMode !== 'engine') return 'dashboard';
  return siteChosen ? current : 'import';
}
