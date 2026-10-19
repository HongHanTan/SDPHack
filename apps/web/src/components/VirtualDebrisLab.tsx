import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Layers,
  Sparkles,
  Camera,
  Activity,
  CheckCircle2,
  Sliders,
  FileCheck,
} from 'lucide-react';
import { InspectionRecord } from '../types';

interface VirtualDebrisLabProps {
  inletId: string;
  onClose: () => void;
  inspections: InspectionRecord[];
  onOpenNewInspection: () => void;
  currentHypothesisFraction: number;
  onSelectHypothesis: (fraction: number) => void;
}

export const VirtualDebrisLab: React.FC<VirtualDebrisLabProps> = ({
  inletId,
  onClose,
  inspections,
  onOpenNewInspection,
  currentHypothesisFraction,
  onSelectHypothesis,
}) => {
  const [selectedFraction, setSelectedFraction] = useState<number>(currentHypothesisFraction);
  const [activeTab, setActiveTab] = useState<'lab' | 'evidence'>('lab');

  // Pre-configured debris restriction hypothesis presets
  const presets = [
    {
      fraction: 0.0,
      label: '0% 清淤畅通',
      subtitle: 'Clean Baseline',
      desc: '标准进水孔口理论过水能力，无杂物阻塞。',
      capacityM3s: 0.35,
    },
    {
      fraction: 0.2,
      label: '20% 季节性微淤',
      subtitle: 'Moderate Siltation',
      desc: '少量落叶与砂砾沉积于进水喉口下沿。',
      capacityM3s: 0.28,
    },
    {
      fraction: 0.4,
      label: '40% 现场核查折减',
      subtitle: 'Reported Condition (Default)',
      desc: '对应现场 65% 表面落叶枯枝覆盖的折减假说。',
      capacityM3s: 0.21,
    },
    {
      fraction: 0.6,
      label: '60% 极端前蓄阻塞',
      subtitle: 'Critical Choke',
      desc: '前期强降雨携带大量冲刷枯枝导致严重卡口。',
      capacityM3s: 0.14,
    },
  ];

  const handleApply = () => {
    onSelectHypothesis(selectedFraction);
    onClose();
  };

  const relevantInspections = inspections.filter((i) => i.asset_id === inletId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md pointer-events-auto p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  进水口虚拟杂物实验室 (Virtual Debris Lab)
                </h2>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/40">
                  {inletId}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                低洼关键排水节点 · 现场可见证据与水动力学折减假说标定
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 text-xs px-6">
          <button
            onClick={() => setActiveTab('lab')}
            className={`py-2.5 px-4 font-medium border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'lab'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>水力折减假说实验室</span>
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-2.5 px-4 font-medium border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>现场照片与巡检证据 ({relevantInspections.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {activeTab === 'lab' ? (
            <>
              {/* Concept Separation Banner (Product Architecture Requirement) */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs leading-relaxed space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-amber-300 text-xs uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>工程底线原则：现场照片覆盖率 ≠ 水动力学折减率</span>
                </div>
                <p className="text-[11px] text-amber-200/90">
                  巡检员目测的<strong>“格栅表面覆盖率 (65%)”</strong>仅反映落叶堆积视觉证据；而在 SWMM 模型中，水流可通过喉口侧向与未完全阻断缝隙进入。在获得实测率定数据前，<strong>“水力折减率 (Hydraulic Clogging Loss)”</strong>需作为独立假设由工程师自主设定，不得强行等值换算。
                </p>
              </div>

              {/* Simulated Throat Graphic Preview */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    进水喉口过水截面剖面示意 (1.8m × 0.15m)
                  </span>
                  <span className="font-mono text-cyan-400 font-bold">
                    有效过水能力: ~{(0.35 * (1 - selectedFraction)).toFixed(2)} m³/s (原标称 0.35 m³/s)
                  </span>
                </div>

                {/* Visual curb throat representation */}
                <div className="relative h-20 bg-slate-900 border-2 border-slate-700 rounded-lg overflow-hidden flex flex-col justify-end">
                  {/* Concrete Curb Top */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between px-2 text-[9px] text-slate-400 font-mono">
                    <span>CURB OPENING THROAT (L=1.8m)</span>
                    <span>H=0.15m</span>
                  </div>

                  {/* Water inflow stream */}
                  <div
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cyan-600/50 to-transparent transition-all duration-500"
                    style={{ height: `${Math.max(20, (1 - selectedFraction) * 80)}%` }}
                  />

                  {/* Debris blockage visual layer */}
                  {selectedFraction > 0 && (
                    <div
                      className="absolute inset-y-0 right-0 bg-amber-900/60 border-l-2 border-amber-600/70 transition-all duration-500 flex items-center justify-center p-2 text-center"
                      style={{ width: `${selectedFraction * 100}%` }}
                    >
                      <div className="space-y-0.5 select-none">
                        <span className="text-[10px] font-bold text-amber-300 font-mono block">
                          截面阻水: {(selectedFraction * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] text-amber-200/80">
                          落叶/泥沙淤塞
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Grate bars lines */}
                  <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
                    {Array.from({ length: 18 }).map((_, idx) => (
                      <div key={idx} className="w-0.5 h-full bg-slate-300" />
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>畅通口径: {((1 - selectedFraction) * 1.8).toFixed(2)} m</span>
                  <span>受阻口径: {(selectedFraction * 1.8).toFixed(2)} m</span>
                </div>
              </div>

              {/* Hypothesis Preset Selectors */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    选择水动力学折减假说预设 (Restriction Hypothesis)
                  </span>
                  <span className="text-amber-400 font-mono font-bold text-sm">
                    {(selectedFraction * 100).toFixed(0)}% 折减
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {presets.map((preset) => {
                    const isSelected = selectedFraction === preset.fraction;
                    return (
                      <button
                        key={preset.fraction}
                        onClick={() => setSelectedFraction(preset.fraction)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400/80 text-amber-200 ring-1 ring-amber-400/50'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-xs">{preset.label}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ~{preset.capacityM3s} m³/s
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                          {preset.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Debris Composition Profile */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                <span className="font-semibold text-slate-300 block text-xs">
                  现场典型杂物成分构成分析 (Debris Composition)
                </span>
                <div className="space-y-1.5">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span>热带阔叶与枯枝 (Leaf Litter & Organic):</span>
                      <span className="text-amber-300 font-mono">60%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: '60%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span>路面细泥沙沉降 (Road Silt & Sediment):</span>
                      <span className="text-yellow-400 font-mono">25%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full" style={{ width: '25%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-0.5">
                      <span>塑料袋与城市生活杂物 (Plastic & Wrappers):</span>
                      <span className="text-cyan-400 font-mono">15%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-500 rounded-full" style={{ width: '15%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Field Evidence & Photos Tab */
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-300">
                  针对 {inletId} 的现场巡检与证据档案
                </span>
                <button
                  onClick={onOpenNewInspection}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-cyan-600/20"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>现场拍照打卡 / 录入新巡检</span>
                </button>
              </div>

              {relevantInspections.length === 0 ? (
                <div className="p-8 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-800 italic">
                  暂无历史巡检记录，可点击上方按钮录入现场目测报告。
                </div>
              ) : (
                <div className="space-y-3">
                  {relevantInspections.map((insp) => (
                    <div
                      key={insp.inspection_id}
                      className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-200">
                              {insp.inspector}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                              {insp.method.toUpperCase()}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono">
                              {insp.source_type}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            打卡时间: {new Date(insp.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">目测格栅覆盖率</span>
                          <span className="text-base font-bold font-mono text-amber-400">
                            {(insp.visible_grate_coverage_fraction * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 leading-relaxed font-sans">
                        {insp.notes}
                      </div>

                      {/* Photo evidence placeholder preview */}
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                        <div className="w-20 h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 font-mono text-[9px] text-center p-1">
                          [现场照片]
                        </div>
                        <div>
                          <span className="font-medium text-slate-300 block">
                            巡检证据编号: {insp.inspection_id}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            主要堵塞物: {insp.debris_category} · 包含地理空间时间戳与经办人数字签名
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>当前设定：{inletId} 折减率 {(selectedFraction * 100).toFixed(0)}%</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>应用此假说至当前仿真</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
