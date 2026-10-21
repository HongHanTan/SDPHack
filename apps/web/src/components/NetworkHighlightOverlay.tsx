import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { useViewLook } from '../view/ViewLookContext';
import {
  AssetConduit,
  AssetNode,
  ConduitStatus,
  NodeStatus,
  Position3D,
  SimulationFrame,
} from '../types';

// Convert local coordinates {x (East), y (North), z (Elevation)} to Three.js [x, z, -y]
export function toThreeCoords(pos: Position3D): [number, number, number] {
  return [pos.x, pos.z, -pos.y];
}

interface NetworkHighlightOverlayProps {
  nodes: AssetNode[];
  conduits: AssetConduit[];
  currentFrame?: SimulationFrame | null;
  selectedAssetId?: string | null;
  onSelectAsset: (asset: { type: 'node' | 'inlet' | 'conduit'; id: string; data: unknown }) => void;
  active: boolean; // True when Twin Highlight / X-Ray mode is enabled
}

// Manhole mapping to mockup naming
const MANHOLE_LABELS: Record<string, string> = {
  'NODE-J01': 'MH-0101',
  'NODE-J02': 'MH-0102',
  'NODE-J03': 'MH-0203',
  'NODE-J04': 'MH-0204',
  'NODE-J05': 'MH-0305',
  'NODE-J06': 'MH-0406',
  'NODE-J07': 'MH-0421 (Lowland Overflow)',
  'NODE-J08': 'MH-0508',
  'NODE-OUT01': 'MH-OUT (Outfall)',
};

