import { GRID, INFILTRATION_MMHR, MANHOLE, RIVER_STAGE, SIM, THRESHOLDS } from '../scenario/config';
import { BLOCK_S, IDF, STORM_DURATION_S } from '../scenario/storms';
import { ORIFICE_CD, WEIR_C } from '../sim/coupling';
import { MANNING_N, MIN_SLOPE } from '../sim/pipes';
import { DAMPING, maxStableDt, surfaceSubsteps } from '../sim/surface';

export function renderAssumptions(el: HTMLElement): void {
  const rows: Array<[string, string]> = [
    ['Model', 'Virtual-pipes surface flow coupled to capacity-based pipe routing. Simplified — not SWMM dynamic-wave. Validation against SWMM is a next step.'],
    ['Site', 'Synthetic representative township, not a real SDP site.'],
    ['Grid', `${GRID.nx} × ${GRID.ny} cells at ${GRID.dx} m`],
    ['Timestep', `${SIM.dt} s coupling; surface sub-stepped ×${surfaceSubsteps(GRID.dx, SIM.dt)} (stability limit ${maxStableDt(GRID.dx).toFixed(3)} s incl. 0.8 safety); flux damping ${DAMPING}`],
    ['Rainfall IDF', `${IDF.station}: λ=${IDF.lambda}, κ=${IDF.kappa}, θ=${IDF.theta}, η=${IDF.eta}${IDF.provisional ? ' — PROVISIONAL' : ''}`],
    ['Storm pattern', `Alternating block, ${BLOCK_S / 60}-min blocks, ${STORM_DURATION_S / 3600} h, then ${SIM.recessionS / 60} min recession`],
    ['Infiltration (mm/hr)', Object.entries(INFILTRATION_MMHR).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(', ')],
    ['Pipes', `Manning n = ${MANNING_N}; minimum grade ${MIN_SLOPE}`],
    ['Custom pipes', 'Routed by capacity only; uphill pipes are rejected.'],
    ['Inlets', `Weir C = ${WEIR_C}; perimeter ${MANHOLE.inletPerimeter} m per manhole`],
    ['Outfall', `Orifice Cd = ${ORIFICE_CD}`],
    ['River stage', RIVER_STAGE.times.map((t, k) => `${t / 60} min: ${RIVER_STAGE.levels[k]} m`).join(' · ')],
    ['Flood thresholds', `road ${THRESHOLDS.road} m, home ${THRESHOLDS.home} m`],
    ['Live mode', 'Changes made mid-storm are applied in place (water kept where it is); use Compare for fair before/after numbers. Effect badges are pre-computed single-intervention runs (npm run effects).'],
    ['Costs','Indicative placeholders — replace with SDP quantity-surveyor rates.'],
  ];
  el.innerHTML = `<h2>Assumptions</h2><table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
}
