import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { AppMode, FieldInspector } from '../types';

export const FIELD_INSPECTORS: FieldInspector[] = [
  {
    id: 'inspector-azman',
    name: 'Inspector Azman',
    unit: 'Unit A',
    role: 'Inlet Visual Inspection & Debris Sampling',
    assignedAssetId: 'INLET-D07',
    assignedZone: 'Zone 1: Cul-de-sac Lowland Island',
    position: [43.0, 11.0, 2.5],
    status: 'transmitting',
    batteryPct: 94,
    lastTelemetry: {
      timestamp: 'Live',
      metric: 'Inlet Throat Openness',
      value: '35% (65% Blocked)',
      status: 'warning',
    },
  },
  {
    id: 'inspector-siti',
    name: 'Inspector Siti',
    unit: 'Unit B',
    role: 'In-Pipe CCTV Crawler Inspection',
    assignedAssetId: 'PIPE-P04',
    assignedZone: 'Zone 2: Pinecrest Main Trunk',
    position: [48.0, 9.8, -12.0],
    status: 'transmitting',
    batteryPct: 88,
    lastTelemetry: {
      timestamp: 'Live',
      metric: 'CCTV Distance & Silt',
      value: '18.2m / 70mm Silt',
      status: 'normal',
    },
  },
  {
    id: 'inspector-muthu',
    name: 'Inspector Muthu',
    unit: 'Unit C',
    role: 'Lake Sediment & Hydrology Telemetry',
    assignedAssetId: 'NODE-J06',
    assignedZone: 'Zone 3: Maple Grove Retention Pond',
    position: [82.0, 10.8, -20.0],
    status: 'online',
    batteryPct: 91,
    lastTelemetry: {
      timestamp: 'Live',
      metric: 'Inflow Turbidity / Stage',
      value: '12 NTU / 10.45m',
      status: 'normal',
    },
  },
  {
    id: 'inspector-kevin',
    name: 'Inspector Kevin',
    unit: 'Unit D',
    role: 'Outfall Sluice & Tailwater Monitoring',
    assignedAssetId: 'NODE-OUT01',
    assignedZone: 'Zone 4: East Drain Open Canal',
    position: [132.0, 9.2, -6.0],
    status: 'transmitting',
    batteryPct: 96,
    lastTelemetry: {
      timestamp: 'Live',
      metric: 'Receiving Canal Stage',
      value: '1.18m (Free Flow)',
      status: 'normal',
    },
  },
];

interface FieldInspectorsManagerProps {
  appMode?: AppMode;
  onSelectInspector?: (inspector: FieldInspector) => void;
  selectedInspectorId?: string | null;
}

