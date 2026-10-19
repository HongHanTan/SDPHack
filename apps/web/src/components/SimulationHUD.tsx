import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CloudRain,
  Layers,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Compass,
  Radio,
  Eye,
  Flame,
  Check,
  Search,
} from 'lucide-react';
import {
  DebrisPreset,
  SimulationFrame,
  SimulationMetricsResponse,
  StormPreset,
  TailwaterPreset,
  TwinViewMode,
  AppMode,
} from '../types';

interface SimulationHUDProps {
  storms: StormPreset[];
  selectedStormId: string;
  onSelectStorm: (id: string) => void;
  debrisScenarios: DebrisPreset[];
  selectedDebrisId: string;
  onSelectDebris: (id: string) => void;
  tailwaterCases: TailwaterPreset[];
  selectedTailwater: string;
  onSelectTailwater: (id: string) => void;
  onRunSimulation: () => void;
  onLoadVerifiedRun: (stormId: string) => void;
  isRunning: boolean;
  runProgressMessage?: string;
  frames: SimulationFrame[];
  currentFrameIndex: number;
  onSeekFrame: (index: number) => void;
  metrics: SimulationMetricsResponse | null;
  undergroundOnly: boolean;
  onToggleUnderground: () => void;
  twinViewMode?: TwinViewMode;
  onSelectTwinViewMode?: (mode: TwinViewMode) => void;
  isRainActive?: boolean;
  rainEnabled?: boolean;
  onToggleRain?: () => void;
  hasSimulationStarted?: boolean;
  onStartSimulation?: () => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onResetSimulation?: () => void;
  onOpenDebrisLab?: () => void;
  onOpenInspect?: () => void;
  appMode?: AppMode;
  onChangeAppMode?: (mode: AppMode) => void;
}

