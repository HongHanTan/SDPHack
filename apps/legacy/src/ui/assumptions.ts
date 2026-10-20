import { GRID, INFILTRATION_MMHR, TAILWATER, SIM, THRESHOLDS } from '@floodops/engine/scenario/config';
import { BLOCK_S, IDF, STORM_DURATION_S } from '@floodops/engine/scenario/storms';
import { ORIFICE_CD, WEIR_C } from '@floodops/engine/sim/coupling';
import { MANNING_N, MIN_SLOPE } from '@floodops/engine/sim/pipes';
import { DAMPING, maxStableDt, surfaceSubsteps } from '@floodops/engine/sim/surface';

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
    ['Inlets', `Weir C = ${WEIR_C}; perimeter = 4·√(grate area)·(1 − blockage) per inlet`],
    ['Outfall', `Orifice Cd = ${ORIFICE_CD}`],
    ['Canal level (tailwater)', `normal ${TAILWATER.normal} m · high ${TAILWATER.high} m (constant)`],
    ['Flood thresholds', `road ${THRESHOLDS.road} m, home ${THRESHOLDS.home} m`],
    ['Live mode', 'Changes made mid-storm are applied in place (water kept where it is); use Compare for fair before/after numbers. Effect badges are pre-computed single-intervention runs (npm run effects).'],
    ['Town', 'Taman Kyra synthetic zone: drainage network by Tay Zheheng (data/synthetic/taman_kyra_assets.json), street/house layout by TEH JIA JIE (TownshipEnvironment.tsx). Grid-local metres = team datum − (−80, −140).'],
    ['Grate D07', 'Baseline 40% blocked (team demo_inlet_40pct); grate edge = 4·√area·(1 − blockage).'],
    ['SWMM cross-check', 'Pipe peaks compared with EPA SWMM 5.2.4 runs by Tay Zheheng — see docs/swmm-crosscheck.md.'],
    ['Costs','Indicative placeholders — replace with SDP quantity-surveyor rates.'],
  ];
  el.innerHTML = `<h2>Assumptions</h2><table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>`;
}
