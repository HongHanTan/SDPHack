/**
 * Automated fix finder (simulation-based optimisation, no LLM): pure diagnosis of a baseline run,
 * candidate fix generation tied to problems, ranking of simulated results, and the log message formats.
 * Spec: docs/superpowers/specs/2026-10-21-automated-fix-finder-design.md (§3–§6, §9, §10).
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
export const MAX_CANDIDATES = 8;
export const MAX_PROBLEMS = 3;
export const NO_IMPROVING_FIX_TEXT = 'No tested fix reduced flooding here';

export interface PipeDiagnosis { pipeId: string; diameterM: number | null; peakLoad: number; surchargedMin: number; onsetS: number | null }
export interface NodeDiagnosis { nodeId: string; floods: boolean; floodingFrames: number; peakDepthM: number; floodOnsetS: number | null }
export interface Problem {
  id: string;
  kind: 'bottleneck' | 'ponding';
  /** Bottleneck: the most upstream pipe of the chain; ponding: the node. */
  assetId: string;
  /** Bottleneck only: the full pipes in series (the downstream end of one is the upstream end of the next), most upstream first. */
  pipeIds?: string[];
  onsetS: number;
  /** Ponding only: what set the onset — the node's first `flooding` status, or the hotspot street depth reaching 0.15 m. */
  onsetBy?: 'flooding' | 'depth';
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

/**
 * Bottleneck pipes grouped into chains of pipes in series (the downstream end of one is the upstream end of the next),
 * most upstream first. Where several full pipes leave or join a node, the higher-ranked pipe (bottleneck order) links;
 * the others start or end their own chains. Chains are ordered by their best-ranked pipe.
 */
