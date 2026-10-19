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
      title: '基线现状工况',
      subtitle: 'Baseline (Clogged 40%)',
      type: 'baseline',
      target_asset: 'INLET-D07 + PIPE-P07',
      description: '维持当前现场状态：INLET-D07 喉口受阻 40%，下游管道维持现有 Ø600mm 规格。',
      tag: '现状基准',
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
        timeframe: '现状',
        cost_rating: 'FREE',
        lead_time_days: 0,
        crew_type: '无',
      },
      is_available: true,
    },
    {
      id: 'clean_inlet',
      title: '方案一：进水口应急清淤',
      subtitle: 'Clean Inlet D07 (0% Loss)',
      type: 'clean_inlet',
      target_asset: 'INLET-D07',
      description: '清除 INLET-D07 喉口枯枝树叶与沉砂，恢复理论 100% 收水截面（0% 水力损失），管道仍为 Ø600mm。',
      tag: '立即运维措施',
      parameters: {
        hydraulic_loss_fraction: 0.0,
        pipe_diameter_mm: 600,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.077,
        surcharge_duration_s: 3322.8, // 55.4 min (雨水全部进入地下管网，管网满负荷)
        d07_captured_volume_m3: 741.78,
        d07_bypass_volume_m3: 389.68,
        flooded_node_count: 1,
        peak_conduit_utilization_pct: 100,
      },
      feasibility: {
        timeframe: '< 24 小时',
        cost_rating: 'LOW',
        lead_time_days: 1,
        crew_type: '市政环境清扫班组 (2人 + 吸污车)',
      },
      is_available: true,
    },
    {
      id: 'upsize_conduit',
      title: '方案二：下游管道扩径改造',
      subtitle: 'Upsize Conduit P07 (Ø750mm)',
      type: 'upsize_conduit',
      target_asset: 'PIPE-P07',
      description: '将下游输送主干管 PIPE-P07 规格由 Ø600mm 扩建至 Ø750mm 钢筋混凝土管，但进水口仍维持 40% 堵塞。',
      tag: '中长期工程改造',
      parameters: {
        hydraulic_loss_fraction: 0.4,
        pipe_diameter_mm: 750,
        storm_id: 'synthetic_120mmh_60min',
        tailwater_case: 'normal',
      },
      metrics: {
        total_flooding_volume_m3: 0.0,
        surcharge_duration_s: 0.0, // 0 min 超载
        d07_captured_volume_m3: 445.07,
        d07_bypass_volume_m3: 686.35, // 进水口依然受阻，路面积水未改善！
        flooded_node_count: 0,
        peak_conduit_utilization_pct: 58,
      },
      feasibility: {
        timeframe: '3 - 6 个月',
        cost_rating: 'HIGH',
        lead_time_days: 120,
        crew_type: '市政道路开挖与管道工程承包商',
      },
      is_available: true,
    },
    {
      id: 'combined',
      title: '方案三：清淤 + 扩径综合治理',
      subtitle: 'Combined Clean & Upsize',
      type: 'combined',
      target_asset: 'INLET-D07 + PIPE-P07',
      description: '进水口清淤（0% 损失）结合下游干管扩径至 Ø750mm，地表雨水充分下渗且地下管网顺畅外排至出水口。',
      tag: '系统性最优解',
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
        timeframe: '分期实施',
        cost_rating: 'MEDIUM',
        lead_time_days: 120,
        crew_type: '清扫班组即刻响应 + 规划扩径立项',
      },
      is_available: true,
    },
    {
      id: 'add_storage',
      title: '方案四：上游节点调蓄池',
      subtitle: 'Add Detention Storage (NODE-J06)',
      type: 'add_storage',
      target_asset: 'NODE-J06',
      description: '在支路汇流节点规划 500m³ 地下调蓄箱涵削峰。当前后端契约版本 v1.2.0 未开放 comparisons 求解。',
      tag: '规划中 (T4/T5)',
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
        timeframe: '长期规划',
        cost_rating: 'HIGH',
        lead_time_days: 365,
        crew_type: '市政水务规划专项',
      },
      is_available: false,
      unavailable_reason: '后端能力 comparisons=false；将在 T4/T5 水力调蓄版本中开放支持。',
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
      target_asset: 'INLET-D07 (Jalan Kyra 1/2 交叉口进水雨水口)',
      title: '进水口喉口与格栅应急清淤排障工单',
      justification:
        '现场巡检记录 #INSP-2026-10-18-001 表明格栅枯枝落叶覆盖达 65%，造成约 40% 水力截流损失。SWMM 计算显示清淤后可削减地表道路积水 296.7 m³ (-43.2%)。',
      evidence_reference: 'Inspection #INSP-2026-10-18-001 (Inspector Azman, Photo Attachment)',
      expected_hydraulic_impact: '地表旁路积水由 686.35 m³ 降至 389.68 m³；有效截流入渗量提升 66.7%。',
      action_steps: [
        '调派环境清扫二组（2人）携小型高压冲洗吸污车到达 INLET-D07。',
        '人工铲除 1.8m × 0.15m 进水喉口上沿及格栅网面的堆积枯叶与塑料杂物。',
        '对沉砂槽进行吸污排空，复测孔口净过水截面，拍照打卡上传闭环。',
      ],
      responsible_entity: '市政基础设施日常运维保障中心 (Township O&M Unit)',
      estimated_lead_time: '24 小时内（下一场暴雨预警前必须闭环）',
    },
    {
      id: 'PR-ENG-2026-Q4-P07',
      priority: 'HIGH',
      category: 'CAPITAL_ENGINEERING',
      target_asset: 'PIPE-P07 (连通 NODE-J07 至 NODE-J08 之主干雨水管，长 38m)',
      title: '主干雨水管道过流能力复核与扩径改造建议',
      justification:
        '动态水力验算显示，当进水口恢复全额收水时，现有 Ø600mm 管道在 120 mm/h 极端暴雨下持续满管顶托超载 55.4 分钟，为下游排水瓶颈。建议扩增管径以承载完全下渗流量。',
      evidence_reference: 'EPA SWMM 5.2.4 Dynamic Simulation Engine (taman_kyra_synthetic_v1)',
      expected_hydraulic_impact: '扩径至 Ø750mm 后，管道超载时长由 55.4 min 降至 0 min (-100%)，彻底消除管网反压。',
      action_steps: [
        '将 PIPE-P07 列入 2027 年度市政雨水干网资本性工程改造预算规划 (CAPEX)。',
        '聘请注册土木/水利工程师进行沿线地下综合管线物探核查与纵断面坡度校核。',
        '编制施工招投标文件，采用非开挖顶管或分段浅埋开挖工艺，将管径扩增为 Ø750mm 钢筋混凝土管。',
      ],
      responsible_entity: '规划开发与水务工程部 (Planning & Civil Infrastructure Dept)',
      estimated_lead_time: '3 - 6 个月工程实施期',
    },
  ];

  const handleCopyReport = () => {
    const text = `# Township FloodOps — 治理决策与工程建议报告
生成时间: ${new Date().toLocaleString()}
模型基线: taman_kyra_synthetic_v1 | 引擎: EPA SWMM 5.2.4 (Simulated)
降雨情景: 120 mm/h 极端季风降雨 (60 min) | 尾水: 自由出流 (Normal)

## 1. 方案比选结论
- 基线工况 (Baseline): 地表旁路积水 686.35 m³，管道超载 53.2 min
- 进水口清淤 (Clean Inlet): 地表旁路积水削减至 389.68 m³ (-43.2% 改善)，管道超载 55.4 min
- 管道扩径改造 (Upsize P07): 管道超载降为 0 min (-100% 改善)，但地表仍积水 686.35 m³
- 综合治理方案 (Clean + Upsize): 地表积水削减 43.2%，管道超载 100% 消除！

## 2. 建议行动工单
1. [CRITICAL 24h] ${proposedActions[0].title}
   - 对象: ${proposedActions[0].target_asset}
   - 现场依据: ${proposedActions[0].evidence_reference}
   - 预期收益: ${proposedActions[0].expected_hydraulic_impact}

2. [HIGH 中长期] ${proposedActions[1].title}
   - 对象: ${proposedActions[1].target_asset}
   - 改造建议: ${proposedActions[1].justification}
   - 预期收益: ${proposedActions[1].expected_hydraulic_impact}

免责声明: 本报告基于合成数字化孪生模型 (taman_kyra_synthetic_v1) 仿真生成，非施工图纸或工程报价。`;

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
                  方案对比与治理决策 (Interventions & Action Plan)
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
                  EPA SWMM 5.2.4 Verified
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                  Synthetic Twin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                严谨水动力学工况对比：共享 120 mm/h 60min 暴雨条件与自由出流尾水
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
                <span>方案指标对比</span>
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
                <span>建议行动工单</span>
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
                  选择治理干预方案 (Select Intervention Candidate):
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
                          <span className="text-slate-500">时限: {opt.feasibility.timeframe}</span>
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
                            成本: {opt.feasibility.cost_rating}
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
                      工况水动力学指标对比 (Relative Delta Analysis)
                    </span>
                    <span className="text-xs text-slate-400">
                      — 对比基线 (40% 堵塞，Ø600mm)
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    当前查看: <span className="text-cyan-400 font-bold">{selectedOption.title}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                  {/* Metric 1: Surface Bypass Volume */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        地表旁路积水量 (Surface Bypass)
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
                        <span className="text-slate-500">基准基线</span>
                      ) : bypassDeltaM3 < 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <TrendingDown className="w-3.5 h-3.5" />
                          {bypassDeltaPct.toFixed(1)}% ({bypassDeltaM3.toFixed(1)} m³)
                        </span>
                      ) : (
                        <span className="text-slate-400">无变化</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">越低越好</span>
                    </div>
                  </div>

                  {/* Metric 2: Inlet Captured Volume */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        进水口收水入渗量 (Captured Flow)
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
                        <span className="text-slate-500">基准基线</span>
                      ) : capturedDeltaM3 > 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          +{capturedDeltaPct.toFixed(1)}% (+{capturedDeltaM3.toFixed(1)} m³)
                        </span>
                      ) : (
                        <span className="text-slate-400">无变化</span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">越高越充分</span>
                    </div>
                  </div>

                  {/* Metric 3: Sewer Surcharge Duration */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        管道满管顶托时长 (Surcharge Time)
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
                        <span className="text-slate-500">基准基线</span>
                      ) : selectedOption.metrics.surcharge_duration_s === 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          -100% (彻底消除)
                        </span>
                      ) : surchargeDeltaMin > 0 ? (
                        <span className="text-rose-400 font-medium flex items-center gap-0.5">
                          +{surchargeDeltaMin.toFixed(1)} min (水全部入网)
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-bold">
                          {surchargeDeltaMin.toFixed(1)} min
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">下游压力</span>
                    </div>
                  </div>

                  {/* Metric 4: Conduit Capacity Utilization */}
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 block mb-1">
                        主干管峰值负荷率 (PIPE-P07 Load)
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
                          ? '满管顶托'
                          : '重力自流充裕'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Manning Q</span>
                    </div>
                  </div>
                </div>

                {/* Comparative Bar Visualization */}
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    多方案水量分配与削峰横向对比 (Water Balance & Routing Breakdown):
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
                            有效截留: {opt.metrics.d07_captured_volume_m3.toFixed(0)} m³ ({capturedPct.toFixed(0)}%) | 地表滞留: {opt.metrics.d07_bypass_volume_m3.toFixed(0)} m³ ({bypassPct.toFixed(0)}%)
                          </span>
                        </div>
                        {/* Stacked bar */}
                        <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                          <div
                            style={{ width: `${capturedPct}%` }}
                            className="bg-blue-500/80 hover:bg-blue-500 transition-all flex items-center justify-center text-[9px] font-mono text-white font-bold"
                            title={`截流入渗: ${opt.metrics.d07_captured_volume_m3.toFixed(1)} m³`}
                          >
                            {capturedPct > 15 ? '截流入渗' : ''}
                          </div>
                          <div
                            style={{ width: `${bypassPct}%` }}
                            className="bg-rose-500/80 hover:bg-rose-500 transition-all flex items-center justify-center text-[9px] font-mono text-white font-bold"
                            title={`地表积水旁路: ${opt.metrics.d07_bypass_volume_m3.toFixed(1)} m³`}
                          >
                            {bypassPct > 15 ? '地表滞积 (Bypass)' : ''}
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
                    <span>核心工程与水动力学启示 (The Core Hydraulic Revelation):</span>
                  </div>
                  <p>
                    <strong>“蓝图设计”与“现场实况”的根本背离：</strong> 当进水口严重堵塞时，雨水在路面发生滞积（Bypass 达 686 m³），此时地下管道由于没有水进入，反倒表现出“负荷未满”的假象。
                  </p>
                  <p>
                    若<strong>仅进行进水口清淤</strong>，地表积水将大幅削减 43.2%（-296.7 m³），但涌入地下的大量雨水会瞬间将现有 Ø600mm 管道推向满管顶托超载 55.4 分钟。
                    反之，若<strong>仅扩建管道而不清淤</strong>，因喉口卡死，水流根本无法进入，路面积水毫厘未减。
                  </p>
                  <p className="text-amber-100 font-semibold">
                    👉 科学治理决策：紧急派员清淤解燃眉之急（排除地表积水），随后将下游 PIPE-P07 扩径列入资本预算以彻底消除管网超载瓶颈。
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
                    建议行动工单与工程复核建议 (Traceable Proposed Action Orders)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    由 SWMM 水动力学验算与现场巡检证据链（已关联 {inspections.length} 条现场记录，重点: INLET-D07）联合溯源驱动
                  </p>
                </div>
                <button
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
                >
                  {copiedReport ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">已复制工单报告</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>复制工单报告</span>
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
                          {action.priority === 'CRITICAL' ? '紧急抢险工单' : '资本工程复核'}
                        </span>
                        <span className="text-xs font-mono text-slate-400">{action.id}</span>
                      </div>
                      <span className="text-xs font-medium text-cyan-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        时限: {action.estimated_lead_time}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-100">{action.title}</h4>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        处置目标资产: <strong className="text-slate-200">{action.target_asset}</strong>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-xs space-y-1.5">
                      <div>
                        <strong className="text-slate-300">工单立案依据 (Justification): </strong>
                        <span className="text-slate-400">{action.justification}</span>
                      </div>
                      <div className="flex items-center gap-2 text-cyan-300 font-mono text-[11px] pt-1">
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span>溯源证据: {action.evidence_reference}</span>
                      </div>
                    </div>

                    {/* Action Steps */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-300">处置实施细则:</span>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400 pl-1">
                        {action.action_steps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                      <span>负责部门: {action.responsible_entity}</span>
                      <span className="text-emerald-400 font-medium">
                        预期水力收益: {action.expected_hydraulic_impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Provenance Footer */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                  <span>工程可追溯性元数据 (Model Provenance):</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[10px] text-slate-500">
                  <div>模型版本: taman_kyra_synthetic_v1</div>
                  <div>求解引擎: EPA SWMM 5.2.4</div>
                  <div>现场巡检: #INSP-2026-10-18-001</div>
                  <div>验证状态: Verified Snapshot</div>
                </div>
              </div>
            </div>
          )}

          {/* Strict Engineering Disclaimer */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-500 leading-relaxed flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong>【工程与法律免责声明】</strong>{' '}
              本对比与行动工单基于未校准合成数字孪生网络（taman_kyra_synthetic_v1）及 EPA SWMM 5.2.4 动态水动力学仿真生成，非真实现场工程施工图纸，亦不构成正式工程招投标报价或 Taman Kyra 实地洪水预报。所有治理方案实施前须经注册专业工程师（PE）及地方市政水利局现场复勘复核。
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            已选方案:{' '}
            <strong className="text-cyan-400">{selectedOption.title}</strong>{' '}
            <span className="text-slate-500">({selectedOption.tag})</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
            >
              关闭
            </button>
            <button
              onClick={() => {
                onApplyIntervention(selectedOption.id);
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
            >
              <span>应用方案至 3D 孪生场景</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
