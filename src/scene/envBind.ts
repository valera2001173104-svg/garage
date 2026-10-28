import type * as THREE from 'three'

/**
 * three.js (r163+) ignores `material.envMapIntensity` while the material has no `envMap` of its own: it uses
 * `scene.environmentIntensity` for everything. Binding the scene environment to a material gives it its own
 * strength, relative to the scene's (k = 1 → same as the rest of the scene). Call every frame; it only does work
 * when the environment texture is replaced (e.g. switching Studio / Day / Night).
 */
export function bindEnv(scene: THREE.Scene, mat: THREE.MeshStandardMaterial, k: number) {
  if (mat.envMap !== scene.environment) { mat.envMap = scene.environment; mat.needsUpdate = true }
  mat.envMapIntensity = k * scene.environmentIntensity
}
