import React, { useState } from 'react';
import {
  X,
  Sliders,
  ChevronRight,
  Activity,
  Waves,
  Camera,
  Maximize2,
  Tv,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { InspectionRecord, SimulationFrame } from '../types';
import { getSitePhotoForAsset } from '../mocks/sitePhotos';

interface AssetDetailModalProps {
  selectedAsset: {
    type: 'node' | 'inlet' | 'conduit';
    id: string;
    data: unknown;
  } | null;
  onClose: () => void;
  inspections: InspectionRecord[];
  onOpenInspect: (assetId: string) => void;
  onOpenInterventions?: () => void;
  currentFrame?: SimulationFrame | null;
  blockageFraction?: number;
  onUpdateBlockage?: (assetId: string, fraction: number) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  selectedAsset,
  onClose,
  inspections,
  onOpenInspect,
  onOpenInterventions,
  currentFrame,
  blockageFraction = 0.0,
  onUpdateBlockage,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'photos' | 'blockage' | 'maintenance'>('overview');
  const [isMinimized, setIsMinimized] = useState(false);
  const [photoMode, setPhotoMode] = useState<'surface' | 'cctv'>('surface');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [localBlockage, setLocalBlockage] = useState<number>(blockageFraction);

  // Fallback to primary demonstration focal point MH-0421 (NODE-J07)
  const assetId = selectedAsset?.id || 'NODE-J07';
  const assetType = selectedAsset?.type || 'node';
  const displayId = assetId === 'NODE-J07' ? 'MH-0421' : assetId;

  // Site photo metadata
  const sitePhoto = getSitePhotoForAsset(assetId);

  // Frame telemetry calculations
  const nodeState = currentFrame?.node_states?.find(
    (n) => n.node_id === assetId || (assetId === 'NODE-J07' && n.node_id === 'NODE-J07')
  );
  const pipeState = currentFrame?.pipe_states?.find(
    (p) => p.conduit_id === assetId || (assetId.startsWith('PIPE') && p.conduit_id === assetId)
  );

  const depthM = nodeState?.depth_m ?? (pipeState ? 0.45 : 1.62);
  const baseFlow = pipeState?.flow_m3s ?? 1.24;
  const baseCapacity = 1.60;

  // Real-time capacity adjustment based on adjusted blockage level
  const effectiveCapacity = baseCapacity * Math.max(0.05, 1 - localBlockage);
  const throttledFlow = Math.min(baseFlow, effectiveCapacity);
  const flowLevelPct = Math.min(100, Math.round((throttledFlow / effectiveCapacity) * 100));
  const isHighLoad =
    flowLevelPct >= 75 ||
    localBlockage >= 0.4 ||
    nodeState?.status === 'flooding' ||
    nodeState?.status === 'surcharged';

  const handleApplyBlockage = (fraction: number) => {
    setLocalBlockage(fraction);
    onUpdateBlockage?.(assetId, fraction);
  };

  if (isMinimized) {
    return (
      <div className="absolute top-20 right-6 z-20 pointer-events-auto animate-in fade-in">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/80 text-stone-200 hover:text-white shadow-2xl transition cursor-pointer text-xs font-semibold"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>Drain Telemetry: {displayId}</span>
          {localBlockage > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
              Blockage {(localBlockage * 100).toFixed(0)}%
            </span>
          )}
          <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>
    );
  }

  return (
    <>
      <aside className="absolute top-20 right-6 z-20 w-88 md:w-96 bg-[#181111]/95 backdrop-blur-2xl border border-[#3b1818]/80 rounded-2xl shadow-2xl p-4 text-stone-200 pointer-events-auto select-none max-h-[calc(100vh-6.5rem)] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* 1. Header with Asset Type Icon & Close Button */}
        <div className="flex items-center justify-between pb-3 border-b border-[#3b1818]/60">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-600 to-amber-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {assetType === 'conduit' ? '⌁' : '⊞'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold text-stone-100 tracking-wide">
                  {displayId}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-mono uppercase">
                  {assetType}
                </span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono block">
                {sitePhoto.locationName}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              if (selectedAsset) {
                onClose();
              } else {
                setIsMinimized(true);
              }
            }}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-900/60 transition cursor-pointer"
            title="Close drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. Sub-Tabs */}
        <div className="flex items-center justify-between py-2.5 text-[11px] font-medium border-b border-[#3b1818]/40">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'photos'
                ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Camera className="w-3 h-3" />
            <span>Field CCTV</span>
          </button>
          <button
            onClick={() => setActiveTab('blockage')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${
              activeTab === 'blockage'
                ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3 h-3 text-amber-400" />
            <span>Tune Blockage</span>
            {localBlockage > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Logs ({inspections.length})
          </button>
        </div>

        {/* 3. Live Site Photo / In-Pipe CCTV Inspection View */}
        <div className="my-3 space-y-2">
          {/* Mode Switcher: Surface vs CCTV */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-stone-300 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-red-400" />
              <span>Field Live Visuals & Inspection</span>
            </span>

            <div className="flex items-center gap-1 bg-[#100b0b] p-0.5 rounded-lg border border-stone-800 text-[10px]">
              <button
                onClick={() => setPhotoMode('surface')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  photoMode === 'surface'
                    ? 'bg-stone-700 text-white font-medium'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Surface Inlet
              </button>
              <button
                onClick={() => setPhotoMode('cctv')}
                className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  photoMode === 'cctv'
                    ? 'bg-red-600 text-white font-medium'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Tv className="w-3 h-3" />
                <span>In-Pipe CCTV</span>
              </button>
            </div>
          </div>

          {/* Photo Container */}
          <div
            onClick={() => setIsLightboxOpen(true)}
            className="relative rounded-xl overflow-hidden border border-[#3b1818]/90 h-36 bg-[#0a0707] cursor-pointer group shadow-inner"
          >
            {photoMode === 'surface' ? (
              /* Surface Manhole / Inflow Opening Photo */
              <div className="w-full h-full relative">
                <img
                  src={sitePhoto.surfacePhotoUrl || '/assets/mock_manhole.jpg'}
                  alt="Site Asset Grate"
                  className="w-full h-full object-cover brightness-95 contrast-105 group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#140e0e]/90 via-transparent to-black/30" />
                <div className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/60 text-stone-200 backdrop-blur-md flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" />
                  <span>Enlarge</span>
                </div>
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] text-stone-300 font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{sitePhoto.title}</span>
                  </div>
                  <span className="text-stone-400">Integrity: {sitePhoto.structuralIntegrityPct}%</span>
                </div>
              </div>
            ) : (
              /* In-Pipe Robotic CCTV Crawler Live View */
              <div className="w-full h-full relative bg-radial from-stone-800 via-stone-900 to-black flex items-center justify-center p-3 select-none">
                {/* Simulated Circular Pipe Barrel with CCTV Lighting */}
                <div className="w-28 h-28 rounded-full border-4 border-stone-600/70 relative overflow-hidden flex flex-col justify-end shadow-2xl bg-gradient-to-b from-stone-950 via-stone-800 to-stone-900">
                  {/* Perspective Pipe Rings */}
                  <div className="absolute inset-2 rounded-full border border-stone-500/30" />
                  <div className="absolute inset-5 rounded-full border border-stone-500/20" />
                  <div className="absolute inset-8 rounded-full border border-stone-500/10" />

                  {/* Water Stream in Pipe Invert */}
                  <div
                    className="absolute inset-x-0 bottom-0 bg-cyan-500/40 border-t border-cyan-400/60"
                    style={{ height: `${Math.max(15, (1 - localBlockage) * 45)}%` }}
                  />

                  {/* Sediment / Silt Bed */}
                  {localBlockage > 0 && (
                    <div
                      className="absolute inset-x-0 bottom-0 bg-amber-900/80 border-t border-amber-600/80"
                      style={{ height: `${localBlockage * 60}%` }}
                    />
                  )}

                  {/* CCTV Crosshair in center */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 border border-cyan-400/40 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    </div>
                  </div>
                </div>

                {/* CCTV Telemetry OSD Header */}
                <div className="absolute top-2 left-2.5 right-2.5 flex items-center justify-between text-[9px] font-mono text-cyan-400 drop-shadow">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    <span>CAM-02 CCTV CRAWLER [LIVE]</span>
                  </div>
                  <span>CH: {sitePhoto.chainageM ?? 14.8}m</span>
                </div>

                {/* CCTV Telemetry OSD Footer */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[9px] font-mono text-stone-300 drop-shadow">
                  <span>Silt: {sitePhoto.siltDepthMm ?? 120}mm ({(localBlockage * 100).toFixed(0)}% Area)</span>
                  <span className="text-amber-400">Vel: 0.42 m/s</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. Tab 1: Overview Specifications Grid */}
        {activeTab === 'overview' && (
          <>
            <div className="py-2 space-y-1.5 text-xs border-y border-[#3b1818]/60">
              <div className="flex justify-between text-stone-400">
                <span>Asset Classification</span>
                <span className="text-stone-200 font-medium capitalize">
                  {assetType === 'conduit' ? 'Storm Drainage Conduit' : 'Manhole / Curb Inlet'}
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Asset Identifier</span>
                <span className="text-stone-200 font-mono font-medium">{displayId}</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Active Restriction (Loss)</span>
                <span className={`font-mono font-bold ${localBlockage > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {(localBlockage * 100).toFixed(0)}% {localBlockage > 0 ? 'Choked' : 'Clear'}
                </span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Invert Depth</span>
                <span className="text-stone-200 font-mono">{depthM.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Nominal Full Capacity</span>
                <span className="text-stone-200 font-mono">{baseCapacity.toFixed(2)} m³/s</span>
              </div>
              <div className="flex justify-between text-stone-400">
                <span>Effective Throttled Capacity</span>
                <span className="text-red-400 font-mono font-bold">{effectiveCapacity.toFixed(2)} m³/s</span>
              </div>
            </div>

            {/* Current Status Card */}
            <div className="my-3 p-3.5 rounded-xl bg-stone-950/70 border border-[#3b1818]/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dynamic Hydraulic Load</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isHighLoad
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {isHighLoad ? 'High Surcharge' : 'Normal Gravity'}
                </span>
              </div>

              {/* Flow Level Progress Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-stone-400">Hydraulic Conduit Fullness</span>
                  <span className="font-bold font-mono text-stone-100">{flowLevelPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600 transition-all duration-500"
                    style={{ width: `${flowLevelPct}%` }}
                  />
                </div>
              </div>

              {/* Mini Stats Grid */}
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                <div>
                  <span className="text-stone-400 block text-[10px]">Simulated Flow</span>
                  <span className="font-mono text-stone-200 font-semibold">{throttledFlow.toFixed(2)} m³/s</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px]">Spare Capacity</span>
                  <span className="font-mono text-stone-200 font-semibold">
                    {Math.max(0, effectiveCapacity - throttledFlow).toFixed(2)} m³/s
                  </span>
                </div>
              </div>
            </div>

            {/* Flood Risk Card */}
            <div className="mb-3 p-3.5 rounded-xl bg-stone-950/70 border border-[#3b1818]/60 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
                  <Waves className="w-3.5 h-3.5 text-red-500" />
                  <span>Surface Ponding & Surcharge Risk</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${
                    localBlockage >= 0.5 ? 'bg-red-600' : localBlockage >= 0.25 ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}
                >
                  {localBlockage >= 0.5 ? 'Critical Risk' : localBlockage >= 0.25 ? 'Moderate' : 'Low'}
                </span>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed font-sans">
                {localBlockage >= 0.5
                  ? `Asset restriction set at ${(localBlockage * 100).toFixed(0)}%. At 120 mm/h rainfall, this produces prolonged upstream node surcharging and local street ponding up to 28 cm.`
                  : 'Conduit hydraulic grade line remains below ground elevation; gravity runoff discharges freely to downstream retention basin.'}
              </p>
            </div>
          </>
        )}

        {/* 5. Tab 2: Photos & Field Observations */}
        {activeTab === 'photos' && (
          <div className="space-y-3 py-1">
            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-stone-300">
                <span className="font-semibold">{sitePhoto.title}</span>
                <span className="text-[10px] text-stone-400 font-mono">{sitePhoto.captureDate}</span>
              </div>
              <p className="text-[11px] text-stone-400 leading-relaxed font-sans">
                {sitePhoto.observedCondition}
              </p>
              <div className="pt-2 border-t border-stone-800/80 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-stone-500 block text-[10px]">Field Inspector</span>
                  <span className="text-stone-300">{sitePhoto.photographer}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">Silt Depth</span>
                  <span className="text-amber-400 font-mono font-bold">{sitePhoto.siltDepthMm ?? 120} mm</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onOpenInspect(assetId)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-900/30"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Upload Field Inspection / Site Photo</span>
            </button>
          </div>
        )}

        {/* 6. Tab 3: Interactive Blockage Degree Adjustment & Simulation */}
        {activeTab === 'blockage' && (
          <div className="space-y-3 py-1 animate-in fade-in">
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Interactive Blockage Tuning & Dynamic Simulation</span>
              </div>
              <p className="text-[11px] text-amber-200/90 leading-relaxed">
                Customize <strong>Blockage / Restriction Loss (0%–90%)</strong> for this asset. The engine throttles cross-sectional flow, recomputes hydraulic grade lines, and renders water ponding and surcharge risks in the 3D twin.
              </p>
            </div>

            {/* Slider Control */}
            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-stone-300 font-medium">Asset Blockage Level:</span>
                <span className="font-mono text-base font-bold text-amber-400">
                  {(localBlockage * 100).toFixed(0)}%
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={localBlockage}
                onChange={(e) => handleApplyBlockage(parseFloat(e.target.value))}
                className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-red-600"
              />

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px]">
                <button
                  onClick={() => handleApplyBlockage(0.0)}
                  className={`py-1.5 rounded-lg border transition cursor-pointer font-medium ${
                    localBlockage === 0.0
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  0% Clear
                </button>
                <button
                  onClick={() => handleApplyBlockage(0.25)}
                  className={`py-1.5 rounded-lg border transition cursor-pointer font-medium ${
                    localBlockage === 0.25
                      ? 'bg-amber-600 text-white border-amber-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  25% Light
                </button>
                <button
                  onClick={() => handleApplyBlockage(0.5)}
                  className={`py-1.5 rounded-lg border transition cursor-pointer font-medium ${
                    localBlockage === 0.5
                      ? 'bg-orange-600 text-white border-orange-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  50% Moderate
                </button>
                <button
                  onClick={() => handleApplyBlockage(0.75)}
                  className={`py-1.5 rounded-lg border transition cursor-pointer font-medium ${
                    localBlockage === 0.75
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                  }`}
                >
                  75% Critical
                </button>
              </div>
            </div>

            {/* Impact Calculation Preview */}
            <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
              <span className="font-semibold text-stone-300 block text-xs">Hydraulic Throttling Projection:</span>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-stone-400">Clear Invert Area:</span>
                  <span className="font-mono text-stone-200">
                    {((1 - localBlockage) * 100).toFixed(0)}% Clear Area
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Restricted Conveyance:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {effectiveCapacity.toFixed(2)} m³/s (Base: {baseCapacity.toFixed(2)} m³/s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Projected Head Increase:</span>
                  <span className="font-mono text-red-400 font-bold">
                    +{(localBlockage * 0.42).toFixed(2)} m Head
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => handleApplyBlockage(0.0)}
                className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Clear</span>
              </button>
              <button
                onClick={() => handleApplyBlockage(localBlockage)}
                className="flex-1 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-900/30"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Apply Calibration</span>
              </button>
            </div>
          </div>
        )}

        {/* 7. Tab 4: Maintenance Records */}
        {activeTab === 'maintenance' && (
          <div className="space-y-3 py-1">
            {inspections.length === 0 ? (
              <div className="p-6 text-center text-stone-500 bg-stone-950 rounded-xl border border-stone-800 text-xs italic">
                No maintenance records found
              </div>
            ) : (
              <div className="space-y-2">
                {inspections.map((insp) => (
                  <div
                    key={insp.inspection_id}
                    className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center text-stone-300">
                      <span className="font-bold">{insp.inspector}</span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        {new Date(insp.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-400 line-clamp-2">{insp.notes}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => onOpenInspect(assetId)}
              className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>New Inspection Record</span>
            </button>
          </div>
        )}

        {/* 8. Action Buttons Footer */}
        <div className="pt-3 border-t border-[#3b1818]/60 flex items-center gap-2">
          <button
            onClick={() => onOpenInspect(assetId)}
            className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Log Inspection</span>
          </button>
          <button
            onClick={onOpenInterventions}
            className="flex-1 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-red-900/30"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Interventions</span>
          </button>
        </div>
      </aside>

      {/* 9. Lightbox Photo Zoom Modal */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md pointer-events-auto p-4 animate-in fade-in">
          <div className="relative max-w-4xl w-full bg-[#181111] border border-stone-800 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-red-500" />
                  <span>{sitePhoto.title} (High-Res Field Survey)</span>
                </h3>
                <span className="text-xs text-stone-400 font-mono">
                  {sitePhoto.locationName} · {sitePhoto.captureDate}
                </span>
              </div>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Large Image Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-stone-800 max-h-[60vh] bg-black flex items-center justify-center">
              <img
                src={sitePhoto.surfacePhotoUrl || '/assets/mock_manhole.jpg'}
                alt="Enlarged inspection"
                className="w-full h-full object-contain max-h-[60vh]"
              />
              <div className="absolute bottom-3 left-4 right-4 p-3 rounded-xl bg-black/75 backdrop-blur-md text-stone-200 text-xs border border-stone-800 flex items-center justify-between">
                <span>{sitePhoto.observedCondition}</span>
                <span className="text-amber-400 font-mono font-bold shrink-0 pl-4">
                  Silt Depth: {sitePhoto.siltDepthMm ?? 120} mm
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
