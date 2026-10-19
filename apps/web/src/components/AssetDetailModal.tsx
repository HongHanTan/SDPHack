import React from 'react';
import { X, Layers, AlertCircle, FileText, Wrench } from 'lucide-react';
import { AssetConduit, AssetInlet, AssetNode, InspectionRecord, SimulationFrame } from '../types';

interface AssetDetailModalProps {
  selectedAsset: {
    type: 'node' | 'inlet' | 'conduit';
    id: string;
    data: unknown;
  } | null;
  onClose: () => void;
  inspections: InspectionRecord[];
  onOpenInspect: (assetId: string) => void;
  currentFrame?: SimulationFrame | null;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  selectedAsset,
  onClose,
  inspections,
  onOpenInspect,
  currentFrame,
}) => {
  if (!selectedAsset) return null;

  const { type, id, data } = selectedAsset;

  const relevantInspections = inspections.filter((i) => i.asset_id === id);

  // Current frame state lookup
  const nodeState = currentFrame?.node_states?.find((n) => n.node_id === id);
  const pipeState = currentFrame?.pipe_states?.find((p) => p.conduit_id === id);
  const inletState = currentFrame?.inlet_states?.find((i) => i.inlet_id === id);

  return (
    <div className="absolute top-20 right-5 z-20 w-96 bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-xl shadow-2xl p-4 text-slate-200 pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">{id}</h3>
            <span className="text-xs uppercase tracking-wider text-slate-400">
              资产类型: {type}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Asset Specific Details */}
      <div className="py-3 text-xs space-y-2 border-b border-slate-800 font-mono">
        {type === 'node' && (
          <>
            {(() => {
              const node = data as AssetNode;
              return (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>节点类型:</span>
                    <span className="text-slate-200 capitalize">{node.node_type || node.type}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>管底高程 (Invert):</span>
                    <span className="text-slate-200">{node.invert_elevation_m.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>地表盖口高程 (Ground):</span>
                    <span className="text-slate-200">{node.ground_elevation_m.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>检查井落深 (Depth):</span>
                    <span className="text-slate-200">{node.max_depth_m.toFixed(2)} m</span>
                  </div>
                  {nodeState && (
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1 mt-2">
                      <div className="text-[11px] text-slate-400 font-sans font-semibold">
                        当前时间点水动力学状态:
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">水深 (Depth):</span>
                        <span className="text-cyan-400 font-bold">{nodeState.depth_m.toFixed(3)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">溢流率 (Flooding Rate):</span>
                        <span className={nodeState.flooding_rate_m3s > 0 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                          {nodeState.flooding_rate_m3s.toFixed(4)} m³/s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">水力状态:</span>
                        <span className={
                          nodeState.status === 'flooding' ? 'text-rose-400 font-bold' :
                          nodeState.status === 'surcharged' ? 'text-amber-400 font-bold' : 'text-emerald-400'
                        }>
                          {nodeState.status}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {type === 'conduit' && (
          <>
            {(() => {
              const conduit = data as AssetConduit;
              const fromId = conduit.from_node_id || conduit.from_node;
              const toId = conduit.to_node_id || conduit.to_node;
              return (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>起点 → 终点:</span>
                    <span className="text-slate-200">{fromId} → {toId}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>管段长度:</span>
                    <span className="text-slate-200">{conduit.length_m.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>管径 (Diameter):</span>
                    <span className="text-slate-200">Ø {(conduit.diameter_m * 1000).toFixed(0)} mm</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>粗糙系数 (Manning n):</span>
                    <span className="text-slate-200">{conduit.manning_n}</span>
                  </div>
                  {pipeState && (
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1 mt-2">
                      <div className="text-[11px] text-slate-400 font-sans font-semibold">
                        当前时间点水动力学状态:
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">流量 (Flow):</span>
                        <span className="text-cyan-400 font-bold">{pipeState.flow_m3s.toFixed(4)} m³/s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">管内水深 (Depth):</span>
                        <span className="text-slate-200">{pipeState.depth_m.toFixed(3)} m</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">充盈状态:</span>
                        <span className={
                          pipeState.status === 'surcharged' ? 'text-rose-400 font-bold' :
                          pipeState.status === 'near_capacity' ? 'text-amber-400 font-bold' : 'text-emerald-400'
                        }>
                          {pipeState.status}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}

        {type === 'inlet' && (
          <>
            {(() => {
              const inlet = data as AssetInlet;
              return (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>关联管网节点:</span>
                    <span className="text-slate-200">{inlet.node_id}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>格栅有效面积:</span>
                    <span className="text-slate-200">{inlet.grate_area_m2.toFixed(2)} m²</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>地表高程:</span>
                    <span className="text-slate-200">{inlet.position_m.z.toFixed(2)} m</span>
                  </div>
                  {inletState && (
                    <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1 mt-2">
                      <div className="text-[11px] text-slate-400 font-sans font-semibold">
                        模拟水力折减假设:
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">折减率 (Loss Fraction):</span>
                        <span className="text-amber-400 font-bold">
                          {(inletState.hydraulic_inlet_clogging_fraction * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-400">假设状态:</span>
                        <span className="text-slate-400">{inletState.parameter_status}</span>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* Field Inspection History */}
      <div className="pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-cyan-400" /> 现场巡检与证据 (Inspection)
          </span>
          {type === 'inlet' && (
            <button
              onClick={() => onOpenInspect(id)}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3 h-3" /> 新建巡检
            </button>
          )}
        </div>

        {relevantInspections.length === 0 ? (
          <div className="text-xs text-slate-500 py-2 italic text-center">
            暂无针对此资产的巡检记录
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {relevantInspections.map((insp) => (
              <div
                key={insp.inspection_id}
                className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs space-y-1.5"
              >
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>{new Date(insp.timestamp).toLocaleDateString()}</span>
                  <span className="text-slate-300">{insp.inspector}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">格栅可见遮盖率:</span>
                  <span className="text-amber-400 font-semibold">
                    {(insp.visible_grate_coverage_fraction * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">堵塞物类别:</span>
                  <span className="text-slate-200 capitalize">{insp.debris_category}</span>
                </div>
                <p className="text-slate-300 text-[11px] font-sans leading-relaxed pt-1 border-t border-slate-700/40">
                  {insp.notes}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500 pt-0.5">
                  <AlertCircle className="w-3 h-3 text-cyan-400/70" />
                  <span>
                    注：现场格栅可见覆盖率独立存储，非水力折减率的直接换算。
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
