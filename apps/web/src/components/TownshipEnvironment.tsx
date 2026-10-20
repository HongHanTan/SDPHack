import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import layout from '../../../../data/synthetic/taman_kyra_layout.json';
import { SimulationFrame, AppMode } from '../types';
import { PondingWaterAnimation } from './PondingWaterAnimation';
import { displaceFlat } from '../engine/displaceFlat';
import { bowlDrop, lawnHeight } from '../engine/visualGround';
import { useViewLook } from '../view/ViewLookContext';
import { applySurfaceLook } from '../view/surfaceLook';

type HeightAt = (tx: number, ty: number) => number;

/** Disposes a memoised geometry when it is replaced or the component unmounts. */
function useDisposable(geom: THREE.BufferGeometry | null) {
  useEffect(() => () => geom?.dispose(), [geom]);
}

interface TownshipEnvironmentProps {
  showUndergroundOnly?: boolean;
  floodingActive?: boolean;
  appMode?: AppMode;
  currentFrame?: SimulationFrame | null;
  /** Engine mode: dips on lawn/roads, data-driven heights (SceneViewer draws the engine water). */
  engineMode?: boolean;
}

// Low-poly parked suburban vehicle (Sedan / SUV)
const ParkedCar: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  color?: string;
}> = ({ position, rotationY = 0, color = '#2563eb' }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Wheels */}
      <mesh position={[-0.85, 0.28, 1.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[0.85, 0.28, 1.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[-0.85, 0.28, -1.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[0.85, 0.28, -1.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 0.22, 12]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>

      {/* Car Lower Body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.55, 3.8]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.6} />
      </mesh>

      {/* Car Cabin & Windshield */}
      <mesh position={[0, 1.0, -0.2]} castShadow>
        <boxGeometry args={[1.5, 0.5, 2.0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.1} metalness={0.8} />
      </mesh>
    </group>
  );
};

// Realistic Suburban House with multi-gable roof, garage, driveway, and landscaping
const RealisticSuburbanHouse: React.FC<{
  position: [number, number, number];
  rotationY?: number;
  roofColor?: string;
  wallColor?: string;
  hasCar?: boolean;
  carColor?: string;
  scale?: number;
}> = ({
  position,
  rotationY = 0,
  roofColor = '#334155', // slate or terracotta
  wallColor = '#f8fafc',
  hasCar = false,
  carColor = '#3b82f6',
  scale = 1.0,
}) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]}>
      {/* 1. Lot / Lawn Parcel Base (Green yard) */}
      <mesh position={[0, 0.02, 2.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[15.0, 19.0]} />
        <meshStandardMaterial color="#22542a" roughness={0.9} />
      </mesh>

      {/* Backyard perimeter hedges */}
      <mesh position={[-7.2, 0.6, -5.0]}>
        <boxGeometry args={[0.6, 1.2, 8.0]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </mesh>
      <mesh position={[7.2, 0.6, -5.0]}>
        <boxGeometry args={[0.6, 1.2, 8.0]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.6, -9.0]}>
        <boxGeometry args={[15.0, 1.2, 0.6]} />
        <meshStandardMaterial color="#14532d" roughness={0.9} />
      </mesh>

      {/* 2. Concrete Driveway & Front Walkway */}
      <mesh position={[3.2, 0.04, 7.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.2, 8.0]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>
      <mesh position={[-1.5, 0.04, 6.0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 5.0]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>

      {/* 3. Foundation Base (Stone/Brick water table) */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[10.5, 0.8, 11.5]} />
        <meshStandardMaterial color="#64748b" roughness={0.9} />
      </mesh>

      {/* 4. Main House Body (2-Story Volume) */}
      <mesh position={[-1.2, 3.2, -0.5]} castShadow receiveShadow>
        <boxGeometry args={[7.5, 4.8, 10.0]} />
        <meshStandardMaterial color={wallColor} roughness={0.6} />
      </mesh>

      {/* 5. Garage Wing (Projecting Forward) */}
      <mesh position={[3.2, 2.0, 3.0]} castShadow receiveShadow>
        <boxGeometry args={[5.2, 3.2, 6.5]} />
        <meshStandardMaterial color={wallColor} roughness={0.6} />
      </mesh>

      {/* Garage Double Doors */}
      <mesh position={[3.2, 1.6, 6.28]}>
        <planeGeometry args={[4.4, 2.6]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
      </mesh>
      {/* Garage door frame accent */}
      <mesh position={[3.2, 2.95, 6.3]}>
        <boxGeometry args={[4.6, 0.15, 0.08]} />
        <meshStandardMaterial color="#475569" />
      </mesh>

      {/* 6. Front Entrance Porch / Pillars */}
      <mesh position={[-1.5, 1.4, 4.8]} castShadow>
        <boxGeometry args={[2.4, 2.4, 1.4]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.6} />
      </mesh>
      <mesh position={[-1.5, 2.7, 4.8]} castShadow>
        <boxGeometry args={[2.8, 0.25, 1.8]} />
        <meshStandardMaterial color={roofColor} roughness={0.4} />
      </mesh>
      {/* Front Entrance Door */}
      <mesh position={[-1.5, 1.2, 4.52]}>
        <planeGeometry args={[1.0, 2.1]} />
        <meshStandardMaterial color="#78350f" roughness={0.3} />
      </mesh>

      {/* 7. Realistic Multi-Pitched Roofs */}
      {/* Main Roof Gable */}
      <mesh position={[-1.2, 6.7, -0.5]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[5.8, 2.6, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.5} />
      </mesh>
      {/* Garage Roof Cross-Gable */}
      <mesh position={[3.2, 4.4, 3.0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[4.2, 1.8, 4]} />
        <meshStandardMaterial color={roofColor} roughness={0.5} />
      </mesh>

      {/* 8. Chimney */}
      <mesh position={[-3.8, 6.8, -2.5]} castShadow>
        <boxGeometry args={[0.9, 2.8, 0.9]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.9} />
      </mesh>
      <mesh position={[-3.8, 8.25, -2.5]}>
        <boxGeometry args={[1.1, 0.15, 1.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* 9. Windows with White Trim & Reflective Glass */}
      {/* Upper Floor Windows */}
      <mesh position={[-2.8, 4.2, 4.52]}>
        <planeGeometry args={[1.5, 1.6]} />
        <meshStandardMaterial color="#0284c7" roughness={0.1} metalness={0.7} />
      </mesh>
      <mesh position={[0.2, 4.2, 4.52]}>
        <planeGeometry args={[1.5, 1.6]} />
        <meshStandardMaterial color="#0284c7" roughness={0.1} metalness={0.7} />
      </mesh>
      {/* Side Windows */}
      <mesh position={[-4.97, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.0, 1.5]} />
        <meshStandardMaterial color="#0284c7" roughness={0.1} metalness={0.7} />
      </mesh>

      {/* 10. Foundation Landscaping Shrubs */}
      <mesh position={[-4.0, 0.45, 4.8]} castShadow>
        <sphereGeometry args={[0.55, 8, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>
      <mesh position={[-3.0, 0.4, 4.8]} castShadow>
        <sphereGeometry args={[0.45, 8, 8]} />
        <meshStandardMaterial color="#16a34a" roughness={0.8} />
      </mesh>
      <mesh position={[0.4, 0.4, 4.8]} castShadow>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshStandardMaterial color="#15803d" roughness={0.8} />
      </mesh>

      {/* 11. Parked Vehicle in Driveway (Optional) */}
      {hasCar && (
        <ParkedCar position={[3.2, 0.05, 7.2]} rotationY={0} color={carColor} />
      )}
    </group>
  );
};

// Lush Multi-Sphere Suburban Tree
const LushTree: React.FC<{
  position: [number, number, number];
  scale?: number;
  color?: string;
}> = ({ position, scale = 1.0, color = '#15803d' }) => {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Tree Trunk */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.48, 3.6, 8]} />
        <meshStandardMaterial color="#5c2e0b" roughness={0.9} />
      </mesh>

      {/* Natural Clustered Spherical Foliage */}
      <mesh position={[0, 4.5, 0]} castShadow>
        <sphereGeometry args={[2.2, 10, 10]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0.9, 4.2, 0.8]} castShadow>
        <sphereGeometry args={[1.7, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[-0.8, 4.0, -0.7]} castShadow>
        <sphereGeometry args={[1.8, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0.2, 5.8, -0.2]} castShadow>
        <sphereGeometry args={[1.5, 8, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  );
};

// Realistic Street Segment with Asphalt, White Markings & Curbs
const DetailedRoadSegment: React.FC<{
  position: [number, number, number];
  width: number;
  length: number;
  rotationY?: number;
  /** Engine mode: absolute surface height at a team-datum point (road dips). */
  heightAt?: HeightAt;
}> = ({ position, width, length, rotationY = 0, heightAt }) => {
  const [px, py, pz] = position;
  const engine = heightAt !== undefined;
  // heightAt for a given segment is a pure function of its position, so memos key on `engine`, not its identity.
  const asphaltGeom = useMemo(
    () =>
      heightAt
        ? displaceFlat(
            new THREE.PlaneGeometry(width, length, Math.max(1, Math.ceil(width / 2)), Math.max(1, Math.ceil(length / 2))),
            { x: px, y: py, z: pz, rotY: rotationY, meshY: 0.02 },
            heightAt,
          )
        : null,
    [engine, width, length, px, py, pz, rotationY],
  );
  const lineGeom = useMemo(
    () =>
      heightAt
        ? displaceFlat(
            new THREE.PlaneGeometry(0.22, length * 0.95, 1, Math.max(1, Math.ceil(length / 2))),
            { x: px, y: py, z: pz, rotY: rotationY, meshY: 0.03 },
            heightAt,
          )
        : null,
    [engine, length, px, py, pz, rotationY],
  );
  const curbs = useMemo(() => {
    if (!heightAt) return null;
    const n = Math.ceil(length / 4);
    const pieceLen = length / n;
    const c = Math.cos(rotationY);
    const s = Math.sin(rotationY);
    const pieces: Array<{ key: string; pos: [number, number, number] }> = [];
    for (const lx of [-width / 2 - 0.7, width / 2 + 0.7]) {
      for (let k = 0; k < n; k++) {
        const lz = -length / 2 + (k + 0.5) * pieceLen;
        const sx = px + lx * c + lz * s;
        const sz = pz - lx * s + lz * c;
        pieces.push({ key: `${lx}-${k}`, pos: [lx, 0.09 + (heightAt(sx, -sz) - py), lz] });
      }
    }
    return { pieceLen, pieces };
  }, [engine, width, length, px, py, pz, rotationY]);
  useDisposable(asphaltGeom);
  useDisposable(lineGeom);

  if (asphaltGeom && lineGeom && curbs) {
    return (
      <group position={position} rotation={[0, rotationY, 0]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={asphaltGeom}>
          <meshStandardMaterial color="#1e293b" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} geometry={lineGeom}>
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
        {curbs.pieces.map((p) => (
          <mesh key={p.key} position={p.pos}>
            <boxGeometry args={[1.4, 0.18, curbs.pieceLen]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.7} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Asphalt Surface */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>

      {/* Painted White Dashed Centerline */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, length * 0.95]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
      </mesh>

      {/* Left Concrete Curb */}
      <mesh position={[-width / 2 - 0.7, 0.09, 0]}>
        <boxGeometry args={[1.4, 0.18, length]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} />
      </mesh>

      {/* Right Concrete Curb */}
      <mesh position={[width / 2 + 0.7, 0.09, 0]}>
        <boxGeometry args={[1.4, 0.18, length]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.7} />
      </mesh>
    </group>
  );
};

// Circular Cul-De-Sac Turnaround Loop
const CulDeSac: React.FC<{
  position: [number, number, number];
  radius: number;
  /** Engine mode: absolute surface height at a team-datum point (road dips). */
  heightAt?: HeightAt;
}> = ({ position, radius, heightAt }) => {
  const [px, py, pz] = position;
  const engine = heightAt !== undefined;
  const circleGeom = useMemo(
    () => (heightAt ? displaceFlat(new THREE.CircleGeometry(radius, 32), { x: px, y: py, z: pz, rotY: 0, meshY: 0.02 }, heightAt) : null),
    [engine, radius, px, py, pz],
  );
  useDisposable(circleGeom);

  if (heightAt && circleGeom) {
    const off = heightAt(px, -pz) - py;
    return (
      <group position={position}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={circleGeom}>
          <meshStandardMaterial color="#1e293b" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.1 + off, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[radius * 0.38, 24]} />
          <meshStandardMaterial color="#15803d" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.15 + off, 0]}>
          <cylinderGeometry args={[radius * 0.4, radius * 0.4, 0.2, 24]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.8} />
        </mesh>
        <LushTree position={[0, 0.2 + off, 0]} scale={0.9} color="#16a34a" />
      </group>
    );
  }

  return (
    <group position={position}>
      {/* Asphalt Turnaround Circle */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>
      {/* Center Island Greenery */}
      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.38, 24]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[radius * 0.4, radius * 0.4, 0.2, 24]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.8} />
      </mesh>
      {/* Tree inside Cul-de-sac island */}
      <LushTree position={[0, 0.2, 0]} scale={0.9} color="#16a34a" />
    </group>
  );
};

const TownshipEnvironmentInner: React.FC<TownshipEnvironmentProps> = ({
  showUndergroundOnly = false,
  floodingActive = true,
  appMode = 'diagnose',
  currentFrame,
  engineMode = false,
}) => {
  // X-ray / plan view (legacy viewer port): ghost the surface, hide trees and (in 2D) labels.
  const { ghost, is2d } = useViewLook();
  const rootRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (rootRef.current) applySurfaceLook(rootRef.current, ghost, is2d);
  });
  // Placement data extracted from this component's original loops (TEH JIA JIE) into data/synthetic/taman_kyra_layout.json
  // Houses Layout across all neighborhood zones
  const houses = useMemo(() => {
    const list: Array<{
      pos: [number, number, number];
      rotY: number;
      roof: string;
      wall: string;
      hasCar: boolean;
      carColor: string;
      scale: number;
    }> = [];

    for (const h of layout.houses) {
      list.push({
        pos: [h.x, engineMode ? lawnHeight(h.x, h.y) : h.sceneY, -h.y],
        rotY: (h.rotationDeg * Math.PI) / 180,
        roof: h.roof,
        wall: h.wall,
        hasCar: h.hasCar,
        carColor: h.carColor,
        scale: h.scale,
      });
    }

    return list;
  }, [engineMode]);

  // Trees Layout (Clusters of rich lush trees around parcels and parks)
  const trees = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; scale: number; color: string }> = [];
    for (const t of layout.trees) {
      list.push({ pos: [t.x, engineMode ? lawnHeight(t.x, t.y) : t.sceneY, -t.y], scale: t.scale, color: t.color });
    }

    return list;
  }, [engineMode]);

  const lawnGeom = useMemo(
    () => (engineMode ? displaceFlat(new THREE.PlaneGeometry(240, 280, 120, 140), { x: 45, y: 10.8, z: -10, rotY: 0, meshY: 0 }, lawnHeight) : null),
    [engineMode],
  );
  useDisposable(lawnGeom);
  // Engine mode: each road's own surface level minus the engine's dips; undefined keeps the original flat roads.
  const roadHeight = (surfaceY: number): HeightAt | undefined =>
    engineMode ? (tx, ty) => surfaceY - bowlDrop(tx, ty) : undefined;

  if (showUndergroundOnly) {
    // Underground Highlight Mode: Show faint blueprint footprint
    return (
      <group ref={rootRef} position={[0, 0, 0]}>
        <mesh position={[50, 10.8, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noGhost: true }}>
          <planeGeometry args={[240, 260]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.35} wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={rootRef} position={[0, 0, 0]}>
      {/* 1. Base Neighborhood Lawn & Terrain Surface */}
      {lawnGeom ? (
        <mesh position={[45, 10.8, -10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={lawnGeom}>
          <meshStandardMaterial color="#1e3a24" roughness={0.95} />
        </mesh>
      ) : (
      <mesh position={[45, 10.8, -10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[240, 280]} />
        <meshStandardMaterial
          color="#1e3a24" // rich suburban lawn green
          roughness={0.95}
        />
      </mesh>
      )}

      {/* 2. Detailed Asphalt Roadways, Curbs & Markings */}
      <group position={[0, 0, 0]}>
        {/* North Street (y = 120, z = -120) */}
        <DetailedRoadSegment
          position={[45, 12.15, -120]}
          width={13}
          length={145}
          rotationY={Math.PI / 2}
          heightAt={roadHeight(12.15)}
        />

        {/* Mid Residential Street (y = 80, z = -80) */}
        <DetailedRoadSegment
          position={[65, 11.85, -80]}
          width={11}
          length={105}
          rotationY={Math.PI / 2}
          heightAt={roadHeight(11.85)}
        />

        {/* Central Main Avenue (y = 0, z = 0) */}
        <DetailedRoadSegment
          position={[45, 10.98, 0]}
          width={15}
          length={155}
          rotationY={Math.PI / 2}
          heightAt={roadHeight(10.98)}
        />

        {/* North-South Main Drainage Boulevard (x = 40, z = -140 to 70) */}
        <DetailedRoadSegment
          position={[40, 11.2, -35]}
          width={13}
          length={195}
          rotationY={0}
          heightAt={roadHeight(11.2)}
        />

        {/* East Diagonal Connector */}
        <DetailedRoadSegment
          position={[85, 11.5, -40]}
          width={10}
          length={95}
          rotationY={Math.PI / 4}
          heightAt={roadHeight(11.5)}
        />

        {/* Cul-De-Sac Turnaround Loop at East End of Mid Street */}
        <CulDeSac position={[120, 11.86, -80]} radius={10.5} heightAt={roadHeight(11.86)} />
      </group>

      {/* 3. Realistic Suburban Villas (Houses with garages, porches & parked cars) */}
      {houses.map((h, idx) => (
        <RealisticSuburbanHouse
          key={`house-${idx}`}
          position={h.pos}
          rotationY={h.rotY}
          roofColor={h.roof}
          wallColor={h.wall}
          hasCar={h.hasCar}
          carColor={h.carColor}
          scale={h.scale}
        />
      ))}

      {/* 4. Lush Spherical Garden Trees */}
      {!(ghost || is2d) &&
        trees.map((t, idx) => (
          <LushTree
            key={`tree-${idx}`}
            position={t.pos}
            scale={t.scale}
            color={t.color}
          />
        ))}

      {/* 5. Maple Grove Retention Pond & Lake Park */}
      <group position={[130, 11.1, -30]}>
        {/* Lake shoreline sand/rock basin */}
        <mesh position={[0, -0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 20.5, 36]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>

        {/* Reflective Deep Blue Lake Water */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[20.0, 36]} />
          <meshStandardMaterial
            color="#0284c7"
            roughness={0.08}
            metalness={0.75}
            transparent
            opacity={0.88}
          />
        </mesh>

        {/* Fountain Water Spray Spout */}
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[0.25, 0.6, 2.8, 12]} />
          <meshStandardMaterial color="#bae6fd" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh position={[0, 2.6, 0]}>
          <sphereGeometry args={[0.8, 12, 12]} />
          <meshStandardMaterial color="#e0f2fe" transparent opacity={0.7} />
        </mesh>

        {/* 3D Pond Badge */}
        <group position={[0, 4.0, 0]}>
          <Text
            fontSize={1.6}
            color="#38bdf8"
            anchorX="center"
            anchorY="bottom"
          >
            Maple Grove Retention Pond
          </Text>
        </group>
      </group>

      {/* 6. East Drain Outfall & Canal Embankment */}
      <group position={[40, 10.3, 90]}>
        {/* Concrete Canal Retaining Walls */}
        <mesh position={[-8.5, 0.5, 0]}>
          <boxGeometry args={[1.4, 2.0, 75]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>
        <mesh position={[8.5, 0.5, 0]}>
          <boxGeometry args={[1.4, 2.0, 75]} />
          <meshStandardMaterial color="#64748b" roughness={0.8} />
        </mesh>

        {/* Canal Water Surface Flow */}
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[15.6, 75]} />
          <meshStandardMaterial
            color="#0369a1"
            roughness={0.12}
            metalness={0.65}
            transparent
            opacity={0.85}
          />
        </mesh>

        {/* Outfall 3D Badge */}
        <group position={[0, 3.5, 12]}>
          <Text
            fontSize={1.5}
            color="#38bdf8"
            anchorX="center"
            anchorY="bottom"
          >
            East Drain Outfall (NODE-OUT01)
          </Text>
        </group>
      </group>

      {/* 7. Dynamic Street Surface Ponding Water Animation (Physically rises with runoff) */}
      {/* Engine mode: the engine water surface is rendered by SceneViewer beside this component, so Live frames don't re-render the township. */}
      {engineMode ? null : (
        <group userData={{ noGhost: true }}>
          <PondingWaterAnimation
            currentFrame={currentFrame}
            floodingActive={Boolean(floodingActive)}
            appMode={appMode}
          />
        </group>
      )}

      {/* 8. 3D Floating Neighborhood Badges (Matching the Mockup Exactly) */}
      <group position={[0, 0, 0]}>
        {/* Pinecrest Residential */}
        <group position={[10, 19.5, 0]}>
          <Text
            fontSize={1.8}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            Pinecrest Residential
          </Text>
        </group>

        {/* North Ridge Subdivision */}
        <group position={[45, 20.5, -120]}>
          <Text
            fontSize={1.8}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            North Ridge Subdivision
          </Text>
        </group>

        {/* Cedar View Estates */}
        <group position={[-28, 19.0, -40]}>
          <Text
            fontSize={1.8}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            Cedar View Estates
          </Text>
        </group>

        {/* Riverside Heights */}
        <group position={[85, 18.5, 55]}>
          <Text
            fontSize={1.8}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            Riverside Heights
          </Text>
        </group>

        {/* 3D Sky Mode Title */}
        <group position={[45, 27.0, -60]}>
          <Text
            fontSize={2.2}
            color={appMode === 'idle' ? '#10b981' : appMode === 'diagnose' ? '#f59e0b' : '#38bdf8'}
            anchorX="center"
            anchorY="bottom"
          >
            {appMode === 'idle'
              ? '📡 Active Grid Patrol & Field Telemetry Zone (Taman Kyra)'
              : appMode === 'diagnose'
              ? '🔍 Historical Ponding Forensic & Diagnosis Zone (Taman Kyra)'
              : '⚡ 50-Year Extreme Monsoon Flood Stress Test Zone (120 mm/h)'}
          </Text>
        </group>
      </group>
    </group>
  );
};

// Memoised so engine Live frames (which only change the water) don't rebuild the houses, trees and roads.
export const TownshipEnvironment = React.memo(TownshipEnvironmentInner);
