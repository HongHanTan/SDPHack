import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  FieldInspector,
  ConduitStatus,
  NodeStatus,
} from './types';
import { StatusHeader } from './components/StatusHeader';
import { SceneViewer } from './components/SceneViewer';
import { AssetDetailModal } from './components/AssetDetailModal';
import { SimulationHUD } from './components/SimulationHUD';
import { InspectionModal } from './components/InspectionModal';
import { VirtualDebrisLab } from './components/VirtualDebrisLab';
import { InterventionDashboard } from './components/InterventionDashboard';
import { LiveTelemetryTicker } from './components/LiveTelemetryTicker';
import { SiteImportPanel } from './site/SiteImportPanel';
import { engineSource } from './engine/engineSource';
import { useLiveEngine } from './engine/useLiveEngine';
import { buildDashboardOptions, idsForOption } from './engine/dashboardOptions';
import { TAMAN_KYRA, type SiteSpec } from '@floodops/engine/scenario/site';
import { baseTownship } from '@floodops/engine/scenario/index';
import { rainIntensityAt, STORMS, type StormId } from '@floodops/engine/scenario/storms';

export function App() {
  const [mode, setMode] = useState<DataMode>(apiClient.getDataMode());
  const engineMode = mode === 'engine';
  const live = useLiveEngine();
  const [site, setSiteState] = useState<SiteSpec>(TAMAN_KYRA);
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
    apiClient.getDataMode() === 'engine' ? 'engine_d07_40pct' : 'demo_inlet_clean'
  );
  const [selectedTailwater, setSelectedTailwater] = useState<string>('normal');

  // J4: Intervention Dashboard state
  const [isInterventionDashboardOpen, setIsInterventionDashboardOpen] = useState<boolean>(false);

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
  const [isSiteImportOpen, setIsSiteImportOpen] = useState(false);
  const [rainEnabled, setRainEnabled] = useState<boolean>(true);

  // J3: Virtual Debris Lab states
  const [isDebrisLabOpen, setIsDebrisLabOpen] = useState<boolean>(false);
  const [debrisRestrictionFraction, setDebrisRestrictionFraction] = useState<number>(0.4);

  // Dynamic blockage customization per pipe/node
  const [customBlockages, setCustomBlockages] = useState<Record<string, number>>({
    'PIPE-P07': 0.4,
    'INLET-D07': 0.4,
  });
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);

  // Loading & error state
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Run token: each run takes the next number; a newer run, a mode switch or unmount makes older poll loops stale.
  const runTokenRef = useRef<number>(0);
  // Engine mode: the run whose frames are shown (its depth grids feed the water surface), and the applied dashboard option.
  const [engineRunId, setEngineRunId] = useState<string | null>(null);
  const [appliedOptionId, setAppliedOptionId] = useState<string>('baseline');

  // Load foundational data (assets, bootstrap, health)
  const loadData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [h, b, a] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getBootstrap(),
        apiClient.getTownshipAssets('taman_kyra_demo'),
      ]);

      setHealth(h);
      setBootstrap(b);
      setNodes(a.nodes);
      setInlets(a.inlets);
      setConduits(a.conduits);

      // In API mode, only call /api/inspections if backend capability is true (T2 has it as false)
      const inspRes = await apiClient.getInspections();
      setInspections(inspRes.items);

      if (mode !== 'engine') {
        // Load initial offline verified SWMM 5.2.4 run
        const offlineFrames = apiClient.getOfflineFrames(selectedStormId);
        const offlineMetrics = apiClient.getOfflineMetrics(selectedStormId);
        setFrames(offlineFrames.frames);
        setMetrics(offlineMetrics);
      } else {
        setFrames([]);
        setMetrics(null);
      }
    } catch (err: unknown) {
      console.error('Failed to load foundational data:', err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedStormId, mode]);

  useEffect(() => {
    loadData();
    return () => {
      runTokenRef.current++;
    };
  }, [loadData, mode]);

  // Engine Live: one continuous storm in a worker with the current scenario settings.
  const startLive = (stormId: string, debrisId = selectedDebrisId, tailwater = selectedTailwater) => {
    live.start(stormId as StormId, engineSource.getInterventions(), {
      tailwater: tailwater === 'high' ? 'high' : 'normal',
      blockage: engineSource.blockageForDebris(debrisId),
      site: engineSource.getSite(),
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

  /** Switches the engine's active site (null = built-in) and resets everything derived from the previous one. */
  const applySite = (s: SiteSpec | null) => {
    if (s) {
      // Belt and braces: an imported site that cannot be built keeps the current site instead of blanking the app.
      try {
        baseTownship({}, s);
      } catch (err) {
        setApiError(`The site could not be built: ${err instanceof Error ? err.message : String(err)}`);
        return;
      }
    }
    runTokenRef.current++;
    setIsRunning(false);
    setRunProgressMessage('');
    setApiError(null);
    stopLive();
    engineSource.setSite(s);
    setSiteState(engineSource.getSite());
    setViewDim('3d');
    setAppliedOptionId('baseline');
    setFrames([]);
    setMetrics(null);
    setEngineRunId(null);
    setHasSimulationStarted(false);
    setIsPlaying(false);
    setCurrentFrameIndex(0);
    setSelectedDebrisId('engine_d07_40pct');
    void loadData();
  };

  const handleToggleMode = (newMode: DataMode) => {
    runTokenRef.current++;
    setIsRunning(false);
    setRunProgressMessage('');
    if (newMode !== 'engine') stopLive();
    apiClient.setDataMode(newMode);
    setMode(newMode);
    if (newMode === 'engine') {
      setSelectedDebrisId('engine_d07_40pct');
      // Entering engine mode starts from the baseline network (loadData reloads the assets).
      engineSource.setInterventions([]);
      setAppliedOptionId('baseline');
      setEngineRunId(null);
    } else if (mode === 'engine') {
      setSelectedDebrisId('demo_inlet_clean');
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
  };

  // Unified simulation start and playback controls
  const handleStartSimulation = () => {
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
    setHasSimulationStarted(true);
    setIsPlaying(true);
    setIsRunning(true);
    setApiError(null);
    setRunProgressMessage('Submitting hydraulic simulation job...');
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
    if (file) {
      try {
        const media = await apiClient.uploadInspectionMedia(saved.inspection_id, file);
        saved.media = [media, ...(saved.media || [])];
        saved.media_urls = [media.url, ...(saved.media_urls || [])];
      } catch (uploadErr) {
        console.error('Failed to upload inspection media:', uploadErr);
      }
    }
    setInspections((prev) => [saved, ...prev]);
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

  // Dynamic blockage tuning & real-time hydraulic simulation recalculation
  const handleUpdateBlockage = (assetId: string, fraction: number) => {
    setCustomBlockages((prev) => ({ ...prev, [assetId]: fraction }));
    if (engineMode) return;

    if (assetId === 'INLET-D07' || assetId === 'NODE-J07') {
      setDebrisRestrictionFraction(fraction);
    }

    // Dynamic hydraulic recalculation on simulation frames and metrics
    setFrames((prevFrames) => {
      return prevFrames.map((frame) => {
        const nextFrame = { ...frame };

        // 1. Throttling pipe states
        nextFrame.pipe_states = nextFrame.pipe_states.map((ps) => {
          const pipeBlockage =
            assetId === ps.conduit_id
              ? fraction
              : customBlockages[ps.conduit_id] ?? 0;
          if (pipeBlockage > 0) {
            const throttledCapacity = 1.6 * Math.max(0.08, 1 - pipeBlockage);
            const throttledFlow = Math.min(ps.flow_m3s, throttledCapacity);
            const utilization = throttledFlow / throttledCapacity;
            const newStatus: ConduitStatus =
              utilization >= 0.92 || pipeBlockage >= 0.55
                ? 'surcharged'
                : utilization >= 0.72 || pipeBlockage >= 0.25
                ? 'near_capacity'
                : 'normal';
            return {
              ...ps,
              flow_m3s: throttledFlow,
              status: newStatus,
              capacity_fraction: utilization,
            };
          }
          return ps;
        });

        // 2. Upstream node surcharge & depth rise
        nextFrame.node_states = nextFrame.node_states.map((ns) => {
          const isTargetNode = ns.node_id === assetId;
          const isUpstreamOfP07 =
            ns.node_id === 'NODE-J07' &&
            (assetId === 'PIPE-P07' || assetId === 'NODE-J07');
          if (isTargetNode || isUpstreamOfP07) {
            const headBuildup = fraction * 0.45;
            const newDepth = Math.max(0.3, ns.depth_m + headBuildup);
            const isFlooding = newDepth >= 1.45 || fraction >= 0.5;
            const isSurcharged = newDepth >= 1.2 || fraction >= 0.25;
            const newStatus: NodeStatus = isFlooding
              ? 'flooding'
              : isSurcharged
              ? 'surcharged'
              : 'normal';
            return {
              ...ns,
              depth_m: newDepth,
              status: newStatus,
              surcharge_flag: isSurcharged,
              flooding_rate_m3s: isFlooding ? fraction * 0.45 : 0,
            };
          }
          return ns;
        });

        // 3. Inlet clogging
        if (assetId.startsWith('INLET') || assetId === 'NODE-J07') {
          nextFrame.inlet_states = nextFrame.inlet_states.map((is) => {
            if (is.inlet_id === 'INLET-D07' || is.inlet_id === assetId) {
              return {
                ...is,
                hydraulic_inlet_clogging_fraction: fraction,
              };
            }
            return is;
          });
        }

        return nextFrame;
      });
    });

    // Update metrics
    setMetrics((prev) => {
      if (!prev) return prev;
      const additionalFloodM3 = fraction >= 0.35 ? fraction * 220 : 0;
      return {
        ...prev,
        total_flooding_volume_m3: Math.max(
          prev.total_flooding_volume_m3,
          additionalFloodM3
        ),
        flooded_node_count:
          fraction >= 0.5 ? Math.max(2, prev.flooded_node_count) : prev.flooded_node_count,
        surcharge_duration_s:
          fraction >= 0.25
            ? Math.max(3200, prev.surcharge_duration_s)
            : prev.surcharge_duration_s,
      };
    });
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
      // Idle mode: calm clear weather, field patrol inspection active, live telemetry streaming
      setRainEnabled(false);
      if (!engineMode) handleLoadVerifiedRun('synthetic_80mmh_60min');
    } else if (newMode === 'diagnose') {
      // Historical diagnosis: focus on INLET-D07 restriction under baseline event
      setRainEnabled(true);
      if (!engineMode) {
        handleLoadVerifiedRun('synthetic_80mmh_60min');
        setSelectedDebrisId('demo_inlet_40pct');
      }
      setDebrisRestrictionFraction(0.4);
    } else {
      // Forward anticipation: projected 120 mm/h monsoon storm with antecedent blockage
      setRainEnabled(true);
      if (!engineMode) {
        handleLoadVerifiedRun('synthetic_120mmh_60min');
        setSelectedDebrisId('demo_inlet_40pct');
      }
      setDebrisRestrictionFraction(0.4);
    }
  };

  // Field Inspector & Asset Focus Handlers
  const handleSelectInspector = (inspector: FieldInspector) => {
    setSelectedInspectorId(inspector.id);
    handleSelectInspectorAsset(inspector.assignedAssetId);
  };

  const handleSelectInspectorAsset = (targetId: string) => {
    if (targetId.startsWith('INLET')) {
      const inlet = inlets.find((i) => i.inlet_id === targetId);
      if (inlet) setSelectedAsset({ type: 'inlet', id: inlet.inlet_id, data: inlet });
    } else if (targetId.startsWith('PIPE')) {
      const pipe = conduits.find((c) => c.conduit_id === targetId);
      if (pipe) setSelectedAsset({ type: 'conduit', id: pipe.conduit_id, data: pipe });
    } else {
      const node = nodes.find((n) => n.node_id === targetId);
      if (node) setSelectedAsset({ type: 'node', id: node.node_id, data: node });
    }
  };

  // J4: Handle applying an intervention candidate
  const handleApplyIntervention = async (interventionId: string) => {
    if (engineMode) {
      if (isRunning && !live.on) {
        setApiError('A simulation is still running; apply the option when it finishes.');
        return;
      }
      const ids = idsForOption(interventionId);
      engineSource.setInterventions(ids);
      setAppliedOptionId(interventionId);
      try {
        const a = await apiClient.getTownshipAssets('taman_kyra_demo');
        setNodes(a.nodes);
        setConduits(a.conduits);
      } catch (err: unknown) {
        setApiError(err instanceof Error ? err.message : String(err));
        return;
      }
      setIsInterventionDashboardOpen(false);
      if (live.on) live.patch(ids, interventionId);
      else void handleRunSimulation();
      return;
    }
    if (interventionId === 'clean_inlet') {
      setDebrisRestrictionFraction(0.0);
      setSelectedDebrisId('demo_inlet_clean');
      handleLoadVerifiedRun(selectedStormId);
    } else if (interventionId === 'baseline') {
      setDebrisRestrictionFraction(0.4);
      setSelectedDebrisId('demo_inlet_40pct');
      handleLoadVerifiedRun(selectedStormId);
      // Reset conduit diameter
      setConduits((prev) =>
        prev.map((c) =>
          c.conduit_id === 'PIPE-P07' ? { ...c, diameter_m: 0.6 } : c
        )
      );
    } else if (interventionId === 'upsize_conduit') {
      setDebrisRestrictionFraction(0.4);
      setSelectedDebrisId('demo_inlet_40pct');
      // Upsize PIPE-P07 from 600mm to 750mm
      setConduits((prev) =>
        prev.map((c) =>
          c.conduit_id === 'PIPE-P07' ? { ...c, diameter_m: 0.75 } : c
        )
      );
    } else if (interventionId === 'combined') {
      setDebrisRestrictionFraction(0.0);
      setSelectedDebrisId('demo_inlet_clean');
      setConduits((prev) =>
        prev.map((c) =>
          c.conduit_id === 'PIPE-P07' ? { ...c, diameter_m: 0.75 } : c
        )
      );
      handleLoadVerifiedRun(selectedStormId);
    }
  };

  const currentTimestamp = frames[currentFrameIndex]?.timestamp_s ?? 0;
  // Engine Live overrides what the scene shows, without touching his `frames` state.
  const sceneFrame = liveActive ? live.frame : frames[currentFrameIndex] || null;
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
  const engineOptions = useMemo(
    () => (engineMode && site.builtIn ? buildDashboardOptions(selectedStormId as StormId) : undefined),
    [engineMode, site, selectedStormId]
  );

  const handleSelectTab = (tab: 'dashboard' | 'map' | 'assets' | 'analytics' | 'reports') => {
    if (tab === 'dashboard') {
      setIsInterventionDashboardOpen(false);
      setIsDebrisLabOpen(false);
      setSelectedAsset(null);
    } else if (tab === 'map') {
      setTwinViewMode('twin_highlight');
      setIsInterventionDashboardOpen(false);
    } else if (tab === 'assets') {
      const j07 = nodes.find((n) => n.node_id === 'NODE-J07') || nodes[0];
      if (j07) {
        setSelectedAsset({ type: 'node', id: j07.node_id, data: j07 });
      }
    } else if (tab === 'analytics' || tab === 'reports') {
      setIsInterventionDashboardOpen(true);
    }
  };

  const handleSearch = (query: string) => {
    const q = query.trim().toUpperCase();
    if (!q) return;

    // Search nodes (including MH-0421 alias for NODE-J07)
    const foundNode = nodes.find(
      (n) => n.node_id.toUpperCase().includes(q) || (q.includes('0421') && n.node_id === 'NODE-J07')
    );
    if (foundNode) {
      setSelectedAsset({ type: 'node', id: foundNode.node_id, data: foundNode });
      return;
    }

    // Search inlets
    const foundInlet = inlets.find(
      (i) => i.inlet_id.toUpperCase().includes(q) || (q.includes('D07') && i.inlet_id === 'INLET-D07')
    );
    if (foundInlet) {
      setSelectedAsset({ type: 'inlet', id: foundInlet.inlet_id, data: foundInlet });
      return;
    }

    // Search conduits
    const foundConduit = conduits.find((c) => c.conduit_id.toUpperCase().includes(q));
    if (foundConduit) {
      setSelectedAsset({ type: 'conduit', id: foundConduit.conduit_id, data: foundConduit });
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 select-none">
      {/* Top Header & Status Indicators */}
      <StatusHeader
        mode={mode}
        onToggleMode={handleToggleMode}
        appMode={appMode}
        onChangeAppMode={handleSwitchAppMode}
        onOpenInterventions={() => setIsInterventionDashboardOpen(true)}
        onSelectTab={handleSelectTab}
        onSearch={handleSearch}
        health={health}
        loading={loading}
        onRefresh={loadData}
        onOpenSiteImport={engineMode ? () => setIsSiteImportOpen(true) : undefined}
        apiError={shownError}
      />

      {/* Main 3D WebGL Digital Twin Canvas */}
      <SceneViewer
        nodes={nodes}
        inlets={inlets}
        conduits={conduits}
        currentFrame={sceneFrame}
        selectedAssetId={selectedAsset?.id}
        onSelectAsset={(asset) => setSelectedAsset(asset)}
        showUndergroundOnly={twinViewMode === 'underground_only'}
        twinViewMode={twinViewMode}
        onChangeTwinViewMode={(m) => setTwinViewMode(m)}
        xray={xray}
        viewDim={viewDim}
        onChangeViewDim={setViewDim}
        site={site}
        onToggleXray={() => setXray((v) => !v)}
        isRainActive={isRainActive}
        rainEnabled={rainEnabled}
        hasSimulationStarted={hasSimulationStarted}
        onToggleRain={() => setRainEnabled(!rainEnabled)}
        stormIntensityMmh={stormIntensity}
        onOpenDebrisLab={engineMode ? undefined : () => setIsDebrisLabOpen(true)}
        isDebrisLabOpen={isDebrisLabOpen}
        appMode={appMode}
        onSelectInspector={handleSelectInspector}
        selectedInspectorId={selectedInspectorId}
        showInspectors={!engineMode}
        engineDepth={liveActive ? live.depth : engineMode ? engineSource.surfaceAt(engineRunId, currentTimestamp) : undefined}
      />

      {/* Selected Asset Details Drawer with Live Site Photos, CCTV, and Blockage Slider */}
      <AssetDetailModal
        selectedAsset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        inspections={inspections}
        onOpenInspect={(assetId) => setInspectingAssetId(assetId)}
        onOpenInterventions={() => setIsInterventionDashboardOpen(true)}
        currentFrame={sceneFrame}
        blockageFraction={
          selectedAsset
            ? customBlockages[selectedAsset.id] ?? 0.0
            : customBlockages['NODE-J07'] ?? 0.4
        }
        onUpdateBlockage={handleUpdateBlockage}
        hideBlockageTuning={engineMode}
      />

      {/* Real-time Field Telemetry Stream (Intelligent non-overlapping layout) */}
      <LiveTelemetryTicker
        onSelectInspectorAsset={handleSelectInspectorAsset}
        isIdleMode={appMode === 'idle'}
        isAssetSelected={selectedAsset !== null}
      />

      {/* Simulation HUD (Timeline, Storm/Debris Selectors, Metrics, Legend) */}
      {bootstrap && (
        <SimulationHUD
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
          hideVerifiedRun={engineMode}
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
          metrics={metrics}
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
          hotspotLabel={engineMode && !site.builtIn ? `Hotspot (${site.hotspotNodeId})` : undefined}
          appliedOptionTitle={
            engineMode
              ? appliedOptionId === 'baseline'
                ? 'Baseline'
                : engineOptions?.find((o) => o.id === appliedOptionId)?.title.replace(/^Option \d+: /, '') ?? appliedOptionId
              : undefined
          }
          onOpenInspect={() => setInspectingAssetId('NODE-J07')}
          appMode={appMode}
          onChangeAppMode={handleSwitchAppMode}
        />
      )}

      {/* J3: Virtual Debris Lab (Close-up modal for INLET-D07) */}
      {engineMode && isSiteImportOpen && (
        <SiteImportPanel activeSite={site} onApply={applySite} onReset={() => applySite(null)} onClose={() => setIsSiteImportOpen(false)} />
      )}

      {!engineMode && isDebrisLabOpen && (
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
      {!engineMode && inspectingAssetId && (
        <InspectionModal
          assetId={inspectingAssetId}
          onClose={() => setInspectingAssetId(null)}
          onSubmit={handleCreateInspection}
        />
      )}

      {/* J4: Interventions Comparison Dashboard & Proposed Action Plan Modal */}
      {isInterventionDashboardOpen && (
        <InterventionDashboard
          onClose={() => setIsInterventionDashboardOpen(false)}
          onApplyIntervention={handleApplyIntervention}
          inspections={inspections}
          engineOptions={engineOptions}
          engineNotice={
            engineMode && !site.builtIn
              ? 'Intervention comparison is available for the built-in township. For an uploaded site, edit the files and re-upload to compare designs.'
              : undefined
          }
          engineStormLabel={STORMS[selectedStormId as StormId]?.label}
          applyDisabled={engineMode && isRunning && !live.on}
        />
      )}
    </div>
  );
}

export default App;