// Single Inspector 3D Mesh with animated transmission telemetry wave rings
const SingleInspectorMesh: React.FC<{
  inspector: FieldInspector;
  isIdle: boolean;
  isSelected: boolean;
  onClick: () => void;
}> = ({ inspector, isIdle, isSelected, onClick }) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef1 = useRef<THREE.Mesh>(null);
  const ringRef2 = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  // Subtle breathing and transmission pulses
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      // Subtle idle breathing motion
      groupRef.current.position.y =
        inspector.position[1] + Math.sin(t * 2 + inspector.position[0]) * 0.03;
    }

    // Radio transmission wave animation
    const speed = isIdle ? 2.0 : 1.2;
    if (ringRef1.current) {
      const s1 = ((t * speed) % 2) + 0.5;
      ringRef1.current.scale.set(s1, s1, s1);
      (ringRef1.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - (s1 - 0.5) / 2
      );
    }
    if (ringRef2.current) {
      const s2 = (((t * speed) + 1.0) % 2) + 0.5;
      ringRef2.current.scale.set(s2, s2, s2);
      (ringRef2.current.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        1 - (s2 - 0.5) / 2
      );
    }
  });

  const isWarning = inspector.lastTelemetry.status === 'warning';
  const beaconColor = isWarning ? '#f59e0b' : '#10b981';

  return (
    <group ref={groupRef} position={inspector.position}>
      {/* 1. Wireless Transmission Beacon Rings (5G Telemetry to Operations Cloud) */}
      <mesh
        ref={ringRef1}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.8, 1.1, 32]} />
        <meshBasicMaterial
          color={beaconColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        ref={ringRef2}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.8, 1.1, 32]} />
        <meshBasicMaterial
          color={beaconColor}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. Interactive Click Collider */}
      <mesh
        position={[0, 0.9, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        visible={false}
      >
        <cylinderGeometry args={[0.8, 0.8, 2.0, 12]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* 3. 3D Body Representation (Professional Safety Attire) */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Work Boots */}
        <mesh position={[-0.15, 0.1, 0.05]}>
          <boxGeometry args={[0.15, 0.2, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>
        <mesh position={[0.15, 0.1, 0.05]}>
          <boxGeometry args={[0.15, 0.2, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.8} />
        </mesh>

        {/* Navy Work Trousers */}
        <mesh position={[-0.15, 0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.6, 12]} />
          <meshStandardMaterial color="#0f172a" roughness={0.7} />
        </mesh>
        <mesh position={[0.15, 0.45, 0]}>
          <cylinderGeometry args={[0.1, 0.11, 0.6, 12]} />
          <meshStandardMaterial color="#0f172a" roughness={0.7} />
        </mesh>

        {/* High-Visibility Reflective Vest / Torso */}
        <mesh position={[0, 1.05, 0]}>
          <cylinderGeometry args={[0.26, 0.22, 0.65, 14]} />
          <meshStandardMaterial
            color={hovered || isSelected ? '#fbbf24' : '#f97316'}
            roughness={0.4}
            metalness={0.1}
          />
        </mesh>

        {/* Reflective Silver Strips on Vest */}
        <mesh position={[0, 1.15, 0]}>
          <cylinderGeometry args={[0.265, 0.265, 0.06, 14]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.6}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.245, 0.245, 0.06, 14]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.6}
            roughness={0.2}
          />
        </mesh>

        {/* Head & Neck */}
        <mesh position={[0, 1.48, 0]}>
          <sphereGeometry args={[0.14, 16, 16]} />
          <meshStandardMaterial color="#d4a373" roughness={0.6} />
        </mesh>

        {/* Safety Hardhat with Headlamp */}
        <mesh position={[0, 1.58, 0]}>
          <sphereGeometry args={[0.17, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#eab308"
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>
        {/* Hardhat Rim */}
        <mesh position={[0, 1.55, 0.02]} rotation={[-0.1, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.03, 16]} />
          <meshStandardMaterial color="#ca8a04" roughness={0.3} />
        </mesh>
        {/* Headlamp */}
        <mesh position={[0, 1.62, 0.16]}>
          <boxGeometry args={[0.07, 0.05, 0.04]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={0.8}
          />
        </mesh>

        {/* Arms holding Handheld Telemetry Scanner / Tablet */}
        <mesh position={[-0.26, 0.98, 0.12]} rotation={[0.6, 0.2, -0.2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.45, 10]} />
          <meshStandardMaterial color="#f97316" roughness={0.5} />
        </mesh>
        <mesh position={[0.26, 0.98, 0.12]} rotation={[0.6, -0.2, 0.2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.45, 10]} />
          <meshStandardMaterial color="#f97316" roughness={0.5} />
        </mesh>

        {/* Handheld Rugged Tablet (GIS Field Logger) */}
        <mesh position={[0, 0.92, 0.32]} rotation={[-0.6, 0, 0]}>
          <boxGeometry args={[0.28, 0.18, 0.02]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} />
        </mesh>
        {/* Glowing Screen of Tablet */}
        <mesh position={[0, 0.925, 0.32]} rotation={[-0.6, 0, 0]}>
          <planeGeometry args={[0.24, 0.15]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>

        {/* Laser Scanning Beam projecting down towards drainage opening */}
        <mesh position={[0, 0.4, 0.7]} rotation={[0.5, 0, 0]}>
          <coneGeometry args={[0.35, 1.0, 16, 1, true]} />
          <meshBasicMaterial
            color={beaconColor}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* 4. Overhead Floating 3D Telemetry Badge */}
      <Html
        position={[0, 2.2, 0]}
        center
        distanceFactor={22}
        className="pointer-events-auto select-none"
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl backdrop-blur-md shadow-xl border transition-all cursor-pointer whitespace-nowrap text-xs ${
            isSelected || hovered
              ? 'bg-[#181111]/95 border-red-500 scale-105 ring-2 ring-red-500/40 text-white'
              : 'bg-[#140e0e]/90 border-stone-800 text-stone-200 hover:border-stone-600'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isWarning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="font-bold text-[11px] text-stone-100">
            {inspector.unit}: {inspector.name.split(' ')[1]}
          </span>
          <span className="text-[10px] text-stone-400 font-mono">
            {inspector.assignedAssetId}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 font-mono">
            📡 Live Uplink
          </span>
        </div>
      </Html>
    </group>
  );
};

export const FieldInspectorsManager: React.FC<FieldInspectorsManagerProps> = ({
  appMode,
  onSelectInspector,
  selectedInspectorId,
}) => {
  const isIdle = appMode === 'idle';

  return (
    <group>
      {FIELD_INSPECTORS.map((inspector) => (
        <SingleInspectorMesh
          key={inspector.id}
          inspector={inspector}
          isIdle={isIdle}
          isSelected={selectedInspectorId === inspector.id}
          onClick={() => onSelectInspector?.(inspector)}
        />
      ))}
    </group>
  );
};
