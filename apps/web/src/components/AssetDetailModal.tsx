import React from 'react';
import { X, Layers, AlertCircle, FileText, Wrench } from 'lucide-react';
import { AssetConduit, AssetInlet, AssetNode, InspectionRecord } from '../types';

interface AssetDetailModalProps {
  selectedAsset: {
    type: 'node' | 'inlet' | 'conduit';
    id: string;
    data: unknown;
  } | null;
  onClose: () => void;
  inspections: InspectionRecord[];
  onOpenInspect: (assetId: string) => void;
}

export const AssetDetailModal: React.FC<AssetDetailModalProps> = ({
  selectedAsset,
  onClose,
  inspections,
  onOpenInspect,
}) => {
  if (!selectedAsset) return null;

  const { type, id, data } = selectedAsset;

  const relevantInspections = inspections.filter((i) => i.asset_id === id);

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
              Asset Type: {type}
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
                    <span>Role / Type:</span>
                    <span className="text-slate-200 capitalize">{node.type}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Invert Elevation:</span>
                    <span className="text-slate-200">{node.invert_elevation_m.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Max Rim Depth:</span>
                    <span className="text-slate-200">{node.max_depth_m.toFixed(2)} m</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Surface Elevation:</span>
                    <span className="text-slate-200">
                      {node.surface_elevation_m ? `${node.surface_elevation_m.toFixed(2)} m` : 'N/A'}
                    </span>
                  </div>
                  <div className="pt-1 text-slate-400 font-sans">
                    {node.description}
                  </div>
                </>
              );
            })()}
          </>
        )}

        {type === 'conduit' && (
          <>
            {(() => {
              const conduit = data as AssetConduit;
              return (
                <>
                  <div className="flex justify-between text-slate-400">
                    <span>Connecting:</span>
                    <span className="text-slate-200">{conduit.from_node} → {conduit.to_node}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Length:</span>
                    <span className="text-slate-200">{conduit.length_m} m</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Cross-Section:</span>
                    <span className="text-slate-200">
                      {conduit.shape === 'circular'
                        ? `Ø ${(conduit.diameter_m! * 1000).toFixed(0)} mm`
                        : `${conduit.width_m}m × ${conduit.height_m}m Box`}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Roughness (n):</span>
                    <span className="text-slate-200">{conduit.roughness}</span>
                  </div>
                  <div className="pt-1 text-slate-400 font-sans">
                    {conduit.description}
                  </div>
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
                    <span>Inlet Structure:</span>
                    <span className="text-slate-200 capitalize">{inlet.inlet_type}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Associated Node:</span>
                    <span className="text-slate-200">{inlet.node_id}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Dimensions:</span>
                    <span className="text-slate-200">
                      {inlet.dimensions_m ? `${inlet.dimensions_m.length}m × ${inlet.dimensions_m.width}m` : 'Standard'}
                    </span>
                  </div>
                  <div className="pt-1 text-slate-400 font-sans">
                    {inlet.description}
                  </div>
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
            <FileText className="w-3.5 h-3.5 text-cyan-400" /> 现场巡检记录 (Inspections)
          </span>
          {type === 'inlet' && (
            <button
              onClick={() => onOpenInspect(id)}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
            >
              <Wrench className="w-3 h-3" /> 新建记录
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
                    注：格栅覆盖率 ≠ 水力收水损失率，需在仿真中独立设定 restriction 假设
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
