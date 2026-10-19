import React, { useMemo, useState } from 'react';
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
}

// 3D Node Mesh
const NodeMesh: React.FC<{
  node: AssetNode;
  status: NodeStatus;
  depthM?: number;
  isSelected: boolean;
  onClick: () => void;
}> = ({ node, status, depthM = 0, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const position = useMemo(() => toThreeCoords(node.position_m), [node.position_m]);

  const color = useMemo(() => {
    if (isSelected) return '#38bdf8'; // bright sky
    if (status === 'flooding') return '#f43f5e'; // rose-500
    if (status === 'surcharged') return '#fbbf24'; // amber-400
    if (status === 'normal') return '#10b981'; // emerald-500
    return '#94a3b8'; // slate-400
  }, [status, isSelected]);

  const isOutfall = node.type === 'outfall';

  return (
    <group position={position}>
      {/* Node Geometry */}
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
        {isOutfall ? (
          <boxGeometry args={[3, 2, 3]} />
        ) : (
          <cylinderGeometry args={[1.2, 1.2, 2.0, 16]} />
        )}
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.2}
          emissive={isSelected || hovered ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : hovered ? 0.3 : 0}
        />
      </mesh>

      {/* Surface manhole ring */}
      <mesh position={[0, 1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.3, 16]} />
        <meshBasicMaterial color={isSelected ? '#38bdf8' : '#cbd5e1'} side={THREE.DoubleSide} />
      </mesh>

      {/* Water Level inside node if flooding/surcharging */}
      {depthM > 0.1 && (
        <mesh position={[0, Math.min(depthM - 1.0, 1.2), 0]}>
          <cylinderGeometry args={[1.0, 1.0, 0.4, 16]} />
          <meshStandardMaterial
            color="#0284c7"
            transparent
            opacity={0.8}
            roughness={0.1}
          />
        </mesh>
      )}

      {/* Node Label */}
      <Text
        position={[0, 2.2, 0]}
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

// 3D Conduit / Pipe Mesh
const ConduitMesh: React.FC<{
  conduit: AssetConduit;
  fromNode?: AssetNode;
  toNode?: AssetNode;
  status: ConduitStatus;
  capacityFraction?: number;
  isSelected: boolean;
  onClick: () => void;
}> = ({ conduit, fromNode, toNode, status, capacityFraction = 0, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);

  const { midpoint, length, orientation } = useMemo(() => {
    if (!fromNode || !toNode) {
      return { midpoint: [0, 0, 0] as [number, number, number], length: 0, orientation: new THREE.Quaternion() };
    }
    const p1 = new THREE.Vector3(...toThreeCoords(fromNode.position_m));
    const p2 = new THREE.Vector3(...toThreeCoords(toNode.position_m));
    const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();

    // Default cylinder aligns with Y-axis; rotate to point along dir
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());

    return {
      midpoint: [mid.x, mid.y, mid.z] as [number, number, number],
      length: len,
      orientation: quaternion,
    };
  }, [fromNode, toNode]);

  const color = useMemo(() => {
    if (isSelected) return '#38bdf8';
    if (status === 'surcharged') return '#ef4444'; // rose
    if (status === 'near_capacity') return '#f59e0b'; // amber
    if (status === 'normal') return '#0284c7'; // cyan-600
    return '#64748b'; // slate-500
  }, [status, isSelected]);

  if (!fromNode || !toNode || length <= 0) return null;

  const radius = Math.max((conduit.diameter_m || 0.6) * 0.5, 0.3);

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
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={0.85}
          emissive={isSelected || hovered ? color : '#000000'}
          emissiveIntensity={isSelected ? 0.6 : hovered ? 0.3 : 0}
        />
      </mesh>

      {/* Capacity fill indicator ring at midpoint */}
      {capacityFraction > 0.5 && (
        <mesh>
          <torusGeometry args={[radius * 1.1, 0.08, 8, 16]} />
          <meshBasicMaterial color={status === 'surcharged' ? '#ef4444' : '#f59e0b'} />
        </mesh>
      )}
    </group>
  );
};

