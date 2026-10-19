import { useEffect, useState, useCallback } from 'react';
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
} from './types';
import { StatusHeader } from './components/StatusHeader';
import { SceneViewer } from './components/SceneViewer';
import { AssetDetailModal } from './components/AssetDetailModal';
import { SimulationHUD } from './components/SimulationHUD';
import { InspectionModal } from './components/InspectionModal';

export function App() {
  const [mode, setMode] = useState<DataMode>(apiClient.getDataMode());
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [nodes, setNodes] = useState<AssetNode[]>([]);
  const [inlets, setInlets] = useState<AssetInlet[]>([]);
  const [conduits, setConduits] = useState<AssetConduit[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);

  // Simulation parameters aligned with bootstrap
  const [selectedStormId, setSelectedStormId] = useState<string>('synthetic_80mmh_60min');
  const [selectedDebrisId, setSelectedDebrisId] = useState<string>('demo_inlet_40pct');
  const [selectedTailwater, setSelectedTailwater] = useState<string>('normal');

  // Simulation execution & playback
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [frames, setFrames] = useState<SimulationFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(29); // start near t=1800s (frame 30)
  const [metrics, setMetrics] = useState<SimulationMetricsResponse | null>(null);

  // Asset selection & modal states
  const [selectedAsset, setSelectedAsset] = useState<{
    type: 'node' | 'inlet' | 'conduit';
    id: string;
    data: unknown;
  } | null>(null);
  const [inspectingAssetId, setInspectingAssetId] = useState<string | null>(null);
  const [undergroundOnly, setUndergroundOnly] = useState<boolean>(false);

  // Loading & error state
  const [loading, setLoading] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load foundational data (assets, bootstrap, health)
  const loadData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [h, b, a, inspRes, framesRes, metricsRes] = await Promise.all([
        apiClient.getHealth(),
        apiClient.getBootstrap(),
        apiClient.getTownshipAssets('taman_kyra_demo'),
        apiClient.getInspections(),
        apiClient.getSimulationFrames(
          selectedStormId === 'synthetic_120mmh_60min' ? 't1_stronger' : 't1_baseline'
        ),
        apiClient.getSimulationMetrics(
          selectedStormId === 'synthetic_120mmh_60min' ? 't1_stronger' : 't1_baseline'
        ),
      ]);

      setHealth(h);
      setBootstrap(b);
      setNodes(a.nodes);
      setInlets(a.inlets);
      setConduits(a.conduits);
      setInspections(inspRes.items);
      setFrames(framesRes.frames);
      setMetrics(metricsRes);
    } catch (err: unknown) {
      console.error('Failed to load data:', err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedStormId]);

  useEffect(() => {
    loadData();
  }, [loadData, mode]);

  const handleToggleMode = (newMode: DataMode) => {
    apiClient.setDataMode(newMode);
    setMode(newMode);
  };

  // Switch between verified SWMM runs (Baseline vs Stronger)
  const handleLoadVerifiedRun = async (stormId: string) => {
    const isStronger = stormId === 'synthetic_120mmh_60min';
    const runId = isStronger ? 't1_stronger' : 't1_baseline';

    const [framesRes, metricsRes] = await Promise.all([
      apiClient.getSimulationFrames(runId),
      apiClient.getSimulationMetrics(runId),
    ]);

    setFrames(framesRes.frames);
    setMetrics(metricsRes);
    // Move slider to near peak rainfall (frame 30 = t=1800s)
    setCurrentFrameIndex(29);
  };

  const handleRunSimulation = async () => {
    setIsRunning(true);
    setApiError(null);
    try {
      const simReq = {
        model_version_id: 'taman_kyra_synthetic_v1',
        storm_id: selectedStormId,
        debris_scenario_id: selectedDebrisId,
        tailwater_case: selectedTailwater,
        intervention: null,
      };

      const res = await apiClient.createSimulation(simReq);
      const [newFrames, newMetrics] = await Promise.all([
        apiClient.getSimulationFrames(res.run_id),
        apiClient.getSimulationMetrics(res.run_id),
      ]);

      setFrames(newFrames.frames);
      setMetrics(newMetrics);
      setCurrentFrameIndex(0);
    } catch (err: unknown) {
      console.error('Simulation execution failed:', err);
      // Per Team Workflow rules: display real error, do not silently fallback
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const handleCreateInspection = async (record: Partial<InspectionRecord>) => {
    const saved = await apiClient.createInspection(record);
    setInspections((prev) => [saved, ...prev]);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Top Header & Status Indicators */}
      <StatusHeader
        mode={mode}
        onToggleMode={handleToggleMode}
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
        showUndergroundOnly={undergroundOnly}
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
          frames={frames}
          currentFrameIndex={currentFrameIndex}
          onSeekFrame={(idx) => setCurrentFrameIndex(idx)}
          metrics={metrics}
          undergroundOnly={undergroundOnly}
          onToggleUnderground={() => setUndergroundOnly(!undergroundOnly)}
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
    </div>
  );
}

export default App;
