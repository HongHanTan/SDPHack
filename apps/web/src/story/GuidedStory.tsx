import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Layers, Pause, Play, RotateCcw } from 'lucide-react';
import type { BootstrapResponse, InspectionRecord } from '../types';
import { assetInspections, scenarioKey, type MaintenanceHandoff, type ScenarioSelection } from '../maintenance/model';
import { createCameraLink } from './LinkedCamera';
import { DepthChart } from './DepthChart';
import { StoryViewport } from './StoryViewport';
import { changeDescription, cleaningFinding, clockLabel, depthCm, frameIndexAt, STORY_CASES, type StoryCase, type StoryRun } from './model';
import { useStoryRuns } from './useStoryRuns';
import { baseTownship } from '@floodops/engine/scenario/index';
import { assessRoad } from './run';
import { buildRoadStudy, type RoadRegionId } from './roadStudy';
import { RoadStudyPanel } from './RoadStudyPanel';
import { ReferencePanel } from './ReferencePanel';
import { InputAuditView } from '../maintenance/InputAuditView';
import './story.css';

interface Props {
  visible: boolean; scenario: ScenarioSelection; bootstrap: BootstrapResponse | null; inspections: InspectionRecord[];
  onChangeScenario: (field: 'storm_id' | 'debris_id' | 'tailwater', value: string) => void;
  onMaintenance: () => void; onInspect: () => void; onPrepare: (handoff: MaintenanceHandoff) => void;
}
const CHAPTERS = ['Meet the street', 'Test the rain', 'Try cleaning', 'Test the pipe', 'Choose the next step'];

function StreetNumbers({ run, label }: { run?: StoryRun; label: string }) {
  return <div className="story-numbers" aria-label={`${label} calculated road results`}>
    <div><small>Sampled peak at road point R1</small><strong>{run ? depthCm(run.summary.peakM) : 'Not calculated'}</strong><span>Fixed road cell - excludes the inlet sump</span></div>
    <div><small>Largest road area above reference</small><strong>{run ? `${run.summary.maxAreaM2.toFixed(0)} m2` : 'Not calculated'}</strong><span>Simultaneous area at one output sample</span></div>
    <div><small>R1 time at or above {run ? Math.round(run.summary.referenceM*100) : 15} cm</small><strong>{run ? `${(run.summary.aboveReferenceS/60).toFixed(1)} min` : 'Not calculated'}</strong><span>{run?.summary.stillAboveAtEnd ? 'Still above reference at the end' : 'Approximate - 30-second output samples'}</span></div>
  </div>;
}

