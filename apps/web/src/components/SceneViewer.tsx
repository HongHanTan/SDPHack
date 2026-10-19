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
} from '../types';
import { InspectorAvatar } from './InspectorAvatar';

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
  onOpenDebrisLab?: () => void;
  isDebrisLabOpen?: boolean;
}

// 3D Node Mesh with physical chamber drop from ground down to invert
const NodeMesh: React.FC<{
  node: AssetNode;
  status: NodeStatus;
  depthM?: number;
  isSelected: boolean;
  onClick: () => void;
  showUndergroundOnly: boolean;
}> = ({ node, status, depthM = 0, isSelected, onClick, showUndergroundOnly }) => {
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
              opacity={showUndergroundOnly ? 0.95 : 0.75}
              emissive={isSelected || hovered ? color : '#000000'}
              emissiveIntensity={isSelected ? 0.7 : hovered ? 0.35 : 0}
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
}> = ({ conduit, fromNode, toNode, status, isSelected, onClick }) => {
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
          emissive={isSelected || hovered ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : hovered ? 0.3 : 0}
        />
      </mesh>
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
}> = ({ inlet, associatedNode, cloggingFraction = 0, isSelected, onClick }) => {
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
            color="#fb923c"
            anchorX="center"
            anchorY="bottom"
          >
            ★ INLET-D07 (重点进水口)
          </Text>
          {cloggingFraction > 0 && (
            <Text
              position={[0, -0.6, 0]}
              fontSize={0.8}
              color="#fdba74"
              anchorX="center"
              anchorY="bottom"
            >
              {`水力折减假设: ${(cloggingFraction * 100).toFixed(0)}%`}
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
  onOpenDebrisLab,
  isDebrisLabOpen = false,
}) => {
  const controlsRef = useRef<any>(null);

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
    <div className="w-full h-full relative bg-slate-950">
      {/* Camera Preset Quick Buttons */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300">
        <span className="px-2 text-slate-500 font-medium">视角预设:</span>
        <button
          onClick={() => handlePreset('overview')}
          className="px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          全貌俯视
        </button>
        <button
          onClick={() => handlePreset('d07')}
          className="px-2.5 py-1 rounded-lg hover:bg-amber-500/20 text-amber-300 transition cursor-pointer font-medium"
        >
          低洼进水点 (D07)
        </button>
        <button
          onClick={() => handlePreset('outfall')}
          className="px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          出水口 (OUT01)
        </button>
        <button
          onClick={() => handlePreset('north')}
          className="px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
        >
          上游源头 (J01/J02)
        </button>
        <div className="h-3 w-px bg-slate-700 mx-1" />
        <button
          onClick={onOpenDebrisLab}
          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition cursor-pointer font-medium flex items-center gap-1 shadow-sm"
        >
          <span>★ 进水口虚拟实验室</span>
        </button>
      </div>

      <Canvas
        camera={{ position: [60, 90, 130], fov: 45, near: 0.1, far: 1000 }}
        shadows
      >
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[80, 100, 50]} intensity={1.3} castShadow />
        <directionalLight position={[-80, 50, -50]} intensity={0.4} />

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
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={40}
          sectionThickness={1.2}
          sectionColor="#334155"
          fadeDistance={280}
          fadeStrength={1}
          position={[50, 0, 0]}
        />

        {/* Contextual Street Surfaces & Road Network */}
        {!showUndergroundOnly && (
          <group position={[0, 0, 0]}>
            {/* North East-West Street (y = 120, z = 12.15) */}
            <mesh position={[40, 12.1, -120]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[130, 12]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>

            {/* Mid East-West Road (y = 80, z = 11.9) */}
            <mesh position={[80, 11.85, -80]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[110, 12]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>

            {/* Central Main Street (y = 0, z = 11.0) passing through low point J07 */}
            <mesh position={[20, 10.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[120, 14]} />
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </mesh>

            {/* South Discharge Canal Corridor (y = -75, z = 10.3) */}
            <mesh position={[40, 10.25, 75]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[16, 60]} />
              <meshStandardMaterial color="#0369a1" roughness={0.3} transparent opacity={0.6} />
            </mesh>
          </group>
        )}

        {/* 3D Nodes (Manholes & Drop Chambers) */}
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
              showUndergroundOnly={showUndergroundOnly}
            />
          );
        })}

        {/* 3D Conduits / Sewer Pipes */}
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
            />
          );
        })}

        {/* Field Inspector Avatar (Azman - Field Unit A) positioned at INLET-D07 */}
        <InspectorAvatar
          position={[43.0, 11.0, 2.5]}
          onOpenDebrisLab={onOpenDebrisLab || (() => {})}
          active={isDebrisLabOpen}
        />

        {/* Axis Orientation Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#f43f5e', '#10b981', '#38bdf8']} labelColor="#ffffff" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
};
