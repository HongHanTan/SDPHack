import dashboard from '@floodops/engine/scenario/dashboard.json';
import { INTERVENTIONS, type InterventionId } from '@floodops/engine/scenario/interventions';
import type { StormId } from '@floodops/engine/scenario/storms';

export interface DashboardMetrics {
  j07PeakM: number;
  homesFlooded: number;
  p07SurchargeMin: number;
  p07PeakUtilPct: number;
  floodedRoadAreaM2: number;
}

export interface EngineOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tag: string;
  description: string;
  finding: string;
  interventions: InterventionId[];
  costRM: number;
  costRating: string;
  timeframe: string;
  recommended: boolean;
  metrics: DashboardMetrics | null;
  dSagVsBaseline: number | null;
  dHomesVsBaseline: number | null;
}

const CARDS: Array<Omit<EngineOption, 'costRM' | 'metrics' | 'dSagVsBaseline' | 'dHomesVsBaseline'>> = [
  { id: 'baseline', title: 'Baseline Condition', subtitle: 'INLET-D07 40% blocked, PIPE-P07 Ø600', icon: '⚠️', tag: 'Baseline', description: 'Current field state from the team scenario.', finding: 'P07 runs full early in the storm; water ponds at the J07 junction and reaches nearby homes.', interventions: [], costRating: 'FREE', timeframe: 'Current', recommended: false },
  { id: 'desilt-d07', title: 'Option 1: Emergency Inlet Desilting', subtitle: 'Clean INLET-D07', icon: '🧹', tag: 'Immediate O&M', description: 'Remove leaf litter and sediment from INLET-D07, restoring full grate capacity.', finding: 'No effect on its own while P07 runs full; adds benefit once P07 is upsized.', interventions: ['desilt-d07'], costRating: 'LOW', timeframe: '< 24 Hours', recommended: false },
  { id: 'upsize-p07', title: 'Option 2: Conduit Upsizing', subtitle: 'PIPE-P07 Ø600 → Ø750', icon: '⬇️', tag: 'Capital Engineering', description: 'Replace trunk conduit PIPE-P07 (J07 → J08) with Ø750 RCP.', finding: 'Removes the P07 bottleneck — the largest single reduction at J07.', interventions: ['upsize-p07'], costRating: 'HIGH', timeframe: '3 - 6 Months', recommended: false },
  { id: 'storage-tank', title: 'Option 4: Underground Storage Tank', subtitle: 'Off-line tank fed from J05', icon: '🛢️', tag: 'Capital Engineering', description: 'Store the peak from J05 and release slowly to J08.', finding: 'Takes the peak off P07 — comparable to upsizing at J07.', interventions: ['storage-tank'], costRating: 'HIGH', timeframe: 'Phased Implementation', recommended: false },
  { id: 'lake-overflow', title: 'Option 5: Overflow to Maple Grove Pond', subtitle: 'Relief pipe J04 → pond', icon: '↪️', tag: 'Green-Blue Infrastructure', description: 'Divert the J04 branch into the retention pond.', finding: 'Partial relief: diverts the east branch away from the trunk.', interventions: ['lake-overflow'], costRating: 'MEDIUM', timeframe: 'Phased Implementation', recommended: false },
  { id: 'combined', title: 'Option 3: Combined Desilting & Upsizing', subtitle: 'Clean D07 + Ø750 P07', icon: '✅', tag: 'Optimal Holistic Solution', description: 'Inlet desilting coupled with conduit upsizing.', finding: 'Upsizing frees P07, and the clean grate then captures more.', interventions: ['desilt-d07', 'upsize-p07'], costRating: 'MEDIUM', timeframe: 'Phased Implementation', recommended: false },
  { id: 'store-peak', title: 'Option 6: Store the Peak', subtitle: 'Tank + pond overflow', icon: '💧', tag: 'Green-Blue Infrastructure', description: 'Storage tank and pond overflow together.', finding: 'Storage-led alternative to upsizing.', interventions: ['storage-tank', 'lake-overflow'], costRating: 'HIGH', timeframe: 'Long-Term Masterplan', recommended: false },
];

const COST = new Map(INTERVENTIONS.map((iv) => [iv.id, iv.costRM]));

export function idsForOption(optionId: string): InterventionId[] {
  return CARDS.find((c) => c.id === optionId)?.interventions ?? [];
}

export const PRECOMPUTED_NOTE = 'Cards precomputed at D07 40% blocked, normal canal level; Apply runs with your HUD choices.';

/** Builds the 7 cards for a storm. The recommended card is the lowest J07 peak (cheaper wins a tie), baseline excluded. */
export function buildDashboardOptions(stormId: StormId): EngineOption[] {
  const table = (dashboard as unknown as Record<string, Record<string, DashboardMetrics>>)[stormId] ?? {};
  const base = table.baseline ?? null;
  const opts: EngineOption[] = CARDS.map((c) => {
    const m = table[c.id] ?? null;
    return {
      ...c,
      costRM: c.interventions.reduce((s, id) => s + (COST.get(id) ?? 0), 0),
      metrics: m,
      dSagVsBaseline: m && base ? Math.round((m.j07PeakM - base.j07PeakM) * 1000) / 1000 : null,
      dHomesVsBaseline: m && base ? m.homesFlooded - base.homesFlooded : null,
    };
  });
  let best: EngineOption | null = null;
  for (const o of opts) {
    if (o.id === 'baseline' || !o.metrics) continue;
    if (!best || o.metrics.j07PeakM < best.metrics!.j07PeakM || (o.metrics.j07PeakM === best.metrics!.j07PeakM && o.costRM < best.costRM)) best = o;
  }
  if (best) best.recommended = true;
  const combined = opts.find((o) => o.id === 'combined')!;
  combined.finding = combined.recommended
    ? `Best result: ${combined.finding.charAt(0).toLowerCase()}${combined.finding.slice(1)}`
    : `Best for 80 mm/h; for this storm ${best?.title.replace(/^Option \d+: /, '') ?? 'another option'} gives a lower J07 peak.`;
  return opts;
}

export function recommendedOption(opts: EngineOption[]): EngineOption | undefined {
  return opts.find((o) => o.recommended);
}
