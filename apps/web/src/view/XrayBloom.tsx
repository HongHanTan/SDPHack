import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { useViewLook } from './ViewLookContext';

/** Bloom for the x-ray look only (legacy viewer had bloom 1 in x-ray, 0 by day). */
export function XrayBloom() {
  const { ghost } = useViewLook();
  if (!ghost) return null;
  return (
    <EffectComposer>
      <Bloom intensity={1} luminanceThreshold={0.55} luminanceSmoothing={0.2} mipmapBlur />
    </EffectComposer>
  );
}
