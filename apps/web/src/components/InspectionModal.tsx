import React, { useState } from 'react';
import { X, Camera, AlertCircle, Check } from 'lucide-react';
import { InspectionRecord } from '../types';

interface InspectionModalProps {
  assetId: string;
  onClose: () => void;
  onSubmit: (record: Partial<InspectionRecord>) => Promise<void>;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  assetId,
  onClose,
  onSubmit,
}) => {
  const [inspector, setInspector] = useState('Inspector Azman (Field Unit A)');
  const [method, setMethod] = useState<'visual' | 'cctv' | 'drone' | 'sensor'>('visual');
  const [coveragePct, setCoveragePct] = useState(65);
  const [debrisCategory, setDebrisCategory] = useState<
    'leaf_litter' | 'sediment' | 'plastic' | 'mixed' | 'none'
  >('leaf_litter');
  const [notes, setNotes] = useState(
    'Dense accumulation of fallen dry leaves and roadside clay silt over grate opening. Curbside throat clearance compromised.'
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        asset_id: assetId,
        inspector,
        method,
        source_type: 'observed',
        visible_grate_coverage_fraction: coveragePct / 100,
        debris_category: debrisCategory,
        notes,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">
                新建现场巡检记录 (Field Inspection)
              </h2>
              <span className="text-xs text-slate-400 font-mono">目标资产: {assetId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">巡检人员 (Inspector)</label>
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">巡检方法 (Method)</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="visual">现场目测 (Visual)</option>
                <option value="cctv">管道闭路电视 (CCTV)</option>
                <option value="drone">无人机巡航 (Drone)</option>
                <option value="sensor">固定传感器 (Sensor)</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-slate-400">
                格栅表面可见杂物遮盖率 (Visible Grate Coverage)
              </label>
              <span className="text-amber-400 font-mono font-bold text-sm">{coveragePct}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={coveragePct}
              onChange={(e) => setCoveragePct(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">主要堵塞杂物类别 (Debris Category)</label>
            <select
              value={debrisCategory}
              onChange={(e) => setDebrisCategory(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="leaf_litter">落叶枯枝 (Leaf Litter)</option>
              <option value="sediment">道路泥沙淤积 (Road Sediment)</option>
              <option value="plastic">塑料垃圾 (Plastic Trash)</option>
              <option value="mixed">混合垃圾杂物 (Mixed Debris)</option>
              <option value="none">无可见杂物 (None)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">巡检描述与成因分析 (Notes)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
              required
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">现场照片证据附录 (Photo Evidence Attachment)</label>
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <div className="w-16 h-12 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-cyan-400 font-mono">
                [现场照片]
              </div>
              <div className="flex-1 text-[11px] text-slate-400">
                <span className="text-slate-200 font-medium block">
                  IMG_20261018_INLET_D07_THROAT.jpg
                </span>
                <span>包含高精度现场时间戳、经纬度与现场巡检员电子防伪水印</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <div>
              <strong>数据边界约定：</strong> 现场目测的格栅表面覆盖率仅作为资产证据保存；在 SWMM
              水力模型中，实际进水折减率属于水力折减假设（Hydraulic Clogging
              Hypothesis），由调度模块独立配置，绝不进行未经率定的强行换算。
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-cyan-600/20"
            >
              {submitting ? (
                <span>保存中...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>保存巡检记录</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
