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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto p-4">
      <div className="w-full max-w-3xl bg-[#181111] border border-[#3e2222] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#301c1c] bg-[#120d0d]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-100">
                  Curb Inlet Virtual Debris Lab
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 font-mono border border-red-500/40">
                  {inletId}
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Critical Lowland Asset · Field Visual Evidence & EPA SWMM 5.2.4 Finite Inlet Calibration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[#301c1c] bg-[#100a0a] text-xs px-6">
          <button
            onClick={() => setActiveTab('lab')}
            className={`py-2.5 px-4 font-medium border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'lab'
                ? 'border-red-500 text-red-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Hydraulic Loss Hypothesis Lab</span>
          </button>
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-2.5 px-4 font-medium border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'evidence'
                ? 'border-red-500 text-red-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Field Evidence & CCTV Photos ({relevantInspections.length})</span>
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
                  <span>Engineering Principle: Visual Grate Coverage ≠ Hydraulic Restriction Loss</span>
                </div>
                <p className="text-[11px] text-amber-200/90">
                  Field inspector observations of <strong>"Surface Grate Coverage (65%)"</strong> reflect visual leaf accumulation. In SWMM, water continues to enter through lateral curbs and partially open interstitial gaps. Pending physical flow metering, <strong>"Hydraulic Clogging Loss"</strong> must be treated as an independent hypothesis calibrated by the civil engineer.
                </p>
              </div>

              {/* Simulated Throat Graphic Preview */}
              <div className="bg-[#120d0d] border border-[#301c1c] rounded-xl p-5 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-red-400" />
                    Curb Opening Throat Inflow Profile (1.8m × 0.15m)
                  </span>
                  <span className="font-mono text-red-400 font-bold">
                    Effective Capacity: ~{(0.35 * (1 - selectedFraction)).toFixed(2)} m³/s (Nominal: 0.35 m³/s)
                  </span>
                </div>

                {/* Visual curb throat representation */}
                <div className="relative h-20 bg-[#0c0808] border-2 border-stone-800 rounded-lg overflow-hidden flex flex-col justify-end">
                  {/* Concrete Curb Top */}
                  <div className="absolute top-0 left-0 right-0 h-4 bg-stone-800 border-b border-stone-700 flex items-center justify-between px-2 text-[9px] text-stone-400 font-mono">
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
                          Throat Blockage: {(selectedFraction * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] text-amber-200/80">
                          Leaf Litter & Silt
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Grate bars lines */}
                  <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-20">
                    {Array.from({ length: 18 }).map((_, idx) => (
                      <div key={idx} className="w-0.5 h-full bg-stone-300" />
                    ))}
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-stone-500 font-mono">
                  <span>Clear Throat: {((1 - selectedFraction) * 1.8).toFixed(2)} m</span>
                  <span>Choked Throat: {(selectedFraction * 1.8).toFixed(2)} m</span>
                </div>
              </div>

              {/* Hypothesis Preset Selectors (SWMM 5.2.4 Verified Finite Presets) */}
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-red-400" />
                    Select Hydraulic Loss Hypothesis Preset (EPA SWMM 5.2.4 Finite Inlets)
                  </span>
                  <span className="text-red-400 font-mono font-bold text-sm">
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
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-red-500/15 border-red-500 text-stone-100 ring-1 ring-red-500/50 shadow-md'
                            : 'bg-[#120d0d] border-[#301c1c] hover:border-stone-700 text-stone-300'
                        }`}
                      >
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-xs">{preset.label}</span>
                          <span className="text-[10px] text-stone-400 font-mono">
                            ~{preset.capacityM3s} m³/s
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 leading-relaxed font-sans">
                          {preset.desc}
                        </p>
                        <div className="flex items-center justify-between pt-1 border-t border-stone-800/80 text-[10px] font-mono">
                          <span className="text-emerald-400">Captured: {preset.capturedM3} m³</span>
                          <span className="text-amber-400">Bypass: {preset.bypassM3} m³</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Native Inlet Water Balance Card */}
              <div className="bg-[#120d0d] border border-[#301c1c] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-300 block text-xs flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    D07 Water Balance Partitioning at 120 mm/h Storm (SWMM 5.2.4 Verified)
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">Total Inflow: ~1,131.5 m³</span>
                </div>
                <div className="space-y-2 pt-1">
                  <div>
                    <div className="flex justify-between text-[11px] text-stone-300 mb-1">
                      <span>Subsurface Captured Volume:</span>
                      <span className="text-emerald-400 font-mono font-bold">
                        {currentPreset.capturedM3} m³ (
                        {((currentPreset.capturedM3 / 1131.5) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${(currentPreset.capturedM3 / 1131.5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-stone-300 mb-1">
                      <span>Surface Bypass Runoff Volume:</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {currentPreset.bypassM3} m³ (
                        {((currentPreset.bypassM3 / 1131.5) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-600 to-rose-500 rounded-full transition-all duration-500"
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
              <div className="flex justify-between items-center">
                <span className="font-semibold text-stone-300">
                  Field Inspection Evidence Dossier for {inletId}
                </span>
                <button
                  onClick={onOpenNewInspection}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-red-900/30"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Log Field Inspection / Upload Photo</span>
                </button>
              </div>

              {relevantInspections.length === 0 ? (
                <div className="p-8 text-center text-stone-500 bg-[#120d0d] rounded-xl border border-[#301c1c] italic">
                  No previous inspection logs found. Click above to record a new field inspection report.
                </div>
              ) : (
                <div className="space-y-3">
                  {relevantInspections.map((insp) => {
                    const firstPhoto = insp.media_urls?.[0] || insp.media?.[0]?.url;
                    return (
                      <div
                        key={insp.inspection_id}
                        className="p-4 rounded-xl bg-[#120d0d] border border-[#301c1c] space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-stone-200">
                                {insp.inspector}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 font-mono">
                                {insp.method.toUpperCase()}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-mono">
                                {insp.source_type}
                              </span>
                            </div>
                            <span className="text-[11px] text-stone-500">
                              Timestamp: {new Date(insp.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-stone-400 block">Visual Grate Coverage</span>
                            <span className="text-base font-bold font-mono text-amber-400">
                              {(insp.visible_grate_coverage_fraction * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>

                        <div className="text-xs text-stone-300 bg-[#0e0a0a] p-3 rounded-xl border border-[#281818] leading-relaxed font-sans">
                          {insp.notes}
                        </div>

                        {/* Photo evidence preview */}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-stone-400">
                          {firstPhoto ? (
                            <img
                              src={firstPhoto}
                              alt="Inspection"
                              className="w-20 h-14 rounded-lg object-cover border border-stone-700 shrink-0"
                            />
                          ) : (
                            <div className="w-20 h-14 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-500 font-mono text-[9px] text-center p-1 shrink-0">
                              <ImageIcon className="w-5 h-5 text-stone-400" />
                            </div>
                          )}
                          <div>
                            <span className="font-medium text-stone-300 block">
                              Evidence Record ID: {insp.inspection_id}
                            </span>
                            <span className="text-[10px] text-stone-500">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#301c1c] bg-[#120d0d]">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <span>
              Active Setting: {inletId} Loss {(selectedFraction * 100).toFixed(0)}% (
              {currentPreset.presetId})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-red-900/30"
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
