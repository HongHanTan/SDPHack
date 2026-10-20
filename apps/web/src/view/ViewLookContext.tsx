import { createContext, useContext, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { stepXray } from './xrayTheme';

export interface LookState {
  /** 0 = day look, 1 = x-ray look; eased over XRAY_FADE_S. Read it in useFrame, not render. */
  xrayT: number;
}

export interface ViewLook {
  lookRef: MutableRefObject<LookState>;
  /** xrayT >= 0.5: ghosted surface, glowing pipes, bloom. */
  ghost: boolean;
  /** Plan (2D) view requested. */
  is2d: boolean;
}

const ViewLookContext = createContext<ViewLook>({ lookRef: { current: { xrayT: 0 } }, ghost: false, is2d: false });

export const useViewLook = () => useContext(ViewLookContext);

/** Inside the Canvas: eases the x-ray blend toward the toggle and flips `ghost` at the halfway point. */
export function ViewLookProvider({ xray, is2d, children }: { xray: boolean; is2d: boolean; children: ReactNode }) {
  const lookRef = useRef<LookState>({ xrayT: 0 });
  const [ghost, setGhost] = useState(false);
  useFrame((_, dt) => {
    const next = stepXray(lookRef.current.xrayT, xray ? 1 : 0, dt);
    if (next === lookRef.current.xrayT) return;
    lookRef.current.xrayT = next;
    const g = next >= 0.5;
    if (g !== ghost) setGhost(g);
  });
  const value = useMemo(() => ({ lookRef, ghost, is2d }), [ghost, is2d]);
  return <ViewLookContext.Provider value={value}>{children}</ViewLookContext.Provider>;
}
