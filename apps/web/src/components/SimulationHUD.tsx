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
  /** Engine mode: hide the verified-SWMM-run storm slider (it loads offline SWMM fixtures). */
  hideVerifiedRun?: boolean;
  /** Engine mode: storms offered by a compact selector (replaces the hidden verified-run slider). */
  engineStorms?: { id: string; label: string }[];
  /** Engine mode: rain intensity at the displayed time, replacing the fixed SWMM storm figure. */
  intensityMmh?: number;
  /** Engine mode: Live toggle and its playback controls. Absent: unchanged playback UI. */
  liveAvailable?: boolean;
  liveOn?: boolean;
  onToggleLive?: (on: boolean) => void;
  liveSpeed?: number;
  onLiveSpeed?: (s: number) => void;
  livePaused?: boolean;
  onLivePause?: () => void;
  onLiveSeek?: (t: 'start' | 'peak' | 'end') => void;
  liveTimeS?: number;
  /** Engine mode: engine wording, and the applied dashboard option instead of the SWMM-only tools. */
  engineMode?: boolean;
  appliedOptionTitle?: string;
  /** Imported engine site: the hotspot node shown in place of J07. */
  hotspotLabel?: string;
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
  hideVerifiedRun,
  engineStorms,
  intensityMmh,
  liveAvailable,
  liveOn,
  onToggleLive,
  liveSpeed = 1,
  onLiveSpeed,
  livePaused = false,
  onLivePause,
  onLiveSeek,
  liveTimeS = 0,
  engineMode = false,
  appliedOptionTitle,
  hotspotLabel = 'J07',
}) => {
  const liveActive = !!liveAvailable && !!liveOn;
  // Engine-only metric fields (absent from SWMM/mock metrics, so nothing extra renders there).
  const j07PeakDepthM = (_metrics as { j07_peak_depth_m?: number } | null)?.j07_peak_depth_m;
  const homesFlooded = (_metrics as { homes_flooded?: number } | null)?.homes_flooded;
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const isPlaying = isPlayingProp !== undefined ? isPlayingProp : localIsPlaying;
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [simMode, setSimMode] = useState<'realtime' | 'forecast' | 'historical'>('realtime');
  const [leftTab, setLeftTab] = useState<'scenario' | 'layers' | 'legend'>('scenario');
  const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);

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
  const currentIntensity = intensityMmh !== undefined ? Math.round(intensityMmh) : selectedStormId === 'synthetic_120mmh_60min' ? 120 : selectedStormId === 'synthetic_80mmh_60min' ? 80 : 50;

  // Surcharge status calculation
  const hasFlooding = currentFrame?.node_states?.some((n) => n.status === 'flooding');
  const hasSurcharge = currentFrame?.node_states?.some((n) => n.status === 'surcharged');

  return (
    <>
      {/* ======================================================== */}
      {/* 1. LEFT COLUMN: Unified Non-Overlapping Operations Card   */}
      {/* ======================================================== */}
      {isLeftCollapsed ? (
        <div className="absolute top-20 left-6 z-20 pointer-events-auto">
          <button
            onClick={() => setIsLeftCollapsed(false)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-xl border border-slate-200 text-slate-800 shadow-md text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-red-600" />
            <span>Map Controls & Scenario</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      ) : (
        <div className="absolute top-20 left-6 z-20 w-80 max-h-[calc(100vh-6.5rem)] flex flex-col bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden pointer-events-auto select-none animate-in fade-in">
          {/* Card Navigation Tabs */}
          <div className="flex items-center justify-between p-1.5 border-b border-slate-200 bg-slate-50/90">
            <div className="flex items-center gap-1 flex-1">
              <button
                onClick={() => setLeftTab('scenario')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  leftTab === 'scenario'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Scenario
              </button>
              <button
                onClick={() => setLeftTab('layers')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  leftTab === 'layers'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Layers
              </button>
              <button
                onClick={() => setLeftTab('legend')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer text-center ${
                  leftTab === 'legend'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                Legend
              </button>
            </div>
            <button
              onClick={() => setIsLeftCollapsed(true)}
              className="p-1.5 ml-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
              title="Minimize dock"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-3.5 overflow-y-auto max-h-[calc(100vh-10rem)] text-xs text-slate-700 space-y-4">
            {/* TAB 1: SCENARIO CONTROLS */}
            {leftTab === 'scenario' && (
              <div className="space-y-4">
                {/* Rainfall Intensity Slider */}
                {!hideVerifiedRun && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-700">Rainfall Intensity</span>
                      <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">
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
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono px-0.5">
                      <span>50 mm/h</span>
                      <span>80 mm/h</span>
                      <span>120 mm/h</span>
                    </div>
                  </div>
                )}

                {/* Engine mode: storm selector */}
                {hideVerifiedRun && engineStorms && engineStorms.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-700 block">Storm</span>
                    <select
                      value={selectedStormId}
                      onChange={(e) => onSelectStorm(e.target.value)}
                      disabled={isRunning}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-800 cursor-pointer focus:outline-none focus:border-red-400 disabled:opacity-50"
                    >
                      {engineStorms.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Engine run results: render only when the engine's metric fields are present */}
                {!liveActive && (j07PeakDepthM !== undefined || homesFlooded !== undefined) && (
                  <div className="space-y-1 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                    {j07PeakDepthM !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">{hotspotLabel} peak depth</span>
                        <span className="font-mono font-bold text-slate-900">{j07PeakDepthM.toFixed(2)} m</span>
                      </div>
                    )}
                    {homesFlooded !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Homes flooded</span>
                        <span className="font-mono font-bold text-slate-900">{homesFlooded}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Workflow Mode Switcher (Idle, Diagnose, Anticipate) */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-700 block">Workflow Mode</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px]">
                    <button
                      onClick={() => onChangeAppMode?.('idle')}
                      className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                        appMode === 'idle'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Idle Patrol
                    </button>
                    <button
                      onClick={() => onChangeAppMode?.('diagnose')}
                      className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                        appMode === 'diagnose'
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Diagnose
                    </button>
                    <button
                      onClick={() => onChangeAppMode?.('anticipate')}
                      className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                        appMode === 'anticipate'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Anticipate
                    </button>
                  </div>
                </div>

                {/* Simulation Mode Pill Switcher */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-700 block">Simulation Mode</span>
                  <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px]">
                    <button
                      onClick={() => setSimMode('realtime')}
                      className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                        simMode === 'realtime'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Real-time
                    </button>
                    <button
                      onClick={() => setSimMode('forecast')}
                      className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                        simMode === 'forecast'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Forecast
                    </button>
                    <button
                      onClick={() => setSimMode('historical')}
                      className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                        simMode === 'historical'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Historical
                    </button>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="space-y-1.5 pt-1">
                  {engineMode ? (
                    // Engine mode: Inspect and Debris Lab have no engine backing, so the applied option shows here instead.
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-semibold text-slate-700">Applied:</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-semibold truncate">
                        {appliedOptionTitle ?? 'Baseline'}
                      </span>
                    </div>
                  ) : (
                  <>
                  <span className="text-[11px] font-semibold text-slate-700 block">Analysis Tools</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={onOpenInspect}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition text-[11px] cursor-pointer"
                    >
                      <Search className="w-3.5 h-3.5 text-amber-500" />
                      <span>Inspect</span>
                    </button>
                    <button
                      onClick={onOpenDebrisLab}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition text-[11px] cursor-pointer"
                    >
                      <span className="text-emerald-500 text-xs">🍃</span>
                      <span>Debris Lab</span>
                    </button>
                  </div>
                  </>
                  )}

                  {!liveActive && (
                  <button
                    onClick={() => {
                      if (!hasSimulationStarted && onStartSimulation) {
                        onStartSimulation();
                      }
                      onRunSimulation();
                    }}
                    disabled={isRunning}
                    className="w-full mt-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-red-600/20 disabled:opacity-50"
                  >
                    {isRunning ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{runProgressMessage || 'Solving...'}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>
                          {hasSimulationStarted
                            ? engineMode
                              ? 'Re-Run Engine Simulation'
                              : 'Re-Run SWMM Simulation'
                            : 'Start Simulation'}
                        </span>
                      </>
                    )}
                  </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MAP LAYERS */}
            {leftTab === 'layers' && (
              <div className="space-y-1 text-slate-700">
                {[
                  { key: 'drainageNetwork', label: 'Drainage Network', icon: <Radio className="w-3.5 h-3.5 text-red-500" /> },
                  { key: 'manholesInlets', label: 'Manholes & Inlets', icon: <Compass className="w-3.5 h-3.5 text-amber-500" /> },
                  { key: 'outfalls', label: 'Outfalls', icon: <span className="text-[10px] text-cyan-600 font-bold">▲</span> },
                  { key: 'floodRiskZones', label: 'Flood Risk Zones', icon: <Flame className="w-3.5 h-3.5 text-rose-500" /> },
                  { key: 'elevationDem', label: 'Elevation (DEM)', icon: <span className="text-slate-400">≈</span> },
                  { key: 'aerialImagery', label: 'Aerial Imagery', icon: <Eye className="w-3.5 h-3.5 text-emerald-600" /> },
                  { key: 'propertyBoundaries', label: 'Property Boundaries', icon: <span className="text-slate-400">⬚</span> },
                  { key: 'criticalInfrastructure', label: 'Critical Infrastructure', icon: <span className="text-amber-500">⚡</span> },
                  { key: 'liveWeatherRadar', label: 'Live Weather Radar', icon: <CloudRain className="w-3.5 h-3.5 text-cyan-600" /> },
                ].map(({ key, label, icon }) => {
                  const active = layers[key as keyof typeof layers];
                  return (
                    <div
                      key={key}
                      onClick={() => toggleLayer(key as keyof typeof layers)}
                      className="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-slate-100 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            active
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {active && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        {icon}
                        <span className="font-medium text-slate-800 text-[11px]">{label}</span>
                      </div>
                      <MoreHorizontal className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: DRAINAGE NETWORK STATUS (LEGEND) */}
            {leftTab === 'legend' && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-800 block">Hydraulic Capacity</span>
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-2 rounded-full bg-emerald-500" />
                      <span className="text-slate-700">Normal Capacity (&lt;75%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-2 rounded-full bg-amber-400" />
                      <span className="text-slate-700">Elevated Load (75-90%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-2 rounded-full bg-orange-500" />
                      <span className="text-slate-700">High Load (90-99%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-2 rounded-full bg-red-600" />
                      <span className="text-slate-700">Critical / Overflow (100%)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-800 block">Network Symbology</span>
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">◯</span>
                      <span className="text-slate-700">Manhole / Chamber</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">▢</span>
                      <span className="text-slate-700">Catch Basin / Inlet Grate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan-600">▲</span>
                      <span className="text-slate-700">Gravity Outfall</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">➔</span>
                      <span className="text-slate-700">Flow Direction Vector</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. BOTTOM CENTER: Minimalist Light Timeline Player Bar   */}
      {/* ======================================================== */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 w-[90%] max-w-xl bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl px-5 py-3 shadow-xl flex flex-col gap-2 pointer-events-auto text-slate-800">
        {liveAvailable && (
          /* Engine mode: Playback | Live segmented control */
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px]">
            <button
              onClick={() => liveOn && onToggleLive?.(false)}
              className={`py-1 rounded-lg font-medium transition cursor-pointer text-center ${
                !liveOn ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Playback
            </button>
            <button
              onClick={() => !liveOn && onToggleLive?.(true)}
              disabled={isRunning}
              className={`py-1 rounded-lg font-medium transition cursor-pointer text-center disabled:opacity-50 ${
                liveOn ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Live
            </button>
          </div>
        )}
        {liveActive ? (
          /* Live: continuous engine storm controls */
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={onLivePause}
              className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition cursor-pointer flex items-center justify-center shadow-md shadow-red-600/20"
              title={livePaused ? 'Resume live storm' : 'Pause live storm'}
            >
              {livePaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5" />}
            </button>

            <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5">
              {[0.5, 1, 2, 4].map((s) => (
                <button
                  key={s}
                  onClick={() => onLiveSpeed?.(s)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition cursor-pointer ${
                    liveSpeed === s ? 'bg-red-600 text-white font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {s === 0.5 ? '½' : s}x
                </button>
              ))}
            </div>

            <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5">
              {([
                ['start', 'Start'],
                ['peak', 'Peak rain'],
                ['end', 'Rain stops'],
              ] as const).map(([target, label]) => (
                <button
                  key={target}
                  onClick={() => onLiveSeek?.(target)}
                  className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition cursor-pointer"
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="font-mono text-slate-800 font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {formatTime(Math.round(liveTimeS))}
            </span>

            <button
              onClick={onToggleRain}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                isRainActive
                  ? 'bg-cyan-50 border-cyan-200 text-cyan-800'
                  : rainEnabled
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-slate-100 border-slate-200 text-slate-500'
              }`}
              title="Toggle rain animation"
            >
              <CloudRain className={`w-3 h-3 ${isRainActive ? 'text-cyan-600 animate-pulse' : 'text-slate-400'}`} />
              <span>{isRainActive ? `${currentIntensity} mm/h` : rainEnabled ? (livePaused ? 'Paused' : 'Dry') : 'Off'}</span>
            </button>
          </div>
        ) : !hasSimulationStarted ? (
          /* Pre-Start State: Unified Start Button & Armed Rain Toggle */
          <div className="flex items-center justify-between text-xs py-0.5">
            <div className="flex items-center gap-3">
              {/* Unified Start Button */}
              <button
                onClick={onStartSimulation}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-red-600/20 active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Simulation</span>
              </button>

              {/* Rain Pre-Start Toggle Button */}
              <button
                onClick={onToggleRain}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium border transition cursor-pointer ${
                  rainEnabled
                    ? 'bg-cyan-50 border-cyan-200 text-cyan-800 shadow-sm'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
                }`}
                title={
                  rainEnabled
                    ? 'Rain is armed. Precipitation animation will begin when Start Simulation is clicked.'
                    : 'Rain is disabled. Click to arm rain before starting.'
                }
              >
                <CloudRain
                  className={`w-3.5 h-3.5 ${rainEnabled ? 'text-cyan-600 animate-pulse' : 'text-slate-400'}`}
                />
                <span>{rainEnabled ? 'Rain: Armed (Starts on Run)' : 'Rain: Off'}</span>
              </button>
            </div>

            {/* Ready Status Pill */}
            <span className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              Simulation Ready
            </span>
          </div>
        ) : (
          /* Started / Running State: Full Timeline Player Controls */
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {/* Play/Pause Button in Sime Darby Red */}
              <button
                onClick={() => (onTogglePlay ? onTogglePlay() : setLocalIsPlaying(!localIsPlaying))}
                className="p-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition cursor-pointer flex items-center justify-center shadow-md shadow-red-600/20"
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
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition cursor-pointer border border-slate-200"
                title="Reset Simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Speed pills */}
              <div className="flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5">
                {[1, 2, 5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-mono transition cursor-pointer ${
                      playbackSpeed === speed
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              {/* Current Timestamp */}
              <span className="font-mono text-slate-800 font-bold text-xs bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                {formatTime(currentTimestamp)}
              </span>

              {/* Rain Indicator Pill */}
              <button
                onClick={onToggleRain}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-mono transition cursor-pointer ${
                  isRainActive
                    ? 'bg-cyan-50 border-cyan-200 text-cyan-800'
                    : rainEnabled
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-slate-100 border-slate-200 text-slate-500'
                }`}
                title="Toggle rain animation"
              >
                <CloudRain
                  className={`w-3 h-3 ${isRainActive ? 'text-cyan-600 animate-pulse' : 'text-slate-400'}`}
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
                <span className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-red-600" />
                  Critical / Overflow
                </span>
              ) : hasSurcharge ? (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  High Load (78%)
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Normal Capacity
                </span>
              )}
            </div>
          </div>
        )}

        {/* Minimalist Range Slider */}
        {!liveActive && (
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
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
          />
        </div>
        )}
      </div>
    </>
  );
};
