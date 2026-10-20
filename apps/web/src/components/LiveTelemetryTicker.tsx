import React, { useState, useEffect } from 'react';
import { Radio, ChevronDown, ChevronUp, Wifi, ArrowRight } from 'lucide-react';
import { FIELD_INSPECTORS } from './FieldInspectorsManager';

interface LiveTelemetryTickerProps {
  onSelectInspectorAsset: (assetId: string) => void;
  isIdleMode: boolean;
  isAssetSelected?: boolean;
}

interface TelemetryPacket {
  id: string;
  time: string;
  unit: string;
  inspectorName: string;
  assetId: string;
  message: string;
  status: 'normal' | 'warning' | 'info';
}

const INITIAL_PACKETS: TelemetryPacket[] = [
  {
    id: 'pkt-1',
    time: '22:48:15',
    unit: 'Unit B',
    inspectorName: 'Siti',
    assetId: 'PIPE-P04',
    message: 'CCTV crawler advanced 18.2m; 70mm silt bed detected; flow rate 0.42 m³/s normal.',
    status: 'normal',
  },
  {
    id: 'pkt-2',
    time: '22:48:18',
    unit: 'Unit A',
    inspectorName: 'Azman',
    assetId: 'INLET-D07',
    message: 'Visual grate coverage 65%, inlet restriction factor 0.40, dispatch desilt crew advised.',
    status: 'warning',
  },
  {
    id: 'pkt-3',
    time: '22:48:21',
    unit: 'Unit C',
    inspectorName: 'Muthu',
    assetId: 'NODE-J06',
    message: 'Retention pond intake hydrology sample: turbidity 12 NTU, sediment trap free depth 1.2m.',
    status: 'normal',
  },
  {
    id: 'pkt-4',
    time: '22:48:24',
    unit: 'Unit D',
    inspectorName: 'Kevin',
    assetId: 'NODE-OUT01',
    message: 'Open canal outfall sluice: receiving canal stage 1.18m, gravity free-flow smooth.',
    status: 'normal',
  },
];

export const LiveTelemetryTicker: React.FC<LiveTelemetryTickerProps> = ({
  onSelectInspectorAsset,
  isIdleMode,
  isAssetSelected = false,
}) => {
  const [packets, setPackets] = useState<TelemetryPacket[]>(INITIAL_PACKETS);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pulseCount, setPulseCount] = useState(148);

  // Auto-collapse when asset is selected to guarantee zero overlap
  const effectivelyCollapsed = isAssetSelected ? true : isCollapsed;

  // Simulate periodic incoming telemetry data packets every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseCount((prev) => prev + 1);
      const inspector =
        FIELD_INSPECTORS[Math.floor(Math.random() * FIELD_INSPECTORS.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      const messages: Record<string, string[]> = {
        'INLET-D07': [
          'Laser measurement complete: grate clear aperture ratio 35%, slight backwater surge.',
          'RTK GPS calibrated: lowland surface flood warning sensor online.',
          'Acoustic throat scan: no heavy concrete debris lodging detected.',
        ],
        'PIPE-P04': [
          'CCTV crawler streaming 1080p frame packet (64KB), rubber gasket seal intact.',
          'Micro-sonar cross section: pipe bottom silt bed steady at 70mm.',
          'Hydrodynamic velocity meter: 0.38 m/s, capacity utilization 42%.',
        ],
        'NODE-J06': [
          'Debris boom tension sensors normal, leaf litter layer thickness 8cm.',
          'Retention pond inlet DO: 6.8 mg/L, water quality compliant.',
          'Inlet sluice gate 100% open, gravity inflow confirmed.',
        ],
        'NODE-OUT01': [
          'Downstream East Drain canal velocity: 0.92 m/s, embankment stable.',
          'Radar stage sensor upload: hydraulic head drop across outfall is 0.45m.',
          'Flap gate swing sensors normal, zero backflow intrusion.',
        ],
      };

      const pool = messages[inspector.assignedAssetId] || [
        'Field telemetry packet validated (CRC32 OK)',
      ];
      const selectedMsg = pool[Math.floor(Math.random() * pool.length)];

      const newPacket: TelemetryPacket = {
        id: `pkt-${Date.now()}`,
        time: timeStr,
        unit: inspector.unit,
        inspectorName: inspector.name.split(' ')[1],
        assetId: inspector.assignedAssetId,
        message: selectedMsg,
        status: inspector.assignedAssetId === 'INLET-D07' ? 'warning' : 'normal',
      };

      setPackets((prev) => [newPacket, ...prev.slice(0, 7)]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // When an asset is selected, render as a sleek floating button at bottom right that doesn't overlap
  if (effectivelyCollapsed) {
    return (
      <div className="absolute bottom-6 right-6 z-20 pointer-events-auto select-none animate-in fade-in">
        <button
          onClick={() => {
            if (isAssetSelected) {
              onSelectInspectorAsset('INLET-D07');
            } else {
              setIsCollapsed(false);
            }
          }}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-xl border border-slate-200 text-slate-800 hover:bg-slate-50 shadow-md transition cursor-pointer text-xs font-semibold"
          title="Open Field Patrol Feed"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
          </span>
          <Radio className="w-3.5 h-3.5 text-red-600" />
          <span>Field Feed (4 Online)</span>
          <span className="text-[10px] font-mono text-slate-400">#{pulseCount}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-6 right-6 z-20 w-88 md:w-96 pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden text-xs">
        {/* Header */}
        <div
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center justify-between px-4 py-2.5 bg-slate-50/90 border-b border-slate-200 cursor-pointer hover:bg-slate-100 transition"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
            </span>
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-red-600" />
              <span className="font-bold text-slate-900 text-xs">
                Live Field Telemetry Feed
              </span>
            </div>
            {isIdleMode && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono font-semibold border border-emerald-200">
                Idle Patrol
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-[11px] font-mono">
            <span>#{pulseCount} pkts</span>
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>

        {/* Content Feed */}
        {!isCollapsed && (
          <div className="p-3 space-y-2 max-h-56 overflow-y-auto">
            <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pb-1 border-b border-slate-100">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-emerald-600" /> 4 Field Terminals Online (5G NB-IoT)
              </span>
              <span>Click row to locate</span>
            </div>

            <div className="space-y-1.5">
              {packets.map((pkt) => (
                <div
                  key={pkt.id}
                  onClick={() => onSelectInspectorAsset(pkt.assetId)}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200 hover:border-red-400 transition cursor-pointer text-left group"
                >
                  <div className="flex items-center justify-between mb-0.5 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          pkt.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />
                      <span className="font-bold text-slate-800">
                        {pkt.unit} ({pkt.inspectorName})
                      </span>
                      <span className="text-red-700 bg-red-100 px-1.5 py-0.2 rounded text-[9px] font-bold">
                        {pkt.assetId}
                      </span>
                    </div>
                    <span className="text-slate-400">{pkt.time}</span>
                  </div>

                  <p className="text-[11px] text-slate-600 font-sans leading-tight line-clamp-2">
                    {pkt.message}
                  </p>

                  <div className="flex justify-end pt-1 opacity-0 group-hover:opacity-100 transition text-[10px] text-red-600 font-mono flex items-center gap-1 font-semibold">
                    <span>Locate Asset</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