export function GuidedStory({visible, scenario, bootstrap, inspections, onChangeScenario, onMaintenance, onInspect, onPrepare}: Props) {
  const [chapter, setChapter] = useState(0);
  const [region,setRegion]=useState<RoadRegionId>('d07');
  const [referenceCm,setReferenceCm]=useState(15);
  const [activeCase, setActiveCase] = useState<StoryCase>('baseline');
  const [timeS, setTimeS] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(120);
  const [underground, setUnderground] = useState(false);
  const [action, setAction] = useState<'inspect' | 'desilt-d07' | 'upsize-p07'>('inspect');
  const [cameraLink] = useState(createCameraLink);
  const timeRef = useRef(0);
  const {runs:rawRuns, calculate, busy, progress, error, cancel} = useStoryRuns(scenario,visible);
  const runs=useMemo(()=>Object.fromEntries(Object.entries(rawRuns).map(([id,run])=>[id,assessRoad(run,region,referenceCm/100)])) as typeof rawRuns,[rawRuns,region,referenceCm]);
  const study=useMemo(()=>buildRoadStudy(baseTownship().grid,region),[region]);
  const baseline = runs.baseline;
  const cleaning = runs['desilt-d07'];
  const upsize = runs['upsize-p07'];
  const candidate = runs[activeCase];
  const latest = assetInspections('INLET-D07', inspections)[0];
  const loss = bootstrap?.debris_scenarios.find(d=>d.debris_scenario_id===scenario.debris_id)?.parameters.hydraulic_inlet_clogging_fraction;
  const endS = baseline?.frames[baseline.frames.length-1].t ?? 7200;
  const split = chapter >= 3;
  const currentKey = scenarioKey(scenario);
  useEffect(()=>{
    cameraLink.pose={position:[study.point.x+22,39,-study.point.y+42],target:[study.point.x,11,-study.point.y]};
    cameraLink.applying=true;try{cameraLink.listeners.forEach(listener=>listener(cameraLink.pose));}finally{cameraLink.applying=false;}
  },[region,cameraLink]);

  const seek = (seconds: number) => {const next=Math.max(0,Math.min(endS,seconds));timeRef.current=next;setTimeS(next);};
  useEffect(()=>{setChapter(0);setActiveCase('baseline');setPlaying(false);timeRef.current=0;setTimeS(0);setAction('inspect');},[currentKey]);
  useEffect(()=>{if(!visible)setPlaying(false);},[visible]);
  useEffect(()=>{
    if(!visible || !playing || !baseline) return;
    let frame=0; let previous=performance.now();
    const tick=(now:number)=>{
      const elapsed=Math.min(0.1,Math.max(0,(now-previous)/1000));previous=now;
      const next=Math.min(endS,timeRef.current+elapsed*speed);timeRef.current=next;setTimeS(next);
      if(next>=endS){setPlaying(false);return;}
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[visible,playing,speed,baseline,endS]);

  const solve = async (id: StoryCase, nextChapter: number) => {
    setPlaying(false);setChapter(nextChapter);setActiveCase(id);
    const rawResult=await calculate(id);
    const result=rawResult?assessRoad(rawResult,region,referenceCm/100):null;
    if(!result) return;
    if(id==='baseline'){seek(result.frames[0].t);setPlaying(true);}
    else {seek(baseline?.summary.peakSampleTimeS ?? result.summary.peakSampleTimeS);setUnderground(false);}
  };
  const handoff = () => {
    const option=action==='inspect'?null:action;
    const result=option?runs[option]:null;
    if(option&&!result)return;
    const complete=[baseline,cleaning,upsize].filter((r):r is StoryRun=>!!r);
    onPrepare({ handoff_id: crypto.randomUUID(), mode:'engine', asset_id:action==='upsize-p07'?'PIPE-P07':'INLET-D07', option_id:option,
      scope:action==='inspect'?'Inspect D07 and verify drainage inputs':action==='desilt-d07'?'Review cleaning of INLET-D07':'Request an engineering review of PIPE-P07 capacity and upsizing feasibility',
      justification:action==='inspect'?'Collect current field evidence, survey pavement levels and verify drainage inputs before specifying work.':`${baseline&&result?`${changeDescription(baseline.summary,result.summary)} Study: ${result.roadStudy.name}, ${result.roadStudy.areaM2} m2 of road cells. R1 sampled peak: ${depthCm(baseline.summary.peakM)} before, ${depthCm(result.summary.peakM)} after. Maximum simultaneous road area at or above ${referenceCm} cm: ${baseline.summary.maxAreaM2} m2 before, ${result.summary.maxAreaM2} m2 after. Approximate R1 duration above reference: ${(baseline.summary.aboveReferenceS/60).toFixed(1)} / ${(result.summary.aboveReferenceS/60).toFixed(1)} minutes (before / after, 30-second samples).`:''} Browser-engine scenario only. Road cells exclude grates and manhole footprints. Terrain is synthetic, not surveyed pavement; the reference is not a safety standard. Site and surface validation are not established. Verify inputs, downstream constraints, access and actual cost before approval.`,
      comparison:option?{comparison_id:crypto.randomUUID(),created_at:new Date().toISOString(),scenario:{...scenario},results:complete.map(r=>r.result)}:null });
  };
  if(!visible)return null;

  const titles=[
    'Will cleaning this drain be enough?',
    'First, watch what this storm does.',
    'Try the obvious fix: clean the inlet.',
    'Now test a bigger downstream pipe.',
    'Turn the finding into a sensible next step.',
  ];
  const explanation=chapter===0?'Choose a road study area, then compare calculated actions using the same road cells and fixed point.'
    :chapter===1?'Watch the selected road area and R1 measurement point. These are illustrative sampled results, not measured pavement depths.'
    :chapter===2&&baseline&&cleaning?cleaningFinding(baseline.summary,cleaning.summary)
    :chapter===3&&baseline&&upsize?`${changeDescription(baseline.summary,upsize.summary)} Both scenes use the same storm, clock and camera.`
    :chapter===4?'Use the comparison to decide what to inspect or review. A model result is not a construction approval.'
    :'Calculating this option under the same storm and boundary conditions.';
  return <main className="guided-story" aria-label="Guided D07 storm demonstration">
    <header className="story-heading"><div><span className="story-kicker">A street. A storm. A decision.</span><h1>{titles[chapter]}</h1><p>{explanation}</p></div><button className="story-quiet" onClick={onMaintenance}>Operations dashboard <ChevronRight size={16}/></button></header>
    <div className="story-source"><span className="story-source-dot"/><b>Illustrative model</b><span>Calculated with the FloodOps browser engine</span><span>Uncalibrated site · not an EPA SWMM run</span></div>
    <div className="story-layout">
      <aside className="story-rail">
        <nav aria-label="Guided story steps">{CHAPTERS.map((title,index)=>{
          const unlocked=index===0||index===1&&!!baseline||index===2&&!!cleaning||index>=3&&!!upsize;
          return <button key={title} className={chapter===index?'selected':''} disabled={!unlocked||!!busy} onClick={()=>{setChapter(index);setPlaying(false);if(index===1)setActiveCase('baseline');if(index===2)setActiveCase('desilt-d07');if(index>=3&&activeCase==='baseline')setActiveCase('upsize-p07');}}><span>{index<chapter?<Check size={13}/>:index+1}</span>{title}</button>;
        })}</nav>
        <div className="story-evidence"><small>What do we know about D07?</small><b>{latest?`${latest.source_type} inspection available`:'No inspection recorded'}</b><p>{latest?`${new Date(latest.timestamp).toLocaleDateString()} · ${latest.inspector}`:'A real decision starts with a current site inspection.'}</p><button onClick={onInspect}>{latest?'Review with a new inspection':'Record inspection evidence'}</button></div>
        <div className="story-assumptions"><label>Rain scenario<select aria-label="Guided rain scenario" value={scenario.storm_id} disabled={!!busy} onChange={e=>onChangeScenario('storm_id',e.target.value)}>{bootstrap?.storms.filter(s=>['synthetic_80mmh_60min','synthetic_120mmh_60min'].includes(s.storm_id)).map(s=><option key={s.storm_id} value={s.storm_id}>{s.parameters.intensity_mmh} mm/h for {s.parameters.duration_s/60} minutes</option>)}</select></label>
          <details><summary>Other assumptions</summary><label>Inlet hydraulic loss<select value={scenario.debris_id} disabled={!!busy} onChange={e=>onChangeScenario('debris_id',e.target.value)}>{bootstrap?.debris_scenarios.map(d=><option key={d.debris_scenario_id} value={d.debris_scenario_id}>{Math.round(d.parameters.hydraulic_inlet_clogging_fraction*100)}% assumed loss</option>)}</select></label><label>Canal level<select value={scenario.tailwater} disabled={!!busy} onChange={e=>onChangeScenario('tailwater',e.target.value)}><option value="normal">Normal assumed level</option><option value="high">High assumed level</option></select></label><p>Photo coverage and hydraulic loss are separate. Changing an input clears this story's old results.</p></details>
          <span>{loss===undefined?'Choose an inlet hypothesis':`${Math.round(loss*100)}% assumed inlet loss`} · {scenario.tailwater} canal</span>
        </div>
        {chapter>0 && <StreetNumbers run={candidate} label={STORY_CASES[activeCase].title}/>}
        {error&&<div className="story-error" role="alert">{error}<button onClick={()=>void solve(activeCase,chapter)}>Retry calculation</button></div>}
        {busy&&<div className="story-progress" role="status"><b>Calculating {STORY_CASES[busy].title.toLowerCase()}…</b><progress max={progress.totalS} value={progress.timeS}/><small>{Math.floor(progress.timeS/60)} of {Math.round(progress.totalS/60)} model minutes solved</small><button onClick={cancel}>Cancel calculation</button></div>}
        {!busy&&<div className="story-next">
          {chapter>0&&chapter<4&&!candidate&&!error&&<button className="story-primary" onClick={()=>void solve(activeCase,chapter)}>Calculate this step <Play size={16}/></button>}
          {chapter===0&&<button className="story-primary" disabled={!bootstrap} onClick={()=>void solve('baseline',1)}><Play size={16}/> Test this storm</button>}
          {chapter===1&&baseline&&<><p>Would cleaning D07 solve the problem?</p><button className="story-primary" onClick={()=>void solve('desilt-d07',2)}>Try cleaning D07 <ArrowRight size={16}/></button></>}
          {chapter===2&&cleaning&&<><div className="story-pipe-finding"><b>{baseline&&baseline.summary.p07AtCapacityS>0?'P07 reaches its modelled flow capacity':'P07 has no sampled full-capacity interval'}</b><p>{baseline?`${(baseline.summary.p07AtCapacityS/60).toFixed(1)} minutes at capacity in the current run.`:''} This is a simplified flow indicator, not a pressure calculation.</p></div><button className="story-primary" onClick={()=>void solve('upsize-p07',3)}>Test P07: 600 → 750 mm <ArrowRight size={16}/></button></>}
          {chapter===3&&upsize&&<button className="story-primary" onClick={()=>{setPlaying(false);setChapter(4);}}>Choose the next action <ArrowRight size={16}/></button>}
          {chapter===4&&<button className="story-primary" onClick={handoff}>Prepare a work proposal <ArrowRight size={16}/></button>}
          {chapter>0&&<button className="story-back" onClick={()=>{setPlaying(false);setChapter(Math.max(0,chapter-1));if(chapter===2)setActiveCase('baseline');if(chapter===3)setActiveCase('desilt-d07');}}><ArrowLeft size={14}/> Previous step</button>}
        </div>}
      </aside>
      <section className="story-content">
        <RoadStudyPanel study={study} region={region} referenceCm={referenceCm} onRegion={id=>{setPlaying(false);setRegion(id);}} onReference={value=>{setPlaying(false);setReferenceCm(value);}} frame={candidate?candidate.frames[frameIndexAt(candidate.frames,timeS)]:undefined}/>
        <ReferencePanel run={candidate}/>
        <InputAuditView baseline={baseline?.result} candidate={candidate?.result} mode="engine"/>
        {chapter===4&&<div className="story-decision"><div><small>Proposed next step</small><h2>What should the manager do?</h2><p>Costs still need a sourced estimate. Engineering options need site and feasibility checks.</p></div><div role="group" aria-label="Choose a proposed action">{[
          ['inspect','Collect site evidence','Confirm the inlet, pipe dimensions and observations.'],
          ['desilt-d07','Review inlet cleaning','Use its calculated effect, access and actual cleaning quote.'],
          ['upsize-p07','Request engineering review','Investigate P07 capacity, utilities and downstream constraints.'],
        ].map(([id,title,description])=><button key={id} aria-pressed={action===id} className={action===id?'selected':''} onClick={()=>setAction(id as typeof action)}><b>{title}</b><small>{description}</small></button>)}</div></div>}
        <div className="story-view-bar"><div><b>{split?'Same moment. Same camera. Two calculated outcomes.':chapter===0?study.name:STORY_CASES[activeCase].title}</b><small>{split?'Drag either view to move both cameras.':'Drag to explore the example street.'}</small></div><div>{cleaning&&chapter>=2&&<select aria-label="Select comparison outcome" value={activeCase} onChange={e=>{setPlaying(false);setActiveCase(e.target.value as StoryCase);}}>{!split&&<option value="baseline">Current network</option>}<option value="desilt-d07">Clean D07 only</option>{upsize&&<option value="upsize-p07">Larger P07 pipe</option>}</select>}<button aria-pressed={underground} onClick={()=>setUnderground(v=>!v)}><Layers size={15}/>{underground?'Show street surface':'Look underground'}</button><button onClick={()=>{cameraLink.pose={position:[study.point.x+22,39,-study.point.y+42],target:[study.point.x,11,-study.point.y]};cameraLink.applying=true;try{cameraLink.listeners.forEach(l=>l(cameraLink.pose));}finally{cameraLink.applying=false;}}}><RotateCcw size={14}/> Reset view</button></div></div>
        <div className={`story-scenes ${split?'split':''}`}>
          {split&&<StoryViewport title="BEFORE · current network" run={baseline} timeS={timeS} playing={playing} stormId={scenario.storm_id} underground={underground} cameraLink={cameraLink} focusPipe={underground} roadStudy={study}/>}
          <StoryViewport title={split?`AFTER · ${STORY_CASES[activeCase].title}`:chapter===0?'THE EXAMPLE STREET':STORY_CASES[activeCase].title} run={candidate} timeS={timeS} playing={playing} stormId={scenario.storm_id} underground={underground} cameraLink={cameraLink} focusPipe={underground} roadStudy={study} pending={busy&&activeCase===busy?`Solving ${STORY_CASES[busy].title.toLowerCase()}`:undefined}/>
        </div>
        {split&&baseline&&candidate&&<div className="story-comparison-strip"><div><span>Sampled peak at the same road point R1</span><b>{depthCm(baseline.summary.peakM)} <ArrowRight size={16}/> {depthCm(candidate.summary.peakM)}</b></div><p>{changeDescription(baseline.summary,candidate.summary)}</p><small>Sampled maxima cover the whole run; pictures show the same selected moment. Largest simultaneous road area above reference: {baseline.summary.maxAreaM2} m2 before / {candidate.summary.maxAreaM2} m2 after.</small></div>}
        {baseline&&<div className="story-playback"><button aria-label={playing?'Pause linked playback':'Play linked playback'} disabled={!!busy} onClick={()=>{if(timeS>=endS)seek(baseline.frames[0].t);setPlaying(v=>!v);}}>{playing?<Pause size={16}/>:<Play size={16}/>}</button><span>{clockLabel(timeS)} / {clockLabel(endS)}</span><input aria-label="Linked simulation time" type="range" min={baseline.frames[0].t} max={endS} step="30" value={timeS} onChange={e=>{setPlaying(false);seek(Number(e.target.value));}}/><label>Speed<select aria-label="Playback speed" value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value="30">30×</option><option value="60">60×</option><option value="120">120×</option><option value="240">240×</option></select></label></div>}
        {baseline&&<DepthChart baseline={baseline} candidate={activeCase==='baseline'?undefined:candidate} timeS={timeS} onSeek={t=>{setPlaying(false);seek(t);}}/>}
        <details className="story-method"><summary>Measurement definition, input changes and retained run details</summary><p>Every action uses the same rain, initial grid, inlet-loss hypothesis and canal level. Cleaning restores D07 inlet capacity. The pipe option changes P07 from 600 to 750 mm. These are separate options.</p><p>All displayed road metrics use actual output samples, normally 30 seconds apart. Road area is counted simultaneously in each frame; it is not the union of different cells flooded at different times. Duration is a right-endpoint sample estimate. R1 is the same fixed road cell in every compared run. Grate and manhole footprints within 2.5 m are excluded.</p><p>The {referenceCm} cm reference is a comparison setting, not a road-safety standard. Grid terrain is synthetic. The 3D neighbourhood is illustrative; the cell diagram shows the exact measurement mask. No observed road depth, property protection or monetary saving is established.</p><p>EPA SWMM runs are available in Compare with native cleaning, pipe and conceptual storage presets. Native pipe and storage checks do not validate this browser surface map.</p>{[baseline,cleaning,upsize].filter((r):r is StoryRun=>!!r).map(r=><div key={r.caseId}><b>{STORY_CASES[r.caseId].title}</b><code>{r.result.run_id} - hydraulic input SHA-256: {r.result.input_hash}</code><small>Road area: {r.roadStudy.areaM2} m2. R1 cell {r.surfaceCell}, centre ({r.roadStudy.point.x}, {r.roadStudy.point.y}).</small>{r.result.metrics?.warnings.map(w=><p className="story-error" key={w}>{w}</p>)}</div>)}</details>
      </section>
    </div>
  </main>;
}
