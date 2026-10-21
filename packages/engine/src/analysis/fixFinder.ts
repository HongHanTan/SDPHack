/**
 * Automated fix finder (simulation-based optimisation, no LLM): pure diagnosis of a baseline run,
 * candidate fix generation tied to problems, ranking of simulated results, and the log message formats.
 * Spec: docs/superpowers/specs/2026-10-21-automated-fix-finder-design.md (§3–§6, §9).
 */
import { fixId, STANDARD_PIPE_SIZES_M, type FixAction } from '../scenario/fixActions';
import type { SiteSpec } from '../scenario/site';

/** Minimal structural shape of a team simulation frame (the web's SimulationFrame satisfies it). */
export interface TeamFrameLike {
  timestamp_s: number;
  pipe_states: ReadonlyArray<{ conduit_id: string; capacity_fraction?: number; status: string }>;
  node_states: ReadonlyArray<{ node_id: string; status: string; depth_m: number }>;
}
/** The run metrics the fix finder reads (`j07_peak_depth_m` is the hotspot node's peak, whatever the site). */
export interface TeamMetricsLike {
  j07_peak_depth_m: number;
  homes_flooded: number;
  total_flooding_volume_m3: number;
}
export interface DiagnoseOptions {
  /** Hotspot street depth (m) per frame, aligned with `frames`; ≥ 0.15 m counts as ponding. */
  hotspotStreetDepthM?: ReadonlyArray<number>;
}

export const FULL_LOAD = 0.999;
export const PONDING_DEPTH_M = 0.15;
export const MAX_CANDIDATES = 6;
export const MAX_PROBLEMS = 3;
export const NO_IMPROVING_FIX_TEXT = 'No tested fix reduced flooding here';

export interface PipeDiagnosis { pipeId: string; diameterM: number | null; peakLoad: number; surchargedMin: number; onsetS: number | null }
export interface NodeDiagnosis { nodeId: string; floods: boolean; floodingFrames: number; peakDepthM: number; floodOnsetS: number | null }
export interface Problem {
  id: string;
  kind: 'bottleneck' | 'ponding';
  assetId: string;
  onsetS: number;
  location: { x: number; y: number };
}
export interface Diagnosis {
  pipes: PipeDiagnosis[];
  nodes: NodeDiagnosis[];
  hotspotNodeId: string;
  hotspotPeakM: number;
  homesFlooded: number;
  floodVolumeM3: number;
  /** Pipes with peak load ≥ 0.999, by minutes surcharged (desc), then peak load (desc). */
  bottlenecks: PipeDiagnosis[];
  /** The hotspot if it floods, else the node with the most flooding frames; null when nothing floods. */
  worstFloodingNodeId: string | null;
  /** At most 3, ordered by onset. */
  problems: Problem[];
}

const loadOf = (p: { capacity_fraction?: number; status: string }) =>
  p.capacity_fraction ?? (p.status === 'surcharged' ? 1 : 0);

/** Seconds each frame stands for: the gap to the next frame (the last frame reuses the previous gap). */
function frameDurations(frames: ReadonlyArray<TeamFrameLike>): number[] {
  return frames.map((f, i) => {
    if (i + 1 < frames.length) return frames[i + 1].timestamp_s - f.timestamp_s;
    return i > 0 ? f.timestamp_s - frames[i - 1].timestamp_s : 0;
  });
}

