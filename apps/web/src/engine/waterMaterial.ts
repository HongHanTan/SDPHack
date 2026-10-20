// Ported from apps/legacy/src/render/waterMaterial.ts (Hong Han) for the team UI.
import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute float aDepth;
varying float vDepth;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  vDepth = aDepth;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform float uOpMin;
uniform float uOpMax;
uniform float uTime;
uniform float uRipple;
uniform float uEmissive;
varying float vDepth;
varying vec3 vWorld;
varying vec3 vNormalW;
void main() {
  if (vDepth <= 0.01) discard;
  vec3 col = mix(uShallow, uDeep, clamp(vDepth, 0.0, 1.0));
  float op = mix(uOpMin, uOpMax, clamp(vDepth / 0.5, 0.0, 1.0));
  vec3 n = normalize(vNormalW);
  if (uRipple > 0.5) {
    n.x += 0.06 * sin(vWorld.x * 0.15 + uTime * 1.3) + 0.04 * sin(vWorld.z * 0.23 + uTime * 0.7);
    n.z += 0.06 * sin(vWorld.z * 0.11 - uTime * 1.1) + 0.04 * sin(vWorld.x * 0.19 - uTime * 0.9);
    n = normalize(n);
  }
  vec3 viewDir = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
  vec3 sunDir = normalize(vec3(-0.54, 0.64, 0.54));
  float spec = pow(max(dot(reflect(-sunDir, n), viewDir), 0.0), 60.0);
  col += (fres * 0.35 + spec * 0.6) * (1.0 - uEmissive);
  float foam = (1.0 - smoothstep(0.01, 0.04, vDepth)) * (1.0 - uEmissive);
  col = mix(col, vec3(1.0), foam * 0.6);
  op = max(op, foam * 0.6);
  col *= 1.0 + uEmissive * 0.8;
  gl_FragColor = vec4(col, op);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function createWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uShallow: { value: new THREE.Color() },
      uDeep: { value: new THREE.Color() },
      uOpMin: { value: 0.25 },
      uOpMax: { value: 0.85 },
      uTime: { value: 0 },
      uRipple: { value: 1 },
      uEmissive: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });
}
