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
} from './types';
import { StatusHeader } from './components/StatusHeader';
import { SceneViewer } from './components/SceneViewer';
import { AssetDetailModal } from './components/AssetDetailModal';
import { SimulationHUD } from './components/SimulationHUD';
import { InspectionModal } from './components/InspectionModal';
import { VirtualDebrisLab } from './components/VirtualDebrisLab';
import { InterventionDashboard } from './components/InterventionDashboard';

export function App() {
  const [mode, setMode] = useState<DataMode>(apiClient.getDataMode());
  const [appMode, setAppMode] = useState<AppMode>('diagnose');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [nodes, setNodes] = useState<AssetNode[]>([]);
  const [inlets, setInlets] = useState<AssetInlet[]>([]);
  const [conduits, setConduits] = useState<AssetConduit[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);

  // Simulation scenario parameters
  const [selectedStormId, setSelectedStormId] = useState<string>('synthetic_80mmh_60min');
  const [selectedDebrisId, setSelectedDebrisId] = useState<string>('demo_inlet_clean');
  const [selectedTailwater, setSelectedTailwater] = useState<string>('normal');

  // J4: Intervention Dashboard state
  const [isInterventionDashboardOpen, setIsInterventionDashboardOpen] = useState<boolean>(false);

  // Simulation execution & playback
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runProgressMessage, setRunProgressMessage] = useState<string>('');
  const [frames, setFrames] = useState<SimulationFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(29); // near t=1800s (frame 30)
  const [metrics, setMetrics] = useState<SimulationMetricsResponse | null>(null);

  // Asset selection & modal states
  const [selectedAsset, setSelectedAsset] = useState<{
    type: 'node' | 'inlet' | 'conduit';
    id: string;
    data: unknown;
  } | null>(null);
  const [inspectingAssetId, setInspectingAssetId] = useState<string | null>(null);
  const [twinViewMode, setTwinViewMode] = useState<TwinViewMode>('twin_highlight');
  const [rainEnabled, setRainEnabled] = useState<boolean>(true);

  // J3: Virtual Debris Lab states
  const [isDebrisLabOpen, setIsDebrisLabOpen] = useState<boolean>(false);
  const [debrisRestrictionFraction, setDebrisRestrictionFraction] = useState<number>(0.4);

  // Loading & error state
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Ref to cancel ongoing poll loops when switching modes or unmounting
  const activePollRef = useRef<boolean>(false);

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

      // Load initial offline verified SWMM 5.2.4 run
      const offlineFrames = apiClient.getOfflineFrames(selectedStormId);
      const offlineMetrics = apiClient.getOfflineMetrics(selectedStormId);
      setFrames(offlineFrames.frames);
      setMetrics(offlineMetrics);
    } catch (err: unknown) {
      console.error('Failed to load foundational data:', err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedStormId]);

  useEffect(() => {
    loadData();
    return () => {
      activePollRef.current = false;
    };
  }, [loadData, mode]);

  const handleToggleMode = (newMode: DataMode) => {
    activePollRef.current = false;
    apiClient.setDataMode(newMode);
    setMode(newMode);
  };

  // Explicit switch between verified offline SWMM 5.2.4 runs
  const handleLoadVerifiedRun = (stormId: string) => {
    setSelectedStormId(stormId);
    const offlineFrames = apiClient.getOfflineFrames(stormId);
    const offlineMetrics = apiClient.getOfflineMetrics(stormId);
    setFrames(offlineFrames.frames);
    setMetrics(offlineMetrics);
    setCurrentFrameIndex(29); // peak frame
  };

  // Run Simulation handler (with T2 polling support)
  const handleRunSimulation = async () => {
    setIsRunning(true);
    setApiError(null);
    setRunProgressMessage('提交水力求解任务...');
    activePollRef.current = true;

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
      setRunProgressMessage(`Run ${run_id.slice(0, 8)}... 排队中 (queued)`);

      // Poll until succeeded or failed
      let currentStatus = initialStatus;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 800ms = 48s max poll

      while (activePollRef.current && (currentStatus === 'queued' || currentStatus === 'running')) {
        attempts++;
        if (attempts > maxAttempts) {
          throw new Error('Simulation polling timed out after 48 seconds.');
        }

        await new Promise((r) => setTimeout(r, 800));
        if (!activePollRef.current) return;

        try {
          const run = await apiClient.getSimulation(run_id);
          currentStatus = run.status;
          setRunProgressMessage(
            `EPA SWMM 求解中 (${run.status})... [${attempts * 0.8}s]`
          );

          if (run.status === 'failed') {
            const msg = run.error?.message || 'SWMM calculation failed.';
            throw new Error(`[SIMULATION_FAILED] ${msg}`);
          }
        } catch (pollErr: unknown) {
          // If 409 RESULTS_NOT_READY, continue polling
          const errStr = String(pollErr);
          if (errStr.includes('RESULTS_NOT_READY') || errStr.includes('409')) {
            continue;
          }
          throw pollErr;
        }
      }

      if (currentStatus === 'succeeded') {
        setRunProgressMessage('拉取真实模拟帧与指标...');
        const [newFrames, newMetrics] = await Promise.all([
          apiClient.getSimulationFrames(run_id),
          apiClient.getSimulationMetrics(run_id),
        ]);

        setFrames(newFrames.frames);
        setMetrics(newMetrics);
        setCurrentFrameIndex(0);
      }
    } catch (err: unknown) {
      console.error('Simulation execution failed:', err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
      setRunProgressMessage('');
      activePollRef.current = false;
    }
  };

  const handleCreateInspection = async (record: Partial<InspectionRecord>) => {
    const saved = await apiClient.createInspection(record);
    setInspections((prev) => [saved, ...prev]);
  };

  // J3: Handle hypothesis update from Virtual Debris Lab
  const handleSelectHypothesis = (fraction: number) => {
    setDebrisRestrictionFraction(fraction);
    // Find matching debris preset or update current choice
    if (fraction === 0.0) {
      setSelectedDebrisId('demo_inlet_clean');
    } else {
      setSelectedDebrisId('demo_inlet_40pct');
    }
  };

  // J4: Handle workflow mode switch (Diagnose vs Anticipate)
  const handleSwitchAppMode = (newMode: AppMode) => {
    setAppMode(newMode);
    if (newMode === 'diagnose') {
      // Historical diagnosis: focus on INLET-D07 restriction under baseline event
      handleLoadVerifiedRun('synthetic_80mmh_60min');
      setSelectedDebrisId('demo_inlet_40pct');
      setDebrisRestrictionFraction(0.4);
    } else {
      // Forward anticipation: projected 120 mm/h monsoon storm with antecedent blockage
      handleLoadVerifiedRun('synthetic_120mmh_60min');
      setSelectedDebrisId('demo_inlet_40pct');
      setDebrisRestrictionFraction(0.4);
    }
  };

  // J4: Handle applying an intervention candidate
  const handleApplyIntervention = (interventionId: string) => {
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

  const stormIntensity = selectedStormId === 'synthetic_120mmh_60min' ? 120 : 80;
  const currentTimestamp = frames[currentFrameIndex]?.timestamp_s ?? 0;
  const isRainActive = rainEnabled && (currentTimestamp <= 3600 || isRunning);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Top Header & Status Indicators */}
      <StatusHeader
        mode={mode}
        onToggleMode={handleToggleMode}
        appMode={appMode}
        onChangeAppMode={handleSwitchAppMode}
        onOpenInterventions={() => setIsInterventionDashboardOpen(true)}
        health={health}
        loading={loading}
        onRefresh={loadData}
        apiError={apiError}
      />

      {/* Main 3D WebGL Digital Twin Canvas */}
      <SceneViewer
        nodes={nodes}
        inlets={inlets}
        conduits={conduits}
        currentFrame={frames[currentFrameIndex] || null}
        selectedAssetId={selectedAsset?.id}
        onSelectAsset={(asset) => setSelectedAsset(asset)}
        showUndergroundOnly={twinViewMode === 'underground_only'}
        twinViewMode={twinViewMode}
        onChangeTwinViewMode={(m) => setTwinViewMode(m)}
        isRainActive={isRainActive}
        onToggleRain={() => setRainEnabled(!rainEnabled)}
        stormIntensityMmh={stormIntensity}
        onOpenDebrisLab={() => setIsDebrisLabOpen(true)}
        isDebrisLabOpen={isDebrisLabOpen}
        appMode={appMode}
      />

      {/* Selected Asset Details Drawer */}
      <AssetDetailModal
        selectedAsset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        inspections={inspections}
        onOpenInspect={(assetId) => setInspectingAssetId(assetId)}
        currentFrame={frames[currentFrameIndex] || null}
      />

      {/* Simulation HUD (Timeline, Storm/Debris Selectors, Metrics, Legend) */}
      {bootstrap && (
        <SimulationHUD
          storms={bootstrap.storms}
          selectedStormId={selectedStormId}
          onSelectStorm={(id) => setSelectedStormId(id)}
          debrisScenarios={bootstrap.debris_scenarios}
          selectedDebrisId={selectedDebrisId}
          onSelectDebris={(id) => setSelectedDebrisId(id)}
          tailwaterCases={bootstrap.tailwater_cases}
          selectedTailwater={selectedTailwater}
          onSelectTailwater={(id) => setSelectedTailwater(id)}
          onRunSimulation={handleRunSimulation}
          onLoadVerifiedRun={handleLoadVerifiedRun}
          isRunning={isRunning}
          runProgressMessage={runProgressMessage}
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          onSeekFrame={(idx) => setCurrentFrameIndex(idx)}
          metrics={metrics}
          undergroundOnly={twinViewMode === 'underground_only'}
          onToggleUnderground={() =>
            setTwinViewMode((prev) => (prev === 'underground_only' ? 'twin_highlight' : 'underground_only'))
          }
        />
      )}

      {/* J3: Virtual Debris Lab (Close-up modal for INLET-D07) */}
      {isDebrisLabOpen && (
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

      {/* J4: Interventions Comparison Dashboard & Proposed Action Plan Modal */}
      {isInterventionDashboardOpen && (
        <InterventionDashboard
          onClose={() => setIsInterventionDashboardOpen(false)}
          onApplyIntervention={handleApplyIntervention}
          inspections={inspections}
        />
      )}
    </div>
  );
}

export default App;
