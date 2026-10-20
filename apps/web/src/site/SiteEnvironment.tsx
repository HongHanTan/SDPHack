// Imported-site scene: data-driven placement of TEH JIA JIE's house, tree and road components over the engine ground.
import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { baseTownship } from '@floodops/engine/scenario/index';
import { siteToLocal, type SiteSpec } from '@floodops/engine/scenario/site';
import { LandUse } from '@floodops/engine/sim/types';
import { CulDeSac, DetailedRoadSegment, LushTree, RealisticSuburbanHouse } from '../components/TownshipEnvironment';
import { groundSampler } from '../engine/visualGround';
import { useViewLook } from '../view/ViewLookContext';
import { applySurfaceLook } from '../view/surfaceLook';
import { groundPlane, vertexTeam } from './groundPlane';
import { siteFrame } from './siteFrame';

const WATER = '#0e7490';
const LAND_COLOUR: Record<number, string> = {
  [LandUse.ROOF]: '#1e3a24', // houses sit on top
  [LandUse.ROAD]: '#1e293b',
  [LandUse.LAWN]: '#1e3a24',
  [LandUse.PARK]: '#2f5d3a',
  [LandUse.POND]: WATER,
  [LandUse.RIVER]: WATER,
};

/** Ground mesh over the whole grid: heights from the engine ground, vertex colours by engine land use. */
function buildGround(site: SiteSpec, ground: (tx: number, ty: number) => number): THREE.PlaneGeometry {
  const { nx, ny, dx } = site.gridSpec;
  const grid = baseTownship({}, site).grid;
  const f = siteFrame(site);
  const geom = groundPlane(f, nx, ny);
  const pos = geom.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(pos.count * 3);
  const palette = new Map<number, THREE.Color>();
  const fallback = new THREE.Color(LAND_COLOUR[LandUse.LAWN]);
  for (let k = 0; k < pos.count; k++) {
    const { tx, ty } = vertexTeam(pos, k);
    pos.setY(k, ground(tx, ty));
    const p = siteToLocal(site, tx, ty);
    const i = Math.min(nx - 1, Math.max(0, Math.floor(p.x / dx)));
    const j = Math.min(ny - 1, Math.max(0, Math.floor(p.y / dx)));
    const lc = grid.land[j * nx + i];
    let c = palette.get(lc);
    if (!c) {
      c = LAND_COLOUR[lc] ? new THREE.Color(LAND_COLOUR[lc]) : fallback;
      palette.set(lc, c);
    }
    colours[3 * k] = c.r;
    colours[3 * k + 1] = c.g;
    colours[3 * k + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  pos.needsUpdate = true;
  geom.computeVertexNormals();
  return geom;
}

interface SiteEnvironmentProps {
  site: SiteSpec;
  /** Underground-only twin mode: a faint footprint instead of the surface. */
  showUndergroundOnly?: boolean;
}

const SiteEnvironmentInner: React.FC<SiteEnvironmentProps> = ({ site, showUndergroundOnly = false }) => {
  const { ghost, is2d } = useViewLook();
  const rootRef = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    if (rootRef.current) applySurfaceLook(rootRef.current, ghost, is2d);
  });

  // Keyed by site.key: the site content (and so the ground) only changes when its key does.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groundAt = useMemo(() => groundSampler(site), [site.key]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const frame = useMemo(() => siteFrame(site), [site.key]);
  const groundGeom = useMemo(
    () => (showUndergroundOnly ? null : buildGround(site, groundAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site.key, groundAt, showUndergroundOnly],
  );
  useEffect(() => () => groundGeom?.dispose(), [groundGeom]);
  const roadHeight = useMemo(() => (tx: number, ty: number) => groundAt(tx, ty) + 0.02, [groundAt]);

  if (showUndergroundOnly) {
    return (
      <group ref={rootRef}>
        <mesh position={[frame.cx, frame.groundY, frame.cz]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noGhost: true }}>
          <planeGeometry args={[frame.w, frame.h]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.35} wireframe />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={rootRef}>
      {groundGeom && (
        <mesh receiveShadow geometry={groundGeom}>
          <meshStandardMaterial vertexColors roughness={0.95} />
        </mesh>
      )}

      {/* Roads: same angle mapping as the built-in scene (angleDeg 0 → π/2, −90 → 0, −45 → π/4). */}
      {site.layout.roads.map((r) =>
        r.kind === 'straight' ? (
          <DetailedRoadSegment
            key={`${site.key}-${r.id}`}
            position={[r.x, groundAt(r.x, r.y), -r.y]}
            width={r.width}
            length={r.length}
            rotationY={((r.angleDeg + 90) * Math.PI) / 180}
            heightAt={roadHeight}
          />
        ) : (
          <CulDeSac key={`${site.key}-${r.id}`} position={[r.x, groundAt(r.x, r.y), -r.y]} radius={r.radius} heightAt={roadHeight} />
        ),
      )}

      {/* Houses: rotationDeg → rotationY exactly as TownshipEnvironment's houses memo. */}
      {site.layout.houses.map((h, idx) => (
        <RealisticSuburbanHouse
          key={`${site.key}-house-${h.id ?? idx}`}
          position={[h.x, groundAt(h.x, h.y), -h.y]}
          rotationY={(h.rotationDeg * Math.PI) / 180}
          scale={h.scale}
          roofColor={typeof h.roof === 'string' ? h.roof : '#334155'}
          wallColor={typeof h.wall === 'string' ? h.wall : '#f8fafc'}
          hasCar={typeof h.hasCar === 'boolean' ? h.hasCar : false}
          carColor={typeof h.carColor === 'string' ? h.carColor : undefined}
        />
      ))}

      {!(ghost || is2d) &&
        site.layout.trees.map((t, idx) => (
          <LushTree key={`${site.key}-tree-${idx}`} position={[t.x, groundAt(t.x, t.y), -t.y]} scale={t.scale} />
        ))}

      {/* Standing water bodies keep their look in X-ray. */}
      <group userData={{ noGhost: true }}>
        {site.ponds.map((p) => (
          <mesh key={`${site.key}-${p.id}`} position={[p.x, p.waterLevel, -p.y]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[p.radius, 36]} />
            <meshStandardMaterial color={WATER} transparent opacity={0.85} roughness={0.15} />
          </mesh>
        ))}
        {site.rivers.map((r) => (
          <group key={`${site.key}-${r.id}`} position={[r.cx, site.tailwater.normal, -r.cy]} rotation={[0, (r.angleDeg * Math.PI) / 180, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[r.length, r.width]} />
              <meshStandardMaterial color={WATER} transparent opacity={0.85} roughness={0.15} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
};

// Memoised so engine Live frames (which only change the water) don't rebuild the site.
export const SiteEnvironment = React.memo(SiteEnvironmentInner);
