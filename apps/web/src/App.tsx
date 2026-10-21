import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient, DataMode } from './api/client';
import {
  AssetConduit,
  AssetInlet,
  AssetNode,
  BootstrapResponse,
  HealthResponse,
  InspectionRecord,
  SimulationFrame,
  SimulationMetricsResponse,
  AppMode,
  TwinViewMode,
  TownshipAssetsResponse,
} from './types';
import { StatusHeader } from './components/StatusHeader';
import { SceneViewer } from './components/SceneViewer';
import { AssetDetailModal } from './components/AssetDetailModal';
import { SimulationHUD } from './components/SimulationHUD';
import { InspectionModal } from './components/InspectionModal';
import { VirtualDebrisLab } from './components/VirtualDebrisLab';
import { MaintenanceWorkspace, type WorkspaceView } from './maintenance/MaintenanceWorkspace';
import { OPTIONS } from './maintenance/comparison';
import { assetLocation, scenarioKey, type MaintenanceHandoff } from './maintenance/model';
import { GuidedStory } from './story/GuidedStory';
import { OperationsDashboard } from './operations/OperationsDashboard';
import { scopeKey, type ProblemScope } from './operations/model';
import { engineSource } from './engine/engineSource';
import { useLiveEngine } from './engine/useLiveEngine';
import { rainIntensityAt, STORMS, type StormId } from '@floodops/engine/scenario/storms';
import { SitePortal } from './site/SitePortal';

