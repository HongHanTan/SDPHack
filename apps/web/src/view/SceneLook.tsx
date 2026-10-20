import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useViewLook } from './ViewLookContext';
import { blendTheme, blendThemeInto } from './xrayTheme';

/** Applies the blended day/x-ray theme to the background, fog and lights each frame it changes. */
export function SceneLook({
  ambient,
  keyLight,
  fill,
}: {
  ambient: RefObject<THREE.AmbientLight | null>;
  keyLight: RefObject<THREE.DirectionalLight | null>;
  fill: RefObject<THREE.DirectionalLight | null>;
}) {
  const { lookRef, is2d } = useViewLook();
  const scene = useThree((s) => s.scene);
  const theme = useMemo(() => blendTheme(0), []);
  const last = useRef('');
  useFrame(() => {
    const t = lookRef.current.xrayT;
    const key = `${t}|${is2d}`;
    if (key === last.current) return;
    last.current = key;
    blendThemeInto(t, theme);
    if (scene.background instanceof THREE.Color) scene.background.set(theme.background);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(theme.fog);
      // The plan camera sits high above the site: keep the fog out of the way there (legacy plan view did the same).
      scene.fog.near = is2d ? 1e5 : theme.fogNear;
      scene.fog.far = is2d ? 2e5 : theme.fogFar;
    }
    if (ambient.current) {
      ambient.current.intensity = theme.ambient;
      ambient.current.color.set(theme.ambientColor);
    }
    if (keyLight.current) {
      keyLight.current.intensity = theme.key;
      keyLight.current.color.set(theme.keyColor);
    }
    if (fill.current) fill.current.intensity = theme.fill;
  });
  return null;
}
