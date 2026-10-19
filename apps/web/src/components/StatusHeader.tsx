import React, { useState } from 'react';
import {
  Search,
  Bell,
  Settings,
  LayoutDashboard,
  Map,
  Layers,
  BarChart3,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Database,
  Server,
  RefreshCw,
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'assets' | 'analytics' | 'reports'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex flex-col pointer-events-none">
      {/* Real API Error Alert (Minimalistic banner) */}
      {mode === 'api' && apiError && (
        <div className="bg-rose-950/90 border-b border-rose-500/50 text-rose-200 text-xs px-6 py-1.5 flex items-center justify-between backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="font-semibold">API Error:</span>
            <span className="text-rose-300/80 truncate max-w-xl">{apiError}</span>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 px-2 py-0.5 rounded border border-rose-400/50 transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Main Brand Top Navigation Bar (Sime Darby Property Theme) */}
      <div className="flex items-center justify-between px-6 h-15 backdrop-blur-xl bg-[#140e0e]/92 border-b border-[#3b1818]/60 shadow-2xl pointer-events-auto">
        {/* Left: Sime Darby Property Wave Crest & Title */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            {/* Sime Darby stylized triple-wave brand logo */}
            <div className="flex flex-col gap-1 items-center justify-center p-1">
              <svg
                className="w-7 h-6 text-red-500"
                viewBox="0 0 32 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 6c4-4 8-4 12 0s8 4 12 0 4-2 4-2" stroke="#e11d48" />
                <path d="M2 12c4-4 8-4 12 0s8 4 12 0 4-2 4-2" stroke="#dc2626" />
                <path d="M2 18c4-4 8-4 12 0s8 4 12 0 4-2 4-2" stroke="#c2410c" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white font-bold tracking-tight text-base">Township</span>
              <span className="text-red-500 font-extrabold tracking-tight text-base">FloodOps</span>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <nav className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-700 text-white shadow-lg shadow-red-900/30'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('map')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>

            <button
              onClick={() => setActiveTab('assets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'assets'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Assets</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('analytics');
                onOpenInterventions();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('reports');
                onOpenInterventions();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg shadow-red-900/30'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reports</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                isSettingsOpen
                  ? 'bg-stone-800 text-white'
                  : 'text-stone-300 hover:text-white hover:bg-stone-900/60'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Right: Search Bar, Notifications, User Profile */}
        <div className="flex items-center gap-4">
          {/* Search Bar matching mockup */}
          <div className="relative w-64 md:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search location, asset or address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#201717]/80 hover:bg-[#281a1a]/80 focus:bg-[#281a1a] text-xs text-stone-200 placeholder-stone-400 pl-9 pr-4 py-2 rounded-xl border border-[#3e2222]/80 focus:border-red-500/60 focus:outline-none transition"
            />
          </div>

          {/* Notification Bell with Badge */}
          <button
            className="relative p-2 rounded-xl bg-[#201717]/80 hover:bg-[#281a1a] text-stone-300 hover:text-white border border-[#3e2222]/80 transition cursor-pointer"
            title="Notifications (3 active alerts)"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center border border-[#140e0e]">
              3
            </span>
          </button>

          {/* User Profile Badge (John Doe / Township Admin) */}
          <div className="flex items-center gap-2.5 pl-1 border-l border-stone-800/80">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-amber-800 text-white font-bold text-xs flex items-center justify-center shadow-md border border-red-500/40">
              JD
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-stone-100 leading-tight">John Doe</span>
              <span className="text-[10px] text-stone-400 leading-tight">Township Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Discrete Settings Popover (When Settings tab is clicked) */}
      {isSettingsOpen && (
        <div className="absolute top-16 left-96 z-40 w-72 bg-[#1c1414]/95 backdrop-blur-xl border border-[#442222] rounded-2xl p-4 shadow-2xl space-y-3 text-xs text-stone-200 pointer-events-auto">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800">
            <span className="font-semibold text-stone-100 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-red-500" /> System Settings
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-stone-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Engine health & Refresh */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950/60 border border-stone-800/80">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-stone-300">
                {health?.swmm ? `${health.swmm.engine} ${health.swmm.engine_version}` : 'SWMM 5.2.4'}
              </span>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 rounded text-stone-400 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Refresh engine state"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Data Mode Switcher */}
          <div>
            <label className="text-stone-400 text-[11px] block mb-1 font-medium">Data Source Mode</label>
            <div className="grid grid-cols-2 gap-1.5 bg-stone-950/60 p-1 rounded-xl border border-stone-800/80">
              <button
                onClick={() => onToggleMode('mock')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'mock'
                    ? 'bg-amber-600 text-white font-medium shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Database className="w-3 h-3" /> Mock Fixtures
              </button>
              <button
                onClick={() => onToggleMode('api')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'api'
                    ? 'bg-red-600 text-white font-medium shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Server className="w-3 h-3" /> Live FastAPI
              </button>
            </div>
          </div>

          {/* Workflow Mode Switcher */}
          <div>
            <label className="text-stone-400 text-[11px] block mb-1 font-medium">Workflow Phase</label>
            <div className="grid grid-cols-2 gap-1.5 bg-stone-950/60 p-1 rounded-xl border border-stone-800/80">
              <button
                onClick={() => onChangeAppMode('diagnose')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer ${
                  appMode === 'diagnose'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 font-medium'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Diagnose (现状诊断)
              </button>
              <button
                onClick={() => onChangeAppMode('anticipate')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer ${
                  appMode === 'anticipate'
                    ? 'bg-red-600/30 text-red-300 border border-red-500/40 font-medium'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Anticipate (暴雨推演)
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
