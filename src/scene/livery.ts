import * as THREE from 'three'

/**
 * Racing stripes / side band painted procedurally in the car's own frame
 * (x = lateral, y = up, z = length), so they don't depend on the model's UV layout.
 * One uniform set is shared by every paint material, so the roof follows the body.
 */
export const LIVERY_MODES = { none: 0, twin: 1, wide: 2, side: 3 } as const
export type LiveryMode = keyof typeof LIVERY_MODES

export function makeLiveryUniforms(hw: number, top: number) {
  return {
    uLvMode: { value: 0 },
    uLvAmt: { value: 0 },
    uLvCol: { value: new THREE.Color('#f2f2ee') },
    uLvHW: { value: hw },
    uLvTop: { value: top },
    uLvOff: { value: 0 },
    uLvInv: { value: new THREE.Matrix4() }
  }
}
export type LiveryUniforms = ReturnType<typeof makeLiveryUniforms>

export function applyLivery(mat: THREE.MeshPhysicalMaterial, u: LiveryUniforms) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uLvInv;\nuniform float uLvOff;\nvarying vec3 vLvPos;\nvarying vec3 vLvN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLvPos = (uLvInv * modelMatrix * vec4(transformed, 1.0)).xyz;\nvLvPos.y -= uLvOff;\nvLvN = normalize(mat3(uLvInv * modelMatrix) * objectNormal);')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uLvMode; uniform float uLvAmt; uniform vec3 uLvCol; uniform float uLvHW; uniform float uLvTop;
varying vec3 vLvPos; varying vec3 vLvN;
float lvBand(float v, float a, float b) { float f = fwidth(v) * 1.2 + 1e-4; return smoothstep(a - f, a + f, v) * (1.0 - smoothstep(b - f, b + f, v)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  float lx = abs(vLvPos.x), lm = 0.0;
  if (uLvMode > 0.5 && uLvMode < 1.5) lm = lvBand(lx, 0.05, 0.2);
  else if (uLvMode > 1.5 && uLvMode < 2.5) lm = lvBand(lx, -1.0, 0.26);
  else if (uLvMode > 2.5) lm = smoothstep(0.2, 0.4, abs(normalize(vLvN).x)) * lvBand(vLvPos.y, uLvTop * 0.33, uLvTop * 0.46);
  diffuseColor.rgb = mix(diffuseColor.rgb, uLvCol, lm * uLvAmt);
}`)
  }
  mat.customProgramCacheKey = () => 'livery'
  mat.needsUpdate = true
}