export const SimulationHUD: React.FC<SimulationHUDProps> = ({
  storms: _storms,
  selectedStormId,
  onSelectStorm,
  debrisScenarios: _debrisScenarios,
  selectedDebrisId: _selectedDebrisId,
  onSelectDebris: _onSelectDebris,
  tailwaterCases: _tailwaterCases,
  selectedTailwater: _selectedTailwater,
  onSelectTailwater: _onSelectTailwater,
  onRunSimulation,
  onLoadVerifiedRun,
  isRunning,
  runProgressMessage,
  frames,
  currentFrameIndex,
  onSeekFrame,
  metrics: _metrics,
  undergroundOnly: _undergroundOnly,
  onToggleUnderground,
  twinViewMode: _twinViewMode,
  onSelectTwinViewMode,
  isRainActive = false,
  rainEnabled = true,
  onToggleRain,
  hasSimulationStarted = false,
  onStartSimulation,
  isPlaying: isPlayingProp,
  onTogglePlay,
  onResetSimulation,
  onOpenDebrisLab,
  onOpenInspect,
  appMode,
  onChangeAppMode,
}) => {
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const isPlaying = isPlayingProp !== undefined ? isPlayingProp : localIsPlaying;
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [simMode, setSimMode] = useState<'realtime' | 'forecast' | 'historical'>('realtime');
  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [isScenarioOpen, setIsScenarioOpen] = useState(true);

  // Map layer toggle states matching mockup
  const [layers, setLayers] = useState({
    drainageNetwork: true,
    manholesInlets: true,
    outfalls: true,
    floodRiskZones: true,
    elevationDem: false,
    aerialImagery: true,
    propertyBoundaries: false,
    criticalInfrastructure: true,
    liveWeatherRadar: true,
  });

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'drainageNetwork' && onSelectTwinViewMode) {
        onSelectTwinViewMode(next.drainageNetwork ? 'twin_highlight' : 'realistic');
      }
      if (key === 'aerialImagery') {
        onToggleUnderground();
      }
      if (key === 'liveWeatherRadar' && onToggleRain) {
        onToggleRain();
      }
      return next;
    });
  };

  const frameCount = frames.length;

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || frameCount <= 1) return;

    const intervalMs = Math.max(800 / playbackSpeed, 100);
    const timer = setInterval(() => {
      if (currentFrameIndex >= frameCount - 1) {
        if (onTogglePlay) {
          onTogglePlay();
        } else {
          setLocalIsPlaying(false);
        }
      } else {
        onSeekFrame(currentFrameIndex + 1);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, frameCount, currentFrameIndex, playbackSpeed, onSeekFrame, onTogglePlay]);

  const currentFrame = frames[currentFrameIndex] || null;
  const currentTimestamp = currentFrame?.timestamp_s ?? 60;

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `T+${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `T+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Current storm intensity in mm/hr
  const currentIntensity = selectedStormId === 'synthetic_120mmh_60min' ? 120 : selectedStormId === 'synthetic_80mmh_60min' ? 80 : 50;

  // Surcharge status calculation
  const hasFlooding = currentFrame?.node_states?.some((n) => n.status === 'flooding');
  const hasSurcharge = currentFrame?.node_states?.some((n) => n.status === 'surcharged');

  return (
    <>
      {/* ======================================================== */}
      {/* 1. LEFT COLUMN: Map Layers & Scenario Controls Panels    */}
      {/* ======================================================== */}
      <div className="absolute top-20 left-6 z-20 flex flex-col gap-3.5 w-76 pointer-events-auto select-none">
        {/* Panel 1: Map Layers */}
        <div className="bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/70 rounded-2xl shadow-2xl overflow-hidden transition-all">
          <div
            onClick={() => setIsLayersOpen(!isLayersOpen)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-stone-900/40 border-b border-[#3b1818]/40"
          >
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-xs text-stone-100 tracking-wide">Map Layers</span>
            </div>
            {isLayersOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            )}
          </div>

          {isLayersOpen && (
            <div className="p-3 text-[11px] space-y-1.5 text-stone-300">
              {/* Drainage Network */}
              <div
                onClick={() => toggleLayer('drainageNetwork')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.drainageNetwork
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.drainageNetwork && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Radio className="w-3.5 h-3.5 text-red-400" />
                  <span className="font-medium text-stone-200">Drainage Network</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Manholes & Inlets */}
              <div
                onClick={() => toggleLayer('manholesInlets')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.manholesInlets
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.manholesInlets && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Compass className="w-3.5 h-3.5 text-amber-400" />
                  <span>Manholes & Inlets</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Outfalls */}
              <div
                onClick={() => toggleLayer('outfalls')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.outfalls
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.outfalls && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="text-[10px] text-cyan-400 font-bold">▲</span>
                  <span>Outfalls</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Flood Risk Zones */}
              <div
                onClick={() => toggleLayer('floodRiskZones')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.floodRiskZones
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.floodRiskZones && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Flame className="w-3.5 h-3.5 text-rose-500" />
                  <span>Flood Risk Zones</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Elevation (DEM) */}
              <div
                onClick={() => toggleLayer('elevationDem')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.elevationDem
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.elevationDem && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="text-stone-400">≈</span>
                  <span>Elevation (DEM)</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Aerial Imagery */}
              <div
                onClick={() => toggleLayer('aerialImagery')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.aerialImagery
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.aerialImagery && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Aerial Imagery</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Property Boundaries */}
              <div
                onClick={() => toggleLayer('propertyBoundaries')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.propertyBoundaries
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.propertyBoundaries && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="text-stone-400">⬚</span>
                  <span>Property Boundaries</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Critical Infrastructure */}
              <div
                onClick={() => toggleLayer('criticalInfrastructure')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.criticalInfrastructure
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.criticalInfrastructure && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span className="text-amber-400">⚡</span>
                  <span>Critical Infrastructure</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>

              {/* Live Weather Radar */}
              <div
                onClick={() => toggleLayer('liveWeatherRadar')}
                className="flex items-center justify-between px-2 py-1 rounded-lg hover:bg-stone-900/60 cursor-pointer transition"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition ${
                      layers.liveWeatherRadar
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'border-stone-700 bg-stone-950/60'
                    }`}
                  >
                    {layers.liveWeatherRadar && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Weather Radar</span>
                </div>
                <MoreHorizontal className="w-3.5 h-3.5 text-stone-500 hover:text-stone-300" />
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Scenario Controls */}
        <div className="bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/70 rounded-2xl shadow-2xl overflow-hidden transition-all">
          <div
            onClick={() => setIsScenarioOpen(!isScenarioOpen)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-stone-900/40 border-b border-[#3b1818]/40"
          >
            <div className="flex items-center gap-2.5">
              <CloudRain className="w-4 h-4 text-red-500" />
              <span className="font-semibold text-xs text-stone-100 tracking-wide">Scenario Controls</span>
            </div>
            {isScenarioOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            )}
          </div>

          {isScenarioOpen && (
            <div className="p-4 space-y-4 text-xs">
              {/* Rainfall Intensity Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-stone-300">Rainfall Intensity</span>
                  <span className="text-xs font-mono font-bold text-red-400 bg-red-950/60 px-2 py-0.5 rounded-lg border border-red-900/50">
                    {currentIntensity} mm/hr
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="25"
                  value={currentIntensity <= 50 ? 50 : currentIntensity <= 80 ? 75 : 100}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (val <= 50) {
                      onSelectStorm('synthetic_80mmh_60min');
                      onLoadVerifiedRun('synthetic_80mmh_60min');
                    } else if (val <= 75) {
                      onSelectStorm('synthetic_80mmh_60min');
                      onLoadVerifiedRun('synthetic_80mmh_60min');
                    } else {
                      onSelectStorm('synthetic_120mmh_60min');
                      onLoadVerifiedRun('synthetic_120mmh_60min');
                    }
                  }}
                  className="w-full h-1.5 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
                <div className="flex justify-between text-[10px] text-stone-500 font-mono px-0.5">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </div>

              {/* Workflow Mode Switcher (Idle, Diagnose, Anticipate) */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-stone-300 block">Workflow Mode</span>
                <div className="grid grid-cols-3 gap-1 bg-stone-950/80 p-1 rounded-xl border border-stone-800/80 text-[11px]">
                  <button
                    onClick={() => onChangeAppMode?.('idle')}
                    className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                      appMode === 'idle'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Idle Patrol
                  </button>
                  <button
                    onClick={() => onChangeAppMode?.('diagnose')}
                    className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                      appMode === 'diagnose'
                        ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Diagnose
                  </button>
                  <button
                    onClick={() => onChangeAppMode?.('anticipate')}
                    className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                      appMode === 'anticipate'
                        ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Anticipate
                  </button>
                </div>
              </div>

              {/* Simulation Mode Pill Switcher */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-stone-300 block">Simulation Mode</span>
                <div className="grid grid-cols-3 gap-1 bg-stone-950/80 p-1 rounded-xl border border-stone-800/80 text-[11px]">
                  <button
                    onClick={() => setSimMode('realtime')}
                    className={`py-1 rounded-lg font-medium transition cursor-pointer ${
                      simMode === 'realtime'
                        ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Real-time
                  </button>
                  <button
                    onClick={() => setSimMode('forecast')}
                    className={`py-1 rounded-lg font-medium transition cursor-pointer ${
                      simMode === 'forecast'
                        ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Forecast
                  </button>
                  <button
                    onClick={() => setSimMode('historical')}
                    className={`py-1 rounded-lg font-medium transition cursor-pointer ${
                      simMode === 'historical'
                        ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white shadow-sm'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Historical
                  </button>
                </div>
              </div>

              {/* Analysis Tools Buttons */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-stone-300 block">Analysis Tools</span>
                <div className="space-y-1.5">
                  <button
                    onClick={onOpenInspect}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900/70 hover:bg-stone-800/80 border border-[#3b1818]/70 hover:border-red-500/50 text-stone-200 transition text-[11px] cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inspection Mode</span>
                  </button>
                  <button
                    onClick={onOpenDebrisLab}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900/70 hover:bg-stone-800/80 border border-[#3b1818]/70 hover:border-red-500/50 text-stone-200 transition text-[11px] cursor-pointer"
                  >
                    <span className="text-emerald-400 text-xs">🍃</span>
                    <span>Debris Mode</span>
                  </button>
                  <button
                    onClick={() => {
                      onSelectStorm('synthetic_120mmh_60min');
                      onLoadVerifiedRun('synthetic_120mmh_60min');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-stone-900/70 hover:bg-stone-800/80 border border-[#3b1818]/70 hover:border-red-500/50 text-stone-200 transition text-[11px] cursor-pointer"
                  >
                    <span className="text-red-400 text-xs">🌊</span>
                    <span>Flood Scenario</span>
                  </button>

                  <button
                    onClick={() => {
                      if (!hasSimulationStarted && onStartSimulation) {
                        onStartSimulation();
                      }
                      onRunSimulation();
                    }}
                    disabled={isRunning}
                    className="w-full mt-2 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-700 hover:from-red-500 hover:to-amber-600 text-white font-medium text-[11px] transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-900/40 disabled:opacity-50"
                  >
                    {isRunning ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{runProgressMessage || 'Solving...'}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-white" />
                        <span>{hasSimulationStarted ? 'Re-Run SWMM Simulation' : 'Start Simulation'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. BOTTOM LEFT: Drainage Network Status (Legend)         */}
      {/* ======================================================== */}
      <div className="absolute bottom-6 left-6 z-20 w-80 bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/70 rounded-2xl p-3.5 shadow-2xl text-[11px] pointer-events-auto select-none">
        <h4 className="font-semibold text-stone-200 text-xs mb-2.5">Drainage Network Status</h4>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-stone-300">
          {/* Capacity Colors */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-full bg-emerald-500" />
              <span>Normal Capacity</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-full bg-amber-400" />
              <span>Elevated Load</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-full bg-orange-500" />
              <span>High Load</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-full bg-red-600" />
              <span>Critical / Overflow</span>
            </div>
          </div>

          {/* Symbology Icons */}
          <div className="space-y-1.5 text-stone-400 border-l border-stone-800/80 pl-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">◯</span>
              <span className="text-stone-300">Manhole</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">▢</span>
              <span className="text-stone-300">Catch Basin / Inlet</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">▲</span>
              <span className="text-stone-300">Outfall</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs">➔</span>
              <span className="text-stone-300">Flow Direction</span>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. BOTTOM CENTER: Minimalist Timeline Player Bar         */}
      {/* ======================================================== */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-xl bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/70 rounded-2xl px-5 py-3 shadow-2xl flex flex-col gap-2 pointer-events-auto">
        {!hasSimulationStarted ? (
          /* Pre-Start State: Unified Start Button & Armed Rain Toggle */
          <div className="flex items-center justify-between text-xs py-0.5">
            <div className="flex items-center gap-3">
              {/* Unified Start Button */}
              <button
                onClick={onStartSimulation}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-700 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs transition cursor-pointer shadow-lg shadow-red-900/40 active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Simulation</span>
              </button>

              {/* Rain Pre-Start Toggle Button */}
              <button
                onClick={onToggleRain}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  rainEnabled
                    ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 shadow-sm'
                    : 'bg-stone-900/80 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
                title={
                  rainEnabled
                    ? 'Rain is armed. Precipitation animation will begin when Start Simulation is clicked.'
                    : 'Rain is disabled. Click to arm rain before starting.'
                }
              >
                <CloudRain
                  className={`w-3.5 h-3.5 ${rainEnabled ? 'text-cyan-400 animate-pulse' : 'text-stone-500'}`}
                />
                <span>{rainEnabled ? 'Rain: Armed (Starts on Run)' : 'Rain: Off'}</span>
              </button>
            </div>

            {/* Ready Status Pill */}
            <span className="px-3 py-1.5 rounded-full bg-stone-900/80 border border-stone-800 text-stone-300 text-[11px] font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Simulation Ready (Click Start)
            </span>
          </div>
        ) : (
          /* Started / Running State: Full Timeline Player Controls */
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {/* Play/Pause Button in Sime Darby Red */}
              <button
                onClick={() => (onTogglePlay ? onTogglePlay() : setLocalIsPlaying(!localIsPlaying))}
                className="p-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium transition cursor-pointer flex items-center justify-center shadow-lg shadow-red-900/40"
                title={isPlaying ? 'Pause Simulation' : 'Resume Simulation'}
              >
                {isPlaying ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-white" />
                )}
              </button>

              <button
                onClick={() => {
                  if (onResetSimulation) {
                    onResetSimulation();
                  } else {
                    setLocalIsPlaying(false);
                    onSeekFrame(0);
                  }
                }}
                className="p-2 rounded-xl bg-stone-900/80 hover:bg-stone-800 text-stone-300 transition cursor-pointer"
                title="Reset Simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Speed pills */}
              <div className="flex items-center rounded-xl bg-stone-950/80 border border-stone-800/80 p-0.5">
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition cursor-pointer ${
                      playbackSpeed === speed
                        ? 'bg-red-600/30 text-red-300 font-bold border border-red-500/40'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              {/* Current Timestamp */}
              <span className="font-mono text-red-400 font-bold text-xs bg-stone-950/60 px-2.5 py-1 rounded-lg border border-stone-800/60">
                {formatTime(currentTimestamp)}
              </span>

              {/* Rain Indicator Pill */}
              <button
                onClick={onToggleRain}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                  isRainActive
                    ? 'bg-cyan-950/50 border-cyan-500/40 text-cyan-300'
                    : rainEnabled
                    ? 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                    : 'bg-stone-950/60 border-stone-800 text-stone-500'
                }`}
                title="Toggle rain animation"
              >
                <CloudRain
                  className={`w-3 h-3 ${isRainActive ? 'text-cyan-400 animate-pulse' : 'text-stone-500'}`}
                />
                <span>
                  {isRainActive
                    ? `${currentIntensity} mm/h`
                    : rainEnabled
                    ? 'Paused'
                    : 'Off'}
                </span>
              </button>
            </div>

            {/* Surcharge Load Pill */}
            <div>
              {hasFlooding ? (
                <span className="px-2.5 py-1 rounded-full bg-red-600/20 border border-red-500/50 text-red-300 text-[11px] font-semibold flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Critical / Overflow
                </span>
              ) : hasSurcharge ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  High Load (78%)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Normal Capacity
                </span>
              )}
            </div>
          </div>
        )}

        {/* Minimalist Range Slider */}
        <div className="relative pt-0.5">
          <input
            type="range"
            min={0}
            max={Math.max(frameCount - 1, 0)}
            step={1}
            value={currentFrameIndex}
            onChange={(e) => {
              if (isPlaying && onTogglePlay) onTogglePlay();
              else setLocalIsPlaying(false);
              onSeekFrame(Number(e.target.value));
            }}
            className="w-full h-1.5 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>
      </div>
    </>
  );
};
