import { depthCm, type StoryRun } from './model';

export function DepthChart({ baseline, candidate, timeS, onSeek }: { baseline: StoryRun; candidate?: StoryRun; timeS: number; onSeek: (t: number) => void }) {
  const maxTime = baseline.frames[baseline.frames.length - 1].t;
  const reference=baseline.summary.referenceM;
  const maxDepth = Math.max(reference*1.2, baseline.summary.peakM, candidate?.summary.peakM ?? 0) * 1.12;
  const x = (t: number) => 48 + t / maxTime * 690;
  const y = (d: number) => 102 - d / maxDepth * 82;
  const path = (run: StoryRun) => run.summary.series.map((s,i)=>`${i?'L':'M'}${x(s.timeS).toFixed(1)},${y(s.depthM).toFixed(1)}`).join(' ');
  return <div className="story-chart"><div><b>Water at fixed road point R1</b><span><i className="line-current"/> Current network {candidate && <><i className="line-option"/> Selected option</>}</span></div>
    <svg viewBox="0 0 760 130" role="img" aria-label="Sampled R1 road-point depth curves. Use the linked timeline above to choose the same moment on both scenes.">
      <line x1="48" y1="102" x2="738" y2="102" stroke="#d9e3eb"/>
      <line x1="48" y1={y(reference)} x2="738" y2={y(reference)} stroke="#bd8b37" strokeDasharray="5 5"/>
      <text x="50" y={y(reference)-5} fill="#926c25" fontSize="10">{Math.round(reference*100)} cm comparison reference</text>
      <text x="4" y="24" fill="#6b7d90" fontSize="10">{depthCm(maxDepth)}</text><text x="12" y="104" fill="#6b7d90" fontSize="10">0 cm</text>
      <path d={path(baseline)} fill="none" stroke="#c44352" strokeWidth="2.5"/>
      {candidate && <path d={path(candidate)} fill="none" stroke="#087f8c" strokeWidth="2.5"/>}
      <line x1={x(timeS)} y1="16" x2={x(timeS)} y2="104" stroke="#26374c" strokeWidth="1.5"/>
      <text x="48" y="123" fill="#6b7d90" fontSize="10">Start</text><text x="676" y="123" fill="#6b7d90" fontSize="10">{Math.round(maxTime/60)} min</text>
    </svg>
    <button onClick={()=>onSeek(baseline.summary.maxAreaTimeS)}>Jump to largest affected road area</button>
    <button onClick={()=>onSeek(baseline.summary.peakSampleTimeS)}>Jump to current network's deepest sampled moment</button>
  </div>;
}
