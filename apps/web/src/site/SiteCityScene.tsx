// Imported-site city for the site workspace map: TEH JIA JIE's houses, roads, trees and drainage meshes,
// placed from the engine SiteSpec (team coordinates), with the FloodOps engine's street water.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { SiteSpec } from '@floodops/engine/scenario/site';
import type { AssetConduit, AssetInlet, AssetNode, ConduitStatus, NodeStatus, SimulationFrame } from '../types';
import { ConduitMesh, InletMesh, NodeMesh, toThreeCoords } from '../components/SceneViewer';
import { RainEffect } from '../components/RainEffect';
import { EngineWater } from '../engine/EngineWater';
import { ViewLookProvider } from '../view/ViewLookContext';
import { SceneLook } from '../view/SceneLook';
import { XrayBloom } from '../view/XrayBloom';
import { FlowRibbons } from '../view/FlowRibbons';
import { SiteEnvironment } from './SiteEnvironment';
import { siteFrame } from './siteFrame';
import { cityCamera, fogScale, rainPlacement } from './siteCity';
import { LinkedCamera, type CameraLink } from '../story/LinkedCamera';
import { FixPins, type MapPin } from './FixPins';

/** Links already posed at a site's overview (keyed by site), so a remount keeps the shared user view. */
const posedLinks = new WeakMap<CameraLink, string>();

export interface SiteCitySceneProps {
  site: SiteSpec;
  /** Tay's build-up phase: 1 ground, 2 houses/roads/trees, 3 drainage network. */
  phase: number;
  xray: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  frame?: SimulationFrame;
  /** Stored engine street-water grid for the shown frame (null: dry). */
  depth: Float32Array | null;
  raining: boolean;
  /** Uploaded rain at the shown time (mm/h); drives the rain look. */
  rainMmh?: number;
  /** Shared camera (side-by-side compare): both panes follow either pane's orbit. Starts at this site's overview. */
  cameraLink?: CameraLink;
  /** Automated fix analysis pins (team coordinates), drawn as cards on the map. */
  pins?: readonly MapPin[];
}

/** SceneLook sets the shared fog distances for the built-in site; stretch them for larger sites. */
function FogScale({ k }: { k: number }) {
  const scene = useThree((s) => s.scene);
  const written = useRef({ near: NaN, far: NaN });
  useFrame(() => {
    const fog = scene.fog;
    if (!(fog instanceof THREE.Fog) || k === 1) return;
    if (fog.near === written.current.near && fog.far === written.current.far) return;
    fog.near *= k;
    fog.far *= k;
    written.current = { near: fog.near, far: fog.far };
  });
  return null;
}