const nodePos = (site: SiteSpec, id: string) => {
  const n = site.assets.nodes.find((x) => x.node_id === id);
  return n ? { x: n.position_m.x, y: n.position_m.y } : { x: 0, y: 0 };
};
function pipeMid(site: SiteSpec, pipeId: string) {
  const c = site.assets.conduits.find((x) => x.conduit_id === pipeId);
  if (!c) return { x: 0, y: 0 };
  const a = nodePos(site, c.from_node_id);
  const b = nodePos(site, c.to_node_id);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function diagnose(
  frames: ReadonlyArray<TeamFrameLike>,
  metrics: TeamMetricsLike,
  site: SiteSpec,
  options: DiagnoseOptions = {},
): Diagnosis {
  const dur = frameDurations(frames);
  const pipes = new Map<string, PipeDiagnosis & { surchargedS: number }>();
  const nodes = new Map<string, NodeDiagnosis>();
  frames.forEach((f, i) => {
    for (const p of f.pipe_states) {
      let d = pipes.get(p.conduit_id);
      if (!d) {
        const asset = site.assets.conduits.find((c) => c.conduit_id === p.conduit_id);
        d = { pipeId: p.conduit_id, diameterM: asset ? asset.diameter_m : null, peakLoad: 0, surchargedMin: 0, onsetS: null, surchargedS: 0 };
        pipes.set(p.conduit_id, d);
      }
      const load = loadOf(p);
      d.peakLoad = Math.max(d.peakLoad, load);
      if (load >= FULL_LOAD) {
        d.surchargedS += dur[i];
        if (d.onsetS === null) d.onsetS = f.timestamp_s;
      }
    }
    for (const n of f.node_states) {
      let d = nodes.get(n.node_id);
      if (!d) {
        d = { nodeId: n.node_id, floods: false, floodingFrames: 0, peakDepthM: 0, floodOnsetS: null };
        nodes.set(n.node_id, d);
      }
      d.peakDepthM = Math.max(d.peakDepthM, n.depth_m);
      if (n.status === 'flooding') {
        d.floods = true;
        d.floodingFrames++;
        if (d.floodOnsetS === null) d.floodOnsetS = f.timestamp_s;
      }
    }
  });
  const pipeList: PipeDiagnosis[] = [...pipes.values()].map(({ surchargedS, ...p }) => ({ ...p, surchargedMin: surchargedS / 60 }));
  const nodeList = [...nodes.values()];
  const bottlenecks = pipeList
    .filter((p) => p.peakLoad >= FULL_LOAD)
    .sort((a, b) => b.surchargedMin - a.surchargedMin || b.peakLoad - a.peakLoad);

  const hotspot = site.hotspotNodeId;
  const flooding = nodeList.filter((n) => n.floods);
  const worst = flooding.find((n) => n.nodeId === hotspot)
    ?? [...flooding].sort((a, b) => b.floodingFrames - a.floodingFrames)[0];

  // Ponding onset per node: first flooding frame; the hotspot also counts street depth ≥ 0.15 m.
  const pondOnset = new Map<string, number>();
  for (const n of flooding) pondOnset.set(n.nodeId, n.floodOnsetS!);
  const series = options.hotspotStreetDepthM;
  if (series) {
    const i = frames.findIndex((_, k) => (series[k] ?? 0) >= PONDING_DEPTH_M);
    if (i >= 0) pondOnset.set(hotspot, Math.min(pondOnset.get(hotspot) ?? Infinity, frames[i].timestamp_s));
  }

  // Priority: top bottleneck, hotspot ponding, second bottleneck, other ponding nodes (most flooding frames first).
  const bottleneckProblem = (p: PipeDiagnosis): Problem => ({
    id: `bottleneck:${p.pipeId}`, kind: 'bottleneck', assetId: p.pipeId, onsetS: p.onsetS!, location: pipeMid(site, p.pipeId),
  });
  const pondingProblem = (nodeId: string): Problem => ({
    id: `ponding:${nodeId}`, kind: 'ponding', assetId: nodeId, onsetS: pondOnset.get(nodeId)!, location: nodePos(site, nodeId),
  });
  const pool: Problem[] = [];
  if (bottlenecks[0]) pool.push(bottleneckProblem(bottlenecks[0]));
  if (pondOnset.has(hotspot)) pool.push(pondingProblem(hotspot));
  if (bottlenecks[1]) pool.push(bottleneckProblem(bottlenecks[1]));
  for (const n of [...flooding].sort((a, b) => b.floodingFrames - a.floodingFrames)) {
    if (n.nodeId !== hotspot) pool.push(pondingProblem(n.nodeId));
  }
  for (const b of bottlenecks.slice(2)) pool.push(bottleneckProblem(b));
  const problems = pool.slice(0, MAX_PROBLEMS).sort((a, b) => a.onsetS - b.onsetS);

  return {
    pipes: pipeList,
    nodes: nodeList,
    hotspotNodeId: hotspot,
    hotspotPeakM: metrics.j07_peak_depth_m,
    homesFlooded: metrics.homes_flooded,
    floodVolumeM3: metrics.total_flooding_volume_m3,
    bottlenecks,
    worstFloodingNodeId: worst ? worst.nodeId : null,
    problems,
  };
}

export interface Candidate { fix: FixAction; problemId: string }

/** The largest pipe leaving a node (the downstream path), or undefined. */
const outPipe = (site: SiteSpec, nodeId: string) =>
  site.assets.conduits.filter((c) => c.from_node_id === nodeId).sort((a, b) => b.diameter_m - a.diameter_m)[0];

/** Candidate fixes (spec §4, §9), each tied to a problem; at most 6, duplicates dropped. */
export function generateCandidates(diagnosis: Diagnosis, site: SiteSpec): Candidate[] {
  const out: Candidate[] = [];
  const problemIds = new Set(diagnosis.problems.map((p) => p.id));
  const tie = (id: string) => (problemIds.has(id) ? id : diagnosis.problems[0]?.id);
  const push = (fix: FixAction, problemId: string | undefined) => {
    if (problemId && !out.some((c) => fixId(c.fix) === fixId(fix))) out.push({ fix, problemId });
  };
  const nodeOf = (id: string) => site.assets.nodes.find((n) => n.node_id === id);
  const top = diagnosis.bottlenecks[0];
  const hotspotPonds = problemIds.has(`ponding:${diagnosis.hotspotNodeId}`);
  if (!top && !diagnosis.worstFloodingNodeId && !hotspotPonds) return [];

  // 1. Upsize: the next 2 standard sizes above each of the top 2 bottlenecks.
  for (const b of diagnosis.bottlenecks.slice(0, 2)) {
    if (b.diameterM === null) continue;
    for (const d of STANDARD_PIPE_SIZES_M.filter((s) => s > b.diameterM! + 1e-9).slice(0, 2)) {
      push({ kind: 'upsize', pipeId: b.pipeId, diameterM: d }, tie(`bottleneck:${b.pipeId}`));
    }
  }

  // 2. Relief: from the top bottleneck's upstream node (else the worst flooding node / ponding hotspot)
  //    to the first node ≥ 2 links downstream whose invert is > 0.1 m lower.
  const topPipe = top && site.assets.conduits.find((c) => c.conduit_id === top.pipeId);
  const aId = topPipe ? topPipe.from_node_id : diagnosis.worstFloodingNodeId ?? diagnosis.hotspotNodeId;
  const aProblem = topPipe ? `bottleneck:${top.pipeId}` : `ponding:${aId}`;
  const a = nodeOf(aId);
  const first = a && outPipe(site, aId);
  if (a && first) {
    const seen = new Set([aId]);
    let cur = first.to_node_id;
    for (let links = 1; !seen.has(cur); links++) {
      seen.add(cur);
      const n = nodeOf(cur);
      if (!n) break;
      // Skip a B that already has a pipe A → B or a relief pipe with that id (applyFix would refuse it).
      const taken = site.assets.conduits.some((c) => c.conduit_id === `RELIEF-${aId}-${cur}` || (c.from_node_id === aId && c.to_node_id === cur));
      if (links >= 2 && !taken && n.invert_elevation_m < a.invert_elevation_m - 0.1) {
        push({ kind: 'relief', fromNode: aId, toNode: cur, diameterM: first.diameter_m }, tie(aProblem));
        break;
      }
      const next = outPipe(site, cur);
      if (!next) break;
      cur = next.to_node_id;
    }
  }

  // 3. Storage upstream of the top bottleneck: at the node feeding its upstream node through the largest
  //    incoming pipe (the main trunk), else at its upstream node; skipped when that node is under 0.5 m deep.
  if (topPipe) {
    const feeder = site.assets.conduits
      .filter((c) => c.to_node_id === topPipe.from_node_id)
      .sort((x, y) => y.diameter_m - x.diameter_m)[0];
    const s = nodeOf(feeder ? feeder.from_node_id : topPipe.from_node_id);
    if (s && s.max_depth_m >= 0.5) {
      const volumeM3 = Math.max(200, Math.ceil((diagnosis.floodVolumeM3 * 1.2) / 100) * 100);
      push({ kind: 'storage', nodeId: s.node_id, volumeM3 }, tie(`bottleneck:${top.pipeId}`));
    }
  }

  // 4. Extra inlet: +1 grate at the hotspot, tied to its ponding problem (skipped when the hotspot does not pond).
  //    It always keeps its slot; the fixes above fill the rest in order.
  if (hotspotPonds && nodeOf(diagnosis.hotspotNodeId)) {
    const inlet: Candidate = { fix: { kind: 'inlet', nodeId: diagnosis.hotspotNodeId, grates: 1 }, problemId: `ponding:${diagnosis.hotspotNodeId}` };
    return [...out.slice(0, MAX_CANDIDATES - 1), inlet];
  }

  return out.slice(0, MAX_CANDIDATES);
}

export interface Outcome { homesFlooded: number; floodVolumeM3: number; hotspotPeakM: number }
export interface CandidateResult extends Candidate { label: string; costRM: number; outcome: Outcome }

const EPS = 1e-9;
/** Spec §5: fewer homes, or volume down ≥ 1 % and ≥ 1 m³, or hotspot peak down ≥ 0.01 m. */
export function isImprovement(baseline: Outcome, o: Outcome): boolean {
  const dv = baseline.floodVolumeM3 - o.floodVolumeM3;
  return o.homesFlooded < baseline.homesFlooded
    || (dv >= baseline.floodVolumeM3 * 0.01 - EPS && dv >= 1 - EPS)
    || baseline.hotspotPeakM - o.hotspotPeakM >= 0.01 - EPS;
}

/** Improvers sorted by homes, volume, peak, cost; the rest are "no effect" (input order kept). */
export function rankResults<T extends CandidateResult>(baseline: Outcome, results: ReadonlyArray<T>): { ranked: T[]; noEffect: T[] } {
  const ranked = results.filter((r) => isImprovement(baseline, r.outcome));
  const noEffect = results.filter((r) => !isImprovement(baseline, r.outcome));
  ranked.sort((a, b) =>
    a.outcome.homesFlooded - b.outcome.homesFlooded
    || a.outcome.floodVolumeM3 - b.outcome.floodVolumeM3
    || a.outcome.hotspotPeakM - b.outcome.hotspotPeakM
    || a.costRM - b.costRM);
  return { ranked, noEffect };
}

/** The best-ranked improving fix per problem id; a problem without an entry has no improving fix (NO_IMPROVING_FIX_TEXT). */
export function bestFixPerProblem<T extends CandidateResult>(ranked: ReadonlyArray<T>): Record<string, T> {
  const best: Record<string, T> = {};
  for (const r of ranked) if (!(r.problemId in best)) best[r.problemId] = r;
  return best;
}

const m2 = (d: number) => d.toFixed(2);
const vol = (v: number) => String(Math.round(v));
const mmss = (s: number) => {
  const t = Math.max(0, Math.round(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const kindName = (p: Problem) => (p.kind === 'bottleneck' ? 'Bottleneck' : 'Ponding');

/** Exact streaming-log and pin message formats (spec §6, §9). */
export const logLines = {
  readingBaseline(d: Diagnosis): string {
    const b = d.bottlenecks[0];
    const pipe = b ? `${b.pipeId} full for ${Math.round(b.surchargedMin)} min` : 'no pipe ran full';
    return `Reading baseline results… ${pipe}; ${d.hotspotNodeId} peaks at ${m2(d.hotspotPeakM)} m; ${d.homesFlooded} homes flooded; street flood volume ${vol(d.floodVolumeM3)} m³`;
  },
  bottlenecks(d: Diagnosis, site: SiteSpec): string[] {
    return d.bottlenecks.slice(0, 2).map((b) => {
      const dia = b.diameterM ?? site.assets.conduits.find((c) => c.conduit_id === b.pipeId)?.diameter_m;
      const size = dia === undefined || dia === null ? '' : ` (Ø${Math.round(dia * 1000)})`;
      return `Bottleneck found: ${b.pipeId}${size} at ${Math.round(b.peakLoad * 100)}% capacity`;
    });
  },
  noFlooding: () => 'No flooding found; nothing to fix',
  generating: (labels: ReadonlyArray<string>) => `Generating ${labels.length} candidate fixes: ${labels.join('; ')}`,
  simulating: (i: number, n: number, label: string) => `Simulating ${i}/${n}: ${label}…`,
  result(label: string, hotspot: string, o: Outcome, improved: boolean): string {
    const base = `${label}: ${hotspot} peak ${m2(o.hotspotPeakM)} m, homes ${o.homesFlooded}, flood volume ${vol(o.floodVolumeM3)} m³`;
    return improved ? `${base} ✓` : `${base}: no effect`;
  },
  ranking: () => 'Ranking by homes flooded, flood volume, peak depth, then cost…',
  recommended(best: CandidateResult, baseline: Outcome, hotspot: string): string {
    const o = best.outcome;
    const cost = Math.round(best.costRM).toLocaleString('en-US');
    return `✔ Recommended: ${best.label}: homes ${baseline.homesFlooded} → ${o.homesFlooded}, flood volume ${vol(baseline.floodVolumeM3)} → ${vol(o.floodVolumeM3)} m³, ${hotspot} peak ${m2(baseline.hotspotPeakM)} → ${m2(o.hotspotPeakM)} m, about RM ${cost} (indicative)`;
  },
  noImprovingFix: () => NO_IMPROVING_FIX_TEXT,
  problem(p: Problem): string {
    const what = p.kind === 'bottleneck' ? 'full' : `water ${m2(PONDING_DEPTH_M)} m`;
    return `⚠ ${kindName(p)}: ${p.assetId} ${what} at ${mmss(p.onsetS)}`;
  },
  problemPending: (p: Problem, i: number, n: number) => `⚠ ${kindName(p)} detected — testing fixes… (${i}/${n})`,
};
