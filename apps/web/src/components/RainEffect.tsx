import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RainEffectProps {
  active: boolean;
  intensity?: number; // 0.0 to 1.0 (default 1.0)
  stormIntensityMmh?: number; // e.g. 80 mm/h or 120 mm/h
}

const RAIN_COUNT = 3800;
const STREAK_LENGTH = 2.4;
const WIND_X = -0.32;
const WIND_Z = 0.16;

export const RainEffect: React.FC<RainEffectProps> = ({
  active,
  intensity = 1.0,
  stormIntensityMmh = 80,
}) => {
  const lineGeoRef = useRef<THREE.BufferGeometry>(null);
  const splashGroupRef = useRef<THREE.Group>(null);

  // Initialize raindrop positions and speeds
  const { positions, speeds, posArray } = useMemo(() => {
    const pos = new Float32Array(RAIN_COUNT * 3); // Internal particle position [x, y, z]
    const spd = new Float32Array(RAIN_COUNT);
    const linePositions = new Float32Array(RAIN_COUNT * 6); // 2 vertices per line streak

    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = -70 + Math.random() * 230;
      const y = 11.0 + Math.random() * 85;
      const z = -160 + Math.random() * 300;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Varied terminal velocities between 60m/s and 90m/s
      spd[i] = 65 + Math.random() * 25;

      // Line start (top)
      linePositions[i * 6] = x;
      linePositions[i * 6 + 1] = y;
      linePositions[i * 6 + 2] = z;

      // Line end (bottom, angled with wind slant)
      linePositions[i * 6 + 3] = x + WIND_X;
      linePositions[i * 6 + 4] = y - STREAK_LENGTH;
      linePositions[i * 6 + 5] = z + WIND_Z;
    }

    return { positions: pos, speeds: spd, posArray: linePositions };
  }, []);

  // Splash ripple data for road and lake surfaces
  const splashes = useMemo(() => {
    return Array.from({ length: 48 }, (_, i) => ({
      x: 10 + (i % 8) * 12 + (Math.random() - 0.5) * 8,
      z: -30 + Math.floor(i / 8) * 12 + (Math.random() - 0.5) * 8,
      y: 11.06,
      phase: Math.random() * Math.PI * 2,
      speed: 3 + Math.random() * 3,
    }));
  }, []);

  useFrame((state, delta) => {
    if (!active || !lineGeoRef.current) return;

    // Constrain delta to avoid sudden large leaps
    const dt = Math.min(delta, 0.05);
    const speedMult = (stormIntensityMmh >= 100 ? 1.25 : 1.0) * intensity;
    const posAttr = lineGeoRef.current.attributes.position;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < RAIN_COUNT; i++) {
      let x = positions[i * 3];
      let y = positions[i * 3 + 1];
      let z = positions[i * 3 + 2];

      // Move down with wind drift
      y -= speeds[i] * dt * speedMult;
      x += (WIND_X / STREAK_LENGTH) * speeds[i] * dt * speedMult * 0.4;
      z += (WIND_Z / STREAK_LENGTH) * speeds[i] * dt * speedMult * 0.4;

      // Ground collision check: reset to cloud ceiling
      if (y < 11.0) {
        y = 85.0 + Math.random() * 15.0;
        x = -70 + Math.random() * 230;
        z = -160 + Math.random() * 300;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Update line segment vertices
      const idx = i * 6;
      array[idx] = x;
      array[idx + 1] = y;
      array[idx + 2] = z;

      array[idx + 3] = x + WIND_X;
      array[idx + 4] = y - STREAK_LENGTH;
      array[idx + 5] = z + WIND_Z;
    }

    posAttr.needsUpdate = true;

    // Animate splash ripples
    if (splashGroupRef.current) {
      const time = state.clock.getElapsedTime();
      splashGroupRef.current.children.forEach((child, i) => {
        const s = splashes[i];
        if (!s) return;
        const progress = ((time * s.speed + s.phase) % (Math.PI * 2)) / (Math.PI * 2);
        const scale = 0.2 + progress * 1.6;
        child.scale.set(scale, scale, 1);
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.45 * intensity;
        }
      });
    }
  });

  if (!active) return null;

  return (
    <group name="rain-system">
      {/* 1. Falling Rain Streaks */}
      <lineSegments>
        <bufferGeometry ref={lineGeoRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[posArray, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color={stormIntensityMmh >= 100 ? '#e0f2fe' : '#bae6fd'}
          transparent
          opacity={0.6 * intensity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* 2. Ground Impact Splash Ripples */}
      <group ref={splashGroupRef}>
        {splashes.map((s, idx) => (
          <mesh
            key={idx}
            position={[s.x, s.y, s.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.3, 0.45, 12]} />
            <meshBasicMaterial
              color="#bae6fd"
              transparent
              opacity={0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* 3. Soft Atmospheric Monsoon Cloud Sheet High Above */}
      <mesh position={[45, 96, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[260, 320]} />
        <meshBasicMaterial
          color="#334155"
          transparent
          opacity={0.25 * intensity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