function bottleneckChains(bottlenecks: ReadonlyArray<PipeDiagnosis>, site: SiteSpec): PipeDiagnosis[][] {
  const conduit = new Map(site.assets.conduits.map((c) => [c.conduit_id, c]));
  const rank = new Map(bottlenecks.map((b, i) => [b.pipeId, i]));
  const next = new Map<string, PipeDiagnosis>();
  const hasPrev = new Set<string>();
  for (const b of bottlenecks) {
    const c = conduit.get(b.pipeId);
    if (!c) continue;
    const n = bottlenecks.find((x) => x !== b && !hasPrev.has(x.pipeId) && conduit.get(x.pipeId)?.from_node_id === c.to_node_id);
    if (n) {
      next.set(b.pipeId, n);
      hasPrev.add(n.pipeId);
    }
  }
  const seen = new Set<string>();
  const walk = (start: PipeDiagnosis) => {
    const chain: PipeDiagnosis[] = [];
    for (let p: PipeDiagnosis | undefined = start; p && !seen.has(p.pipeId); p = next.get(p.pipeId)) {
      seen.add(p.pipeId);
      chain.push(p);
    }
    return chain;
  };
  const chains: PipeDiagnosis[][] = [];
  for (const b of bottlenecks) if (!hasPrev.has(b.pipeId)) chains.push(walk(b));
  for (const b of bottlenecks) if (!seen.has(b.pipeId)) chains.push(walk(b)); // a loop of full pipes has no head
  const best = (chain: PipeDiagnosis[]) => Math.min(...chain.map((p) => rank.get(p.pipeId)!));
  return chains.sort((a, b) => best(a) - best(b));
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

  // Ponding onset per node: first flooding frame; the hotspot also counts street depth ≥ 0.15 m (whichever is earlier;
  // on a tie the flooding status is named).
  const pondOnset = new Map<string, { s: number; by: 'flooding' | 'depth' }>();
  for (const n of flooding) pondOnset.set(n.nodeId, { s: n.floodOnsetS!, by: 'flooding' });
  const series = options.hotspotStreetDepthM;
  if (series) {
    const i = frames.findIndex((_, k) => (series[k] ?? 0) >= PONDING_DEPTH_M);
    const prev = pondOnset.get(hotspot);
    if (i >= 0 && (!prev || frames[i].timestamp_s < prev.s)) pondOnset.set(hotspot, { s: frames[i].timestamp_s, by: 'depth' });
  }

  // Priority: top bottleneck chain, hotspot ponding, second chain, other ponding nodes (most flooding frames first),
  // remaining chains. A chain is a run of full pipes in series and is one problem at its most upstream pipe (§10).
  const chains = bottleneckChains(bottlenecks, site);
  const bottleneckProblem = (chain: PipeDiagnosis[]): Problem => ({
    id: `bottleneck:${chain[0].pipeId}`,
    kind: 'bottleneck',
    assetId: chain[0].pipeId,
    pipeIds: chain.map((p) => p.pipeId),
    onsetS: Math.min(...chain.map((p) => p.onsetS!)),
    location: pipeMid(site, chain[0].pipeId),
  });
  const pondingProblem = (nodeId: string): Problem => ({
    id: `ponding:${nodeId}`, kind: 'ponding', assetId: nodeId, onsetS: pondOnset.get(nodeId)!.s, onsetBy: pondOnset.get(nodeId)!.by, location: nodePos(site, nodeId),
  });
  const pool: Problem[] = [];
  if (chains[0]) pool.push(bottleneckProblem(chains[0]));
  if (pondOnset.has(hotspot)) pool.push(pondingProblem(hotspot));
  if (chains[1]) pool.push(bottleneckProblem(chains[1]));
  for (const n of [...flooding].sort((a, b) => b.floodingFrames - a.floodingFrames)) {
    if (n.nodeId !== hotspot) pool.push(pondingProblem(n.nodeId));
  }
  for (const c of chains.slice(2)) pool.push(bottleneckProblem(c));
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

/**
 * At most `max` candidates, input order kept: first every problem's first candidate, then the rest in order
 * (so each problem keeps at least one).
 */
export function capCandidates<T extends Candidate>(list: ReadonlyArray<T>, max = MAX_CANDIDATES): T[] {
  if (list.length <= max) return [...list];
  const keep = new Set<T>();
  const problems = new Set<string>();
  for (const c of list) {
    if (!problems.has(c.problemId)) {
      problems.add(c.problemId);
      keep.add(c);
    }
  }
  for (const c of list) {
    if (keep.size >= max) break;
    keep.add(c);
  }
  return list.filter((c) => keep.has(c));
}

/**
 * Candidate fixes per problem (spec §10), in onset order for up to 3 problems; at most 8, duplicates dropped.
 * - Bottleneck chain: upsize its most-loaded pipe to the next 2 standard sizes, and one relief pipe from the chain's
 *   upstream node A to the first node B at least 1 link below the chain's last pipe with invert(B) < invert(A) − 0.1,
 *   at the chain's largest diameter (skipping a B that already has a pipe from A or a relief pipe with that id).
 * - Ponding node: one extra inlet grate at that node.
 * Storage is not generated (the action stays available in the engine).
 */
export function generateCandidates(diagnosis: Diagnosis, site: SiteSpec): Candidate[] {
  const out: Candidate[] = [];
  const push = (fix: FixAction, problemId: string) => {
    if (!out.some((c) => fixId(c.fix) === fixId(fix))) out.push({ fix, problemId });
  };
  const nodeOf = (id: string) => site.assets.nodes.find((n) => n.node_id === id);
  const conduitOf = (id: string) => site.assets.conduits.find((c) => c.conduit_id === id);
  const pipeDiag = new Map(diagnosis.pipes.map((p) => [p.pipeId, p]));

  for (const problem of [...diagnosis.problems].sort((a, b) => a.onsetS - b.onsetS).slice(0, MAX_PROBLEMS)) {
    if (problem.kind === 'ponding') {
      if (nodeOf(problem.assetId)) push({ kind: 'inlet', nodeId: problem.assetId, grates: 1 }, problem.id);
      continue;
    }
    const chain = (problem.pipeIds ?? [problem.assetId]).map(conduitOf).filter((c) => c !== undefined);
    if (!chain.length) continue;

    // Upsize the most-loaded pipe (peak load, then minutes full; the upstream one on a tie).
    const load = (id: string) => pipeDiag.get(id)?.peakLoad ?? 0;
    const full = (id: string) => pipeDiag.get(id)?.surchargedMin ?? 0;
    const most = [...chain].sort((a, b) => load(b.conduit_id) - load(a.conduit_id) || full(b.conduit_id) - full(a.conduit_id))[0];
    for (const d of STANDARD_PIPE_SIZES_M.filter((s) => s > most.diameter_m + 1e-9).slice(0, 2)) {
      push({ kind: 'upsize', pipeId: most.conduit_id, diameterM: d }, problem.id);
    }

    // Relief bypassing the whole chain.
    const aId = chain[0].from_node_id;
    const a = nodeOf(aId);
    if (!a) continue;
    const diameterM = Math.max(...chain.map((c) => c.diameter_m));
    let cur = chain[chain.length - 1].to_node_id;
    const seen = new Set([aId, cur]);
    for (let next = outPipe(site, cur); next && !seen.has(next.to_node_id); next = outPipe(site, cur)) {
      cur = next.to_node_id;
      seen.add(cur);
      const b = nodeOf(cur);
      if (!b) break;
      // Skip a B that already has a pipe A → B or a relief pipe with that id (applyFix would refuse it).
      const taken = site.assets.conduits.some((c) => c.conduit_id === `RELIEF-${aId}-${cur}` || (c.from_node_id === aId && c.to_node_id === cur));
      if (!taken && b.invert_elevation_m < a.invert_elevation_m - 0.1) {
        push({ kind: 'relief', fromNode: aId, toNode: cur, diameterM }, problem.id);
        break;
      }
    }
  }
  return capCandidates(out);
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

/** A problem's fix: its own best-ranked improving fix, or (`sharedFrom` set) one tied to another problem that also helps here. */
export interface ProblemFix<T extends CandidateResult> { result: T; sharedFrom?: string }

/** The asset in a problem id ("bottleneck:PIPE-P07" → "PIPE-P07"). */
export const problemAsset = (problemId: string) => problemId.slice(problemId.indexOf(':') + 1);

/**
 * The fix to show for each problem. A problem with its own improving fix gets the best-ranked one. Otherwise it falls
 * back to the best-ranked improving fix that lowers that problem's peak: for ponding at the hotspot, the hotspot peak
 * must drop by ≥ 0.01 m (no such fix → no entry); outcomes carry no other per-node or per-pipe peak, so any other
 * problem takes the best improving fix overall. A missing entry means NO_IMPROVING_FIX_TEXT.
 */
export function fixPerProblem<T extends CandidateResult>(
  problems: ReadonlyArray<Problem>, ranked: ReadonlyArray<T>, baseline: Outcome, hotspotNodeId: string,
): Record<string, ProblemFix<T>> {
  const own = bestFixPerProblem(ranked);
  const out: Record<string, ProblemFix<T>> = {};
  for (const p of problems) {
    if (own[p.id]) {
      out[p.id] = { result: own[p.id] };
      continue;
    }
    const other = p.kind === 'ponding' && p.assetId === hotspotNodeId
      ? ranked.find((r) => baseline.hotspotPeakM - r.outcome.hotspotPeakM >= 0.01 - EPS)
      : ranked[0];
    if (other) out[p.id] = { result: other, sharedFrom: other.problemId };
  }
  return out;
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
    const what = p.kind === 'bottleneck' ? 'full' : p.onsetBy === 'flooding' ? 'overflowing' : `water ${m2(PONDING_DEPTH_M)} m`;
    const asset = p.kind === 'bottleneck' && p.pipeIds && p.pipeIds.length > 1 ? p.pipeIds.join(' + ') : p.assetId;
    return `⚠ ${kindName(p)}: ${asset} ${what} at ${mmss(p.onsetS)}`;
  },
  /** A fix tied to another problem that also helps this one. */
  fixedByOther: (sharedFromProblemId: string, label: string) => `Fixed by the ${problemAsset(sharedFromProblemId)} fix: ${label}`,
  problemPending: (p: Problem, i: number, n: number) => `⚠ ${kindName(p)} detected — testing fixes… (${i}/${n})`,
};
