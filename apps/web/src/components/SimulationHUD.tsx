import React, { useEffect, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  CloudRain,
  Sliders,
  Waves,
  Activity,
  Layers,
  Info,
  HelpCircle,
  Zap,
} from 'lucide-react';
import {
  DebrisPreset,
  SimulationFrame,
  SimulationMetricsResponse,
  StormPreset,
  TailwaterPreset,
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
}

export const SimulationHUD: React.FC<SimulationHUDProps> = ({
  storms,
  selectedStormId,
  onSelectStorm,
  debrisScenarios,
  selectedDebrisId,
  onSelectDebris,
  tailwaterCases,
  selectedTailwater,
  onSelectTailwater,
  onRunSimulation,
  onLoadVerifiedRun,
  isRunning,
  runProgressMessage,
  frames,
  currentFrameIndex,
  onSeekFrame,
  metrics,
  undergroundOnly,
  onToggleUnderground,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 1x, 2x, 5x
  const [showDefinitions, setShowDefinitions] = useState(false);

  // Frame count
  const frameCount = frames.length;

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || frameCount <= 1) return;

    const intervalMs = Math.max(800 / playbackSpeed, 100);
    const timer = setInterval(() => {
      if (currentFrameIndex >= frameCount - 1) {
        setIsPlaying(false);
      } else {
        onSeekFrame(currentFrameIndex + 1);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, frameCount, currentFrameIndex, playbackSpeed, onSeekFrame]);

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

  const isRainActive = currentTimestamp <= 3600;

  return (
    <>
      {/* Bottom Timeline & Playback Bar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-5xl bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-2.5 pointer-events-auto">
        <div className="flex items-center justify-between text-xs">
          {/* Controls */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-600/30"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? '暂停' : '播放'}</span>
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                onSeekFrame(0);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="重置到起点"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Speed toggle */}
            <div className="flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              {[1, 2, 5].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Current Timestamp */}
            <div className="flex items-baseline gap-1.5 font-mono px-3 py-1 rounded bg-slate-950 border border-slate-800">
              <span className="text-cyan-400 font-bold text-sm">
                {formatTime(currentTimestamp)}
              </span>
              <span className="text-slate-500 text-[11px]">
                / {formatTime(frames[frameCount - 1]?.timestamp_s ?? 7200)}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">
                (帧 {currentFrameIndex + 1}/{frameCount})
              </span>
            </div>

            {/* Rain stage indicator */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-[11px]">
              {isRainActive ? (
                <span className="text-blue-400 font-medium flex items-center gap-1">
                  <CloudRain className="w-3.5 h-3.5" /> 降雨产汇流阶段 (t ≤ 1h)
                </span>
              ) : (
                <span className="text-slate-400 font-medium">
                  排空与退水阶段 (Dry-down)
                </span>
              )}
            </div>
          </div>

          {/* Surcharge Alert Pill & Toggles */}
          <div className="flex items-center gap-2">
            {currentFrame?.node_states?.some((n) => n.status === 'flooding') ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                节点地面积水溢流 (Surface Flooding)
              </span>
            ) : currentFrame?.node_states?.some((n) => n.status === 'surcharged') ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                管网已进入超载顶托 (Surcharged)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                重力自流平稳 (Normal)
              </span>
            )}

            <button
              onClick={onToggleUnderground}
              className={`px-3 py-1 rounded-lg border text-xs transition cursor-pointer flex items-center gap-1.5 ${
                undergroundOnly
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{undergroundOnly ? '地下高亮' : '全貌模式'}</span>
            </button>
          </div>
        </div>

        {/* Timeline Slider with visual rain/drainage zone markings */}
        <div className="relative pt-1">
          <input
            type="range"
            min={0}
            max={Math.max(frameCount - 1, 0)}
            step={1}
            value={currentFrameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onSeekFrame(Number(e.target.value));
            }}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Timeline Event Markers */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
          <span>T+00:01:00 (起点)</span>
          <span className="text-amber-400 font-semibold">T+00:30:00 (产汇流峰值)</span>
          <span className="text-blue-400 font-semibold">T+01:00:00 (降雨停止)</span>
          <span>T+01:30:00 (退水)</span>
          <span>T+02:00:00 (排空结束)</span>
        </div>
      </div>

      {/* Top-Left Scenario Control Card */}
      <div className="absolute top-26 left-5 z-20 w-84 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl text-xs space-y-3 pointer-events-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" /> 水力工况设定 (Scenario)
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
            SWMM 5.2.4 Verified
          </span>
        </div>

        {/* Storm Selector */}
        <div>
          <label className="text-slate-400 font-medium flex items-center gap-1 mb-1">
            <CloudRain className="w-3.5 h-3.5 text-blue-400" /> 降雨工况 (Rainfall Event)
          </label>
          <select
            value={selectedStormId}
            onChange={(e) => {
              const stormId = e.target.value;
              onSelectStorm(stormId);
              onLoadVerifiedRun(stormId);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-sans"
          >
            {storms.map((s) => (
              <option key={s.storm_id} value={s.storm_id}>
                {s.name} ({s.parameters.intensity_mmh} mm/h)
              </option>
            ))}
          </select>
        </div>

        {/* Debris Restriction Scenario Selector */}
        <div>
          <label className="text-slate-400 font-medium flex items-center gap-1 mb-1">
            <Activity className="w-3.5 h-3.5 text-amber-400" /> INLET-D07 进水折减假设 (Clogging)
          </label>
          <select
            value={selectedDebrisId}
            onChange={(e) => onSelectDebris(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-sans"
          >
            {debrisScenarios.map((d) => (
              <option key={d.debris_scenario_id} value={d.debris_scenario_id}>
                {d.name} {!d.swmm_supported ? '(假设预设)' : ''}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            T1 离线模型采用直排 Sewer 节点；有限入口限制留待 T3。
          </p>
        </div>

        {/* Tailwater Case */}
        <div>
          <label className="text-slate-400 font-medium flex items-center gap-1 mb-1">
            <Waves className="w-3.5 h-3.5 text-emerald-400" /> 尾水顶托 (Tailwater Stage)
          </label>
          <select
            value={selectedTailwater}
            onChange={(e) => onSelectTailwater(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-sans"
          >
            {tailwaterCases.map((t) => (
              <option key={t.tailwater_case} value={t.tailwater_case}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Run SWMM / Trigger button */}
        <div className="pt-1 space-y-2">
          <button
            onClick={onRunSimulation}
            disabled={isRunning}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
          >
            {isRunning ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{runProgressMessage || '求解中...'}</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>执行水力模拟 (Run Simulation)</span>
              </>
            )}
          </button>

          {/* Quick Toggle to Verified Datasets */}
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                onSelectStorm('synthetic_80mmh_60min');
                onLoadVerifiedRun('synthetic_80mmh_60min');
              }}
              className={`flex-1 py-1 rounded text-[11px] border transition cursor-pointer flex items-center justify-center gap-1 ${
                selectedStormId === 'synthetic_80mmh_60min'
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>基线 (80mm/h)</span>
            </button>
            <button
              onClick={() => {
                onSelectStorm('synthetic_120mmh_60min');
                onLoadVerifiedRun('synthetic_120mmh_60min');
              }}
              className={`flex-1 py-1 rounded text-[11px] border transition cursor-pointer flex items-center justify-center gap-1 ${
                selectedStormId === 'synthetic_120mmh_60min'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 font-medium'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3 h-3 text-rose-400" />
              <span>极端 (120mm/h)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top-Right Metrics Card */}
      {metrics && (
        <div className="absolute top-26 right-5 z-10 w-80 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl text-xs space-y-2.5 pointer-events-auto">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-semibold text-slate-200">SWMM 模拟指标 (Metrics)</span>
            </div>
            <button
              onClick={() => setShowDefinitions(!showDefinitions)}
              className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 text-[11px] cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>指标说明</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">溢流总量</span>
              <span className="text-base font-bold font-mono text-rose-400">
                {metrics.total_flooding_volume_m3 < 0.1
                  ? `${metrics.total_flooding_volume_m3.toFixed(3)} m³`
                  : `${metrics.total_flooding_volume_m3.toFixed(1)} m³`}
              </span>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">溢流节点数</span>
              <span className="text-base font-bold font-mono text-amber-400">
                {metrics.flooded_node_count} 处
              </span>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">超载时长并集</span>
              <span className="text-base font-bold font-mono text-cyan-400">
                {(metrics.surcharge_duration_s / 60).toFixed(0)} min
              </span>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">求解引擎</span>
              <span className="text-xs font-bold font-mono text-slate-300">
                {metrics.engine} {metrics.engine_version}
              </span>
            </div>
          </div>

          {/* Warnings if any */}
          {metrics.warnings && metrics.warnings.length > 0 && (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] leading-relaxed">
              <strong>Engine Note:</strong> {metrics.warnings[0]}
            </div>
          )}

          {/* Status Definitions Drawer / Accordion */}
          {showDefinitions && metrics.status_definitions && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 text-[10px] text-slate-300 max-h-48 overflow-y-auto">
              <div className="font-semibold text-slate-200">物理状态阈值依据 (Physical Criteria):</div>
              <div>
                <strong className="text-amber-400">node_surcharged:</strong>{' '}
                {metrics.status_definitions.node_surcharged}
              </div>
              <div>
                <strong className="text-rose-400">node_flooding:</strong>{' '}
                {metrics.status_definitions.node_flooding}
              </div>
              <div>
                <strong className="text-cyan-400">pipe_near_capacity:</strong>{' '}
                {metrics.status_definitions.pipe_near_capacity}
              </div>
              <div>
                <strong className="text-rose-400">pipe_surcharged:</strong>{' '}
                {metrics.status_definitions.pipe_surcharged}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                正常重力流 (Normal)
              </span>
              <span className="text-slate-500 font-mono">&lt;80% 满流</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                接近满管/顶托 (Near/Surcharged)
              </span>
              <span className="text-slate-500 font-mono">≥80% 满流</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                节点地面积水 (Flooding)
              </span>
              <span className="text-slate-500 font-mono">溢出井盖</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
