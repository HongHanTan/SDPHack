import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';

interface TownshipEnvironmentProps {
  showUndergroundOnly?: boolean;
  floodingActive?: boolean;
  appMode?: 'diagnose' | 'anticipate';
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
}> = ({ position, width, length, rotationY = 0 }) => {
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
}> = ({ position, radius }) => {
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

export const TownshipEnvironment: React.FC<TownshipEnvironmentProps> = ({
  showUndergroundOnly = false,
  floodingActive = true,
  appMode = 'diagnose',
}) => {
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

    const roofStyles = ['#334155', '#7c2d12', '#1e293b', '#475569', '#991b1b', '#0369a1'];
    const wallStyles = ['#f8fafc', '#f1f5f9', '#fef3c7', '#fdf4ff', '#e2e8f0'];
    const carColors = ['#2563eb', '#dc2626', '#1e293b', '#f8fafc', '#ca8a04', '#475569'];

    // 1. North Ridge Subdivision (Row along North Street y=120, Three.js z = -120)
    for (let x = -20; x <= 105; x += 18) {
      list.push({
        pos: [x, 12.2, -138],
        rotY: 0,
        roof: roofStyles[Math.abs(Math.floor(x / 17)) % roofStyles.length],
        wall: wallStyles[Math.abs(Math.floor(x / 13)) % wallStyles.length],
        hasCar: (x % 2 === 0),
        carColor: carColors[Math.abs(Math.floor(x / 11)) % carColors.length],
        scale: 1.05,
      });
    }

    // 2. Mid Block North Row (z = -102, facing street)
    for (let x = -10; x <= 95; x += 18) {
      list.push({
        pos: [x, 12.0, -102],
        rotY: Math.PI,
        roof: roofStyles[(Math.abs(Math.floor(x / 15)) + 1) % roofStyles.length],
        wall: wallStyles[(Math.abs(Math.floor(x / 14)) + 1) % wallStyles.length],
        hasCar: (x % 3 === 0),
        carColor: carColors[Math.abs(Math.floor(x / 7)) % carColors.length],
        scale: 1.0,
      });
    }

    // 3. Pinecrest Residential North Row (z = -22, facing central main street z=0)
    for (let x = -30; x <= 95; x += 18) {
      if (Math.abs(x - 40) < 10) continue; // Leave opening for D07 junction
      list.push({
        pos: [x, 11.0, -22],
        rotY: 0,
        roof: roofStyles[Math.abs(Math.floor(x / 14)) % roofStyles.length],
        wall: wallStyles[Math.abs(Math.floor(x / 12)) % wallStyles.length],
        hasCar: (x % 2 === 1),
        carColor: carColors[Math.abs(Math.floor(x / 9)) % carColors.length],
        scale: 1.05,
      });
    }

    // 4. Pinecrest Residential South Row (z = 22, facing central main street z=0)
    for (let x = -30; x <= 95; x += 18) {
      if (Math.abs(x - 40) < 10) continue;
      list.push({
        pos: [x, 10.9, 22],
        rotY: Math.PI,
        roof: roofStyles[(Math.abs(Math.floor(x / 16)) + 2) % roofStyles.length],
        wall: wallStyles[(Math.abs(Math.floor(x / 13)) + 2) % wallStyles.length],
        hasCar: (x % 2 === 0),
        carColor: carColors[Math.abs(Math.floor(x / 8)) % carColors.length],
        scale: 1.05,
      });
    }

    // 5. Cedar View Estates (West residential wing along x = -26, facing East)
    for (let z = -85; z <= 45; z += 20) {
      list.push({
        pos: [-28, 11.3, z],
        rotY: Math.PI / 2,
        roof: roofStyles[(Math.abs(Math.floor(z / 18)) + 3) % roofStyles.length],
        wall: wallStyles[(Math.abs(Math.floor(z / 15)) + 1) % wallStyles.length],
        hasCar: true,
        carColor: carColors[Math.abs(Math.floor(z / 10)) % carColors.length],
        scale: 1.0,
      });
    }

    // 6. Riverside Heights (Near Outfall, south residential street z = 70)
    for (let x = 65; x <= 105; x += 18) {
      list.push({
        pos: [x, 10.5, 70],
        rotY: 0,
        roof: roofStyles[Math.abs(Math.floor(x / 16)) % roofStyles.length],
        wall: wallStyles[Math.abs(Math.floor(x / 14)) % wallStyles.length],
        hasCar: true,
        carColor: carColors[Math.abs(Math.floor(x / 5)) % carColors.length],
        scale: 1.0,
      });
    }

    return list;
  }, []);

  // Trees Layout (Clusters of rich lush trees around parcels and parks)
  const trees = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; scale: number; color: string }> = [];
    const colors = ['#15803d', '#16a34a', '#14532d', '#166534', '#15803d'];

    // Street trees along North Street
    for (let x = -25; x <= 115; x += 14) {
      list.push({ pos: [x, 12.2, -128], scale: 1.0 + (x % 3) * 0.1, color: colors[Math.abs(x) % colors.length] });
    }

    // Street trees along Central Main Street
    for (let x = -35; x <= 105; x += 12) {
      list.push({ pos: [x, 11.0, -10], scale: 0.95 + (x % 2) * 0.15, color: colors[Math.abs(x) % colors.length] });
      list.push({ pos: [x, 10.9, 10], scale: 0.9 + (x % 3) * 0.15, color: colors[(Math.abs(x) + 1) % colors.length] });
    }

    // Lush park canopy around Maple Grove Retention Pond
    for (let angle = 0; angle < Math.PI * 2; angle += 0.35) {
      const dist = 22 + (Math.sin(angle * 3) * 3);
      const rx = 130 + Math.cos(angle) * dist;
      const rz = -30 + Math.sin(angle) * (dist * 0.85);
      list.push({
        pos: [rx, 11.2, rz],
        scale: 1.1 + Math.sin(angle * 5) * 0.25,
        color: colors[Math.floor(angle * 2) % colors.length],
      });
    }

    // Backyard grove trees
    for (let x = -15; x <= 85; x += 22) {
      list.push({ pos: [x, 12.1, -150], scale: 1.3, color: '#14532d' });
      list.push({ pos: [x, 10.8, 35], scale: 1.25, color: '#166534' });
    }

    return list;
  }, []);

  if (showUndergroundOnly) {
    // Underground Highlight Mode: Show faint blueprint footprint
    return (
      <group position={[0, 0, 0]}>
        <mesh position={[50, 10.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[240, 260]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.35} wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Base Neighborhood Lawn & Terrain Surface */}
      <mesh position={[45, 10.8, -10]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[240, 280]} />
        <meshStandardMaterial
          color="#1e3a24" // rich suburban lawn green
          roughness={0.95}
        />
      </mesh>

      {/* 2. Detailed Asphalt Roadways, Curbs & Markings */}
      <group position={[0, 0, 0]}>
        {/* North Street (y = 120, z = -120) */}
        <DetailedRoadSegment
          position={[45, 12.15, -120]}
          width={13}
          length={145}
          rotationY={Math.PI / 2}
        />

        {/* Mid Residential Street (y = 80, z = -80) */}
        <DetailedRoadSegment
          position={[65, 11.85, -80]}
          width={11}
          length={105}
          rotationY={Math.PI / 2}
        />

        {/* Central Main Avenue (y = 0, z = 0) */}
        <DetailedRoadSegment
          position={[45, 10.98, 0]}
          width={15}
          length={155}
          rotationY={Math.PI / 2}
        />

        {/* North-South Main Drainage Boulevard (x = 40, z = -140 to 70) */}
        <DetailedRoadSegment
          position={[40, 11.2, -35]}
          width={13}
          length={195}
          rotationY={0}
        />

        {/* East Diagonal Connector */}
        <DetailedRoadSegment
          position={[85, 11.5, -40]}
          width={10}
          length={95}
          rotationY={Math.PI / 4}
        />

        {/* Cul-De-Sac Turnaround Loop at East End of Mid Street */}
        <CulDeSac position={[120, 11.86, -80]} radius={10.5} />
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
      {trees.map((t, idx) => (
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
            Maple Grove Retention Pond (调蓄水景湖)
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
            East Drain Outfall (NODE-OUT01 汇流出水口)
          </Text>
        </group>
      </group>

      {/* 7. Street Surface Ponding Puddle at Low Point INLET-D07 */}
      {floodingActive && (
        <group position={[40, 11.02, 0]}>
          {/* Street Surface Water Pool */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[8.5, 32]} />
            <meshStandardMaterial
              color="#0f766e"
              roughness={0.08}
              metalness={0.5}
              transparent
              opacity={0.82}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[8.2, 8.8, 32]} />
            <meshBasicMaterial color="#f43f5e" transparent opacity={0.65} />
          </mesh>
          {/* Surface Ponding Warning Tag */}
          <group position={[0, 4.0, 0]}>
            <Text
              fontSize={1.3}
              color="#fb7185"
              anchorX="center"
              anchorY="bottom"
            >
              ⚠ 地表滞积淹水洼地 (Bypass Ponding: ~686 m³)
            </Text>
          </group>
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
            Pinecrest Residential (住宅区中心)
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
            North Ridge Subdivision (山脊一期)
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
            Cedar View Estates (雪松林区)
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
            Riverside Heights (滨水高地)
          </Text>
        </group>

        {/* 3D Sky Mode Title */}
        <group position={[45, 27.0, -60]}>
          <Text
            fontSize={2.2}
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
