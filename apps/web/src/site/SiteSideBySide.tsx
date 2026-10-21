// Side-by-side before/after for the uploaded site's Compare tab. Reuses Tay Zheheng's split-view design from the
// guided story (story-scenes / story-viewport / story-comparison-strip CSS and the linked camera).
import { useMemo } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import { rainIntensityAt } from '@floodops/engine/scenario/storms';
import type { Storm } from '@floodops/engine/sim/types';
import type { CameraLink } from '../story/LinkedCamera';
import '../story/story.css';
import { SiteCityScene } from './SiteCityScene';
import { rainingAt } from './siteCity';
import { depthAt } from './local/runs';
import { candidateTitle, comparisonItems, frameAtTime, runChange, runFixLabel, type ComparisonItem } from './compare';
import type { SiteResult } from './types';

interface PaneProps {
  title: string; result: SiteResult; timeS: number; site: SiteSpec; phase: number; xray: boolean; selected: string | null;
  onSelect: (id: string) => void; storm: Storm | null; playing: boolean; cameraLink: CameraLink;
}

function ComparePane({ title, result, timeS, site, phase, xray, selected, onSelect, storm, playing, cameraLink }: PaneProps) {
  const frame = frameAtTime(result.frames, timeS);
  const t = frame?.timestamp_s;
  const depth = useMemo(() => (t === undefined ? null : depthAt(result.depth, t)), [result, t]);
  return <div className="story-viewport">
    <div className="story-pane-title"><span>{title}</span><small>{((t ?? 0) / 60).toFixed(1)} min</small></div>
    <SiteCityScene site={site} phase={phase} xray={xray} selected={selected} onSelect={onSelect} frame={frame}
      depth={result.depth ? depth : null} raining={rainingAt(storm, t, playing)} rainMmh={storm && t !== undefined ? rainIntensityAt(storm, t) : undefined} cameraLink={cameraLink}/>
  </div>;
}

const fmt = (v: number | null, unit: string) => v === null ? 'Not supplied' : `${v.toLocaleString(undefined, { maximumFractionDigits: unit === ' m' ? 3 : 1 })}${unit}`;
const ARROW = { better: ArrowDown, worse: ArrowUp, same: Minus } as const;
const WORD = { better: 'lower', worse: 'higher', same: 'unchanged' } as const;

function Item({ item }: { item: ComparisonItem }) {
  const Icon = item.direction ? ARROW[item.direction] : ArrowRight;
  return <div className={`site-compare-item ${item.direction ?? ''}`}>
    <span>{item.label}</span>
    <b>{fmt(item.before, item.unit)} <ArrowRight size={16}/> {fmt(item.after, item.unit)}
      <Icon size={16} aria-label={item.direction ? WORD[item.direction] : 'not comparable'} className="site-compare-arrow"/></b>
  </div>;
}

export function SiteSideBySide({ baseline, candidate, timeS, site, cameraLink, ...shared }: {
  baseline: SiteResult; candidate: SiteResult; timeS: number; site: SiteSpec; cameraLink: CameraLink; phase: number; xray: boolean;
  selected: string | null; onSelect: (id: string) => void; storm: Storm | null; playing: boolean;
}) {
  const items = useMemo(() => comparisonItems(baseline.metrics, candidate.metrics, site.hotspotNodeId), [baseline, candidate, site.hotspotNodeId]);
  const fix = runFixLabel(candidate.run);
  const change = fix ? `the only change is the fix from the automated analysis (${fix})` : `only ${runChange(candidate.run)?.asset_id ?? 'the selected pipe'} changes`;
  return <div className="site-compare">
    <div className="story-scenes split">
      <ComparePane title="BEFORE · Uploaded baseline" result={baseline} timeS={timeS} site={site} cameraLink={cameraLink} {...shared}/>
      <ComparePane title={candidateTitle(candidate.run)} result={candidate} timeS={timeS} site={site} cameraLink={cameraLink} {...shared}/>
    </div>
    <div className="story-comparison-strip site-compare-strip">
      {items.map((item) => <Item key={item.key} item={item}/>)}
      <small>Same uploaded rainfall and inputs; {change}. Uncalibrated engine results. Drag either view to move both cameras.</small>
    </div>
  </div>;
}
