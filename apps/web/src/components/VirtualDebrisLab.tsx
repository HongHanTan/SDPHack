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
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react';
import { InspectionRecord } from '../types';

interface VirtualDebrisLabProps {
  inletId: string;
  onClose: () => void;
  inspections: InspectionRecord[];
  onOpenNewInspection: () => void;
  currentHypothesisFraction: number;
  onSelectHypothesis: (fraction: number, presetId?: string) => void;
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

  // Strictly aligned with Tay's SWMM 5.2.4 native finite inlet presets in contracts/T3_INTEGRATION.md
  const presets = [
    {
      fraction: 0.0,
      presetId: 'demo_inlet_capture_0pct',
      label: '0% Desilted (Baseline)',
      subtitle: 'Finite Clean Baseline',
      desc: 'Finite curb inlet theoretical capture model, free of debris obstructions.',
      capturedM3: 741.8,
      bypassM3: 389.7,
      capacityM3s: 0.35,
    },
    {
      fraction: 0.2,
      presetId: 'demo_inlet_capture_20pct',
      label: '20% Seasonal Siltation',
      subtitle: 'Moderate Siltation',
      desc: 'Minor leaf litter and silt sediment deposited along the curb opening invert.',
      capturedM3: 593.4,
      bypassM3: 538.0,
      capacityM3s: 0.28,
    },
    {
      fraction: 0.4,
      presetId: 'demo_inlet_40pct',
      label: '40% Field Verified Loss (Default)',
      subtitle: 'Reported Condition (Default)',
      desc: 'Calibrated hydraulic restriction hypothesis corresponding to 65% visual grate blockage.',
      capturedM3: 445.1,
      bypassM3: 686.3,
      capacityM3s: 0.21,
    },
    {
      fraction: 0.6,
      presetId: 'demo_inlet_capture_60pct',
      label: '60% Critical Antecedent Choke',
      subtitle: 'Critical Choke',
      desc: 'Antecedent runoff wash-off carrying heavy leaf debris, severely constricting inlet throat.',
      capturedM3: 296.7,
      bypassM3: 834.7,
      capacityM3s: 0.14,
    },
  ];

  const currentPreset = presets.find((p) => p.fraction === selectedFraction) || presets[2];

  const handleApply = () => {
    onSelectHypothesis(selectedFraction, currentPreset.presetId);
    onClose();
  };

