import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';

interface TownshipEnvironmentProps {
  showUndergroundOnly?: boolean;
  floodingActive?: boolean;
  appMode?: 'diagnose' | 'anticipate';
}

// Low-poly modern residential terrace house
const House: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  roofColor?: string;
  wallColor?: string;
  scale?: [number, number, number];
}> = ({
  position,
  rotation = [0, 0, 0],
  roofColor = '#b45309', // terracotta or slate
  wallColor = '#f1f5f9',
  scale = [1, 1, 1],
}) => {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* House Main Body (2-story) */}
      <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[9.5, 6.4, 11.0]} />
        <meshStandardMaterial color={wallColor} roughness={0.7} />
      </mesh>

      {/* Pitched Roof (Gable style) */}
      <mesh position={[0, 7.8, 0]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[7.8, 3.0, 4]} />
        <meshStandardMaterial
          color={roofColor}
          roughness={0.5}
        />
      </mesh>

      {/* Front Entrance Porch / Carport */}
      <mesh position={[0, 1.8, 6.5]} castShadow>
        <boxGeometry args={[7.0, 3.6, 2.5]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>

      {/* Driveway Concrete Slab */}
      <mesh position={[0, 0.05, 8.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7.5, 4.0]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.8} />
      </mesh>

      {/* Upper Floor Windows */}
      <mesh position={[2.2, 4.6, 5.55]}>
        <planeGeometry args={[2.0, 1.5]} />
        <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[-2.2, 4.6, 5.55]}>
        <planeGeometry args={[2.0, 1.5]} />
        <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
};

// Low-poly Suburban Garden Tree
const Tree: React.FC<{
  position: [number, number, number];
  scale?: number;
  foliageColor?: string;
}> = ({ position, scale = 1, foliageColor = '#15803d' }) => {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Tree Trunk */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.45, 3.2, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* Foliage Top Cone 1 */}
      <mesh position={[0, 3.8, 0]} castShadow>
        <coneGeometry args={[2.0, 2.8, 8]} />
        <meshStandardMaterial color={foliageColor} roughness={0.8} />
      </mesh>
      {/* Foliage Top Cone 2 */}
      <mesh position={[0, 5.2, 0]} castShadow>
        <coneGeometry args={[1.5, 2.2, 8]} />
        <meshStandardMaterial color={foliageColor} roughness={0.8} />
      </mesh>
    </group>
  );
};

