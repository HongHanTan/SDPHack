import React, { useMemo, useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Text, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import {
  AssetConduit,
  AssetInlet,
  AssetNode,
  ConduitStatus,
  NodeStatus,
  Position3D,
  SimulationFrame,
  AppMode,
  TwinViewMode,
} from '../types';
import { FieldInspectorsManager } from './FieldInspectorsManager';
import { TownshipEnvironment } from './TownshipEnvironment';
import { RainEffect } from './RainEffect';
import { NetworkHighlightOverlay } from './NetworkHighlightOverlay';
import { FieldInspector } from '../types';

// Convert local coordinates {x (East), y (North), z (Elevation)} to Three.js [x, z, -y]
// per Section 6.1 of md/TEAM_WORKFLOW.md
export function toThreeCoords(pos: Position3D): [number, number, number] {
  return [pos.x, pos.z, -pos.y];
}

interface SceneViewerProps {
  nodes: AssetNode[];
  inlets: AssetInlet[];
  conduits: AssetConduit[];
  currentFrame?: SimulationFrame | null;
  selectedAssetId?: string | null;
  onSelectAsset: (asset: { type: 'node' | 'inlet' | 'conduit'; id: string; data: unknown }) => void;
  showUndergroundOnly?: boolean;
  twinViewMode?: TwinViewMode;
  onChangeTwinViewMode?: (mode: TwinViewMode) => void;
  isRainActive?: boolean;
  rainEnabled?: boolean;
  hasSimulationStarted?: boolean;
  onToggleRain?: () => void;
  stormIntensityMmh?: number;
  onOpenDebrisLab?: () => void;
  isDebrisLabOpen?: boolean;
  appMode?: AppMode;
  onSelectInspector?: (inspector: FieldInspector) => void;
  selectedInspectorId?: string | null;
}

// 3D Node Mesh with physical chamber drop from ground down to invert
const NodeMesh: React.FC<{
  node: AssetNode;
  status: NodeStatus;
  depthM?: number;
  isSelected: boolean;
  onClick: () => void;
  showUndergroundOnly: boolean;
  isTwinHighlight?: boolean;
}> = ({ node, status, depthM = 0, isSelected, onClick, showUndergroundOnly, isTwinHighlight }) => {
  const [hovered, setHovered] = useState(false);

  // Bottom invert position
  const invertPos = useMemo(() => toThreeCoords(node.position_m), [node.position_m]);
  const groundElevation = node.ground_elevation_m ?? (node.invert_elevation_m + node.max_depth_m);
  const chamberHeight = Math.max(groundElevation - node.invert_elevation_m, 1.0);
  const chamberCenterY = invertPos[1] + chamberHeight / 2;

  const color = useMemo(() => {
    if (isSelected) return '#38bdf8'; // bright cyan
    if (status === 'flooding') return '#f43f5e'; // rose-500
    if (status === 'surcharged') return '#fbbf24'; // amber-400
    if (status === 'normal') return '#10b981'; // emerald-500
    return '#94a3b8'; // slate-400
  }, [status, isSelected]);

  const isOutfall = node.node_type === 'outfall';

  return (
    <group position={[invertPos[0], 0, invertPos[2]]}>
      {/* Vertical Manhole Drop Chamber */}
      {!isOutfall ? (
        <group position={[0, chamberCenterY, 0]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
          >
            <cylinderGeometry args={[1.0, 1.0, chamberHeight, 16]} />
            <meshStandardMaterial
              color={color}
              roughness={0.4}
              metalness={0.2}
              transparent
              opacity={showUndergroundOnly ? 0.95 : isTwinHighlight ? 0.9 : 0.75}
              emissive={isSelected || hovered ? color : isTwinHighlight ? color : '#000000'}
              emissiveIntensity={isSelected ? 0.7 : hovered ? 0.35 : isTwinHighlight ? 0.45 : 0}
            />
          </mesh>

          {/* Water level cylinder inside manhole */}
          {depthM > 0.05 && (
            <mesh position={[0, -chamberHeight / 2 + Math.min(depthM, chamberHeight) / 2, 0]}>
              <cylinderGeometry
                args={[0.9, 0.9, Math.min(depthM, chamberHeight), 16]}
              />
              <meshStandardMaterial
                color="#0284c7"
                transparent
                opacity={0.85}
                roughness={0.1}
              />
            </mesh>
          )}

          {/* Surface Cover Plate */}
          <mesh position={[0, chamberHeight / 2 + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.1, 16]} />
            <meshStandardMaterial
              color={isSelected ? '#38bdf8' : '#334155'}
              roughness={0.8}
            />
          </mesh>
        </group>
      ) : (
        /* Outfall Headwall Box */
        <group position={[0, invertPos[1] + 1.0, 0]}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(true);
            }}
            onPointerOut={() => setHovered(false)}
          >
            <boxGeometry args={[4, 2.5, 3]} />
            <meshStandardMaterial
              color={isSelected ? '#38bdf8' : '#64748b'}
              roughness={0.5}
              emissive={isSelected || hovered ? '#38bdf8' : '#000000'}
              emissiveIntensity={isSelected ? 0.6 : hovered ? 0.3 : 0}
            />
          </mesh>
          {/* Outfall portal */}
          <mesh position={[0, -0.2, -1.55]}>
            <circleGeometry args={[0.9, 16]} />
            <meshBasicMaterial color="#020617" />
          </mesh>
        </group>
      )}

      {/* Node ID Tag */}
      <Text
        position={[0, invertPos[1] + chamberHeight + 1.2, 0]}
        fontSize={1.2}
        color={isSelected ? '#38bdf8' : '#f8fafc'}
        anchorX="center"
        anchorY="bottom"
      >
        {node.node_id}
      </Text>
    </group>
  );
};

