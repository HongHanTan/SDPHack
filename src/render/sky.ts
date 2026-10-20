import * as THREE from 'three';

/** Gradient sky dome (horizon → top), blendable through setColors. */
export function createSky(): { mesh: THREE.Mesh; setColors(top: string, horizon: string): void } {
  const uniforms = { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
    fragmentShader: /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
varying vec3 vDir;
void main() {
  float h = clamp(vDir.y, 0.0, 1.0);
  gl_FragColor = vec4(mix(uHorizon, uTop, pow(h, 0.6)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), material);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return {
    mesh,
    setColors(top, horizon) {
      uniforms.uTop.value.set(top);
      uniforms.uHorizon.value.set(horizon);
    },
  };
}
