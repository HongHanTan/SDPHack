import { pickScaleStep } from './scaleBar';

/** Plan-view scale bar and north arrow (legacy viewer port). */
export function ScaleBar({ metresPerPixel }: { metresPerPixel: number }) {
  const { metres, px } = pickScaleStep(metresPerPixel);
  return (
    <div className="absolute top-32 right-4 z-10 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/95 border border-slate-200 shadow-md text-[11px] text-slate-700 pointer-events-none">
      <span className="font-bold">N ↑</span>
      <div className="flex flex-col items-start">
        <div style={{ width: `${px}px` }} className="h-1.5 border-x-2 border-b-2 border-slate-800" />
        <span className="font-mono">{metres} m</span>
      </div>
    </div>
  );
}
