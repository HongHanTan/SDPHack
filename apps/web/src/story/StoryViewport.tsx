import { useMemo } from 'react';
import { SceneViewer } from '../components/SceneViewer';
import { ASSETS } from '@floodops/engine/scenario/layout';
import type { TownshipAssetsResponse } from '../types';
import { rainIntensityAt, type StormId } from '@floodops/engine/scenario/storms';
import { depthCm, frameIndexAt, type StoryRun } from './model';
import type { CameraLink } from './LinkedCamera';
import type { RoadStudy } from './roadStudy';

export function StoryViewport({ run, title, timeS, playing, stormId, underground, cameraLink, pending, focusPipe, roadStudy }: {
  run?: StoryRun; title: string; timeS: number; playing: boolean; stormId: string;
  underground: boolean; cameraLink: CameraLink; pending?: string; focusPipe: boolean; roadStudy: RoadStudy;
}) {
  const initialAssets = useMemo(() => structuredClone(ASSETS) as unknown as TownshipAssetsResponse, []);
  const assets = run?.assets ?? initialAssets;
  const index = run ? frameIndexAt(run.frames, timeS) : -1;
  const raw = index >= 0 ? run?.frames[index] : undefined;
  const current = index >= 0 ? run?.teamFrames[index] : null;
  const depth = raw && run ? raw.depth[run.surfaceCell] : null;
  return <div className={`story-viewport ${pending ? 'pending' : ''}`} aria-label={title}>
    <div className="story-pane-title"><span>{title}</span><small>{run ? `P07: ${Math.round((assets.conduits.find(p=>p.conduit_id==='PIPE-P07')?.diameter_m ?? 0)*1000)} mm` : 'Illustrative D07 street'}</small></div>
    <SceneViewer presentation cameraLink={cameraLink} roadStudy={roadStudy} nodes={assets.nodes} inlets={assets.inlets} conduits={assets.conduits}
      onSelectAsset={()=>{}} selectedAssetId={focusPipe ? 'PIPE-P07' : 'INLET-D07'}
      currentFrame={current} engineDepth={raw?.depth ?? null} xray={underground}
      twinViewMode="twin_highlight" isRainActive={!!run && playing && rainIntensityAtFor(stormId, timeS) > 0}
      stormIntensityMmh={rainIntensityAtFor(stormId,timeS)} appMode="diagnose" />
    {run && <div className="story-now"><span>Road point R1 at this sample</span><strong>{depth === null ? 'Before first sample' : depthCm(depth)}</strong><small>Illustrative road cell · {Math.floor(timeS/60)} min into the run</small></div>}
    {pending && <div className="story-solving"><span className="story-spinner"/><b>{pending}</b><p>Calculating water movement from the selected inputs.</p></div>}
    {!run && !pending && <div className="story-location"><span>D07</span><b>The inlet at the low point</b><small>Start the storm to calculate what happens here.</small></div>}
  </div>;
}

import { STORMS } from '@floodops/engine/scenario/storms';
function rainIntensityAtFor(id: string, t: number) { return id in STORMS ? rainIntensityAt(STORMS[id as StormId],t) : 0; }
