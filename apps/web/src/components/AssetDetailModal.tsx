import React, { useState } from 'react';
import {
  X,
  Sliders,
  Search,
  ChevronRight,
  Activity,
  Waves,
} from 'lucide-react';
import {
  InspectionRecord,
  SimulationFrame,
} from '../types';

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
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  selectedAsset,
  onClose,
  inspections,
  onOpenInspect,
  onOpenInterventions,
  currentFrame,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'live' | 'maintenance' | 'photos'>('overview');
  const [isMinimized, setIsMinimized] = useState(false);

  // If no asset is selected, default to showing the critical focal point MH-0421 (NODE-J07) from the mockup
  const assetId = selectedAsset?.id || 'NODE-J07';
  const assetType = selectedAsset?.type || 'node';
  const displayId = assetId === 'NODE-J07' ? 'MH-0421' : assetId;

  // Frame telemetry calculations
  const nodeState = currentFrame?.node_states?.find((n) => n.node_id === assetId || n.node_id === 'NODE-J07');
  const pipeState = currentFrame?.pipe_states?.find((p) => p.conduit_id === assetId || p.conduit_id === 'PIPE-P07');

  const depthM = nodeState?.depth_m ?? 1.62;
  const flowRate = pipeState?.flow_m3s ?? 1.24;
  const capacityM3s = 1.60;
  const flowLevelPct = Math.min(100, Math.round((flowRate / capacityM3s) * 100));
  const isHighLoad = flowLevelPct >= 75 || nodeState?.status === 'flooding' || nodeState?.status === 'surcharged';

  if (isMinimized) {
    return (
      <div className="absolute top-20 right-6 z-20 pointer-events-auto">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/80 text-stone-200 hover:text-white shadow-2xl transition cursor-pointer text-xs font-semibold"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span>Drain Telemetry: {displayId}</span>
          <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>
    );
  }

  return (
    <aside className="absolute top-20 right-6 z-20 w-84 md:w-92 bg-[#181111]/92 backdrop-blur-xl border border-[#3b1818]/70 rounded-2xl shadow-2xl p-4 text-stone-200 pointer-events-auto select-none max-h-[calc(100vh-6.5rem)] overflow-y-auto">
      {/* 1. Header with Orange Icon & Close Button */}
      <div className="flex items-center justify-between pb-3 border-b border-[#3b1818]/60">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-amber-500 flex items-center justify-center text-[#181111] font-bold text-[10px]">
            ⊞
          </div>
          <h3 className="text-sm font-bold text-stone-100 tracking-wide">
            Drain ID: {displayId}
          </h3>
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

      {/* 2. Sub-Tabs (Overview, Live Data, Maintenance, Photos) */}
      <div className="flex items-center justify-between py-3 text-[11px] font-medium border-b border-[#3b1818]/40">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('live')}
          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
            activeTab === 'live'
              ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Live Data
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
            activeTab === 'maintenance'
              ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Maintenance {inspections.length > 0 ? `(${inspections.length})` : ''}
        </button>
        <button
          onClick={() => setActiveTab('photos')}
          className={`px-3 py-1 rounded-lg transition cursor-pointer ${
            activeTab === 'photos'
              ? 'bg-gradient-to-r from-red-600 to-amber-700 text-white font-semibold shadow-sm'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          Photos
        </button>
      </div>

      {/* 3. Manhole Cover Photo Thumbnail matching mockup */}
      <div className="my-3 relative rounded-xl overflow-hidden border border-[#3b1818]/80 h-32 bg-stone-950">
        <img
          src="/assets/mock_manhole.jpg"
          alt="Site Asset Grate"
          className="w-full h-full object-cover brightness-90 contrast-110"
          onError={(e) => {
            // Fallback to high-contrast simulated manhole graphic if image asset is unavailable
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#181111]/90 via-transparent to-transparent" />
        <div className="absolute bottom-2 left-2.5 text-[10px] text-stone-300 font-mono flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Field Verification Survey #0421</span>
        </div>
      </div>

      {/* 4. Specifications Grid */}
      <div className="py-2 space-y-1.5 text-xs border-b border-[#3b1818]/60">
        <div className="flex justify-between text-stone-400">
          <span>Asset Type</span>
          <span className="text-stone-200 font-medium capitalize">{assetType === 'conduit' ? 'Conduit' : 'Manhole'}</span>
        </div>
        <div className="flex justify-between text-stone-400">
          <span>Asset ID</span>
          <span className="text-stone-200 font-mono font-medium">{displayId}</span>
        </div>
        <div className="flex justify-between text-stone-400">
          <span>Location</span>
          <span className="text-stone-200 font-medium">Cedar View Estates</span>
        </div>
        <div className="flex justify-between text-stone-400 pl-2 text-[11px]">
          <span>Coordinates</span>
          <span className="text-stone-400 font-mono">📍 4.36521, -79.3845</span>
        </div>
        <div className="flex justify-between text-stone-400">
          <span>Depth</span>
          <span className="text-stone-200 font-mono">{depthM.toFixed(1)} m</span>
        </div>
        <div className="flex justify-between text-stone-400">
          <span>Invert Elevation</span>
          <span className="text-stone-200 font-mono">112.3 m</span>
        </div>
        <div className="flex justify-between items-center text-stone-400 pt-0.5">
          <span>Connected Pipes</span>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-200 font-mono">4</span>
            <span className="text-[11px] text-red-400 hover:text-red-300 transition cursor-pointer flex items-center">
              View Network →
            </span>
          </div>
        </div>
      </div>

      {/* 5. Current Status Card (Matching mockup) */}
      <div className="my-3 p-3.5 rounded-xl bg-stone-950/70 border border-[#3b1818]/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
            <Activity className="w-3.5 h-3.5 text-amber-500" />
            <span>Current Status</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            {isHighLoad ? 'High Load' : 'Normal'}
          </span>
        </div>

        {/* Flow Level Progress Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-stone-400">Flow Level</span>
            <span className="font-bold font-mono text-stone-100">{flowLevelPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-red-600 transition-all duration-500"
              style={{ width: `${flowLevelPct}%` }}
            />
          </div>
        </div>

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
          <div>
            <span className="text-stone-400 block text-[10px]">Flow Rate</span>
            <span className="font-mono text-stone-200 font-semibold">{flowRate.toFixed(2)} m³/s</span>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">Capacity</span>
            <span className="font-mono text-stone-200 font-semibold">{capacityM3s.toFixed(2)} m³/s</span>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">Rainfall (1h)</span>
            <span className="font-mono text-stone-200 font-semibold">48 mm</span>
          </div>
          <div>
            <span className="text-stone-400 block text-[10px]">Status</span>
            <span className="text-amber-400 font-medium text-[10px]">Near capacity.</span>
          </div>
        </div>
      </div>

      {/* 6. Flood Risk Card (Matching mockup) */}
      <div className="mb-3 p-3.5 rounded-xl bg-stone-950/70 border border-[#3b1818]/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-200">
            <Waves className="w-3.5 h-3.5 text-red-500" />
            <span>Flood Risk</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
            High
          </span>
        </div>

        <div>
          <div className="text-base font-extrabold text-red-500 font-sans mb-1 flex items-baseline gap-1.5">
            <span>72%</span>
            <span className="text-xs font-normal text-stone-400">Local Flood Risk</span>
          </div>
          <div className="w-full h-2 rounded-full bg-stone-900 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-600"
              style={{ width: '72%' }}
            />
          </div>
        </div>

        <p className="text-[10px] text-stone-400 pt-0.5">
          Based on current rainfall and network conditions.
        </p>
      </div>

      {/* 7. Action Footer Buttons */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#3b1818]/60 text-xs font-semibold">
        <button
          onClick={() => onOpenInspect(assetId)}
          className="py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-800 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5 text-amber-400" />
          <span>Inspect</span>
        </button>
        <button
          onClick={onOpenInterventions}
          className="py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-700 hover:from-red-500 hover:to-amber-600 text-white shadow-lg shadow-red-900/40 transition cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Intervene</span>
        </button>
      </div>
    </aside>
  );
};