// 3D Conduit / Pipe connecting from-node invert to to-node invert
const ConduitMesh: React.FC<{
  conduit: AssetConduit;
  fromNode?: AssetNode;
  toNode?: AssetNode;
  status: ConduitStatus;
  flowM3s?: number;
  isSelected: boolean;
  onClick: () => void;
  appMode?: AppMode;
  isTwinHighlight?: boolean;
}> = ({ conduit, fromNode, toNode, status, isSelected, onClick, appMode, isTwinHighlight }) => {
  const [hovered, setHovered] = useState(false);

  const { midpoint, length, orientation } = useMemo(() => {
    if (!fromNode || !toNode) {
      return { midpoint: [0, 0, 0] as [number, number, number], length: 0, orientation: new THREE.Quaternion() };
    }
    // Calculate pipe centerline slightly above node invert (invert + diameter / 2)
    const p1 = new THREE.Vector3(...toThreeCoords(fromNode.position_m));
    const p2 = new THREE.Vector3(...toThreeCoords(toNode.position_m));
    const radius = conduit.diameter_m * 0.5;
    p1.y += radius;
    p2.y += radius;

    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();

    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());

    return {
      midpoint: [mid.x, mid.y, mid.z] as [number, number, number],
      length: len,
      orientation: quaternion,
    };
  }, [fromNode, toNode, conduit.diameter_m]);

  const color = useMemo(() => {
    if (isSelected) return '#38bdf8';
    if (status === 'surcharged') return '#ef4444'; // rose-500
    if (status === 'near_capacity') return '#f59e0b'; // amber-500
    if (status === 'normal') return '#0284c7'; // cyan-600
    return '#64748b'; // slate-500
  }, [status, isSelected]);

  if (!fromNode || !toNode || length <= 0) return null;

  const radius = Math.max((conduit.diameter_m || 0.45) * 0.5, 0.25);

  return (
    <group position={midpoint} quaternion={orientation}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <cylinderGeometry args={[radius, radius, length, 16]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.1}
          transparent
          opacity={0.9}
          emissive={isSelected || hovered ? color : isTwinHighlight ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.7 : hovered ? 0.35 : isTwinHighlight ? 0.5 : 0}
        />
      </mesh>

      {/* Outer translucent neon glow sleeve when Twin Highlight is active */}
      {isTwinHighlight && (
        <mesh>
          <cylinderGeometry args={[radius * 1.35, radius * 1.35, length, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.25}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* 3D Label for bottleneck conduit PIPE-P07 */}
      {conduit.conduit_id === 'PIPE-P07' && (
        <group position={[0, radius + 1.2, 0]}>
          <Text
            fontSize={0.9}
            color={appMode === 'anticipate' ? '#38bdf8' : '#94a3b8'}
            anchorX="center"
            anchorY="bottom"
          >
            {appMode === 'anticipate' ? '⚡ PIPE-P07 (Bottleneck Trunk Ø600mm)' : 'PIPE-P07 (Ø600mm)'}
          </Text>
        </group>
      )}
    </group>
  );
};

// 3D Inlet Mesh (Grate located at ground level)
const InletMesh: React.FC<{
  inlet: AssetInlet;
  associatedNode?: AssetNode;
  cloggingFraction?: number;
  isSelected: boolean;
  onClick: () => void;
  appMode?: AppMode;
}> = ({ inlet, associatedNode, cloggingFraction = 0, isSelected, onClick, appMode }) => {
  const [hovered, setHovered] = useState(false);

  const position = useMemo(() => {
    // In authoritative data, inlet.position_m.z is the surface ground elevation
    const pos = { ...inlet.position_m };
    if (associatedNode?.ground_elevation_m) {
      pos.z = associatedNode.ground_elevation_m;
    }
    return toThreeCoords(pos);
  }, [inlet.position_m, associatedNode]);

  const isFocusInlet = inlet.inlet_id === 'INLET-D07';

  return (
    <group position={position}>
      {/* Curb & Grate structure */}
      <mesh
        position={[0, 0.08, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1.8, 0.16, 1.2]} />
        <meshStandardMaterial
          color={isFocusInlet ? '#f97316' : '#94a3b8'}
          roughness={0.6}
          emissive={isSelected || hovered ? '#38bdf8' : isFocusInlet ? '#ea580c' : '#000000'}
          emissiveIntensity={isSelected ? 0.8 : isFocusInlet ? 0.5 : 0}
        />
      </mesh>

      {/* Focus Tag for INLET-D07 */}
      {isFocusInlet && (
        <group position={[0, 2.2, 0]}>
          <Text
            fontSize={1.1}
            color={appMode === 'diagnose' ? '#f59e0b' : '#fb923c'}
            anchorX="center"
            anchorY="bottom"
          >
            {appMode === 'diagnose' ? '🔍 INLET-D07 (Critical Clogging Point)' : '★ INLET-D07 (Curb Inlet)'}
          </Text>
          {cloggingFraction > 0 && (
            <Text
              position={[0, -0.6, 0]}
              fontSize={0.8}
              color="#fdba74"
              anchorX="center"
              anchorY="bottom"
            >
              {`Hydraulic Restriction: ${(cloggingFraction * 100).toFixed(0)}%`}
            </Text>
          )}
        </group>
      )}
    </group>
  );
};

export const SceneViewer: React.FC<SceneViewerProps> = ({
  nodes,
  inlets,
  conduits,
  currentFrame,
  selectedAssetId,
  onSelectAsset,
  showUndergroundOnly = false,
  twinViewMode,
  onChangeTwinViewMode,
  isRainActive,
  rainEnabled = true,
  hasSimulationStarted = false,
  onToggleRain,
  stormIntensityMmh = 80,
  onOpenDebrisLab,
  isDebrisLabOpen: _isDebrisLabOpen = false,
  appMode = 'diagnose',
  onSelectInspector,
  selectedInspectorId,
}) => {
  const controlsRef = useRef<any>(null);

  // Local view mode fallback
  const [internalViewMode, setInternalViewMode] = useState<TwinViewMode>('twin_highlight');
  const currentMode: TwinViewMode = twinViewMode ?? (showUndergroundOnly ? 'underground_only' : internalViewMode);

  // Local rain toggle fallback
  const [internalRain, setInternalRain] = useState<boolean>(true);
  const rainActive = isRainActive ?? internalRain;

  const handleSelectMode = (mode: TwinViewMode) => {
    setInternalViewMode(mode);
    onChangeTwinViewMode?.(mode);
  };

  const handleToggleRain = () => {
    if (onToggleRain) {
      onToggleRain();
    } else {
      setInternalRain(!internalRain);
    }
  };

  // Map nodes by node_id
  const nodeMap = useMemo(() => {
    const map = new Map<string, AssetNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  // Frame state maps
  const pipeStateMap = useMemo(() => {
    const map = new Map<string, { status: ConduitStatus; flow: number }>();
    currentFrame?.pipe_states?.forEach((p) => {
      map.set(p.conduit_id, { status: p.status, flow: p.flow_m3s });
    });
    return map;
  }, [currentFrame]);

  const nodeStateMap = useMemo(() => {
    const map = new Map<string, { status: NodeStatus; depth: number }>();
    currentFrame?.node_states?.forEach((n) => {
      map.set(n.node_id, { status: n.status, depth: n.depth_m });
    });
    return map;
  }, [currentFrame]);

  const inletStateMap = useMemo(() => {
    const map = new Map<string, number>();
    currentFrame?.inlet_states?.forEach((i) => {
      map.set(i.inlet_id, i.hydraulic_inlet_clogging_fraction);
    });
    return map;
  }, [currentFrame]);

  // Camera preset handler
  const handlePreset = (type: 'overview' | 'd07' | 'outfall' | 'north') => {
    if (!controlsRef.current) return;
    if (type === 'overview') {
      controlsRef.current.target.set(50, 10, 0);
      controlsRef.current.object.position.set(60, 90, 130);
    } else if (type === 'd07') {
      controlsRef.current.target.set(40, 10, 0);
      controlsRef.current.object.position.set(40, 22, 28);
    } else if (type === 'outfall') {
      controlsRef.current.target.set(40, 8, 100);
      controlsRef.current.object.position.set(40, 25, 60);
    } else if (type === 'north') {
      controlsRef.current.target.set(40, 11, -120);
      controlsRef.current.object.position.set(40, 30, -80);
    }
    controlsRef.current.update();
  };

  return (
    <div className="w-full h-full relative bg-slate-100">
      {/* Top Floating View & Preset Quick Control Bar */}
      <div className="absolute top-18 left-1/2 -translate-x-1/2 z-10 flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 text-[11px] text-slate-700 shadow-md">
        {/* 1. Twin View Modes (Matching user mockup) */}
        <div className="flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200">
          <button
            onClick={() => handleSelectMode('twin_highlight')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer font-medium flex items-center gap-1.5 ${
              currentMode === 'twin_highlight'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Surface township and underground glowing drainage network overlay"
          >
            <span>💎 Digital Twin</span>
          </button>
          <button
            onClick={() => handleSelectMode('realistic')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
              currentMode === 'realistic'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="High-fidelity surface residential township"
          >
            <span>🏡 Realistic Surface</span>
          </button>
          <button
            onClick={() => handleSelectMode('underground_only')}
            className={`px-2.5 py-1 rounded-lg transition cursor-pointer font-medium ${
              currentMode === 'underground_only'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Subsurface drainage conduits and hydraulic grade line"
          >
            <span>🚇 Underground Only</span>
          </button>
        </div>

        {/* 2. Rain FX Toggle */}
        <button
          onClick={handleToggleRain}
          className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
            rainActive
              ? 'bg-red-50 text-red-700 border-red-200 shadow-xs'
              : rainEnabled
              ? 'bg-cyan-50 text-cyan-800 border-cyan-200 shadow-xs'
              : 'bg-slate-100 text-slate-500 border-slate-200 hover:text-slate-800'
          }`}
          title={
            !hasSimulationStarted
              ? rainEnabled
                ? 'Rain is armed. Precipitation animation will begin when Start Simulation is clicked.'
                : 'Rain is disabled. Click to arm rain before starting.'
              : rainActive
              ? 'Rain active. Click to disable rain.'
              : 'Rain paused. Click to enable rain.'
          }
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              rainActive
                ? 'bg-red-500 animate-ping'
                : rainEnabled
                ? 'bg-cyan-500 animate-pulse'
                : 'bg-slate-400'
            }`}
          />
          <span>
            🌧️ {rainActive ? 'Rain Active' : rainEnabled ? 'Rain Armed' : 'Rain Off'}
          </span>
        </button>

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        {/* 3. Camera Preset Quick Buttons */}
        <div className="flex items-center gap-1 text-slate-600">
          <span className="text-[10px] text-slate-400 font-semibold px-1">View:</span>
          <button
            onClick={() => handlePreset('overview')}
            className="px-2 py-0.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer font-medium"
          >
            Overview
          </button>
          <button
            onClick={() => handlePreset('d07')}
            className="px-2 py-0.5 rounded-lg hover:bg-amber-100 text-amber-800 transition cursor-pointer font-bold"
          >
            D07 Lowland
          </button>
          <button
            onClick={() => handlePreset('outfall')}
            className="px-2 py-0.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer font-medium"
          >
            Outfall
          </button>
          <button
            onClick={() => handlePreset('north')}
            className="px-2 py-0.5 rounded-lg hover:bg-slate-100 text-slate-700 hover:text-slate-900 transition cursor-pointer font-medium"
          >
            Upstream
          </button>
        </div>

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        {/* 4. Virtual Debris Lab Quick Button */}
        <button
          onClick={onOpenDebrisLab}
          className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition cursor-pointer font-bold flex items-center gap-1 shadow-xs"
        >
          <span>★ Virtual Debris Lab</span>
        </button>
      </div>

      <Canvas
        camera={{ position: [60, 90, 130], fov: 45, near: 0.1, far: 1000 }}
        shadows
      >
        <color attach="background" args={['#f1f5f9']} />
        <fog attach="fog" args={['#f1f5f9', 200, 480]} />
        <ambientLight intensity={1.3} color="#ffffff" />
        <directionalLight position={[90, 140, 70]} intensity={2.4} castShadow color="#ffffff" />
        <directionalLight position={[-80, 60, -60]} intensity={0.8} color="#93c5fd" />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={10}
          maxDistance={350}
        />

        {/* Spatial Metric Reference Grid */}
        <Grid
          args={[260, 260]}
          cellSize={10}
          cellThickness={0.5}
          cellColor="#cbd5e1"
          sectionSize={40}
          sectionThickness={1.0}
          sectionColor="#94a3b8"
          fadeDistance={280}
          fadeStrength={1}
          position={[50, -0.05, 0]}
        />

        {/* 3D Falling Rain Streaks & Ground Splash Animation */}
        <RainEffect
          active={rainActive}
          stormIntensityMmh={stormIntensityMmh}
        />

        {/* Full Residential Township Digital Twin (Houses, Roads, Lawns, Lake, Canal, and Rising Ponding Water) */}
        <TownshipEnvironment
          showUndergroundOnly={currentMode === 'underground_only'}
          floodingActive={Boolean(
            currentFrame?.inlet_states?.some(
              (i) => i.inlet_id === 'INLET-D07' && i.hydraulic_inlet_clogging_fraction > 0
            ) ||
              currentFrame?.node_states?.some(
                (n) => n.node_id === 'NODE-J07' && (n.status === 'flooding' || n.depth_m > 1.4)
              )
          )}
          appMode={appMode}
          currentFrame={currentFrame}
        />

        {/* Glowing Surface Road Flow Ribbons & 3D Glowing Junction Markers (Mockup View) */}
        <NetworkHighlightOverlay
          nodes={nodes}
          conduits={conduits}
          currentFrame={currentFrame}
          selectedAssetId={selectedAssetId}
          onSelectAsset={onSelectAsset}
          active={currentMode === 'twin_highlight'}
        />

        {/* 3D Physical Nodes (Manholes & Drop Chambers) */}
        {nodes.map((node) => {
          const state = nodeStateMap.get(node.node_id);
          return (
            <NodeMesh
              key={node.node_id}
              node={node}
              status={state?.status || 'normal'}
              depthM={state?.depth || 0}
              isSelected={selectedAssetId === node.node_id}
              onClick={() => onSelectAsset({ type: 'node', id: node.node_id, data: node })}
              showUndergroundOnly={currentMode === 'underground_only'}
              isTwinHighlight={currentMode === 'twin_highlight'}
            />
          );
        })}

        {/* 3D Physical Conduits / Sewer Pipes */}
        {conduits.map((conduit) => {
          const fromId = conduit.from_node_id || conduit.from_node!;
          const toId = conduit.to_node_id || conduit.to_node!;
          const fromNode = nodeMap.get(fromId);
          const toNode = nodeMap.get(toId);
          const state = pipeStateMap.get(conduit.conduit_id);

          return (
            <ConduitMesh
              key={conduit.conduit_id}
              conduit={conduit}
              fromNode={fromNode}
              toNode={toNode}
              status={state?.status || 'normal'}
              flowM3s={state?.flow || 0}
              isSelected={selectedAssetId === conduit.conduit_id}
              onClick={() => onSelectAsset({ type: 'conduit', id: conduit.conduit_id, data: conduit })}
              appMode={appMode}
              isTwinHighlight={currentMode === 'twin_highlight'}
            />
          );
        })}

        {/* 3D Inlets */}
        {inlets.map((inlet) => {
          const node = nodeMap.get(inlet.node_id);
          const clogging = inletStateMap.get(inlet.inlet_id) ?? 0;
          return (
            <InletMesh
              key={inlet.inlet_id}
              inlet={inlet}
              associatedNode={node}
              cloggingFraction={clogging}
              isSelected={selectedAssetId === inlet.inlet_id}
              onClick={() => onSelectAsset({ type: 'inlet', id: inlet.inlet_id, data: inlet })}
              appMode={appMode}
            />
          );
        })}

        {/* Real-Time Assigned Field Inspectors Patrol Team (Azman, Siti, Muthu, Kevin) */}
        <FieldInspectorsManager
          appMode={appMode}
          selectedInspectorId={selectedInspectorId}
          onSelectInspector={(inspector) => {
            if (onSelectInspector) {
              onSelectInspector(inspector);
            } else {
              // Default selection of assigned asset
              if (inspector.assignedAssetId.startsWith('INLET')) {
                const inlet = inlets.find((i) => i.inlet_id === inspector.assignedAssetId);
                if (inlet) onSelectAsset({ type: 'inlet', id: inlet.inlet_id, data: inlet });
              } else if (inspector.assignedAssetId.startsWith('PIPE')) {
                const pipe = conduits.find((c) => c.conduit_id === inspector.assignedAssetId);
                if (pipe) onSelectAsset({ type: 'conduit', id: pipe.conduit_id, data: pipe });
              } else {
                const node = nodes.find((n) => n.node_id === inspector.assignedAssetId);
                if (node) onSelectAsset({ type: 'node', id: node.node_id, data: node });
              }
            }
          }}
        />

        {/* Axis Orientation Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#f43f5e', '#10b981', '#38bdf8']} labelColor="#ffffff" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
};