  const relevantInspections = inspections.filter((i) => i.asset_id === inletId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm pointer-events-auto p-4 animate-in fade-in">
      <div className="w-full max-w-3xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Curb Inlet Virtual Debris Lab
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-mono font-bold border border-red-200">
                  {inletId}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Critical Lowland Asset · Field Visual Evidence & EPA SWMM 5.2.4 Calibration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 text-xs px-6">
          <button
            onClick={() => setActiveTab('lab')}
            className={`py-3 px-4 font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'lab'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Hydraulic Loss Hypothesis Lab</span>
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 px-4 font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Field Evidence & CCTV Photos ({relevantInspections.length})</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-slate-700">
          {activeTab === 'lab' ? (
            <>
              {/* Concept Separation Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Engineering Principle: Visual Grate Coverage ≠ Hydraulic Restriction Loss</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Field inspector observations of <strong>"Surface Grate Coverage (65%)"</strong> reflect visual leaf accumulation. In SWMM, water continues to enter through lateral curbs and partially open interstitial gaps.
                </p>
              </div>

              {/* Simulated Throat Graphic Preview */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-red-600" />
                    Curb Opening Throat Inflow Profile (1.8m × 0.15m)
                  </span>
                  <span className="font-mono text-red-600 font-bold">
                    Effective Capacity: ~{(0.35 * (1 - selectedFraction)).toFixed(2)} m³/s (Nominal: 0.35 m³/s)
                  </span>
                </div>

                {/* Visual curb throat representation */}
                <div className="relative h-20 bg-slate-900 border-2 border-slate-700 rounded-xl overflow-hidden flex flex-col justify-end shadow-inner">
                  {/* Concrete Curb Top */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-slate-700 border-b border-slate-600 flex items-center justify-between px-2 text-[9px] text-slate-300 font-mono font-bold">
                    <span>CURB OPENING THROAT (L=1.8m)</span>
                    <span>H=0.15m</span>
                  </div>

                  {/* Water inflow stream */}
                  <div
                    className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cyan-500/70 to-transparent transition-all duration-500"
                    style={{ height: `${Math.max(20, (1 - selectedFraction) * 80)}%` }}
                  />

                  {/* Debris blockage visual layer */}
                  {selectedFraction > 0 && (
                    <div
                      className="absolute inset-y-0 right-0 bg-amber-900/80 border-l-2 border-amber-600 transition-all duration-500 flex items-center justify-center p-2 text-center"
                      style={{ width: `${selectedFraction * 100}%` }}
                    >
                      <div className="space-y-0.5 select-none">
                        <span className="text-[10px] font-bold text-amber-300 font-mono block">
                          Throat Blockage: {(selectedFraction * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] text-amber-200">
                          Leaf Litter & Silt
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Grate bars lines */}
                  <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
                    {Array.from({ length: 18 }).map((_, idx) => (
                      <div key={idx} className="w-0.5 h-full bg-white" />
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Clear Throat: {((1 - selectedFraction) * 1.8).toFixed(2)} m</span>
                  <span>Choked Throat: {(selectedFraction * 1.8).toFixed(2)} m</span>
                </div>
              </div>

              {/* Hypothesis Preset Selectors */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-red-600" />
                    Select Hydraulic Loss Hypothesis Preset (SWMM Finite Inlets)
                  </span>
                  <span className="text-red-600 font-mono font-bold text-sm">
                    {(selectedFraction * 100).toFixed(0)}% Loss ({currentPreset.presetId})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {presets.map((preset) => {
                    const isSelected = selectedFraction === preset.fraction;
                    return (
                      <button
                        key={preset.fraction}
                        onClick={() => setSelectedFraction(preset.fraction)}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-red-50/70 border-2 border-red-600 text-slate-900 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-xs text-slate-900">{preset.label}</span>
                          <span className="text-[10px] text-slate-500 font-mono font-medium">
                            ~{preset.capacityM3s} m³/s
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                          {preset.desc}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] font-mono">
                          <span className="text-emerald-700 font-bold">Captured: {preset.capturedM3} m³</span>
                          <span className="text-amber-700 font-bold">Bypass: {preset.bypassM3} m³</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Native Inlet Water Balance Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 block text-xs flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    D07 Water Balance Partitioning (120 mm/h Storm)
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Total Inflow: ~1,131.5 m³</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                      <span>Subsurface Captured Volume:</span>
                      <span className="text-emerald-700 font-mono font-bold">
                        {currentPreset.capturedM3} m³ (
                        {((currentPreset.capturedM3 / 1131.5) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${(currentPreset.capturedM3 / 1131.5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-700 mb-1">
                      <span>Surface Bypass Runoff Volume:</span>
                      <span className="text-red-600 font-mono font-bold">
                        {currentPreset.bypassM3} m³ (
                        {((currentPreset.bypassM3 / 1131.5) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${(currentPreset.bypassM3 / 1131.5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Field Evidence & Photos Tab */
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="font-bold text-slate-800">
                  Field Inspection Evidence Dossier for {inletId}
                </span>
                <button
                  onClick={onOpenNewInspection}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-600/20 text-xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Log Field Inspection / Upload Photo</span>
                </button>
              </div>

              {relevantInspections.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 italic">
                  No previous inspection logs found. Click above to record a new field inspection report.
                </div>
              ) : (
                <div className="space-y-3">
                  {relevantInspections.map((insp) => {
                    const firstPhoto = insp.media_urls?.[0] || insp.media?.[0]?.url;
                    return (
                      <div
                        key={insp.inspection_id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                {insp.inspector}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-mono font-semibold">
                                {insp.method.toUpperCase()}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-mono font-bold">
                                {insp.source_type}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              Timestamp: {new Date(insp.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Visual Grate Coverage</span>
                            <span className="text-base font-bold font-mono text-amber-700">
                              {(insp.visible_grate_coverage_fraction * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed font-sans shadow-xs">
                          {insp.notes}
                        </div>

                        {/* Photo evidence preview */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-600">
                          {firstPhoto ? (
                            <img
                              src={firstPhoto}
                              alt="Inspection"
                              className="w-20 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-14 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-slate-400 font-mono text-[9px] text-center p-1 shrink-0">
                              <ImageIcon className="w-5 h-5 text-slate-500" />
                            </div>
                          )}
                          <div>
                            <span className="font-semibold text-slate-800 block">
                              Evidence Record ID: {insp.inspection_id}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Primary Debris: {insp.debris_category} · Geospatial timestamp & tamper-evident record
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <span>
              Active: {inletId} Loss {(selectedFraction * 100).toFixed(0)}% ({currentPreset.presetId})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-600/20 text-xs active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Hypothesis to Simulation</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
