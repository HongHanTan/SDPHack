import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { UserCheck } from 'lucide-react';

interface InspectorAvatarProps {
  position: [number, number, number];
  onOpenDebrisLab: () => void;
  active: boolean;
}

export const InspectorAvatar: React.FC<InspectorAvatarProps> = ({
  position,
  onOpenDebrisLab,
  active,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Subtle breathing / idle motion
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(t * 2) * 0.05;
    }

    // Radar scanning wave pulse
    if (ringRef.current) {
      const scale = 1 + (t % 2) * 1.5;
      ringRef.current.scale.set(scale, scale, 1);
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 1 - (t % 2) * 0.5);
    }

    // Scanning light sweep
    if (beamRef.current) {
      beamRef.current.rotation.y = t * 1.5;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Ground scanning wave ring */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
      >
        <ringGeometry args={[1.2, 1.4, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* 3D Inspector Figure (High-Vis Safety Uniform) */}
      <group position={[0, 0.9, 0]}>
        {/* Legs / Boots */}
        <mesh position={[-0.2, -0.5, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.8, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0.2, -0.5, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.8, 8]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>

        {/* Torso / High-Vis Safety Vest (Neon Orange + Reflective stripes) */}
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.6, 0.7, 0.35]} />
          <meshStandardMaterial color="#ea580c" roughness={0.4} />
        </mesh>
        {/* Silver reflective stripe */}
        <mesh position={[0, 0.15, 0.18]}>
          <planeGeometry args={[0.55, 0.1]} />
          <meshBasicMaterial color="#f1f5f9" />
        </mesh>
        <mesh position={[0, -0.05, 0.18]}>
          <planeGeometry args={[0.55, 0.1]} />
          <meshBasicMaterial color="#f1f5f9" />
        </mesh>

        {/* Head / Face */}
        <mesh position={[0, 0.6, 0]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>

        {/* Safety Helmet (Yellow Hard Hat) */}
        <mesh position={[0, 0.72, 0]}>
          <sphereGeometry args={[0.22, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#eab308" roughness={0.2} metalness={0.1} />
        </mesh>
        {/* Helmet brim */}
        <mesh position={[0, 0.71, 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.3, 16]} />
          <meshStandardMaterial color="#ca8a04" />
        </mesh>

        {/* Tablet / Field Logging Device in hand */}
        <mesh position={[0.3, 0.1, 0.25]} rotation={[0.4, 0.2, -0.1]}>
          <boxGeometry args={[0.25, 0.35, 0.03]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        {/* Glowing tablet screen */}
        <mesh position={[0.3, 0.1, 0.27]} rotation={[0.4, 0.2, -0.1]}>
          <planeGeometry args={[0.2, 0.28]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Floating 2D HUD Tag */}
      <Html position={[0, 2.5, 0]} center distanceFactor={25}>
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenDebrisLab();
          }}
          className={`px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 cursor-pointer flex items-center gap-2 whitespace-nowrap select-none ${
            active
              ? 'bg-amber-500/25 border-amber-400 text-amber-200 scale-105 ring-2 ring-amber-400/50'
              : 'bg-slate-900/90 border-slate-700 hover:border-cyan-400 text-slate-200 hover:scale-105'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <UserCheck className="w-4 h-4 text-cyan-400" />
          <div className="text-left">
            <div className="text-[11px] font-bold tracking-wide">
              Field Inspector (Azman)
            </div>
            <div className="text-[9px] text-amber-300 font-mono">
              ★ D07 Inlet Debris Lab
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
};
