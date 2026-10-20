// Ported from apps/legacy/src/render/cameras.ts (Hong Han): orbit camera ↔ top-down orthographic plan camera.
import { MapControls, OrbitControls, OrthographicCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { GROUND_Y, orthoZoomFor, SITE, topHeightFor } from './scaleBar';

export const SWITCH_S = 0.5;

type Phase = '3d' | 'to2d' | '2d' | 'to3d';
interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
}

const DEFAULT_POSE: Pose = { pos: new THREE.Vector3(60, 90, 130), target: new THREE.Vector3(50, 10, 0) };

/**
 * Owns the scene's camera controls. 3D: TEH JIA JIE's OrbitControls (same settings, exposed via `controlsRef` for
 * his presets). 2D: glide overhead, then an orthographic camera (north up) with pan/zoom only.
 */
export function ViewRig({
  is2d,
  controlsRef,
  onMetresPerPixel,
}: {
  is2d: boolean;
  controlsRef: MutableRefObject<any>;
  onMetresPerPixel: (mpp: number) => void;
}) {
  const size = useThree((s) => s.size);
  const get = useThree((s) => s.get);
  const perspRef = useRef<THREE.PerspectiveCamera | null>(null);
  if (!perspRef.current) perspRef.current = get().camera as THREE.PerspectiveCamera;
  const [phase, setPhase] = useState<Phase>('3d');
  const phaseRef = useRef<Phase>('3d');
  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };
  const saved = useRef<Pose | null>(null);
  const anim = useRef<{ from: Pose; to: Pose; start: number | null; then: () => void } | null>(null);
  const zoom = orthoZoomFor(size.width, size.height);
  const lookRef = useRef(DEFAULT_POSE.target.clone()); // current look-at, kept live during glides

  const topPose = (): Pose => {
    const h = topHeightFor(size.height, zoom, perspRef.current!.fov);
    return { pos: new THREE.Vector3(SITE.cx, GROUND_Y + h, SITE.cz + 0.01), target: new THREE.Vector3(SITE.cx, GROUND_Y, SITE.cz) };
  };

  useEffect(() => {
    const persp = perspRef.current!;
    const p = phaseRef.current;
    if (is2d && (p === '3d' || p === 'to3d')) {
      const ctl = controlsRef.current;
      const target = p === '3d' ? (ctl ? ctl.target.clone() : DEFAULT_POSE.target.clone()) : lookRef.current.clone();
      const from: Pose = { pos: persp.position.clone(), target };
      if (p === '3d') saved.current = from;
      anim.current = { from, to: topPose(), start: null, then: () => go('2d') };
      go('to2d');
    } else if (!is2d && (p === '2d' || p === 'to2d')) {
      const top = topPose();
      // R3F only resizes the default camera; ours was parked while the ortho camera was active.
      persp.aspect = size.width / size.height;
      persp.updateProjectionMatrix();
      let from: Pose;
      if (p === '2d') {
        persp.position.copy(top.pos);
        persp.lookAt(top.target);
        from = top;
      } else {
        from = { pos: persp.position.clone(), target: lookRef.current.clone() };
      }
      const to = saved.current ?? DEFAULT_POSE;
      anim.current = {
        from,
        to,
        start: null,
        then: () => {
          go('3d');
          const c = controlsRef.current;
          if (c) {
            c.target.copy(to.target);
            c.update();
          }
        },
      };
      go('to3d');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is2d]);

  useFrame(({ clock }) => {
    const a = anim.current;
    if (!a) return;
    const persp = perspRef.current!;
    if (a.start === null) a.start = clock.elapsedTime;
    const k = Math.min(1, (clock.elapsedTime - a.start) / SWITCH_S);
    const e = k * k * (3 - 2 * k);
    persp.position.lerpVectors(a.from.pos, a.to.pos, e);
    persp.lookAt(lookRef.current.lerpVectors(a.from.target, a.to.target, e));
    if (k >= 1) {
      anim.current = null;
      a.then();
    }
  });

  useEffect(() => {
    if (phase === '2d') onMetresPerPixel(1 / zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, onMetresPerPixel]);

  const orthoRef = useRef<THREE.OrthographicCamera>(null);
  useLayoutEffect(() => {
    const cam = orthoRef.current;
    if (phase !== '2d' || !cam) return;
    cam.up.set(0, 0, -1); // north (−Z) at the top of the screen
    cam.position.set(SITE.cx, GROUND_Y + 600, SITE.cz);
    cam.lookAt(SITE.cx, GROUND_Y, SITE.cz);
    cam.zoom = zoom;
    cam.updateProjectionMatrix();
    // Only on entering 2D: a window resize must not reset the user's pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (phase === '2d') {
    return (
      <>
        <OrthographicCamera ref={orthoRef} makeDefault near={0.1} far={2000} />
        <MapControls
          makeDefault
          enableRotate={false}
          screenSpacePanning
          target={[SITE.cx, GROUND_Y, SITE.cz]}
          onChange={(e) => {
            const cam = (e?.target as unknown as { object?: THREE.OrthographicCamera })?.object;
            if (cam?.zoom) onMetresPerPixel(1 / cam.zoom);
          }}
        />
      </>
    );
  }
  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={phase === '3d'}
      enableDamping
      dampingFactor={0.05}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minDistance={10}
      maxDistance={350}
    />
  );
}