export function SiteCityScene({ site, phase, xray, selected, onSelect, frame, depth, raining, rainMmh, cameraLink, pins }: SiteCitySceneProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const f = useMemo(() => siteFrame(site), [site.key]);
  const cam = useMemo(() => cityCamera(f), [f]);
  const rain = useMemo(() => rainPlacement(f), [f]);
  // Tay's LinkedCamera applies link.pose when it mounts, so the pose is set to this site's overview first (once per link and site).
  if (cameraLink && posedLinks.get(cameraLink) !== site.key) {
    cameraLink.pose = { position: [...cam.position], target: [...cam.target] };
    posedLinks.set(cameraLink, site.key);
  }
  const controlsRef = useRef<any>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const keyLightRef = useRef<THREE.DirectionalLight>(null);
  const fillLightRef = useRef<THREE.DirectionalLight>(null);

  // site.assets are team coordinates in the team asset format (SceneViewer's toThreeCoords applies).
  const nodes = site.assets.nodes as unknown as AssetNode[];
  const conduits = site.assets.conduits as unknown as AssetConduit[];
  const inlets = site.assets.inlets as unknown as AssetInlet[];
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.node_id, n])), [nodes]);
  const nodeState = useMemo(() => new Map<string, { status: NodeStatus; depth: number }>(frame?.node_states?.map((n) => [n.node_id, { status: n.status, depth: n.depth_m }]) ?? []), [frame]);
  const pipeState = useMemo(() => new Map<string, { status: ConduitStatus; flow: number }>(frame?.pipe_states?.map((p) => [p.conduit_id, { status: p.status, flow: p.flow_m3s }]) ?? []), [frame]);
  const inletState = useMemo(() => new Map<string, number>(frame?.inlet_states?.map((i) => [i.inlet_id, i.hydraulic_inlet_clogging_fraction]) ?? []), [frame]);

  // Selecting an asset (map or list) brings the camera to it, as in SceneViewer.
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !selected) return;
    const node = nodeMap.get(selected);
    const inlet = inlets.find((i) => i.inlet_id === selected);
    const conduit = conduits.find((c) => c.conduit_id === selected);
    const from = conduit ? nodeMap.get(conduit.from_node_id) : undefined;
    const to = conduit ? nodeMap.get(conduit.to_node_id) : undefined;
    const pos = node?.position_m ?? inlet?.position_m ?? (from && to ? { x: (from.position_m.x + to.position_m.x) / 2, y: (from.position_m.y + to.position_m.y) / 2, z: (from.ground_elevation_m + to.ground_elevation_m) / 2 } : null);
    if (!pos) return;
    const [x, y, z] = toThreeCoords(pos);
    controls.target.set(x, y, z);
    controls.object.position.set(x + 20, y + 45, z + 40);
    controls.update();
  }, [selected, nodeMap, inlets, conduits]);

  return (
    <Canvas camera={{ position: cam.position, fov: 45, near: 0.1, far: cam.far }} shadows dpr={[1, 2]}>
      <ViewLookProvider xray={xray} is2d={false}>
        <color attach="background" args={['#f1f5f9']} />
        <fog attach="fog" args={['#f1f5f9', 200, 480]} />
        <ambientLight ref={ambientRef} intensity={1.3} color="#ffffff" />
        <directionalLight ref={keyLightRef} position={[90, 140, 70]} intensity={2.4} castShadow color="#ffffff" />
        <directionalLight ref={fillLightRef} position={[-80, 60, -60]} intensity={0.8} color="#93c5fd" />
        <SceneLook ambient={ambientRef} keyLight={keyLightRef} fill={fillLightRef} />
        <FogScale k={fogScale(f)} />
        <OrbitControls ref={controlsRef} makeDefault target={cam.target} enableDamping maxDistance={cam.maxDistance} maxPolarAngle={Math.PI / 2.05} />
        {cameraLink && <LinkedCamera controlsRef={controlsRef} link={cameraLink} />}

        <group position={rain.position} scale={rain.scale}>
          <RainEffect active={raining} stormIntensityMmh={rainMmh ?? 80} />
        </group>

        {phase >= 1 && <SiteEnvironment site={site} showLayout={phase >= 2} />}
        {phase >= 1 && <EngineWater site={site} depth={depth} />}

        {phase >= 3 && (
          <>
            {nodes.map((node) => {
              const s = nodeState.get(node.node_id);
              return (
                <NodeMesh
                  key={node.node_id}
                  node={node}
                  status={s?.status ?? 'unknown'}
                  depthM={s?.depth ?? 0}
                  isSelected={selected === node.node_id}
                  onClick={() => onSelect(node.node_id)}
                  showUndergroundOnly={false}
                />
              );
            })}
            {conduits.map((c) => {
              const s = pipeState.get(c.conduit_id);
              return (
                <ConduitMesh
                  key={c.conduit_id}
                  conduit={c}
                  fromNode={nodeMap.get(c.from_node_id)}
                  toNode={nodeMap.get(c.to_node_id)}
                  status={s?.status ?? 'unknown'}
                  flowM3s={s?.flow ?? 0}
                  isSelected={selected === c.conduit_id}
                  onClick={() => onSelect(c.conduit_id)}
                />
              );
            })}
            <FlowRibbons nodes={nodes} conduits={conduits} frame={frame} onSelect={(c) => onSelect(c.conduit_id)} />
            {inlets.map((i) => (
              <InletMesh
                key={i.inlet_id}
                inlet={i}
                associatedNode={nodeMap.get(i.node_id)}
                cloggingFraction={inletState.get(i.inlet_id) ?? 0}
                isSelected={selected === i.inlet_id}
                onClick={() => onSelect(i.inlet_id)}
              />
            ))}
          </>
        )}
        {pins && pins.length > 0 && <FixPins site={site} pins={pins} />}
        <XrayBloom />
      </ViewLookProvider>
    </Canvas>
  );
}
