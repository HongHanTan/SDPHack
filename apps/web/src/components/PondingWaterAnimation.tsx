import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { SimulationFrame, AppMode } from '../types';

interface PondingWaterAnimationProps {
  currentFrame?: SimulationFrame | null;
  floodingActive: boolean;
  appMode?: AppMode;
}

export const PondingWaterAnimation: React.FC<PondingWaterAnimationProps> = ({
  currentFrame,
  floodingActive,
  appMode = 'diagnose',
}) => {
  const waterMeshRef = useRef<THREE.Mesh>(null);
  const rippleGroupRef = useRef<THREE.Group>(null);

  const timestamp = currentFrame?.timestamp_s ?? 1800;

  // Calculate dynamic physical ponding depth and volume based on SWMM frame & timestamp
  const { surfaceDepthM, pondedVolumeM3, poolScale, isFloodingNow } = useMemo(() => {
    // Check if J07 node state indicates surcharge/flooding
    const j07State = currentFrame?.node_states?.find((n) => n.node_id === 'NODE-J07');
    const isNodeFlooding = j07State?.status === 'flooding' || (j07State?.depth_m ?? 0) > 1.45;

    if (!floodingActive && !isNodeFlooding) {
      return {
        surfaceDepthM: 0,
        pondedVolumeM3: 0,
        poolScale: 0,
        isFloodingNow: false,
      };
    }

    // Time-dependent hydrograph curve for synthetic 60-min storm (t: 0 -> 7200)
    // Runoff accumulates from t=600s, peaks around t=1800s ~ 2700s, recedes by t=5400s
    let intensityFraction = 0;
    if (timestamp < 600) {
      intensityFraction = (timestamp / 600) * 0.15;
    } else if (timestamp <= 2100) {
      // Rising limb of hydrograph
      intensityFraction = 0.15 + ((timestamp - 600) / 1500) * 0.85;
    } else if (timestamp <= 3600) {
      // Peak ponding plateau
      intensityFraction = 1.0 - ((timestamp - 2100) / 1500) * 0.15;
    } else if (timestamp <= 6000) {
      // Recession limb as water drains
      intensityFraction = 0.85 * (1 - (timestamp - 3600) / 2400);
    } else {
      intensityFraction = Math.max(0, 0.1 * (1 - (timestamp - 6000) / 1200));
    }

    // Max surface depth reaches 0.28m (28 cm) in diagnosis mode, 0.36m in extreme anticipate mode
    const maxDepth = appMode === 'anticipate' ? 0.36 : 0.28;
    const maxVolume = appMode === 'anticipate' ? 920 : 686;

    const depth = maxDepth * intensityFraction;
    const volume = Math.round(maxVolume * intensityFraction);
    const scale = Math.max(0.01, Math.min(1.0, intensityFraction));

    return {
      surfaceDepthM: depth,
      pondedVolumeM3: volume,
      poolScale: scale,
      isFloodingNow: depth > 0.02,
    };
  }, [currentFrame, floodingActive, timestamp, appMode]);

  // Concentric ripple rings around INLET-D07
  const rippleRings = useMemo(() => {
    return [
      { baseRadius: 1.2, speed: 2.2, phase: 0 },
      { baseRadius: 2.8, speed: 1.8, phase: 1.5 },
      { baseRadius: 4.5, speed: 1.5, phase: 3.0 },
      { baseRadius: 6.5, speed: 1.2, phase: 4.5 },
    ];
  }, []);

  // Animated vertex wave undulation and ripple expansion
  useFrame((state) => {
    const time = state.clock.getElapsedTime();

    // 1. Shimmering water surface subtle wave height
    if (waterMeshRef.current) {
      // Subtle physical breathing / wave surge
      const waveOffset = Math.sin(time * 2.5) * 0.008 + Math.cos(time * 1.8) * 0.005;
      const targetY = 11.02 + surfaceDepthM * 0.95 + waveOffset;
      waterMeshRef.current.position.y = targetY;

      // Dynamic scale expansion along road
      const targetScaleX = Math.max(0.1, poolScale * 14.0);
      const targetScaleZ = Math.max(0.1, poolScale * 22.0);
      waterMeshRef.current.scale.set(targetScaleX, targetScaleZ, 1);
    }

    // 2. Animate concentric ripple rings
    if (rippleGroupRef.current && isFloodingNow) {
      rippleGroupRef.current.children.forEach((child, i) => {
        const ring = rippleRings[i];
        if (!ring) return;
        const progress = ((time * ring.speed + ring.phase) % (Math.PI * 2)) / (Math.PI * 2);
        const radius = (ring.baseRadius + progress * 5.0) * poolScale;
        child.scale.set(radius, radius, 1);
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).opacity =
            (1 - progress) * 0.65 * Math.min(1.0, poolScale * 1.5);
        }
      });
    }
  });

  if (!isFloodingNow && pondedVolumeM3 === 0) {
    return null;
  }

  const depthCm = Math.round(surfaceDepthM * 100);
  const curbHeightCm = 15;
  const isCurbSubmerged = depthCm >= curbHeightCm;

  return (
    <group position={[40, 0, 0]} name="dynamic-ponding-water">
      {/* 1. Main Shimmering Water Pool (Asphalt Surface to Curb Elevation) */}
      <mesh
        ref={waterMeshRef}
        position={[0, 11.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[1, 1, 16, 16]} />
        <meshStandardMaterial
          color={isCurbSubmerged ? '#0e7490' : '#0f766e'}
          roughness={0.06}
          metalness={0.45}
          transparent
          opacity={0.86}
        />
      </mesh>

      {/* 2. Concentric Shockwave Ripples from Clogged Grate (INLET-D07) */}
      <group ref={rippleGroupRef} position={[0, 11.04 + surfaceDepthM, 0]}>
        {rippleRings.map((_, idx) => (
          <mesh
            key={idx}
            position={[0, 0, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.92, 1.0, 32]} />
            <meshBasicMaterial
              color={isCurbSubmerged ? '#f43f5e' : '#38bdf8'}
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* 3. Outer Perimeter Flood Boundary Warning Ribbon */}
      <mesh
        position={[0, 11.03 + surfaceDepthM, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[poolScale * 14.2, poolScale * 22.2, 1]}
      >
        <ringGeometry args={[0.47, 0.5, 32]} />
        <meshBasicMaterial
          color={isCurbSubmerged ? '#f43f5e' : '#fbbf24'}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>

      {/* 4. Physical Flood Depth Metric Gauge Post Planted at Curb Edge */}
      <group position={[7.5, 11.0, 3.5]}>
        {/* Metric gauge post */}
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.6, 12]} />
          <meshStandardMaterial color="#334155" roughness={0.8} />
        </mesh>
        {/* Yellow/Black striped measurement ruler bands */}
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.1, 12]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.1, 12]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        {/* Water surface contact ring on gauge */}
        <mesh position={[0, surfaceDepthM, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.1, 0.28, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
        </mesh>
      </group>

      {/* 5. 3D Floating Flood Depth & Hazard Badge */}
      <group position={[0, 11.1 + surfaceDepthM + 3.8, 0]}>
        <Text
          fontSize={1.3}
          color={isCurbSubmerged ? '#f43f5e' : '#f59e0b'}
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.06}
          outlineColor="#020617"
        >
          {isCurbSubmerged
            ? `🚨 暴雨路面积水超载 | 积水深度: ${depthCm} cm (淹没路牙 +${depthCm - curbHeightCm}cm)`
            : `⚠ 道路低洼积水监测 | 积水深度: ${depthCm} cm`}
        </Text>
        <Text
          position={[0, -0.65, 0]}
          fontSize={0.95}
          color="#f8fafc"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.04}
          outlineColor="#020617"
        >
          {`滞积水量: ${pondedVolumeM3} m³ | 涌积范围: ${(poolScale * 22).toFixed(1)}m × ${(poolScale * 14).toFixed(1)}m`}
        </Text>
      </group>
    </group>
  );
};