// Street Segment with Asphalt & White Center Dashes
const RoadSegment: React.FC<{
  position: [number, number, number];
  width: number;
  length: number;
  rotationY?: number;
}> = ({ position, width, length, rotationY = 0 }) => {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Asphalt road surface */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#1e293b" roughness={0.85} />
      </mesh>

      {/* Sidewalk left curb */}
      <mesh position={[-width / 2 - 0.7, 0.08, 0]}>
        <boxGeometry args={[1.4, 0.16, length]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>

      {/* Sidewalk right curb */}
      <mesh position={[width / 2 + 0.7, 0.08, 0]}>
        <boxGeometry args={[1.4, 0.16, length]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
      </mesh>
    </group>
  );
};

export const TownshipEnvironment: React.FC<TownshipEnvironmentProps> = ({
  showUndergroundOnly = false,
  floodingActive = true,
  appMode = 'diagnose',
}) => {
  // Houses Layout: positioned along the residential roads
  const houseData = useMemo(() => {
    const list: Array<{
      pos: [number, number, number];
      rot: [number, number, number];
      roof: string;
      wall: string;
    }> = [];

    const roofColors = ['#b45309', '#0369a1', '#334155', '#c2410c', '#475569'];

    // 1. North Ridge Subdivision (North of Street y=120, Three.js z = -120)
    for (let x = -10; x <= 95; x += 15) {
      list.push({
        pos: [x, 12.2, -135],
        rot: [0, 0, 0],
        roof: roofColors[Math.abs(Math.floor(x / 15)) % roofColors.length],
        wall: '#f8fafc',
      });
    }

    // 2. Middle Row between North and Mid Streets (y=100, Three.js z = -100)
    for (let x = 5; x <= 90; x += 16) {
      list.push({
        pos: [x, 12.0, -105],
        rot: [0, Math.PI, 0],
        roof: roofColors[(Math.abs(Math.floor(x / 16)) + 1) % roofColors.length],
        wall: '#f1f5f9',
      });
    }

    // 3. Pinecrest Residential (North of Main Street y=0, Three.js z = 0, at z = -18)
    for (let x = -20; x <= 85; x += 15) {
      // Leave space near low point (x=40)
      if (Math.abs(x - 40) < 6) continue;
      list.push({
        pos: [x, 11.0, -20],
        rot: [0, 0, 0],
        roof: roofColors[Math.abs(Math.floor(x / 14)) % roofColors.length],
        wall: '#fafafa',
      });
    }

    // 4. Pinecrest South Row (South of Main Street y=0, at z = 20)
    for (let x = -20; x <= 85; x += 15) {
      if (Math.abs(x - 40) < 6) continue;
      list.push({
        pos: [x, 10.9, 20],
        rot: [0, Math.PI, 0],
        roof: roofColors[(Math.abs(Math.floor(x / 14)) + 2) % roofColors.length],
        wall: '#f8fafc',
      });
    }

    // 5. Cedar View Estates (West of Main Boulevard, x = -15 to -30)
    for (let z = -70; z <= 40; z += 18) {
      list.push({
        pos: [-22, 11.4, z],
        rot: [0, Math.PI / 2, 0],
        roof: roofColors[(Math.abs(Math.floor(z / 18)) + 3) % roofColors.length],
        wall: '#f1f5f9',
      });
    }

    // 6. Riverside Heights (Near Outfall, south end, z = 75)
    for (let x = 60; x <= 95; x += 16) {
      list.push({
        pos: [x, 10.5, 65],
        rot: [0, 0, 0],
        roof: roofColors[Math.abs(Math.floor(x / 16)) % roofColors.length],
        wall: '#f8fafc',
      });
    }

    return list;
  }, []);

  // Trees Layout
  const treeData = useMemo(() => {
    const list: Array<[number, number, number]> = [];
    // Trees along North Street
    for (let x = -15; x <= 100; x += 12) {
      list.push([x, 12.2, -127]);
    }
    // Trees along Central Street
    for (let x = -25; x <= 90; x += 10) {
      list.push([x, 11.0, -9]);
      list.push([x, 10.9, 9]);
    }
    // Trees around Lake Retention Area
    for (let angle = 0; angle < Math.PI * 2; angle += 0.5) {
      const rx = 125 + Math.cos(angle) * 22;
      const rz = -25 + Math.sin(angle) * 16;
      list.push([rx, 11.2, rz]);
    }
    return list;
  }, []);

  if (showUndergroundOnly) {
    // Underground Highlight Mode: Show faint blueprint footprint
    return (
      <group position={[0, 0, 0]}>
        {/* Faint ground wireframe */}
        <mesh position={[50, 10.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[220, 240]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.4} wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Base Suburban Terrain Grass Surface */}
      <mesh position={[45, 10.8, -10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 260]} />
        <meshStandardMaterial
          color="#1e3a24" // lush green suburban lawn
          roughness={0.9}
        />
      </mesh>

      {/* 2. Road Network (Asphalt & Curbs) */}
      <group position={[0, 0, 0]}>
        {/* North Street (y = 120, z = -120) */}
        <RoadSegment
          position={[45, 12.15, -120]}
          width={12}
          length={130}
          rotationY={Math.PI / 2}
        />

        {/* Mid Road (y = 80, z = -80) */}
        <RoadSegment
          position={[65, 11.85, -80]}
          width={10}
          length={95}
          rotationY={Math.PI / 2}
        />

        {/* Central Main Avenue (y = 0, z = 0) */}
        <RoadSegment
          position={[45, 10.98, 0]}
          width={14}
          length={140}
          rotationY={Math.PI / 2}
        />

        {/* North-South Main Drainage Boulevard (x = 40, z = -130 to 60) */}
        <RoadSegment
          position={[40, 11.2, -35]}
          width={12}
          length={185}
          rotationY={0}
        />

        {/* Diagonal Link from J04 to J07 */}
        <RoadSegment
          position={[85, 11.5, -40]}
          width={9}
          length={90}
          rotationY={Math.PI / 4}
        />
      </group>

      {/* 3. Residential Terrace Houses */}
      {houseData.map((h, i) => (
        <House
          key={`house-${i}`}
          position={h.pos}
          rotation={h.rot}
          roofColor={h.roof}
          wallColor={h.wall}
        />
      ))}

      {/* 4. Trees and Green Belts */}
      {treeData.map((t, i) => (
        <Tree key={`tree-${i}`} position={t} scale={0.8 + (i % 3) * 0.2} />
      ))}

      {/* 5. Retention Pond / Detention Basin ("Maple Grove / Taman Kyra Retention Pond") */}
      <group position={[125, 11.1, -25]}>
        {/* Lake basin hole */}
        <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 18, 32]} />
          <meshStandardMaterial color="#0369a1" roughness={0.1} metalness={0.8} />
        </mesh>
        {/* Lake Water Surface with realistic reflection */}
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[18, 32]} />
          <meshStandardMaterial
            color="#0284c7"
            roughness={0.1}
            metalness={0.7}
            transparent
            opacity={0.85}
          />
        </mesh>
        {/* Decorative fountain center */}
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.2, 0.5, 2.4, 8]} />
          <meshStandardMaterial color="#e0f2fe" roughness={0.2} />
        </mesh>
        {/* Label for Retention Pond */}
        <group position={[0, 3.5, 0]}>
          <Text
            fontSize={1.4}
            color="#38bdf8"
            anchorX="center"
            anchorY="bottom"
          >
            Maple Grove Retention Pond (调蓄水景湖)
          </Text>
        </group>
      </group>

      {/* 6. South Outfall Canal ("East Drain Outfall / 汇流排放渠") */}
      <group position={[40, 10.3, 85]}>
        {/* Concrete canal walls */}
        <mesh position={[-7.5, 0.4, 0]}>
          <boxGeometry args={[1.0, 1.8, 65]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>
        <mesh position={[7.5, 0.4, 0]}>
          <boxGeometry args={[1.0, 1.8, 65]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>
        {/* Canal Water Stream */}
        <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[14, 65]} />
          <meshStandardMaterial
            color="#0369a1"
            roughness={0.1}
            metalness={0.6}
            transparent
            opacity={0.8}
          />
        </mesh>
        {/* Outfall Label */}
        <group position={[0, 3.2, 10]}>
          <Text
            fontSize={1.3}
            color="#38bdf8"
            anchorX="center"
            anchorY="bottom"
          >
            East Drain Outfall (NODE-OUT01 汇流出水口)
          </Text>
        </group>
      </group>

      {/* 7. Surface Flooding Puddle at Low Point INLET-D07 */}
      {floodingActive && (
        <group position={[40, 11.02, 0]}>
          {/* Reflective muddy water puddle on street surface */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[7.5, 32]} />
            <meshStandardMaterial
              color="#0f766e"
              roughness={0.1}
              metalness={0.4}
              transparent
              opacity={0.8}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[7.2, 7.8, 32]} />
            <meshBasicMaterial color="#f43f5e" transparent opacity={0.6} />
          </mesh>
          {/* 3D Surface Ponding Alert Tag */}
          <group position={[0, 3.8, 0]}>
            <Text
              fontSize={1.2}
              color="#fb7185"
              anchorX="center"
              anchorY="bottom"
            >
              ⚠ 地表滞积淹水洼地 (Bypass Ponding: ~686 m³)
            </Text>
          </group>
        </group>
      )}

      {/* 8. 3D Neighborhood Zone Labels (Matching the Mockup!) */}
      <group position={[0, 0, 0]}>
        {/* Pinecrest Residential */}
        <group position={[10, 18.0, 0]}>
          <Text
            fontSize={1.6}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            Pinecrest Residential (住宅二期)
          </Text>
        </group>

        {/* North Ridge Subdivision */}
        <group position={[45, 19.0, -120]}>
          <Text
            fontSize={1.6}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            North Ridge Subdivision (山脊一期)
          </Text>
        </group>

        {/* Cedar View Estates */}
        <group position={[-25, 17.5, -40]}>
          <Text
            fontSize={1.6}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            Cedar View Estates (雪松林区)
          </Text>
        </group>

        {/* Riverside Heights */}
        <group position={[80, 17.0, 50]}>
          <Text
            fontSize={1.6}
            color="#f8fafc"
            anchorX="center"
            anchorY="bottom"
          >
            Riverside Heights (滨水高地)
          </Text>
        </group>

        {/* 3D Sky Mode Banner */}
        <group position={[45, 26.0, -60]}>
          <Text
            fontSize={2.0}
            color={appMode === 'diagnose' ? '#f59e0b' : '#38bdf8'}
            anchorX="center"
            anchorY="bottom"
          >
            {appMode === 'diagnose'
              ? '🔍 历史积水成因诊断复盘区 (Taman Kyra)'
              : '⚡ 50年一遇极端季风暴雨推演区 (120 mm/h)'}
          </Text>
        </group>
      </group>
    </group>
  );
};
