import { useEffect, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';

export interface CameraPose { position: [number, number, number]; target: [number, number, number] }
export interface CameraLink {
  pose: CameraPose;
  applying: boolean;
  listeners: Set<(pose: CameraPose) => void>;
}
export function createCameraLink(): CameraLink {
  return { pose: { position: [62, 38, 46], target: [40, 11, 4] }, applying: false, listeners: new Set() };
}
/** Shared controls keep both independently rendered scenes at the same viewing angle. */
export function LinkedCamera({ controlsRef, link }: { controlsRef: MutableRefObject<any>; link: CameraLink }) {
  const cleanup = useRef<(() => void) | null>(null);
  useFrame(() => {
    if (cleanup.current || !controlsRef.current) return;
    const controls = controlsRef.current;
    const apply = (pose: CameraPose) => {
      controls.object.position.set(...pose.position);
      controls.target.set(...pose.target);
      controls.update();
    };
    const changed = () => {
      if (link.applying) return;
      link.pose = { position: controls.object.position.toArray() as CameraPose['position'], target: controls.target.toArray() as CameraPose['target'] };
      link.applying = true;
      try { for (const listener of link.listeners) if (listener !== apply) listener(link.pose); }
      finally { link.applying = false; }
    };
    link.applying = true;
    try { apply(link.pose); } finally { link.applying = false; }
    link.listeners.add(apply);
    controls.addEventListener('change', changed);
    cleanup.current = () => { controls.removeEventListener('change', changed); link.listeners.delete(apply); };
  });
  useEffect(() => () => { cleanup.current?.(); cleanup.current = null; }, [link]);
  return null;
}
