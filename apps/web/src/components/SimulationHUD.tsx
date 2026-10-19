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
} from 'lucide-react';
import {
  DebrisScenarioItem,
  SimulationFrame,
  SimulationMetricsResponse,
  StormItem,
  TailwaterCaseItem,
} from '../types';

interface SimulationHUDProps {
  storms: StormItem[];
  selectedStormId: string;
  onSelectStorm: (id: string) => void;
  debrisScenarios: DebrisScenarioItem[];
  selectedDebrisId: string;
  onSelectDebris: (id: string) => void;
  tailwaterCases: TailwaterCaseItem[];
  selectedTailwater: string;
  onSelectTailwater: (id: string) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
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
  isRunning,
  frames,
  currentFrameIndex,
  onSeekFrame,
  metrics,
  undergroundOnly,
  onToggleUnderground,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Playback timer loop
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) return;

    const timer = setInterval(() => {
      if (currentFrameIndex >= frames.length - 1) {
        setIsPlaying(false);
      } else {
        onSeekFrame(currentFrameIndex + 1);
      }
    }, 1200);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length, currentFrameIndex, onSeekFrame]);

  const currentFrame = frames[currentFrameIndex] || null;
  const currentTimestamp = currentFrame?.timestamp_s ?? 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `T+${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Bottom Timeline & Playback Bar */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-4xl bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-3 pointer-events-auto">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer flex items-center gap-1.5 shadow-lg shadow-cyan-600/30"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? '暂停' : '回放'}</span>
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                onSeekFrame(0);
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Reset Timeline"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="flex items-baseline gap-1.5 font-mono px-3 py-1 rounded bg-slate-950 border border-slate-800">
              <span className="text-cyan-400 font-bold text-sm">
                {formatTime(currentTimestamp)}
              </span>
              <span className="text-slate-500 text-[11px]">
                / {formatTime(frames[frames.length - 1]?.timestamp_s ?? 3600)}
              </span>
            </div>
          </div>

          {/* Surcharge Alert Pill */}
          <div className="flex items-center gap-2">
            {currentFrame?.node_states.some((n) => n.status === 'flooding') ? (
              <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                低洼节点发生地面积水溢流 (Surface Flooding)
              </span>
            ) : currentFrame?.node_states.some((n) => n.status === 'surcharged') ? (
              <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                管网已进入超载顶托状态 (Surcharged)
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                重力自流平稳 (Gravity Flow Normal)
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
              <span>{undergroundOnly ? '地下管网高亮' : '全貌模式'}</span>
            </button>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={Math.max(frames.length - 1, 0)}
            step={1}
            value={currentFrameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onSeekFrame(Number(e.target.value));
            }}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        {/* Step ticks */}
        <div className="flex justify-between text-[10px] text-slate-500 font-mono px-1">
          {frames.map((f, idx) => (
            <button
              key={f.timestamp_s}
              onClick={() => {
                setIsPlaying(false);
                onSeekFrame(idx);
              }}
              className={`hover:text-cyan-400 cursor-pointer ${
                idx === currentFrameIndex ? 'text-cyan-400 font-bold' : ''
              }`}
            >
              {formatTime(f.timestamp_s)}
            </button>
          ))}
        </div>
      </div>

      {/* Top-Left Scenario Control Card */}
      <div className="absolute top-20 left-5 z-20 w-80 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 shadow-xl text-xs space-y-3 pointer-events-auto">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-cyan-400" /> 水力工况设定 (Scenario)
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
            Immutable Run
          </span>
        </div>

        {/* Storm Selector */}
        <div>
          <label className="text-slate-400 font-medium flex items-center gap-1 mb-1">
            <CloudRain className="w-3.5 h-3.5 text-blue-400" /> 降雨工况 (Rainfall Event)
          </label>
          <select
            value={selectedStormId}
            onChange={(e) => onSelectStorm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer font-sans"
          >
            {storms.map((s) => (
              <option key={s.storm_id} value={s.storm_id}>
                {s.name} ({s.intensity_mmh} mm/h)
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
                {d.name}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Info className="w-3 h-3 shrink-0" />
            基于现场 65% 格栅覆盖率的折减假设，未作率定时属假说
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
              <option key={t.case_id} value={t.case_id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Execute Button */}
        <button
          onClick={onRunSimulation}
          disabled={isRunning}
          className="w-full mt-2 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>SWMM 求解中 (Running)...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>执行水力模拟 (Run SWMM)</span>
            </>
          )}
        </button>
      </div>

      {/* Top-Right Metrics Card */}
      {metrics && (
        <div className="absolute top-20 right-5 z-10 w-72 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 shadow-xl text-xs space-y-2 pointer-events-auto">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-cyan-400" /> 模拟指标 (Run Metrics)
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">SIMULATED</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">溢流总量</span>
              <span className="text-sm font-bold font-mono text-rose-400">
                {metrics.total_flooding_volume_m3.toFixed(1)} m³
              </span>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">溢流节点数</span>
              <span className="text-sm font-bold font-mono text-amber-400">
                {metrics.flooded_node_count} 处
              </span>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">超载时长</span>
              <span className="text-sm font-bold font-mono text-cyan-400">
                {(metrics.surcharge_duration_s / 60).toFixed(0)} min
              </span>
            </div>

            <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">排放峰值流量</span>
              <span className="text-sm font-bold font-mono text-slate-200">
                {(metrics.peak_flow_m3s || 0).toFixed(2)} m³/s
              </span>
            </div>
          </div>

          {/* Color Legend */}
          <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
            <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
              状态图例 (Legend)
            </div>
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
              <span className="text-slate-500 font-mono">80-100% 满流</span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                节点地面积水 (Node Flooding)
              </span>
              <span className="text-slate-500 font-mono">溢出井盖</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