// 3D Glowing Junction Cube Marker (Exact match to the mockup)
const GlowingJunctionMarker: React.FC<{
  node: AssetNode;
  status: NodeStatus;
  isSelected: boolean;
  onClick: () => void;
}> = ({ node, status, isSelected, onClick }) => {
  const boxRef = useRef<THREE.Group>(null);

  const groundY = node.ground_elevation_m ?? 11.5;
  const x = node.position_m.x;
  const z = -node.position_m.y;

  const color = useMemo(() => {
    if (isSelected) return '#38bdf8'; // glowing cyan
    if (status === 'flooding') return '#f43f5e'; // vivid crimson red
    if (status === 'surcharged') return '#fbbf24'; // bright amber
    if (status === 'normal') return '#10b981'; // emerald green
    return '#94a3b8';
  }, [status, isSelected]);

  const label = MANHOLE_LABELS[node.node_id] || node.node_id;
  const { is2d } = useViewLook();

  // Gentle floating animation
  useFrame((state) => {
    if (boxRef.current) {
      const t = state.clock.getElapsedTime();
      boxRef.current.position.y = groundY + 1.2 + Math.sin(t * 2 + x * 0.1) * 0.12;
      boxRef.current.rotation.y = t * 0.4;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Ground Surface Glowing Neon Halo Ring */}
      <mesh position={[0, groundY + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.6, 2.2, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Floating 3D Glowing Wireframe Box + Solid Neon Core */}
      <group
        ref={boxRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {/* Wireframe Box */}
        <mesh>
          <boxGeometry args={[2.4, 2.4, 2.4]} />
          <meshBasicMaterial
            color={color}
            wireframe
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Inner Solid Neon Glowing Cube */}
        <mesh>
          <boxGeometry args={[1.4, 1.4, 1.4]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.4}
            transparent
            opacity={0.65}
            roughness={0.2}
          />
        </mesh>
      </group>

      {/* Floating Mockup-style Node ID Badge */}
      <group position={[0, groundY + 3.2, 0]}>
        <Text
          visible={!is2d}
          fontSize={1.1}
          color={isSelected ? '#38bdf8' : '#f8fafc'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.06}
          outlineColor="#020617"
        >
          {label}
        </Text>
      </group>
    </group>
  );
};

// Surface Road Flow Tracer Ribbon (Vibrant glowing neon line on the asphalt)
const SurfaceRoadTracer: React.FC<{
  fromNode?: AssetNode;
  toNode?: AssetNode;
  status: ConduitStatus;
  flowM3s?: number;
  isSelected: boolean;
  onClick: () => void;
}> = ({ fromNode, toNode, status, flowM3s = 0, isSelected, onClick }) => {
  const pulseBeadRef = useRef<THREE.Mesh>(null);

  const { p1, p2, midpoint, length, orientation } = useMemo(() => {
    if (!fromNode || !toNode) {
      return {
        p1: new THREE.Vector3(),
        p2: new THREE.Vector3(),
        midpoint: [0, 0, 0] as [number, number, number],
        length: 0,
        orientation: new THREE.Quaternion(),
      };
    }

    const groundY1 = (fromNode.ground_elevation_m ?? 11.5) + 0.08;
    const groundY2 = (toNode.ground_elevation_m ?? 11.0) + 0.08;

    const v1 = new THREE.Vector3(fromNode.position_m.x, groundY1, -fromNode.position_m.y);
    const v2 = new THREE.Vector3(toNode.position_m.x, groundY2, -toNode.position_m.y);

    const mid = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(v2, v1);
    const len = dir.length();

    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());

    return {
      p1: v1,
      p2: v2,
      midpoint: [mid.x, mid.y, mid.z] as [number, number, number],
      length: len,
      orientation: quaternion,
    };
  }, [fromNode, toNode]);

  const color = useMemo(() => {
    if (isSelected) return '#38bdf8'; // bright cyan
    if (status === 'surcharged') return '#ef4444'; // vivid red
    if (status === 'near_capacity') return '#f59e0b'; // amber/orange
    if (status === 'normal') return '#10b981'; // emerald green
    return '#64748b';
  }, [status, isSelected]);

  // Animated flow pulse traveling from fromNode to toNode
  useFrame((state) => {
    if (pulseBeadRef.current && length > 0) {
      const t = state.clock.getElapsedTime();
      // Flow speed scales with hydraulic flow rate (min 1.0, max 3.5)
      const speed = Math.max(0.8, Math.min(3.5, 0.8 + flowM3s * 1.5));
      const progress = ((t * speed) % 1.0);
      const currentPos = new THREE.Vector3().lerpVectors(p1, p2, progress);
      pulseBeadRef.current.position.copy(currentPos);
    }
  });

  if (!fromNode || !toNode || length <= 0) return null;

  return (
    <group>
      {/* 1. Surface Road Glowing Neon Ribbon */}
      <group position={midpoint} quaternion={orientation}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {/* Cylinder shaped as a flat ribbon along the road */}
          <cylinderGeometry args={[0.42, 0.42, length, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.88}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 2. Flow Energy Pulse Dot traveling along the road surface */}
      <mesh ref={pulseBeadRef} position={[p1.x, p1.y + 0.1, p1.z]}>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export const NetworkHighlightOverlay: React.FC<NetworkHighlightOverlayProps> = ({
  nodes,
  conduits,
  currentFrame,
  selectedAssetId,
  onSelectAsset,
  active,
}) => {
  const nodeMap = useMemo(() => {
    const map = new Map<string, AssetNode>();
    nodes.forEach((n) => map.set(n.node_id, n));
    return map;
  }, [nodes]);

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

  if (!active) return null;

  return (
    <group name="network-highlight-overlay">
      {/* 1. Surface Road Tracers (Glowing ribbons along streets) */}
      {conduits.map((conduit) => {
        const fromId = conduit.from_node_id || conduit.from_node!;
        const toId = conduit.to_node_id || conduit.to_node!;
        const fromNode = nodeMap.get(fromId);
        const toNode = nodeMap.get(toId);
        const state = pipeStateMap.get(conduit.conduit_id);

        return (
          <SurfaceRoadTracer
            key={`tracer-${conduit.conduit_id}`}
            fromNode={fromNode}
            toNode={toNode}
            status={state?.status || 'unknown'}
            flowM3s={state?.flow || 0}
            isSelected={selectedAssetId === conduit.conduit_id}
            onClick={() => onSelectAsset({ type: 'conduit', id: conduit.conduit_id, data: conduit })}
          />
        );
      })}

      {/* 2. 3D Glowing Junction Cube Markers (Manholes) */}
      {nodes.map((node) => {
        const state = nodeStateMap.get(node.node_id);
        return (
          <GlowingJunctionMarker
            key={`marker-${node.node_id}`}
            node={node}
            status={state?.status || 'unknown'}
            isSelected={selectedAssetId === node.node_id}
            onClick={() => onSelectAsset({ type: 'node', id: node.node_id, data: node })}
          />
        );
      })}
    </group>
  );
};
