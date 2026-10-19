import React from 'react';
import { AlertTriangle, CheckCircle2, Database, Server, RefreshCw } from 'lucide-react';
import { DataMode } from '../api/client';
import { HealthResponse } from '../types';

interface StatusHeaderProps {
  mode: DataMode;
  onToggleMode: (newMode: DataMode) => void;
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
  apiError: string | null;
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  mode,
  onToggleMode,
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
      <div className="flex items-center justify-between px-5 py-3 backdrop-blur-md bg-slate-950/70 border-b border-slate-800/80 pointer-events-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-500 animate-pulse" />
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">
              Township FloodOps
            </h1>
          </div>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            Taman Kyra Synthetic Twin v1
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {/* Engine health */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300">
            {health?.swmm?.available ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="text-slate-400">Engine:</span>
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

          {/* Mode Switcher */}
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
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Refresh assets & status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
