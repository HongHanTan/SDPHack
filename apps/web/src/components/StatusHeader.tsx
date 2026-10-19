import React from 'react';
import { AlertTriangle, CheckCircle2, Database, Server, RefreshCw, Search, Zap, Sliders } from 'lucide-react';
import { DataMode } from '../api/client';
import { HealthResponse, AppMode } from '../types';

interface StatusHeaderProps {
  mode: DataMode;
  onToggleMode: (newMode: DataMode) => void;
  appMode: AppMode;
  onChangeAppMode: (mode: AppMode) => void;
  onOpenInterventions: () => void;
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
  apiError: string | null;
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  mode,
  onToggleMode,
  appMode,
  onChangeAppMode,
  onOpenInterventions,
  health,
  loading,
  onRefresh,
  apiError,
}) => {
  return (
    <header className="absolute top-0 left-0 right-0 z-20 flex flex-col pointer-events-none">
      {/* Top Warning Banner for Mock Mode */}
      {mode === 'mock' && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-200 text-xs px-4 py-1.5 flex items-center justify-between backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold tracking-wide uppercase">开发 Mock 模式</span>
            <span className="text-amber-300/80">
              — 当前使用前端静态 Fixture，非真实 SWMM 计算结果。仅供交互原型与接口对齐开发。
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleMode('api')}
              className="text-xs bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 px-2 py-0.5 rounded border border-amber-400/50 transition cursor-pointer"
            >
              切换至真实 API 模式
            </button>
          </div>
        </div>
      )}

      {/* Real API Error Alert */}
      {mode === 'api' && apiError && (
        <div className="bg-rose-500/20 border-b border-rose-500/40 text-rose-200 text-xs px-4 py-1.5 flex items-center justify-between backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-semibold uppercase tracking-wide">后端连接异常 (API Error)</span>
            <span className="text-rose-300/80">{apiError}</span>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 px-2 py-0.5 rounded border border-rose-400/50 transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> 重试
          </button>
        </div>
      )}

      {/* Main Bar */}
      <div className="flex items-center justify-between px-5 py-2.5 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 pointer-events-auto">
        {/* Left: Branding & Twin Model Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Township FloodOps
            </h1>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
            Taman Kyra Synthetic Twin v1
          </span>
        </div>

        {/* Center: Workflow Mode Switcher (Diagnose vs Anticipate vs Act) */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center rounded-xl bg-slate-900/90 p-1 border border-slate-800 shadow-inner">
            <button
              onClick={() => onChangeAppMode('diagnose')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer font-medium ${
                appMode === 'diagnose'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>诊断复盘 (Diagnose)</span>
            </button>
            <button
              onClick={() => onChangeAppMode('anticipate')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition cursor-pointer font-medium ${
                appMode === 'anticipate'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>暴雨推演 (Anticipate)</span>
            </button>
          </div>

          <div className="h-4 w-px bg-slate-800" />

          {/* Interventions Comparison / Act Button */}
          <button
            onClick={onOpenInterventions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600/30 to-blue-600/30 hover:from-cyan-600/50 hover:to-blue-600/50 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 transition cursor-pointer text-xs font-semibold shadow-sm"
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>方案对比与治理决策 (Act)</span>
          </button>
        </div>

        {/* Right: Engine health, mode toggle, refresh */}
        <div className="flex items-center gap-3 text-xs">
          {/* Engine health */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            {health?.swmm?.available ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="text-slate-400">SWMM:</span>
            <span className="font-mono text-slate-200">
              {health?.swmm
                ? `${health.swmm.engine} ${health.swmm.engine_version}`
                : 'Checking...'}
            </span>
            {health?.swmm?.execution_verified && (
              <span className="ml-1 text-[10px] text-emerald-400 font-mono px-1 rounded bg-emerald-500/10">
                VERIFIED
              </span>
            )}
          </div>

          {/* Data Mode Switcher */}
          <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800">
            <button
              onClick={() => onToggleMode('mock')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                mode === 'mock'
                  ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3 h-3" /> Mock
            </button>
            <button
              onClick={() => onToggleMode('api')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition cursor-pointer ${
                mode === 'api'
                  ? 'bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Server className="w-3 h-3" /> Real API
            </button>
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Refresh assets & status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mode Contextual Banner */}
      <div
        className={`px-5 py-1.5 text-xs backdrop-blur-md border-b flex items-center justify-between pointer-events-auto transition-colors ${
          appMode === 'diagnose'
            ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
            : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
        }`}
      >
        <div className="flex items-center gap-2">
          {appMode === 'diagnose' ? (
            <>
              <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-semibold">【现状诊断复盘】</span>
              <span className="text-amber-300/80">
                追溯历史降雨事件：现场照片与巡检证实 INLET-D07 喉口受阻约 40%，为导致路面滞积 686 m³ 的关键成因；地下管道此时负荷尚充裕。
              </span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold">【暴雨前瞻推演】</span>
              <span className="text-cyan-300/80">
                推演 50 年一遇极端季风降雨 (120 mm/h)：清淤后入网流量骤增将导致下游主干管 (PIPE-P07) 满管顶托 55 分钟。需提前制定运维与工程升级决策。
              </span>
            </>
          )}
        </div>

        <button
          onClick={onOpenInterventions}
          className="text-[11px] underline font-medium hover:text-white transition cursor-pointer shrink-0 ml-4"
        >
          查看干预对比与行动报告 →
        </button>
      </div>
    </header>
  );
};
