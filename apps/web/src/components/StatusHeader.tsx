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
  Cpu,
} from 'lucide-react';
import { DataMode } from '../api/client';
import { HealthResponse, AppMode } from '../types';

interface StatusHeaderProps {
  mode: DataMode;
  onToggleMode: (newMode: DataMode) => void;
  appMode: AppMode;
  onChangeAppMode: (mode: AppMode) => void;
  onOpenInterventions: () => void;
  onSelectTab?: (tab: 'dashboard' | 'map' | 'assets' | 'analytics' | 'reports') => void;
  onSearch?: (query: string) => void;
  health: HealthResponse | null;
  loading: boolean;
  onRefresh: () => void;
  apiError: string | null;
  /** Engine mode only: opens the site import panel. The button is hidden when absent. */
  onOpenSiteImport?: () => void;
  /** Engine mode only: shown while site files are being watched. */
  siteWatch?: { count: number; updatedAt: Date | null; onStop: () => void };
}

export const StatusHeader: React.FC<StatusHeaderProps> = ({
  mode,
  onToggleMode,
  appMode,
  onChangeAppMode,
  onOpenInterventions,
  onSelectTab,
  onSearch,
  health,
  loading,
  onRefresh,
  apiError,
  onOpenSiteImport,
  siteWatch,
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'assets' | 'analytics' | 'reports'>('dashboard');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="absolute top-0 left-0 right-0 z-30 flex flex-col pointer-events-none">
      {/* Real API Error Alert (Minimalistic banner) */}
      {(mode === 'api' || mode === 'engine') && apiError && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-6 py-1.5 flex items-center justify-between backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="font-semibold text-rose-900">{mode === 'engine' ? 'Engine Error:' : 'API Error:'}</span>
            <span className="text-rose-700 truncate max-w-xl">{apiError}</span>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs bg-rose-100 hover:bg-rose-200 text-rose-800 px-2.5 py-0.5 rounded-lg border border-rose-300 transition cursor-pointer flex items-center gap-1 font-medium"
          >
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Main Brand Top Navigation Bar (Sime Darby Property Theme - Light Mode) */}
      <div className="flex items-center justify-between px-6 h-15 backdrop-blur-xl bg-white/95 border-b border-slate-200/90 shadow-sm pointer-events-auto">
        {/* Left: Sime Darby Property Wave Crest & Title */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            {/* Sime Darby stylized triple-wave brand logo */}
            <div className="flex flex-col gap-1 items-center justify-center p-1">
              <svg
                className="w-7 h-6"
                viewBox="0 0 32 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 6c4-4 8-4 12 0s8 4 12 0 4-2 4-2" stroke="#dc2626" />
                <path d="M2 12c4-4 8-4 12 0s8 4 12 0 4-2 4-2" stroke="#b91c1c" />
                <path d="M2 18c4-4 8-4 12 0s8 4 12 0 4-2 4-2" stroke="#991b1b" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-slate-900 font-extrabold tracking-tight text-base">Township</span>
              <span className="text-red-600 font-black tracking-tight text-base">FloodOps</span>
            </div>
          </div>

          {/* Navigation Pill Tabs */}
          <nav className="flex items-center gap-1 text-xs">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                onSelectTab?.('dashboard');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('map');
                onSelectTab?.('map');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('assets');
                onSelectTab?.('assets');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'assets'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Assets</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('analytics');
                onSelectTab?.('analytics');
                onOpenInterventions();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'analytics'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('reports');
                onSelectTab?.('reports');
                onOpenInterventions();
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                activeTab === 'reports'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Reports</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer ${
                isSettingsOpen
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Right: Search Bar, Notifications, User Profile */}
        <div className="flex items-center gap-3.5">
          {/* Search Bar matching mockup */}
          <div className="relative w-64 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search location, asset or address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                onSearch?.(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSearch?.(searchQuery);
                }
              }}
              className="w-full bg-slate-100/80 hover:bg-slate-100 focus:bg-white text-xs text-slate-800 placeholder-slate-400 pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-red-500 focus:ring-2 focus:ring-red-500/10 focus:outline-none transition shadow-inner"
            />
          </div>

          {siteWatch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
              <span>
                👁 Watching {siteWatch.count} files ·{' '}
                {siteWatch.updatedAt
                  ? 'updated ' + siteWatch.updatedAt.toLocaleTimeString('en-GB', { hour12: false })
                  : 'no changes yet'}
              </span>
              <button
                onClick={siteWatch.onStop}
                title="Stop watching"
                className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
              >
                ✕
              </button>
            </span>
          )}

          {onOpenSiteImport && (
            <button
              onClick={onOpenSiteImport}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-medium transition cursor-pointer"
            >
              📂 Import site
            </button>
          )}

          {/* Notification Bell with Badge */}
          <button
            className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
            title="Notifications (3 active alerts)"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-[10px] font-bold text-white flex items-center justify-center border-2 border-white">
              3
            </span>
          </button>

          {/* User Profile Badge (John Doe / Township Admin) */}
          <div className="flex items-center gap-2.5 pl-1 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-600 to-amber-700 text-white font-bold text-xs flex items-center justify-center shadow-sm border border-red-500/30">
              JD
            </div>
            <div className="hidden lg:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight">John Doe</span>
              <span className="text-[10px] text-slate-500 leading-tight">Township Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Discrete Settings Popover (When Settings tab is clicked) */}
      {isSettingsOpen && (
        <div className="absolute top-16 left-96 z-40 w-76 bg-white/98 backdrop-blur-xl border border-slate-200 rounded-2xl p-4 shadow-2xl space-y-3 text-xs text-slate-700 pointer-events-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-red-600" /> System Settings
            </span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Engine health & Refresh */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-slate-700 font-medium">
                {health?.swmm ? `${health.swmm.engine} ${health.swmm.engine_version}` : 'SWMM 5.2.4'}
              </span>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Refresh engine state"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Data Mode Switcher */}
          <div>
            <label className="text-slate-500 text-[11px] block mb-1 font-medium">Data Source Mode</label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => onToggleMode('engine')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'engine'
                    ? 'bg-emerald-600 text-white font-medium shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu className="w-3 h-3" /> Engine
              </button>
              <button
                onClick={() => onToggleMode('mock')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'mock'
                    ? 'bg-amber-600 text-white font-medium shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-3 h-3" /> Mock Fixtures
              </button>
              <button
                onClick={() => onToggleMode('api')}
                className={`py-1 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'api'
                    ? 'bg-red-600 text-white font-medium shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Server className="w-3 h-3" /> Live FastAPI
              </button>
            </div>
          </div>

          {/* Workflow Mode Switcher */}
          <div>
            <label className="text-slate-500 text-[11px] block mb-1 font-medium">Workflow Phase</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px]">
              <button
                onClick={() => onChangeAppMode('idle')}
                className={`py-1 rounded-lg transition cursor-pointer text-center font-medium ${
                  appMode === 'idle'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Idle (Patrol)
              </button>
              <button
                onClick={() => onChangeAppMode('diagnose')}
                className={`py-1 rounded-lg transition cursor-pointer text-center font-medium ${
                  appMode === 'diagnose'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diagnose
              </button>
              <button
                onClick={() => onChangeAppMode('anticipate')}
                className={`py-1 rounded-lg transition cursor-pointer text-center font-medium ${
                  appMode === 'anticipate'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Anticipate
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