export function LegacyApp() {
  const [mode, setMode] = useState<DataMode>(apiClient.getDataMode());
  const engineMode = mode === 'engine';
  const live = useLiveEngine();
  const liveActive = engineMode && live.on;
  const [appMode, setAppMode] = useState<AppMode>('diagnose');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [nodes, setNodes] = useState<AssetNode[]>([]);
  const [inlets, setInlets] = useState<AssetInlet[]>([]);
  const [conduits, setConduits] = useState<AssetConduit[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);

  // Simulation scenario parameters
  const [selectedStormId, setSelectedStormId] = useState<string>('synthetic_80mmh_60min');
  const [selectedDebrisId, setSelectedDebrisId] = useState<string>(
    apiClient.getDataMode() === 'engine' ? 'engine_d07_40pct' : 'demo_inlet_40pct'
  );
  const [selectedTailwater, setSelectedTailwater] = useState<string>('normal');

  // J4: Intervention Dashboard state
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView | null>('priorities');
  const [storyOpen, setStoryOpen] = useState(false);
  const [operationsOpen, setOperationsOpen] = useState(true);
  const [storyHandoff, setStoryHandoff] = useState<MaintenanceHandoff | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'assets' | 'analytics' | 'reports'>('dashboard');
  const [resultScenario, setResultScenario] = useState<string | null>(null);

  // Simulation execution & playback
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasSimulationStarted, setHasSimulationStarted] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [runProgressMessage, setRunProgressMessage] = useState<string>('');
  const [frames, setFrames] = useState<SimulationFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [metrics, setMetrics] = useState<SimulationMetricsResponse | null>(null);

  // Asset selection & modal states
  const [selectedAsset, setSelectedAsset] = useState<{
    type: 'node' | 'inlet' | 'conduit';
    id: string;
    data: unknown;
  } | null>(null);
  const [inspectingAssetId, setInspectingAssetId] = useState<string | null>(null);
  const [twinViewMode, setTwinViewMode] = useState<TwinViewMode>('twin_highlight');
  const [xray, setXray] = useState<boolean>(false);
  const [viewDim, setViewDim] = useState<'3d' | '2d'>('3d');
  const [rainEnabled, setRainEnabled] = useState<boolean>(true);

  // J3: Virtual Debris Lab states
  const [isDebrisLabOpen, setIsDebrisLabOpen] = useState<boolean>(false);
  const [debrisRestrictionFraction, setDebrisRestrictionFraction] = useState<number>(0.4);

  // Dynamic blockage customization per pipe/node
  const [customBlockages, setCustomBlockages] = useState<Record<string, number>>({
    'PIPE-P07': 0.4,
    'INLET-D07': 0.4,
  });

  // Loading & error state
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Run token: each run takes the next number; a newer run, a mode switch or unmount makes older poll loops stale.
  const runTokenRef = useRef<number>(0);
  const dataLoadTokenRef = useRef(0);
  // Engine mode: the run whose frames are shown (its depth grids feed the water surface), and the applied dashboard option.
  const [engineRunId, setEngineRunId] = useState<string | null>(null);
  const [appliedOptionId, setAppliedOptionId] = useState<string>('baseline');

  // Load foundational data (assets, bootstrap, health)
  const loadData = useCallback(async () => {
    const myLoad=++dataLoadTokenRef.current;
    setLoading(true);
    setApiError(null);
    try {
      const [h, b, a] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getBootstrap(),
        apiClient.getTownshipAssets('taman_kyra_demo'),
      ]);
      if(myLoad!==dataLoadTokenRef.current) return;

      setHealth(h);
      setBootstrap(b);
      setNodes(a.nodes);
      setInlets(a.inlets);
      setConduits(a.conduits);

      // In API mode, only call /api/inspections if backend capability is true (T2 has it as false)
      const inspRes = b.capabilities.inspections || mode !== 'api' ? await apiClient.getInspections() : { items: [] };
      if(myLoad!==dataLoadTokenRef.current) return;
      setInspections(inspRes.items);

      setFrames([]);
      setMetrics(null);
      setResultScenario(null);
    } catch (err: unknown) {
      if(myLoad!==dataLoadTokenRef.current) return;
      console.error('Failed to load foundational data:', err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      if(myLoad===dataLoadTokenRef.current) setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadData();
    return () => {
      runTokenRef.current++;
      dataLoadTokenRef.current++;
    };
  }, [loadData, mode]);

  // Engine Live: one continuous storm in a worker with the current scenario settings.
  const startLive = (stormId: string, debrisId = selectedDebrisId, tailwater = selectedTailwater) => {
    live.start(stormId as StormId, engineSource.getInterventions(), {
      tailwater: tailwater === 'high' ? 'high' : 'normal',
      blockage: engineSource.blockageForDebris(debrisId),
    });
  };

  const stopLive = () => {
    if (!live.on) return;
    live.setOn(false);
    live.stop();
  };

  const handleToggleLive = (on: boolean) => {
    if (on) {
      live.setOn(true);
      setHasSimulationStarted(true);
      // Live drives its own clock; keep his frame playback timer idle underneath.
      setIsPlaying(false);
      startLive(selectedStormId);
    } else {
      stopLive();
    }
  };

  const handleToggleMode = (newMode: DataMode) => {
    if(newMode===mode) return;
    dataLoadTokenRef.current++;
    setLoading(true);setBootstrap(null);setNodes([]);setInlets([]);setConduits([]);setInspections([]);
    runTokenRef.current++;
    setIsRunning(false);
    setRunProgressMessage('');
    setSelectedAsset(null);
    setWorkspaceView('priorities');
    setStoryOpen(false);
    setOperationsOpen(true);
    setStoryHandoff(null);
    setIsPlaying(false);
    setActiveTab('dashboard');
    if (newMode !== 'engine') stopLive();
    apiClient.setDataMode(newMode);
    setMode(newMode);
    if (newMode === 'engine') {
      if(!['synthetic_80mmh_60min','synthetic_120mmh_60min'].includes(selectedStormId))setSelectedStormId('synthetic_80mmh_60min');
      setSelectedDebrisId('engine_d07_40pct');
      // Entering engine mode starts from the baseline network (loadData reloads the assets).
      engineSource.setInterventions([]);
      setAppliedOptionId('baseline');
      setEngineRunId(null);
    } else if (mode === 'engine') {
      setSelectedDebrisId('demo_inlet_40pct');
    }
  };

  // Explicit switch between verified offline SWMM 5.2.4 runs
  const handleLoadVerifiedRun = (stormId: string) => {
    setSelectedStormId(stormId);
    const offlineFrames = apiClient.getOfflineFrames(stormId);
    const offlineMetrics = apiClient.getOfflineMetrics(stormId);
    setFrames(offlineFrames.frames);
    setMetrics(offlineMetrics);
    setCurrentFrameIndex(0);
    setResultScenario(scenarioKey({ mode, storm_id: stormId, debris_id: selectedDebrisId, tailwater: selectedTailwater, model_version_id: 'taman_kyra_synthetic_v1' }) + '[]');
  };

  // Unified simulation start and playback controls
  const handleStartSimulation = () => {
    if (mode !== 'mock' && !resultsCurrent) { void handleRunSimulation(); return; }
    setHasSimulationStarted(true);
    setIsPlaying(true);
    if (currentFrameIndex >= frames.length - 1) {
      setCurrentFrameIndex(0);
    }
  };

  const handleTogglePlay = () => {
    if (!hasSimulationStarted) {
      setHasSimulationStarted(true);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleResetSimulation = () => {
    setIsPlaying(false);
    setHasSimulationStarted(false);
    setCurrentFrameIndex(0);
  };

  // Run Simulation handler (with T2 polling support)
  const handleRunSimulation = async () => {
    if(!engineMode)setAppliedOptionId('baseline');
    setHasSimulationStarted(true);
    setIsPlaying(true);
    setIsRunning(true);
    setApiError(null);
    setRunProgressMessage('Submitting hydraulic simulation job...');
    const runKey = scenarioKey(scenario) + JSON.stringify(mode === 'engine' ? engineSource.getInterventions() : []);
    const myRun = ++runTokenRef.current;
    const isCurrent = () => runTokenRef.current === myRun;

    try {
      if (mode === 'mock') {
        // Mock instant execution
        await apiClient.createSimulation({
          model_version_id: 'taman_kyra_synthetic_v1',
          storm_id: selectedStormId,
          debris_scenario_id: selectedDebrisId,
          tailwater_case: selectedTailwater,
          intervention: null,
        });
        const offlineFrames = apiClient.getOfflineFrames(selectedStormId);
        const offlineMetrics = apiClient.getOfflineMetrics(selectedStormId);
        setFrames(offlineFrames.frames);
        setMetrics(offlineMetrics);
        setCurrentFrameIndex(0);
        setResultScenario(runKey);
        return;
      }

      // Real API mode (T2 asynchronous simulation with polling)
      const simReq = {
        model_version_id: 'taman_kyra_synthetic_v1',
        storm_id: selectedStormId,
        debris_scenario_id: selectedDebrisId,
        tailwater_case: selectedTailwater,
        intervention: null,
      };

      const { run_id, status: initialStatus } = await apiClient.createSimulation(simReq);
      setRunProgressMessage(`Run ${run_id.slice(0, 8)}... Queued`);

      // Poll until succeeded or failed
      let currentStatus = initialStatus;
      let attempts = 0;
      const maxAttempts = mode === 'engine' ? 300 : 60; // 60 * 800ms = 48s max poll (engine: 240s)

      while (isCurrent() && (currentStatus === 'queued' || currentStatus === 'running')) {
        attempts++;
        if (attempts > maxAttempts) {
          throw new Error(`Simulation polling timed out after ${Math.round(maxAttempts * 0.8)} seconds.`);
        }

        await new Promise((r) => setTimeout(r, 800));
        if (!isCurrent()) return;

        let run;
        try {
          run = await apiClient.getSimulation(run_id);
        } catch (pollErr: unknown) {
          // If 409 RESULTS_NOT_READY, continue polling (engine mode: only its own not-ready signal)
          const errStr = String(pollErr);
          if (errStr.includes('RESULTS_NOT_READY') || (mode !== 'engine' && errStr.includes('409'))) {
            continue;
          }
          throw pollErr;
        }
        if (!isCurrent()) return;
        currentStatus = run.status;
        setRunProgressMessage(
          `${mode === 'engine' ? 'Engine solving' : 'EPA SWMM Solving'} (${run.status})... [${(attempts * 0.8).toFixed(1)}s]`
        );

        if (run.status === 'failed') {
          const msg = run.error?.message || (mode === 'engine' ? 'Engine run failed.' : 'SWMM calculation failed.');
          throw new Error(`[SIMULATION_FAILED] ${msg}`);
        }
      }

      if (isCurrent() && currentStatus === 'succeeded') {
        setRunProgressMessage('Fetching simulation frames & metrics...');
        const [newFrames, newMetrics] = await Promise.all([
          apiClient.getSimulationFrames(run_id),
          apiClient.getSimulationMetrics(run_id),
        ]);
        if (!isCurrent()) return;

        setFrames(newFrames.frames);
        setMetrics(newMetrics);
        setResultScenario(runKey);
        setCurrentFrameIndex(0);
        if (mode === 'engine') setEngineRunId(run_id);
      }
    } catch (err: unknown) {
      console.error('Simulation execution failed:', err);
      if (isCurrent()) setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      if (isCurrent()) {
        setIsRunning(false);
        setRunProgressMessage('');
      }
    }
  };

  const handleCreateInspection = async (record: Partial<InspectionRecord>, file?: File) => {
    const saved = await apiClient.createInspection(record);
    setInspections(prev => [saved, ...prev]);
    if (file) {
      try {
        const media = await apiClient.uploadInspectionMedia(saved.inspection_id, file);
        saved.media = [media, ...(saved.media || [])];
        saved.media_urls = [media.url, ...(saved.media_urls || [])];
        setInspections(prev => prev.map(i => i.inspection_id === saved.inspection_id ? { ...saved } : i));
      } catch (err) { throw new Error(`Inspection ${saved.inspection_id} is saved, but its attachment failed: ${String(err)}. Close this form to view the saved record.`); }
    }
  };

  // J3 & T3: Handle hypothesis update with native finite inlet presets
  const handleSelectHypothesis = (fraction: number, presetId?: string) => {
    setDebrisRestrictionFraction(fraction);
    if (presetId) {
      setSelectedDebrisId(presetId);
    } else if (fraction === 0.0) {
      setSelectedDebrisId('demo_inlet_capture_0pct');
    } else if (fraction === 0.2) {
      setSelectedDebrisId('demo_inlet_capture_20pct');
    } else if (fraction === 0.6) {
      setSelectedDebrisId('demo_inlet_capture_60pct');
    } else {
      setSelectedDebrisId('demo_inlet_40pct');
    }
  };

  // An input edit never changes calculated frames or metrics in place.
  const handleUpdateBlockage = (assetId: string, fraction: number) => {
    setCustomBlockages(prev => ({...prev, [assetId]: fraction}));
    if (assetId === 'INLET-D07') handleSelectHypothesis(fraction);
    setIsPlaying(false);
  };

  // Workflow mode switch (Idle vs Diagnose vs Anticipate)
  const handleSwitchAppMode = (newMode: AppMode) => {
    setAppMode(newMode);
    setHasSimulationStarted(false);
    setIsPlaying(false);
    setCurrentFrameIndex(0);
    // Engine mode: switching workflow resets playback, so the Live storm stops too.
    if (engineMode) stopLive();
    if (newMode === 'idle') {
      // Idle mode: calm clear weather.
      setRainEnabled(false);
      if (mode === 'mock') handleLoadVerifiedRun('synthetic_80mmh_60min');
    } else if (newMode === 'diagnose') {
      // Historical diagnosis: focus on INLET-D07 restriction under baseline event
      setRainEnabled(true);
      if (mode === 'mock') {
        handleLoadVerifiedRun('synthetic_80mmh_60min');
        setSelectedDebrisId('demo_inlet_40pct');
      }
      setDebrisRestrictionFraction(0.4);
    } else {
      // Forward anticipation: projected 120 mm/h monsoon storm with antecedent blockage
      setRainEnabled(true);
      if (mode === 'mock') {
        handleLoadVerifiedRun('synthetic_120mmh_60min');
        setSelectedDebrisId('demo_inlet_40pct');
      }
      setDebrisRestrictionFraction(0.4);
    }
  };

  const scenario = { mode, storm_id: selectedStormId, debris_id: selectedDebrisId, tailwater: selectedTailwater, model_version_id: bootstrap?.model_versions[0]?.model_version_id ?? 'taman_kyra_synthetic_v1' };
  const resultsCurrent = resultScenario === scenarioKey(scenario) + JSON.stringify(engineMode ? engineSource.getInterventions() : []);

  const currentTimestamp = frames[currentFrameIndex]?.timestamp_s ?? 0;
  // Engine Live overrides what the scene shows, without touching his `frames` state.
  const sceneFrame = liveActive ? live.frame : resultsCurrent ? frames[currentFrameIndex] || null : null;
  const sceneTimestamp = liveActive ? live.t : currentTimestamp;
  const stormIntensity = engineMode
    ? rainIntensityAt(STORMS[selectedStormId as StormId] ?? STORMS.synthetic_80mmh_60min, sceneTimestamp)
    : selectedStormId === 'synthetic_120mmh_60min' ? 120 : 80;
  const isRainActive = liveActive
    ? rainEnabled && !live.paused && stormIntensity > 0
    : engineMode
    ? rainEnabled && hasSimulationStarted && (isPlaying || isRunning) && stormIntensity > 0
    : rainEnabled && hasSimulationStarted && (isPlaying || isRunning) && currentTimestamp <= 3600;
  const shownError = liveActive && live.error ? live.error : apiError;
  const handleSelectTab = (tab: 'dashboard' | 'map' | 'assets' | 'analytics' | 'reports') => {
    setActiveTab(tab);
    setStoryOpen(false);
    setOperationsOpen(tab === 'dashboard');
    if(tab === 'dashboard') {stopLive();setIsPlaying(false);}
    if (tab === 'dashboard') {
      setWorkspaceView('priorities');
      setIsDebrisLabOpen(false);
      setSelectedAsset(null);
    } else if (tab === 'map') {
      setTwinViewMode('twin_highlight');
      setWorkspaceView(null);
    } else if (tab === 'assets') {
      setWorkspaceView(null);
      const j07 = nodes.find((n) => n.node_id === 'NODE-J07') || nodes[0];
      if (j07) {
        setSelectedAsset({ type: 'node', id: j07.node_id, data: j07 });
      }
    } else if (tab === 'analytics' || tab === 'reports') {
      setWorkspaceView(tab === 'reports' ? 'proposals' : 'compare');
    }
  };

  const handleSearch = (query: string) => {
    const q = query.trim().toUpperCase();
    if (!q) return;
    setWorkspaceView(null);
    setActiveTab('assets');
    setStoryOpen(false);
    setOperationsOpen(false);

    // Search nodes (including MH-0421 alias for NODE-J07)
    const foundNode = nodes.find(
      (n) => n.node_id.toUpperCase().includes(q) || assetLocation(n.node_id).toUpperCase().includes(q) || (q.includes('0421') && n.node_id === 'NODE-J07')
    );
    if (foundNode) {
      setSelectedAsset({ type: 'node', id: foundNode.node_id, data: foundNode });
      return;
    }

    // Search inlets
    const foundInlet = inlets.find(
      (i) => i.inlet_id.toUpperCase().includes(q) || assetLocation(i.inlet_id).toUpperCase().includes(q) || (q.includes('D07') && i.inlet_id === 'INLET-D07')
    );
    if (foundInlet) {
      setSelectedAsset({ type: 'inlet', id: foundInlet.inlet_id, data: foundInlet });
      return;
    }

    // Search conduits
    const foundConduit = conduits.find((c) => c.conduit_id.toUpperCase().includes(q) || assetLocation(c.conduit_id).toUpperCase().includes(q));
    if (foundConduit) {
      setSelectedAsset({ type: 'conduit', id: foundConduit.conduit_id, data: foundConduit });
    }
  };

  const problemScope:ProblemScope={mode,township_id:bootstrap?.township_id??'taman_kyra_demo',model_version_id:scenario.model_version_id,api_base_url:apiClient.getBaseUrl()};
  const openDemo=()=>{if(!engineMode)handleToggleMode('engine');stopLive();setIsPlaying(false);setOperationsOpen(false);setStoryOpen(true);setActiveTab('dashboard');};
  const prepareHandoff=(handoff:MaintenanceHandoff)=>{
    setStoryHandoff(handoff);
    const inlet=inlets.find(a=>a.inlet_id===handoff.asset_id);const conduit=conduits.find(a=>a.conduit_id===handoff.asset_id);const node=nodes.find(a=>a.node_id===handoff.asset_id);
    if(inlet)setSelectedAsset({type:'inlet',id:handoff.asset_id,data:inlet});
    else if(conduit)setSelectedAsset({type:'conduit',id:handoff.asset_id,data:conduit});
    else if(node)setSelectedAsset({type:'node',id:handoff.asset_id,data:node});
    setStoryOpen(false);setOperationsOpen(false);setWorkspaceView('proposals');setActiveTab('reports');
  };
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 select-none">
      {/* Top Header & Status Indicators */}
      <StatusHeader
        mode={mode}
        activeTab={activeTab}
        onToggleMode={handleToggleMode}
        appMode={appMode}
        onChangeAppMode={handleSwitchAppMode}
        onOpenInterventions={() => { setStoryOpen(false); setOperationsOpen(false); setWorkspaceView('compare'); setActiveTab('analytics'); }}
        onSelectTab={handleSelectTab}
        onSearch={handleSearch}
        health={health}
        loading={loading}
        onRefresh={loadData}
        apiError={shownError}
      />

      {/* Main 3D WebGL Digital Twin Canvas */}
      {!storyOpen && !operationsOpen && <SceneViewer
        nodes={nodes}
        inlets={inlets}
        conduits={conduits}
        currentFrame={sceneFrame}
        selectedAssetId={selectedAsset?.id}
        onSelectAsset={(asset) => {setSelectedAsset(asset);setWorkspaceView(null);setActiveTab('assets');}}
        showUndergroundOnly={twinViewMode === 'underground_only'}
        twinViewMode={twinViewMode}
        onChangeTwinViewMode={(m) => setTwinViewMode(m)}
        xray={xray}
        viewDim={viewDim}
        onChangeViewDim={setViewDim}
        onToggleXray={() => setXray((v) => !v)}
        isRainActive={isRainActive}
        rainEnabled={rainEnabled}
        hasSimulationStarted={hasSimulationStarted}
        onToggleRain={() => setRainEnabled(!rainEnabled)}
        stormIntensityMmh={stormIntensity}
        onOpenDebrisLab={engineMode ? undefined : () => setIsDebrisLabOpen(true)}
        isDebrisLabOpen={isDebrisLabOpen}
        appMode={appMode}
        engineDepth={liveActive ? live.depth : engineMode ? engineSource.surfaceAt(engineRunId, currentTimestamp) : undefined}
      />}

      {/* Selected Asset Details Drawer with Live Site Photos, CCTV, and Blockage Slider */}
      {!storyOpen && !operationsOpen && !workspaceView && <AssetDetailModal
        selectedAsset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        inspections={inspections}
        onOpenInspect={(assetId) => setInspectingAssetId(assetId)}
        onOpenInterventions={() => { setWorkspaceView('compare'); setActiveTab('analytics'); }}
        currentFrame={sceneFrame}
        blockageFraction={
          selectedAsset
            ? customBlockages[selectedAsset.id] ?? 0.0
            : customBlockages['NODE-J07'] ?? 0.4
        }
        onUpdateBlockage={handleUpdateBlockage}
        hideBlockageTuning={engineMode}
      />}

      {/* Simulation HUD (Timeline, Storm/Debris Selectors, Metrics, Legend) */}
      {bootstrap && !storyOpen && !operationsOpen && !workspaceView && (
        <div className={`map-hud ${selectedAsset ? 'asset-open' : ''}`}><SimulationHUD
          storms={bootstrap.storms}
          selectedStormId={selectedStormId}
          onSelectStorm={(id) => {
            setSelectedStormId(id);
            if (liveActive) startLive(id);
          }}
          debrisScenarios={bootstrap.debris_scenarios}
          selectedDebrisId={selectedDebrisId}
          onSelectDebris={(id) => {
            setSelectedDebrisId(id);
            if (liveActive) startLive(selectedStormId, id);
          }}
          tailwaterCases={bootstrap.tailwater_cases}
          selectedTailwater={selectedTailwater}
          onSelectTailwater={(id) => {
            setSelectedTailwater(id);
            if (liveActive) startLive(selectedStormId, selectedDebrisId, id);
          }}
          onRunSimulation={handleRunSimulation}
          onLoadVerifiedRun={engineMode ? () => {} : handleLoadVerifiedRun}
          hideVerifiedRun={mode !== 'mock'}
          engineStorms={engineMode ? bootstrap.storms.map((st) => ({ id: st.storm_id, label: st.name })) : undefined}
          intensityMmh={engineMode ? stormIntensity : undefined}
          liveAvailable={engineMode}
          liveOn={live.on}
          onToggleLive={handleToggleLive}
          liveSpeed={live.speed}
          onLiveSpeed={live.setSpeed}
          livePaused={live.paused}
          onLivePause={live.togglePause}
          onLiveSeek={live.seek}
          liveTimeS={live.t}
          isRunning={isRunning}
          runProgressMessage={runProgressMessage}
          hasSimulationStarted={hasSimulationStarted}
          onStartSimulation={handleStartSimulation}
          isPlaying={isPlaying}
          onTogglePlay={handleTogglePlay}
          onResetSimulation={handleResetSimulation}
          frames={frames}
        currentFrameIndex={currentFrameIndex}
          onSeekFrame={(idx) => setCurrentFrameIndex(idx)}
          metrics={resultsCurrent ? metrics : null}
          undergroundOnly={twinViewMode === 'underground_only'}
          onToggleUnderground={() =>
            setTwinViewMode((prev) => (prev === 'underground_only' ? 'twin_highlight' : 'underground_only'))
          }
          twinViewMode={twinViewMode}
          onSelectTwinViewMode={(m) => setTwinViewMode(m)}
          isRainActive={isRainActive}
          rainEnabled={rainEnabled}
          onToggleRain={() => setRainEnabled(!rainEnabled)}
          onOpenDebrisLab={() => setIsDebrisLabOpen(true)}
          engineMode={engineMode}
          appliedOptionTitle={
            engineMode
              ? appliedOptionId === 'baseline'
                ? 'Baseline'
                : OPTIONS.find((o) => o.id === appliedOptionId)?.title ?? appliedOptionId
              : undefined
          }
          onOpenInspect={() => setInspectingAssetId('NODE-J07')}
          appMode={appMode}
          onChangeAppMode={handleSwitchAppMode}
        /></div>
      )}

      {/* J3: Virtual Debris Lab (Close-up modal for INLET-D07) */}
      {!storyOpen && !operationsOpen && !engineMode && isDebrisLabOpen && (
        <VirtualDebrisLab
          inletId="INLET-D07"
          onClose={() => setIsDebrisLabOpen(false)}
          inspections={inspections}
          onOpenNewInspection={() => {
            setIsDebrisLabOpen(false);
            setInspectingAssetId('INLET-D07');
          }}
          currentHypothesisFraction={debrisRestrictionFraction}
          onSelectHypothesis={handleSelectHypothesis}
        />
      )}

      {/* Field Inspection Logging Modal */}
      {inspectingAssetId && (
        <InspectionModal
          assetId={inspectingAssetId}
          onClose={() => setInspectingAssetId(null)}
          onSubmit={handleCreateInspection}
        />
      )}

      <OperationsDashboard key={scopeKey(problemScope)} visible={operationsOpen} scope={problemScope} nodes={nodes} inlets={inlets} conduits={conduits} inspections={inspections}
        modelVerified={bootstrap?.model_versions.find(m=>m.model_version_id===scenario.model_version_id)?.is_verified_site_model===true} assetsLoading={loading} dataError={apiError}
        onDemo={openDemo} onMaintenance={()=>{setOperationsOpen(false);setStoryOpen(false);setWorkspaceView('priorities');setActiveTab('dashboard');}}
        onLocate={asset=>{stopLive();setIsPlaying(false);setSelectedAsset(asset);setOperationsOpen(false);setStoryOpen(false);setWorkspaceView(null);setActiveTab('assets');}}
        onInspect={setInspectingAssetId} onPrepare={prepareHandoff}/>
      <GuidedStory visible={storyOpen && engineMode} scenario={scenario} bootstrap={bootstrap} inspections={inspections}
        onChangeScenario={(field,value)=>{stopLive();setIsPlaying(false);if(field==='storm_id')setSelectedStormId(value);else if(field==='debris_id')setSelectedDebrisId(value);else setSelectedTailwater(value);}}
        onMaintenance={()=>{setStoryOpen(false);setOperationsOpen(true);setWorkspaceView(null);setActiveTab('dashboard');}}
        onInspect={()=>setInspectingAssetId('INLET-D07')}
        onPrepare={prepareHandoff}/>
      <MaintenanceWorkspace view={storyOpen || operationsOpen ? null : workspaceView} onView={setWorkspaceView} nodes={nodes} inlets={inlets} conduits={conduits}
        handoff={storyHandoff} onOpenStory={openDemo}
        inspections={inspections} selectedAsset={selectedAsset} onSelectAsset={setSelectedAsset}
        onInspect={setInspectingAssetId} scenario={scenario} bootstrap={bootstrap} previewBusy={isRunning}
        onPreview={async (optionId, runId) => {
          if(isRunning) throw new Error('Wait for the current map simulation to finish.');
          stopLive(); setIsPlaying(false); setResultScenario(null);
          if(engineMode) {
            const option=OPTIONS.find(o=>o.id===optionId); if(!option) throw new Error('Unknown option.');
            engineSource.setInterventions(option.interventions); setAppliedOptionId(optionId);
            const a=await apiClient.getTownshipAssets('taman_kyra_demo'); setNodes(a.nodes);setConduits(a.conduits);
            setSelectedAsset(previous => {
              if(!previous) return null;
              const data=previous.type === 'node' ? a.nodes.find(n=>n.node_id===previous.id) : previous.type === 'inlet' ? a.inlets.find(i=>i.inlet_id===previous.id) : a.conduits.find(c=>c.conduit_id===previous.id);
              return data ? {...previous,data} : null;
            });
            setWorkspaceView(null);setActiveTab('map');void handleRunSimulation();
          } else if(mode === 'api' && runId) {
            setAppliedOptionId(optionId);
            const [run, f, m, b]=await Promise.all([apiClient.getSimulation(runId),apiClient.getSimulationFrames(runId),apiClient.getSimulationMetrics(runId),apiClient.getBootstrap()]);
            const candidateAssets=run.input_snapshot?.assets as TownshipAssetsResponse|undefined;
            if(candidateAssets){setNodes(candidateAssets.nodes);setInlets(candidateAssets.inlets);setConduits(candidateAssets.conduits);setSelectedAsset(previous=>{
              if(!previous)return null;
              const data=previous.type==='node'?candidateAssets.nodes.find(n=>n.node_id===previous.id):previous.type==='inlet'?candidateAssets.inlets.find(i=>i.inlet_id===previous.id):candidateAssets.conduits.find(p=>p.conduit_id===previous.id);
              return data?{...previous,data}:null;
            });}
            const debris=run.debris_scenario_id ?? selectedDebrisId;
            setSelectedDebrisId(debris);setBootstrap(b);setFrames(f.frames);setMetrics(m);setCurrentFrameIndex(0);
            setResultScenario(scenarioKey({...scenario,debris_id:debris})+'[]');setHasSimulationStarted(true);
            setWorkspaceView(null);setActiveTab('map');
          }
        }}
        onScenarioChange={(field, value) => {
          setIsPlaying(false); setHasSimulationStarted(false); stopLive();
          if(field === 'storm_id') setSelectedStormId(value);
          else if(field === 'debris_id') setSelectedDebrisId(value);
          else setSelectedTailwater(value);
        }}/>
      {!storyOpen && !operationsOpen && <div className="data-provenance">
        <b>Illustrative dataset | uncalibrated site model</b>
        <span>{mode === 'engine' ? 'Simulation: FloodOps browser engine' : mode === 'api' ? 'Simulation: EPA SWMM API' : 'Offline demo replay'}</span>
        <span>Evidence: {inspections.length ? `${inspections.filter(i=>i.source_type==='observed').length} observed / ${inspections.length} records` : 'Missing'}</span>
        <span>Costs: user estimates / quotes</span>
        {metrics && <span>Displayed results: {metrics.engine} | {metrics.run_id} {resultsCurrent ? '' : '(outdated settings)'}</span>}
        {metrics && resultsCurrent && <span>Action: {OPTIONS.find(option=>option.id===appliedOptionId)?.title??appliedOptionId}</span>}
      </div>}

    </div>
  );
}

export function App() {
  const [demo,setDemo]=useState(false);
  return demo ? <><LegacyApp/><button className="site-return-button" onClick={()=>setDemo(false)}>Back to uploaded projects</button></> : <SitePortal onDemo={()=>setDemo(true)}/>;
}
export default App;
