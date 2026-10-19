import React, { useState, useRef } from 'react';
import { X, Camera, AlertCircle, Check, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { InspectionRecord } from '../types';

interface InspectionModalProps {
  assetId: string;
  onClose: () => void;
  onSubmit: (record: Partial<InspectionRecord>, file?: File) => Promise<void>;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size must not exceed 10 MiB (Per T3 Contract Limit)');
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setUploadError(null);
    try {
      await onSubmit(
        {
          asset_id: assetId,
          inspector,
          method,
          source_type: 'synthetic',
          visible_grate_coverage_fraction: coveragePct / 100,
          debris_category: debrisCategory,
          notes,
          source_reference: 'Township FloodOps Virtual Demonstration',
        },
        selectedFile || undefined
      );
      onClose();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm pointer-events-auto p-4">
      <div className="w-full max-w-lg bg-[#181111] border border-[#3e2222] rounded-2xl shadow-2xl p-6 text-stone-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[#301c1c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-100">
                New Field Inspection Record
              </h2>
              <span className="text-xs text-stone-400 font-mono">Target Asset: {assetId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {uploadError && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-stone-400 block mb-1">Inspector</label>
              <input
                type="text"
                value={inspector}
                onChange={(e) => setInspector(e.target.value)}
                className="w-full bg-[#100b0b] border border-[#381f1f] rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-red-500"
                required
              />
            </div>
            <div>
              <label className="text-stone-400 block mb-1">Inspection Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full bg-[#100b0b] border border-[#381f1f] rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-red-500 cursor-pointer"
              >
                <option value="visual">Visual Inspection</option>
                <option value="cctv">In-Pipe CCTV Crawler</option>
                <option value="drone">Aerial Drone Survey</option>
                <option value="sensor">Telemetry Sensor</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-stone-400">
                Visible Grate Surface Coverage
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
              className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
          </div>

          <div>
            <label className="text-stone-400 block mb-1">Primary Debris Category</label>
            <select
              value={debrisCategory}
              onChange={(e) => setDebrisCategory(e.target.value as any)}
              className="w-full bg-[#100b0b] border border-[#381f1f] rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-red-500 cursor-pointer"
            >
              <option value="leaf_litter">Leaf Litter & Twigs</option>
              <option value="sediment">Roadside Sediment & Silt</option>
              <option value="plastic">Plastic & Trash</option>
              <option value="mixed">Mixed Organic & Refuse</option>
              <option value="none">No Visible Debris</option>
            </select>
          </div>

          <div>
            <label className="text-stone-400 block mb-1">Field Observation & Root Cause Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#100b0b] border border-[#381f1f] rounded-xl px-3 py-2 text-stone-200 focus:outline-none focus:border-red-500 leading-relaxed font-sans"
              required
            />
          </div>

          {/* Real Photo Attachment with Multipart File Upload Support (T3 Contract) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-stone-400">Photo Evidence Attachment</label>
              <span className="text-[10px] text-stone-500 font-mono">PNG / JPEG / WebP ≤ 10MB</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[#100b0b] border border-red-500/40">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-16 h-14 rounded-lg object-cover border border-stone-700 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-14 rounded-lg bg-stone-800 border border-stone-700 flex items-center justify-center text-stone-400 shrink-0">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <span className="text-stone-200 font-medium block truncate text-xs">
                    {selectedFile.name}
                  </span>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {(selectedFile.size / 1024).toFixed(1)} KB · multipart/form-data
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition cursor-pointer"
                  title="Remove file"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#100b0b] border border-dashed border-[#3e2222] hover:border-red-500/60 cursor-pointer transition text-left group"
              >
                <div className="w-12 h-12 rounded-lg bg-[#1f1515] border border-stone-800 flex items-center justify-center text-red-400 group-hover:scale-105 transition">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="flex-1 text-[11px] text-stone-400">
                  <span className="text-stone-200 font-medium block">
                    Click to select field inspection site photo
                  </span>
                  <span>Automatically timestamped and uploaded to /api/inspections/{'{id}'}/media</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <div>
              <strong>Engineering Boundary:</strong> Visual surface grate coverage serves as archival asset field evidence. In the SWMM hydraulic engine, hydraulic intake throttling is modeled as an independent Hydraulic Clogging Hypothesis configured in scenario controls, rather than an uncalibrated mechanical conversion.
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-red-900/30"
            >
              {submitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Inspection & Evidence</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
