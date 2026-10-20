import React, { useState } from 'react';
import {
  X,
  Sliders,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  Wrench,
  Building2,
  FileText,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { InterventionOption, ProposedAction, InspectionRecord } from '../types';
import type { EngineOption } from '../engine/dashboardOptions';

interface InterventionDashboardProps {
  onClose: () => void;
  onApplyIntervention: (interventionId: string) => void;
  inspections: InspectionRecord[];
  /** Engine mode: cards and metrics from the engine. Absent: the original SWMM dashboard, unchanged. */
  engineOptions?: EngineOption[];
  /** Engine mode: label of the selected storm, shown in the heading. */
  engineStormLabel?: string;
}

// Labels for the two D07 metric rows. HIS_LABELS is the original wording, verbatim.
const HIS_LABELS = {
  bypass: 'Surface Ponding Runoff',
  bypassShort: 'Surface Ponding',
  bypassUnit: ' m³',
  bypassDigits: 1,
  captured: 'Curb Inflow Captured',
  capturedShort: 'Captured',
  capturedUnit: ' m³',
  capturedDigits: 1,
  capturedBarDigits: 0,
  capturedLowerIsBetter: false,
};

// Engine mode: d07_captured_volume_m3 carries the J07 peak depth, d07_bypass_volume_m3 the homes flooded.
const ENGINE_LABELS: typeof HIS_LABELS = {
  bypass: 'Homes flooded',
  bypassShort: 'Homes flooded',
  bypassUnit: '',
  bypassDigits: 0,
  captured: 'J07 peak water depth (m)',
  capturedShort: 'J07 peak water depth (m)',
  capturedUnit: ' m',
  capturedDigits: 2,
  capturedBarDigits: 2,
  capturedLowerIsBetter: true,
};

const ENGINE_D07_PREFIX =
  'Engine finding: desilting alone has no effect while P07 runs full; schedule together with the P07 upsizing. ';

export const InterventionDashboard: React.FC<InterventionDashboardProps> = ({
  onClose,
  onApplyIntervention,
  inspections,
  engineOptions,
  engineStormLabel,
}) => {
  const [activeTab, setActiveTab] = useState<'compare' | 'actions'>('compare');
  const [selectedOptionId, setSelectedOptionId] = useState<string>(engineOptions ? 'combined' : 'clean_inlet');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  const L = engineOptions ? ENGINE_LABELS : HIS_LABELS;
  const cardCount = engineOptions ? 7 : 4;

  // Engine mode: the engine's cards mapped onto the InterventionOption shape.
  const fromEngine = (o: EngineOption): InterventionOption => ({
    id: o.id as InterventionOption['id'],
    title: o.title,
    subtitle: o.subtitle,
    type: o.id as InterventionOption['type'],
    target_asset: o.interventions.length ? o.interventions.join(' + ') : 'INLET-D07 + PIPE-P07',
    description: `${o.description} — ${o.finding}`,
    tag: o.tag,
    parameters: { hydraulic_loss_fraction: o.interventions.includes('desilt-d07') ? 0 : 0.4, pipe_diameter_mm: o.interventions.includes('upsize-p07') ? 750 : 600, storm_id: '', tailwater_case: 'normal' },
    metrics: {
      total_flooding_volume_m3: o.metrics?.floodedRoadAreaM2 ?? 0,
      surcharge_duration_s: (o.metrics?.p07SurchargeMin ?? 0) * 60,
      d07_captured_volume_m3: o.metrics?.j07PeakM ?? 0,
      d07_bypass_volume_m3: o.metrics?.homesFlooded ?? 0,
      flooded_node_count: o.metrics?.homesFlooded ?? 0,
      peak_conduit_utilization_pct: o.metrics?.p07PeakUtilPct ?? 0,
    },
    feasibility: { timeframe: o.timeframe, cost_rating: o.costRating as InterventionOption['feasibility']['cost_rating'], lead_time_days: 0, crew_type: o.tag },
    is_available: true,
  });

  // Counterfactual Intervention Options based on verified SWMM 5.2.4 calculations
  // Shared boundary: Synthetic 120 mm/h 60min storm, Normal outfall tailwater stage
  const hisOptions: InterventionOption[] = [
    {
      id: 'baseline',
      title: 'Baseline Condition',
      subtitle: 'Baseline (Clogged 40%)',
      type: 'baseline',
      target_asset: 'INLET-D07 + PIPE-P07',
      description: 'Current field state: INLET-D07 curb opening restricted by 40%, downstream conduit remains existing Ø600mm.',
      tag: 'Baseline',
      parameters: {
        hydraulic_loss_fraction: 0.4,
        pipe_diameter_mm: 600,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.014,
        surcharge_duration_s: 3191.9, // 53.2 min
        d07_captured_volume_m3: 445.07,
        d07_bypass_volume_m3: 686.35,
        flooded_node_count: 1,
        peak_conduit_utilization_pct: 98,
      },
      feasibility: {
        timeframe: 'Current',
        cost_rating: 'FREE',
        lead_time_days: 0,
        crew_type: 'None',
      },
      is_available: true,
    },
    {
      id: 'clean_inlet',
      title: 'Option 1: Emergency Inlet Desilting',
      subtitle: 'Clean Inlet D07 (0% Loss)',
      type: 'clean_inlet',
      target_asset: 'INLET-D07',
      description: 'Remove leaf litter and sediment from INLET-D07, restoring 100% nominal capture area (0% loss), conduit remains Ø600mm.',
      tag: 'Immediate O&M',
      parameters: {
        hydraulic_loss_fraction: 0.0,
        pipe_diameter_mm: 600,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.077,
        surcharge_duration_s: 3322.8, // 55.4 min (all runoff captured into subsurface pipe network)
        d07_captured_volume_m3: 741.78,
        d07_bypass_volume_m3: 389.68,
        flooded_node_count: 1,
        peak_conduit_utilization_pct: 100,
      },
      feasibility: {
        timeframe: '< 24 Hours',
        cost_rating: 'LOW',
        lead_time_days: 1,
        crew_type: 'Township O&M Crew (2 staff + Jetting/Vacuum Tanker)',
      },
      is_available: true,
    },
    {
      id: 'upsize_conduit',
      title: 'Option 2: Conduit Upsizing',
      subtitle: 'Upsize Conduit P07 (Ø750mm)',
      type: 'upsize_conduit',
      target_asset: 'PIPE-P07',
      description: 'Upsize downstream trunk conduit PIPE-P07 from Ø600mm to Ø750mm RCP, inlet remains 40% obstructed.',
      tag: 'Capital Engineering',
      parameters: {
        hydraulic_loss_fraction: 0.4,
        pipe_diameter_mm: 750,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.0,
        surcharge_duration_s: 0.0, // 0 min surcharge
        d07_captured_volume_m3: 445.07,
        d07_bypass_volume_m3: 686.35, // Inlet remains choked; surface runoff unchanged
        flooded_node_count: 0,
        peak_conduit_utilization_pct: 58,
      },
      feasibility: {
        timeframe: '3 - 6 Months',
        cost_rating: 'HIGH',
        lead_time_days: 120,
        crew_type: 'Civil Drainage Infrastructure Contractor',
      },
      is_available: true,
    },
    {
      id: 'combined',
      title: 'Option 3: Combined Desilting & Upsizing',
      subtitle: 'Combined Clean & Upsize',
      type: 'combined',
      target_asset: 'INLET-D07 + PIPE-P07',
      description: 'Inlet desilting (0% loss) coupled with conduit upsizing to Ø750mm; surface runoff fully captured with gravity discharge.',
      tag: 'Optimal Holistic Solution',
      parameters: {
        hydraulic_loss_fraction: 0.0,
        pipe_diameter_mm: 750,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.0,
        surcharge_duration_s: 0.0,
        d07_captured_volume_m3: 741.78,
        d07_bypass_volume_m3: 389.68,
        flooded_node_count: 0,
        peak_conduit_utilization_pct: 68,
      },
      feasibility: {
        timeframe: 'Phased Implementation',
        cost_rating: 'MEDIUM',
        lead_time_days: 120,
        crew_type: 'Immediate O&M + Civil CAPEX Pipeline',
      },
      is_available: true,
    },
    {
      id: 'add_storage',
      title: 'Option 4: Upstream Detention Storage',
      subtitle: 'Add Detention Storage (NODE-J06)',
      type: 'add_storage',
      target_asset: 'NODE-J06',
      description: 'Planned 500m³ subsurface box culvert retention for hydrograph attenuation. Contract v1.2.0 comparisons pending.',
      tag: 'Planned (T4/T5)',
      parameters: {
        hydraulic_loss_fraction: 0.0,
        pipe_diameter_mm: 600,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.0,
        surcharge_duration_s: 0.0,
        d07_captured_volume_m3: 741.78,
        d07_bypass_volume_m3: 389.68,
        flooded_node_count: 0,
        peak_conduit_utilization_pct: 50,
      },
      feasibility: {
        timeframe: 'Long-Term Masterplan',
        cost_rating: 'HIGH',
        lead_time_days: 365,
        crew_type: 'Municipal Stormwater Taskforce',
      },
      is_available: false,
      unavailable_reason: 'Backend capability comparisons=false; will be unlocked in T4/T5 retention release.',
    },
  ];
  const options = engineOptions ? engineOptions.map(fromEngine) : hisOptions;

  const baseline = options[0];
  const selectedOption = options.find((o) => o.id === selectedOptionId) || options[1];

  // Calculated deltas relative to baseline
  const bypassDeltaM3 = selectedOption.metrics.d07_bypass_volume_m3 - baseline.metrics.d07_bypass_volume_m3;
  const bypassDeltaPct = ((bypassDeltaM3 / baseline.metrics.d07_bypass_volume_m3) * 100);

  const capturedDeltaM3 = selectedOption.metrics.d07_captured_volume_m3 - baseline.metrics.d07_captured_volume_m3;
  const capturedDeltaPct = ((capturedDeltaM3 / baseline.metrics.d07_captured_volume_m3) * 100);

  const surchargeDeltaS = selectedOption.metrics.surcharge_duration_s - baseline.metrics.surcharge_duration_s;
  const surchargeDeltaMin = surchargeDeltaS / 60;

  // Structured Proposed Actions
  const proposedActions: ProposedAction[] = [
    {
      id: 'WO-OPS-2026-10-19-D07',
      priority: 'CRITICAL',
      category: 'OPERATIONAL_MAINTENANCE',
      target_asset: 'INLET-D07 (Jalan Kyra 1/2 Intersection Curb Inlet)',
      title: 'Emergency Curb Inlet & Grate Desilting Work Order',
      justification:
        (engineOptions ? ENGINE_D07_PREFIX : '') +
        'Inspection record #INSP-2026-10-18-001 indicates 65% leaf litter coverage causing ~40% hydraulic restriction loss. SWMM modeling confirms desilting reduces street ponding by 296.7 m³ (-43.2%).',
      evidence_reference: 'Inspection #INSP-2026-10-18-001 (Inspector Azman, Photo Attachment)',
      expected_hydraulic_impact: 'Surface bypass runoff cut from 686.35 m³ to 389.68 m³; captured subsurface flow increases by 66.7%.',
      action_steps: [
        'Dispatch Township O&M Crew (2 personnel) with high-pressure jetting/suction tanker to INLET-D07.',
        'Manually clear accumulated leaf litter and debris from 1.8m × 0.15m curb throat and grate surface.',
        'Vacuum out the catch pit sump, verify throat clear area, and photograph completion for digital sign-off.',
      ],
      responsible_entity: 'Township O&M Infrastructure Center',
      estimated_lead_time: 'Within 24 Hours (Prior to next monsoon squall warning)',
    },
    {
      id: 'PR-ENG-2026-Q4-P07',
      priority: 'HIGH',
      category: 'CAPITAL_ENGINEERING',
      target_asset: 'PIPE-P07 (Trunk Storm Conduit connecting NODE-J07 to NODE-J08, L=38m)',
      title: 'Trunk Conduit Hydraulic Conveyance Verification & Upsizing Recommendation',
      justification:
        'Dynamic simulation shows that upon full inlet capture, existing Ø600mm conduit surcharges for 55.4 minutes under 120 mm/h storm, acting as a downstream bottleneck. Upsizing is required to convey design discharge.',
      evidence_reference: 'EPA SWMM 5.2.4 Dynamic Simulation Engine (taman_kyra_synthetic_v1)',
      expected_hydraulic_impact: 'Upsizing to Ø750mm reduces surcharge duration from 55.4 min to 0 min (-100%), eliminating backwater pressure.',
      action_steps: [
        'Enroll PIPE-P07 into FY2027 Municipal Stormwater Capital Expenditure (CAPEX) budget.',
        'Engage Professional Engineer (PE) for utility mapping and longitudinal invert slope verification.',
        'Issue engineering tender for pipe jacking or cut-and-cover replacement with Ø750mm Class 4 RCP.',
      ],
      responsible_entity: 'Planning & Civil Infrastructure Department',
      estimated_lead_time: '3 - 6 Months Execution Window',
    },
  ];

  const handleCopyReport = () => {
    const text = `# Township FloodOps — Mitigation Decision & Engineering Report
Generated: ${new Date().toLocaleString()}
Model Baseline: taman_kyra_synthetic_v1 | Engine: EPA SWMM 5.2.4 (Simulated)
Rainfall Scenario: 120 mm/h Extreme Monsoon Rain (60 min) | Tailwater: Free Outfall (Normal)

## 1. Scenario Comparison Findings
- Baseline Condition: Surface bypass runoff 686.35 m³, conduit surcharged 53.2 min
- Inlet Desilting (Clean Inlet): Surface bypass runoff reduced to 389.68 m³ (-43.2% mitigation), conduit surcharged 55.4 min
- Conduit Upsizing (Upsize P07): Conduit surcharge reduced to 0 min (-100%), but surface ponding remains at 686.35 m³
- Combined Mitigation (Clean + Upsize): Surface ponding reduced by 43.2%, conduit surcharge 100% eliminated!

## 2. Recommended Action Work Orders
1. [CRITICAL 24h] ${proposedActions[0].title}
   - Target: ${proposedActions[0].target_asset}
   - Field Evidence: ${proposedActions[0].evidence_reference}
   - Expected Benefit: ${proposedActions[0].expected_hydraulic_impact}

2. [HIGH Long-Term] ${proposedActions[1].title}
   - Target: ${proposedActions[1].target_asset}
   - Engineering Scope: ${proposedActions[1].justification}
   - Expected Benefit: ${proposedActions[1].expected_hydraulic_impact}

Disclaimer: This report is generated from a synthetic digital twin (taman_kyra_synthetic_v1) simulation and does not constitute construction drawings or commercial tenders.`;

    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm pointer-events-auto p-4 select-none animate-in fade-in">
      <div className="w-full max-w-5xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Mitigation & Counterfactual Decision Report
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono font-semibold border border-emerald-200">
                  EPA SWMM 5.2.4 Verified
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-mono font-semibold border border-red-200">
                  Taman Kyra Twin
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {engineOptions
                  ? `Multi-Scenario Hydraulic Evaluation (${engineStormLabel ?? 'Engine'} Storm)`
                  : 'Multi-Scenario Hydraulic Evaluation (120 mm/h 60min Storm Benchmark)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tabs */}
            <div className="flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'compare'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Scenario Comparison</span>
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'actions'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Action Work Orders</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {activeTab === 'compare' ? (
            <>
              {/* Option Selector Cards */}
              <div>
                <label className="text-xs font-bold text-slate-800 block mb-2">
                  Select Mitigation Candidate:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {options.slice(0, cardCount).map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    const isBase = opt.id === 'baseline';

                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between text-left ${
                          isSelected
                            ? 'bg-red-50/60 border-2 border-red-600 shadow-md shadow-red-600/10'
                            : 'bg-slate-50/80 border-slate-200 hover:border-slate-300 hover:bg-slate-100/70'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                                isBase
                                  ? 'bg-slate-200 text-slate-700'
                                  : opt.id === 'clean_inlet'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : opt.id === 'upsize_conduit'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}
                            >
                              {opt.tag}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-red-600 shrink-0" />}
                          </div>

                          <h4 className="text-xs font-bold text-slate-900">{opt.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono block mb-1.5">
                            {opt.subtitle}
                          </span>
                          <p className="text-[11px] text-slate-600 leading-snug line-clamp-2">
                            {opt.description}
                          </p>
                        </div>

                        <div className="pt-2.5 mt-2.5 border-t border-slate-200/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">Lead: {opt.feasibility.timeframe}</span>
                          <span
                            className={`font-bold ${
                              opt.feasibility.cost_rating === 'FREE'
                                ? 'text-slate-500'
                                : opt.feasibility.cost_rating === 'LOW'
                                ? 'text-emerald-700'
                                : opt.feasibility.cost_rating === 'MEDIUM'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            Cost: {opt.feasibility.cost_rating}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side-by-side KPI Delta Breakdown */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-4">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Key Hydraulic Performance Metrics
                    </span>
                    <span className="text-xs text-slate-500">
                      (Benchmarked against Baseline: 40% Clogged, Ø600mm)
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    Active: <span className="text-red-600 font-bold">{selectedOption.title}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Metric 1: Surface Bypass Volume */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">
                        {L.bypass}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-red-600">
                          {selectedOption.metrics.d07_bypass_volume_m3.toFixed(L.bypassDigits)}{L.bypassUnit}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          {baseline.metrics.d07_bypass_volume_m3.toFixed(L.bypassDigits)}{L.bypassUnit}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      {selectedOption.id === 'baseline' ? (
                        <span className="text-slate-400">Baseline Benchmark</span>
                      ) : bypassDeltaM3 < 0 ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {bypassDeltaPct.toFixed(1)}% ({bypassDeltaM3.toFixed(L.bypassDigits)}{L.bypassUnit})
                        </span>
                      ) : (
                        <span className="text-slate-400">No Change</span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">Lower is Better</span>
                    </div>
                  </div>

                  {/* Metric 2: Inlet Captured Volume */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">
                        {L.captured}
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-blue-600">
                          {selectedOption.metrics.d07_captured_volume_m3.toFixed(L.capturedDigits)}{L.capturedUnit}
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          {baseline.metrics.d07_captured_volume_m3.toFixed(L.capturedDigits)}{L.capturedUnit}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      {selectedOption.id === 'baseline' ? (
                        <span className="text-slate-400">Baseline Benchmark</span>
                      ) : L.capturedLowerIsBetter ? (
                        capturedDeltaM3 < 0 ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {capturedDeltaPct.toFixed(1)}% ({capturedDeltaM3.toFixed(L.capturedDigits)}{L.capturedUnit})
                          </span>
                        ) : capturedDeltaM3 > 0 ? (
                          <span className="text-rose-700 font-bold flex items-center gap-0.5">
                            <TrendingUp className="w-3.5 h-3.5" />
                            +{capturedDeltaPct.toFixed(1)}% (+{capturedDeltaM3.toFixed(L.capturedDigits)}{L.capturedUnit})
                          </span>
                        ) : (
                          <span className="text-slate-400">No Change</span>
                        )
                      ) : capturedDeltaM3 > 0 ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{capturedDeltaPct.toFixed(1)}% (+{capturedDeltaM3.toFixed(1)} m³)
                        </span>
                      ) : (
                        <span className="text-slate-400">No Change</span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">
                        {L.capturedLowerIsBetter ? 'Lower is Better' : 'Higher is Better'}
                      </span>
                    </div>
                  </div>

                  {/* Metric 3: Sewer Surcharge Duration */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">
                        Conduit Surcharge Duration
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-bold font-mono text-amber-600">
                          {(selectedOption.metrics.surcharge_duration_s / 60).toFixed(1)} min
                        </span>
                        <span className="text-[10px] text-slate-400 line-through">
                          {(baseline.metrics.surcharge_duration_s / 60).toFixed(1)} min
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      {selectedOption.id === 'baseline' ? (
                        <span className="text-slate-400">Baseline Benchmark</span>
                      ) : selectedOption.metrics.surcharge_duration_s === 0 ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          100% Eliminated
                        </span>
                      ) : surchargeDeltaMin > 0 ? (
                        <span className="text-rose-700 font-bold flex items-center gap-0.5">
                          +{surchargeDeltaMin.toFixed(1)} min (Full Inflow)
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">
                          {surchargeDeltaMin.toFixed(1)} min
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-medium">Pipe Pressure</span>
                    </div>
                  </div>

                  {/* Metric 4: Conduit Capacity Utilization */}
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-medium text-slate-500 block mb-1">
                        Peak Pipe Utilization (PIPE-P07)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-xl font-bold font-mono ${
                            selectedOption.metrics.peak_conduit_utilization_pct >= 95
                              ? 'text-red-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {selectedOption.metrics.peak_conduit_utilization_pct}%
                        </span>
                        <span className="text-xs text-slate-400">
                          (Ø{selectedOption.parameters.pipe_diameter_mm}mm)
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span
                        className={`font-semibold ${
                          selectedOption.metrics.peak_conduit_utilization_pct >= 95
                            ? 'text-rose-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        {selectedOption.metrics.peak_conduit_utilization_pct >= 95
                          ? 'Pressurized'
                          : 'Gravity Free Flow'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Conveyance</span>
                    </div>
                  </div>
                </div>

                {/* Comparative Bar Visualization */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5">
                  <div className="text-xs font-bold text-slate-800">
                    Multi-Scenario Water Balance Routing Partitioning:
                  </div>

                  {options.slice(0, cardCount).map((opt) => {
                    const totalVolume = opt.metrics.d07_captured_volume_m3 + opt.metrics.d07_bypass_volume_m3;
                    const capturedPct = (opt.metrics.d07_captured_volume_m3 / totalVolume) * 100;
                    const bypassPct = (opt.metrics.d07_bypass_volume_m3 / totalVolume) * 100;

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-800 font-semibold">
                            {opt.title}{' '}
                            <span className="text-slate-400 font-normal">({opt.subtitle})</span>
                          </span>
                          <span className="font-mono text-slate-600 text-[10px]">
                            {L.capturedShort}: {opt.metrics.d07_captured_volume_m3.toFixed(L.capturedBarDigits)}{L.capturedUnit} ({capturedPct.toFixed(0)}%) | {L.bypassShort}: {opt.metrics.d07_bypass_volume_m3.toFixed(0)}{L.bypassUnit} ({bypassPct.toFixed(0)}%)
                          </span>
                        </div>
                        {/* Stacked bar */}
                        <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200">
                          <div
                            style={{ width: `${capturedPct}%` }}
                            className="bg-blue-500 hover:bg-blue-600 transition-all flex items-center justify-center text-[9px] font-mono text-white font-bold"
                            title={`Captured Inflow: ${opt.metrics.d07_captured_volume_m3.toFixed(1)} m³`}
                          >
                            {capturedPct > 18 ? 'Captured' : ''}
                          </div>
                          <div
                            style={{ width: `${bypassPct}%` }}
                            className="bg-rose-500 hover:bg-rose-600 transition-all flex items-center justify-center text-[9px] font-mono text-white font-bold"
                            title={`Surface Ponding Bypass: ${opt.metrics.d07_bypass_volume_m3.toFixed(1)} m³`}
                          >
                            {bypassPct > 18 ? 'Surface Ponding' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Concise Executive Takeaways (Clean 3-Bullet Decision Architecture) */}
                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 leading-relaxed space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>Executive Summary & Engineering Insight:</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-amber-900 pl-1">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold shrink-0">1. Immediate O&M (24h):</span>
                      <span>
                        Desilting INLET-D07 eliminates <strong>43.2% of surface street ponding</strong> (-296.7 m³) immediately by restoring full grate capture aperture.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-700 font-bold shrink-0">2. Downstream Reality:</span>
                      <span>
                        Conveying all surface runoff into existing Ø600mm conduit causes a <strong>55.4 min pressurized pipe surcharge</strong> because the subsurface network becomes the primary bottleneck.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-700 font-bold shrink-0">3. Capital Work (CAPEX):</span>
                      <span>
                        Upsizing downstream trunk conduit PIPE-P07 to <strong>Ø750mm permanently eliminates surcharge</strong>, allowing full gravity free-flow to the retention pond.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </>
          ) : (
            /* Action Plans Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Traceable Action Orders & Work Recommendations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Engineering evidence chain backed by SWMM hydrodynamic modeling & {inspections.length} field records
                  </p>
                </div>
                <button
                  onClick={handleCopyReport}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border border-slate-200 shadow-xs"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700 font-bold">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copy Work Orders</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Cards */}
              <div className="space-y-3.5">
                {proposedActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {action.category === 'OPERATIONAL_MAINTENANCE' ? (
                          <Wrench className="w-4 h-4 text-red-600 shrink-0" />
                        ) : (
                          <Building2 className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            action.priority === 'CRITICAL'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {action.priority === 'CRITICAL' ? 'EMERGENCY WORK ORDER' : 'CAPITAL ENGINEERING'}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-500">{action.id}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Lead Time: {action.estimated_lead_time}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{action.title}</h4>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                        Target Asset: <strong className="text-slate-800">{action.target_asset}</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5 shadow-xs">
                      <div>
                        <strong className="text-slate-700">Justification: </strong>
                        <span className="text-slate-600">{action.justification}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px] pt-1">
                        <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>Evidence Source: {action.evidence_reference}</span>
                      </div>
                    </div>

                    {/* Action Steps */}
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-800">Action Steps:</span>
                      <ol className="list-decimal list-inside space-y-0.5 text-xs text-slate-600 pl-1">
                        {action.action_steps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 font-medium">
                      <span>Responsible: {action.responsible_entity}</span>
                      <span className="text-emerald-700 font-bold">
                        Benefit: {action.expected_hydraulic_impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 bg-slate-50">
          <div className="text-xs text-slate-600">
            Selected Option:{' '}
            <strong className="text-slate-900 font-bold">{selectedOption.title}</strong>{' '}
            <span className="text-slate-500 font-medium">({selectedOption.tag})</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onApplyIntervention(selectedOption.id);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-600/20 active:scale-95"
            >
              <span>Apply Option to 3D Twin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
