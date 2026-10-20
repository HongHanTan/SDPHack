// Ported from apps/legacy/src/render/flowRibbons.ts (Hong Han): pipe ribbons with chevrons scrolling with the flow.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AssetConduit, AssetNode, SimulationFrame } from '../types';
import { advancePhase, arrowsVisible, loadColorBetween, pipeLoad } from './flowMath';
import { useViewLook } from './ViewLookContext';
import { blendTheme, blendThemeInto } from './xrayTheme';

const CHEVRON_SPACING = 12; // world units between chevrons

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uPhase;
uniform float uLen;
uniform float uArrows;
uniform float uGlow;
varying vec2 vUv;
void main() {
  float s = fract(vUv.x * uLen / ${CHEVRON_SPACING.toFixed(1)} - uPhase);
  float v = abs(fract(vUv.y * 2.0) - 0.5);
  float d = s - v * 0.6;
  float chevron = smoothstep(0.0, 0.06, d) * (1.0 - smoothstep(0.16, 0.24, d));
  vec3 col = uColor * (0.75 + 0.25 * uGlow) + vec3(1.0) * chevron * uArrows * 0.55;
  gl_FragColor = vec4(col * (1.0 + uGlow * 0.6), 0.92);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

type Mode = 'xray' | 'plan';

interface Ribbon {
  conduit: AssetConduit;
  geometry: THREE.TubeGeometry;
  material: THREE.ShaderMaterial;
  phase: number;
}

const groundOf = (n: AssetNode) => n.ground_elevation_m ?? n.position_m.z + n.max_depth_m;

function buildRibbons(nodes: AssetNode[], conduits: AssetConduit[], mode: Mode): Ribbon[] {
  const byId = new Map(nodes.map((n) => [n.node_id, n]));
  const out: Ribbon[] = [];
  for (const c of conduits) {
    const from = byId.get(c.from_node_id || c.from_node!);
    const to = byId.get(c.to_node_id || c.to_node!);
    if (!from || !to) continue;
    const d = c.diameter_m || 0.45;
    const at = (n: AssetNode) => {
      // Team coordinates {x east, y north, z elevation} → scene [x, z, −y] (as SceneViewer.toThreeCoords).
      const p = new THREE.Vector3(n.position_m.x, 0, -n.position_m.y);
      // X-ray: on the pipe's true centreline; plan: just above the ground.
      p.y = mode === 'xray' ? n.position_m.z + d / 2 : groundOf(n) + 0.6;
      return p;
    };
    const a = at(from);
    const b = at(to);
    if (a.distanceTo(b) <= 0) continue;
    const radius = mode === 'xray' ? Math.max(0.6, d * 1.2) : Math.max(1.0, d * 2.5);
    const geometry = new THREE.TubeGeometry(new THREE.LineCurve3(a, b), 8, radius, 8, false);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color() },
        uPhase: { value: 0 },
        uLen: { value: a.distanceTo(b) },
        uArrows: { value: 0 },
        uGlow: { value: mode === 'xray' ? 1 : 0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: mode === 'xray',
    });
    out.push({ conduit: c, geometry, material, phase: 0 });
  }
  return out;
}

/** Glowing pipes in X-ray (at depth) and map pipes in 2D (on top of everything). Hidden otherwise. */
export function FlowRibbons({
  nodes,
  conduits,
  frame,
  onSelect,
}: {
  nodes: AssetNode[];
  conduits: AssetConduit[];
  frame: SimulationFrame | null | undefined;
  onSelect?: (c: AssetConduit) => void;
}) {
  const { lookRef, ghost, is2d } = useViewLook();
  const mode: Mode | null = is2d ? 'plan' : ghost ? 'xray' : null;
  const ribbons = useMemo(() => (mode ? buildRibbons(nodes, conduits, mode) : []), [nodes, conduits, mode]);
  useEffect(
    () => () =>
      ribbons.forEach((r) => {
        r.geometry.dispose();
        r.material.dispose();
      }),
    [ribbons],
  );
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const theme = useMemo(() => blendTheme(0), []);
  const low = useMemo(() => new THREE.Color(), []);
  const mid = useMemo(() => new THREE.Color(), []);
  const high = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    if (!ribbons.length) return;
    blendThemeInto(lookRef.current.xrayT, theme);
    low.set(theme.pipeLow);
    mid.set(theme.pipeMid);
    high.set(theme.pipeHigh);
    for (const r of ribbons) {
      const load = pipeLoad(frameRef.current, r.conduit.conduit_id);
      const u = r.material.uniforms;
      r.phase = advancePhase(r.phase, dt, load, (u.uLen.value as number) / CHEVRON_SPACING);
      u.uPhase.value = r.phase;
      u.uArrows.value = arrowsVisible(load) ? 1 : 0;
      loadColorBetween(load, low, mid, high, u.uColor.value as THREE.Color);
    }
  });

  if (!mode) return null;
  return (
    <group>
      {ribbons.map((r) => (
        <mesh
          key={r.conduit.conduit_id}
          geometry={r.geometry}
          material={r.material}
          renderOrder={11}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(r.conduit);
          }}
        />
      ))}
    </group>
  );
}
