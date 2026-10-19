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
  Info,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { InterventionOption, ProposedAction, InspectionRecord } from '../types';

interface InterventionDashboardProps {
  onClose: () => void;
  onApplyIntervention: (interventionId: string) => void;
  inspections: InspectionRecord[];
}

export const InterventionDashboard: React.FC<InterventionDashboardProps> = ({
  onClose,
  onApplyIntervention,
  inspections,
}) => {
  const [activeTab, setActiveTab] = useState<'compare' | 'actions'>('compare');
  const [selectedOptionId, setSelectedOptionId] = useState<string>('clean_inlet');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Counterfactual Intervention Options based on verified SWMM 5.2.4 calculations
  // Shared boundary: Synthetic 120 mm/h 60min storm, Normal outfall tailwater stage
  const options: InterventionOption[] = [
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md pointer-events-auto p-4 select-none">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Interventions & Mitigation Action Plan
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
                  EPA SWMM 5.2.4 Verified
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                  Synthetic Twin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Hydraulic Scenario Comparison: Shared 120 mm/h 60min Storm & Free Outfall
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 mr-2">
              <button
                onClick={() => setActiveTab('compare')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'compare'
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Scenario Comparison</span>
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'actions'
                    ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Action Work Orders</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'compare' ? (
            <>
              {/* Option Selector Cards */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2.5">
                  Select Mitigation Option Candidate:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {options.slice(0, 4).map((opt) => {
                    const isSelected = selectedOptionId === opt.id;
                    const isBase = opt.id === 'baseline';

                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedOptionId(opt.id)}
                        className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between text-left ${
                          isSelected
                            ? 'bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-950/50'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                isBase
                                  ? 'bg-slate-800 text-slate-300'
                                  : opt.id === 'clean_inlet'
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : opt.id === 'upsize_conduit'
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              }`}
                            >
                              {opt.tag}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                          </div>

                          <h4 className="text-xs font-bold text-slate-200">{opt.title}</h4>
                          <span className="text-[10px] text-slate-400 font-mono block mb-2">
                            {opt.subtitle}
                          </span>
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {opt.description}
                          </p>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                          <span className="text-slate-500">Lead Time: {opt.feasibility.timeframe}</span>
                          <span
                            className={`font-semibold ${
                              opt.feasibility.cost_rating === 'FREE'
                                ? 'text-slate-400'
                                : opt.feasibility.cost_rating === 'LOW'
                                ? 'text-emerald-400'
                                : opt.feasibility.cost_rating === 'MEDIUM'
                                ? 'text-amber-400'
                                : 'text-rose-400'
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
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4.5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">
                      Hydraulic Metric Comparison (Relative Delta Analysis)
                    </span>
                    <span className="text-xs text-slate-400">
                      — Relative to Baseline (40% Loss, Ø600mm)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Viewing: <span className="text-cyan-400 font-bold">{selectedOption.title}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Metric 1: Surface Bypass Volume */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        Surface Bypass Runoff (Ponding)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold font-mono text-rose-400">
                          {selectedOption.metrics.d07_bypass_volume_m3.toFixed(1)} m³
                        </span>
                        <span className="text-[10px] text-slate-500 line-through">
                          {baseline.metrics.d07_bypass_volume_m3.toFixed(1)} m³
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      {selectedOption.id === 'baseline' ? (
                        <span className="text-slate-500">Baseline Reference</span>
                      ) : bypassDeltaM3 < 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {bypassDeltaPct.toFixed(1)}% ({bypassDeltaM3.toFixed(1)} m³)
                        </span>
                      ) : (
                        <span className="text-slate-400">No Change</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">Lower is Better</span>
                    </div>
                  </div>

                  {/* Metric 2: Inlet Captured Volume */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        Curb Inlet Captured Flow
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold font-mono text-blue-400">
                          {selectedOption.metrics.d07_captured_volume_m3.toFixed(1)} m³
                        </span>
                        <span className="text-[10px] text-slate-500 line-through">
                          {baseline.metrics.d07_captured_volume_m3.toFixed(1)} m³
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      {selectedOption.id === 'baseline' ? (
                        <span className="text-slate-500">Baseline Reference</span>
                      ) : capturedDeltaM3 > 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{capturedDeltaPct.toFixed(1)}% (+{capturedDeltaM3.toFixed(1)} m³)
                        </span>
                      ) : (
                        <span className="text-slate-400">No Change</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">Higher is Better</span>
                    </div>
                  </div>

                  {/* Metric 3: Sewer Surcharge Duration */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        Conduit Surcharge Duration
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold font-mono text-amber-400">
                          {(selectedOption.metrics.surcharge_duration_s / 60).toFixed(1)} min
                        </span>
                        <span className="text-[10px] text-slate-500 line-through">
                          {(baseline.metrics.surcharge_duration_s / 60).toFixed(1)} min
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      {selectedOption.id === 'baseline' ? (
                        <span className="text-slate-500">Baseline Reference</span>
                      ) : selectedOption.metrics.surcharge_duration_s === 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          -100% (Fully Eliminated)
                        </span>
                      ) : surchargeDeltaMin > 0 ? (
                        <span className="text-rose-400 font-medium flex items-center gap-0.5">
                          +{surchargeDeltaMin.toFixed(1)} min (Full Inflow)
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">
                          {surchargeDeltaMin.toFixed(1)} min
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">Downstream Pressure</span>
                    </div>
                  </div>

                  {/* Metric 4: Conduit Capacity Utilization */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        Trunk Conduit Peak Capacity (PIPE-P07)
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-lg font-bold font-mono ${
                            selectedOption.metrics.peak_conduit_utilization_pct >= 95
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {selectedOption.metrics.peak_conduit_utilization_pct}%
                        </span>
                        <span className="text-xs text-slate-500">
                          (Ø{selectedOption.parameters.pipe_diameter_mm}mm)
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span
                        className={
                          selectedOption.metrics.peak_conduit_utilization_pct >= 95
                            ? 'text-rose-400 font-medium'
                            : 'text-emerald-400 font-medium'
                        }
                      >
                        {selectedOption.metrics.peak_conduit_utilization_pct >= 95
                          ? 'Surcharged'
                          : 'Gravity Free Flow'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Manning Q</span>
                    </div>
                  </div>
                </div>

                {/* Comparative Bar Visualization */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    Multi-Scenario Water Balance & Routing Partitioning:
                  </div>

                  {options.slice(0, 4).map((opt) => {
                    const totalVolume = opt.metrics.d07_captured_volume_m3 + opt.metrics.d07_bypass_volume_m3;
                    const capturedPct = (opt.metrics.d07_captured_volume_m3 / totalVolume) * 100;
                    const bypassPct = (opt.metrics.d07_bypass_volume_m3 / totalVolume) * 100;

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-300 font-medium">
                            {opt.title}{' '}
                            <span className="text-slate-500 font-normal">({opt.subtitle})</span>
                          </span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            Captured: {opt.metrics.d07_captured_volume_m3.toFixed(0)} m³ ({capturedPct.toFixed(0)}%) | Surface Ponding: {opt.metrics.d07_bypass_volume_m3.toFixed(0)} m³ ({bypassPct.toFixed(0)}%)
                          </span>
                        </div>
                        {/* Stacked bar */}
                        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                          <div
                            style={{ width: `${capturedPct}%` }}
                            className="bg-blue-500/80 hover:bg-blue-500 transition-all flex items-center justify-center text-[9px] font-mono text-white font-bold"
                            title={`Captured Inflow: ${opt.metrics.d07_captured_volume_m3.toFixed(1)} m³`}
                          >
                            {capturedPct > 15 ? 'Captured' : ''}
                          </div>
                          <div
                            style={{ width: `${bypassPct}%` }}
                            className="bg-rose-500/80 hover:bg-rose-500 transition-all flex items-center justify-center text-[9px] font-mono text-white font-bold"
                            title={`Surface Ponding Bypass: ${opt.metrics.d07_bypass_volume_m3.toFixed(1)} m³`}
                          >
                            {bypassPct > 15 ? 'Surface Bypass' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Physical Hydraulic Insight Callout */}
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Core Hydraulic & Civil Engineering Revelation:</span>
                  </div>
                  <p>
                    <strong>Divergence Between Blueprint Design and Field Reality:</strong> When curb inlets are obstructed, rainwater ponds on the surface (Bypass up to 686 m³). Subsurface conduits appear artificially "under capacity" merely because runoff cannot enter the drainage network.
                  </p>
                  <p>
                    If <strong>only inlet desilting</strong> is executed, surface ponding drops dramatically by 43.2% (-296.7 m³), but the massive influx of runoff immediately forces the existing Ø600mm conduit into prolonged pressurized surcharge for 55.4 minutes.
                    Conversely, if <strong>only the conduit is upsized without clearing the inlet</strong>, stormwater cannot enter the choked throat, leaving surface street ponding completely unchanged.
                  </p>
                  <p className="text-amber-100 font-semibold">
                    👉 Scientific Mitigation Strategy: Dispatch emergency O&M crew to clear inlet grates immediately (eliminating surface street ponding), while programming downstream PIPE-P07 upsizing into municipal capital expenditure (CAPEX) to permanently resolve network surcharge bottlenecks.
                  </p>
                </div>
              </div>
            </>
          ) : (
            /* Action Plans Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Traceable Action Orders & Engineering Recommendations
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Traceable evidence chain linked to SWMM hydraulic modeling & {inspections.length} field inspections (Focal: INLET-D07)
                  </p>
                </div>
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Work Orders</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Cards */}
              <div className="space-y-4">
                {proposedActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-4.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {action.category === 'OPERATIONAL_MAINTENANCE' ? (
                          <Wrench className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : (
                          <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            action.priority === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {action.priority === 'CRITICAL' ? 'EMERGENCY WORK ORDER' : 'CAPITAL ENGINEERING'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{action.id}</span>
                      </div>
                      <span className="text-xs font-medium text-cyan-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Lead Time: {action.estimated_lead_time}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{action.title}</h4>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        Target Asset: <strong className="text-slate-200">{action.target_asset}</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-xs space-y-1.5">
                      <div>
                        <strong className="text-slate-300">Work Order Justification: </strong>
                        <span className="text-slate-400">{action.justification}</span>
                      </div>
                      <div className="flex items-center gap-2 text-cyan-300 font-mono text-[11px] pt-1">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>Evidence Source: {action.evidence_reference}</span>
                      </div>
                    </div>

                    {/* Action Steps */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-300">Implementation Action Steps:</span>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400 pl-1">
                        {action.action_steps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span>Responsible Entity: {action.responsible_entity}</span>
                      <span className="text-emerald-400 font-medium">
                        Expected Hydraulic Benefit: {action.expected_hydraulic_impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Provenance Footer */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Model Provenance & Engineering Audit Trail:</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[10px] text-slate-500">
                  <div>Model: taman_kyra_synthetic_v1</div>
                  <div>Engine: EPA SWMM 5.2.4</div>
                  <div>Field Record: #INSP-2026-10-18-001</div>
                  <div>Audit Status: Verified Snapshot</div>
                </div>
              </div>
            </div>
          )}

          {/* Strict Engineering Disclaimer */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong>[ENGINEERING & LEGAL DISCLAIMER]</strong>{' '}
              This comparison and proposed action orders are derived from an uncalibrated synthetic digital twin model (taman_kyra_synthetic_v1) and EPA SWMM 5.2.4 hydrodynamic simulation. They do not constitute official construction engineering drawings, commercial contractor bids, or certified real-world flood forecasts for Taman Kyra. Any civil engineering interventions must be verified on-site by a registered Professional Engineer (PE) and municipal drainage authorities prior to execution.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            Selected Option:{' '}
            <strong className="text-cyan-400">{selectedOption.title}</strong>{' '}
            <span className="text-slate-500">({selectedOption.tag})</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={() => {
                onApplyIntervention(selectedOption.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
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