// 3D Inlet Mesh
const InletMesh: React.FC<{
  inlet: AssetInlet;
  associatedNode?: AssetNode;
  cloggingFraction?: number;
  isSelected: boolean;
  onClick: () => void;
}> = ({ inlet, associatedNode, cloggingFraction = 0, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);
  const position = useMemo(() => {
    const pos = { ...inlet.position_m };
    if (associatedNode) {
      pos.z = associatedNode.surface_elevation_m || pos.z;
    }
    return toThreeCoords(pos);
  }, [inlet.position_m, associatedNode]);

  const isFocusInlet = inlet.inlet_id === 'INLET-D07';

  return (
    <group position={position}>
      <mesh
        position={[0, 0.1, 0]}
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
        <boxGeometry args={[1.8, 0.25, 1.2]} />
        <meshStandardMaterial
          color={isFocusInlet ? '#f97316' : '#cbd5e1'}
          roughness={0.5}
          emissive={isSelected || hovered ? '#38bdf8' : isFocusInlet ? '#ea580c' : '#000000'}
          emissiveIntensity={isSelected ? 0.7 : isFocusInlet ? 0.4 : 0}
        />
      </mesh>

      {/* Focus Tag for INLET-D07 */}
      {isFocusInlet && (
        <group position={[0, 1.8, 0]}>
          <Text
            fontSize={0.9}
            color="#fb923c"
            anchorX="center"
            anchorY="bottom"
          >
            ★ INLET-D07 (Focus)
          </Text>
          {cloggingFraction > 0 && (
            <Text
              position={[0, -0.6, 0]}
              fontSize={0.7}
              color="#fdba74"
              anchorX="center"
              anchorY="bottom"
            >
              {`Clogged: ${Math.round(cloggingFraction * 100)}%`}
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
}) => {
  // Map node lookup by ID
  const nodeMap = useMemo(() => {
    const map = new Map<string, AssetNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

  // Frame state maps
  const pipeStateMap = useMemo(() => {
    const map = new Map<string, { status: ConduitStatus; capacity: number }>();
    currentFrame?.pipe_states.forEach((p) => {
      map.set(p.conduit_id, { status: p.status, capacity: p.capacity_fraction || 0 });
    });
    return map;
  }, [currentFrame]);

  const nodeStateMap = useMemo(() => {
    const map = new Map<string, { status: NodeStatus; depth: number }>();
    currentFrame?.node_states.forEach((n) => {
      map.set(n.node_id, { status: n.status, depth: n.depth_m });
    });
    return map;
  }, [currentFrame]);

  const inletStateMap = useMemo(() => {
    const map = new Map<string, number>();
    currentFrame?.inlet_states.forEach((i) => {
      map.set(i.inlet_id, i.hydraulic_inlet_clogging_fraction);
    });
    return map;
  }, [currentFrame]);

  return (
    <div className="w-full h-full relative bg-slate-950">
      <Canvas
        camera={{ position: [0, 80, 100], fov: 45, near: 0.1, far: 1000 }}
        shadows
      >
        <color attach="background" args={['#020617']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[50, 80, 30]} intensity={1.2} castShadow />
        <directionalLight position={[-50, 40, -30]} intensity={0.4} />

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          maxPolarAngle={Math.PI / 2 - 0.05} // prevent going below ground level
          minDistance={10}
          maxDistance={300}
        />

        {/* Spatial Grid */}
        <Grid
          args={[200, 200]}
          cellSize={10}
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={50}
          sectionThickness={1.2}
          sectionColor="#334155"
          fadeDistance={250}
          fadeStrength={1}
          position={[0, 0, 0]}
        />

        {/* Residential Parcel Footprints (Synthetic Context) */}
        {!showUndergroundOnly && (
          <group position={[0, -0.05, 0]}>
            {/* North parcel block */}
            <mesh position={[-15, 0, -65]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[110, 30]} />
              <meshStandardMaterial color="#0f172a" roughness={0.9} />
            </mesh>
            {/* Central parcel block */}
            <mesh position={[-15, 0, -20]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[110, 25]} />
              <meshStandardMaterial color="#0f172a" roughness={0.9} />
            </mesh>
            {/* South parcel block */}
            <mesh position={[15, 0, 25]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[80, 30]} />
              <meshStandardMaterial color="#0f172a" roughness={0.9} />
            </mesh>
          </group>
        )}

        {/* 3D Nodes */}
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
            />
          );
        })}

        {/* 3D Conduits / Pipes */}
        {conduits.map((conduit) => {
          const fromNode = nodeMap.get(conduit.from_node);
          const toNode = nodeMap.get(conduit.to_node);
          const state = pipeStateMap.get(conduit.conduit_id);
          return (
            <ConduitMesh
              key={conduit.conduit_id}
              conduit={conduit}
              fromNode={fromNode}
              toNode={toNode}
              status={state?.status || 'normal'}
              capacityFraction={state?.capacity || 0}
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

        {/* Orientation Gizmo */}
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['#f43f5e', '#10b981', '#38bdf8']} labelColor="#ffffff" />
        </GizmoHelper>
      </Canvas>
    </div>
  );
};
