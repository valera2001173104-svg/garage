import { use, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { qualityLevel, useGarage } from '../store'
import { DEFAULT_CONFIG } from '../lib/catalog'
import { Wheel, setCaliperColor } from './Wheel'
import { fx } from './fx'
import { loadModel } from './modelLoader'
import { LIVERY_MODES, applyLivery, makeLiveryUniforms } from './livery'

/**
 * "Car Concept" glTF — Khronos glTF-Sample-Assets, © 2024 Eric Chadwick / Darmstadt Graphics Group GmbH, CC BY 4.0.
 * Source: https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept
 * Model space: Z-up root rotated into Y-up, car nose = +Z. We wrap it in a Y-rotation so the nose is +X like the rest of the scene.
 */

const FINISH = {
  metallic: { metalness: 0.88, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 },
  matte: { metalness: 0.1, roughness: 0.8, clearcoat: 0, clearcoatRoughness: 0.5 },
  gloss: { metalness: 0.05, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02 }
} as const
const TINT_DARK = new THREE.Color('#0b0e10')
const WHEEL_NODES =['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR']

export default function ModelCar() {
  const url = use(loadModel(useGarage.getState().perf === 2 && useGarage.getState().quality !== 'low' && useGarage.getState().quality !== 'medium' ? 2 : 1))
  const gltf = useGLTF(url) // meshopt decoder is bundled with drei/three-stdlib (no CDN)
  const cfg = useGarage(s => (s.compare ? DEFAULT_CONFIG : s.config)) // hold "compare" → stock build
  const q = useGarage(qualityLevel)
  const low = q < 2
  const ride = useRef({ v: cfg.rideHeight })
  const lights = useRef({ h: cfg.headlights ? 1 : 0, t: cfg.taillights ? 1 : 0 })
  const spots = useRef<THREE.SpotLight[]>([])
  const rot = useRef<THREE.Group>(null)

  const m = useMemo(() => {
    const root = gltf.scene.clone(true)
    // private material copies so tweening here never leaks into the cached glTF
    const mats = new Map<string, THREE.Material>(), byName: Record<string, THREE.MeshPhysicalMaterial> = {}
    root.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshPhysicalMaterial
      let c = mats.get(src.uuid)
      if (!c) { c = src.clone(); mats.set(src.uuid, c); byName[src.name] = c as THREE.MeshPhysicalMaterial }
      mesh.material = c
    })
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const wheels = WHEEL_NODES.map(n => root.getObjectByName(n)!)
    const base = wheels.map(w => w.position.clone())
    // wheel centres in car frame (nose +X): (x,y,z)_model -> (z, y, -x)
    const spots = wheels.map(w => { const v = new THREE.Vector3(); w.getWorldPosition(v); return new THREE.Vector3(v.z, v.y, -v.x) })
    // factory colours, so a zone set back to null tweens home
    const orig: Record<string, THREE.Color> = {}
    for (const n of ['Paint 2 Carmine', 'Brake', 'Interior 3 Carmine']) if (byName[n]) orig[n] = byName[n].color.clone()
    const lv = makeLiveryUniforms(box.max.x, box.max.y)
    for (const n of ['Paint 1 Carmine', 'Paint 2 Carmine', 'Panel Sides']) if (byName[n]) applyLivery(byName[n], lv)
    return { root, mats: [...mats.values()], byName, orig, wheels, base, spots, lv, front: box.max.z, rear: box.min.z, hw: box.max.x, top: box.max.y }
  }, [gltf])
  useEffect(() => { useGarage.setState(s => ({ modelLoad: { ...s.modelLoad, state: 'ready' } })) }, [m])
  useEffect(() => () => m.mats.forEach(x => x.dispose()), [m])

  const dur = (d: number) => (useGarage.getState().reduced ? 0 : d)
  const paint = m.byName['Paint 1 Carmine']
  useEffect(() => {
    if (!paint) return
    const c = new THREE.Color(cfg.color), f = FINISH[cfg.finish]
    const a = gsap.to(paint.color, { r: c.r, g: c.g, b: c.b, duration: dur(0.7), ease: 'power2.inOut' })
    const b = gsap.to(paint, { ...f, duration: dur(0.7), ease: 'power2.inOut' })
    return () => { a.kill(); b.kill() }
  }, [cfg.color, cfg.finish, paint])
  // per-zone colours: roof & inserts / calipers / interior accents
  for (const [key, mat] of [['accent', 'Paint 2 Carmine'], ['caliper', 'Brake'], ['interior', 'Interior 3 Carmine']] as const) {
    const v = cfg[key] ?? null
    // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed-length loop, same hook order every render
    useEffect(() => {
      const target = m.byName[mat]; if (!target) return
      const c = v ? new THREE.Color(v) : m.orig[mat]
      const t = gsap.to(target.color, { r: c.r, g: c.g, b: c.b, duration: dur(0.6), ease: 'power2.inOut' })
      if (key === 'caliper') setCaliperColor(v)
      return () => { t.kill() }
    }, [v, m])
  }
  // livery: fade the old pattern out, swap, fade the new one in
  const lvMode = cfg.livery ?? 'none', lvColor = cfg.liveryColor ?? '#f2f2ee'
  useEffect(() => {
    const u = m.lv, next = LIVERY_MODES[lvMode]
    if (u.uLvMode.value === next) return
    const tl = gsap.timeline()
    if (u.uLvAmt.value > 0) tl.to(u.uLvAmt, { value: 0, duration: dur(0.25) })
    tl.add(() => { u.uLvMode.value = next })
    if (next) tl.to(u.uLvAmt, { value: 1, duration: dur(0.45), ease: 'power2.out' })
    return () => { tl.progress(1).kill() }
  }, [lvMode, m]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = new THREE.Color(lvColor), col = m.lv.uLvCol.value
    const t = gsap.to(col, { r: c.r, g: c.g, b: c.b, duration: dur(0.5), ease: 'power2.inOut' })
    return () => { t.kill() }
  }, [lvColor, m]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = gsap.to(ride.current, { v: cfg.rideHeight, duration: dur(0.9), ease: 'power3.inOut' }); return () => { t.kill() } }, [cfg.rideHeight])
  useEffect(() => { const t = gsap.to(lights.current, { h: cfg.headlights ? 1 : 0, duration: dur(0.35) }); return () => { t.kill() } }, [cfg.headlights])
  useEffect(() => { const t = gsap.to(lights.current, { t: cfg.taillights ? 1 : 0, duration: dur(0.35) }); return () => { t.kill() } }, [cfg.taillights])
  useEffect(() => { m.wheels.forEach(w => (w.visible = cfg.wheel === 'stock')) }, [cfg.wheel, m])
  // glass: real transmission on High, cheap alpha below; tint darkens either way
  const tint = useRef({ v: cfg.tint ?? 0 })
  const applyGlass = (g: THREE.MeshPhysicalMaterial, t: number) => {
    if (low) { g.opacity = 0.28 + t * 0.64; g.color.set('#05080a') }
    else g.color.set('#ffffff').lerp(TINT_DARK, t * 0.96)
  }
  useEffect(() => {
    const g = m.byName['Glass']
    if (!g) return
    if (low) { g.transmission = 0; g.transparent = true }
    else { g.transmission = 1; g.transparent = false; g.opacity = 1 }
    applyGlass(g, tint.current.v)
    g.needsUpdate = true
  }, [low, m]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const g = m.byName['Glass']
    if (!g) return
    const t = gsap.to(tint.current, { v: cfg.tint ?? 0, duration: dur(0.6), ease: 'power2.inOut', onUpdate: () => applyGlass(g, tint.current.v), onComplete: () => applyGlass(g, tint.current.v) })
    return () => { t.kill() }
  }, [cfg.tint, low, m]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const off = -0.07 + ride.current.v * 0.14
    m.root.position.y = off // body (and everything parented to it) moves…
    if (rot.current) { m.lv.uLvInv.value.copy(rot.current.matrixWorld).invert(); m.lv.uLvOff.value = off } // stripes ride with the body
    m.wheels.forEach((w, i) => w.position.set(m.base[i].x, m.base[i].y, m.base[i].z - off)) // …stock wheels stay on the ground
    const h = m.byName['Headlight'], t = m.byName['Brakelight']
    if (h) h.emissiveIntensity = lights.current.h * 10 * (1 - fx.lights * 0.3)
    if (t) t.emissiveIntensity = lights.current.t * 2.2
    spots.current.forEach(s => s && (s.intensity = lights.current.h * (cfg.env === 'night' ? 90 : 25)))
  })

  const carbon = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111315', roughness: 0.35, metalness: 0.6 }), [])
  useEffect(() => () => carbon.dispose(), [carbon])
  const sides = [1, -1] as const
  const { front, rear, hw, spots: sp } = m
  const midX = (front + rear) / 2
  return (
    <group>
      <group ref={rot} rotation-y={Math.PI / 2}><primitive object={m.root} /></group>

      {cfg.wheel !== 'stock' && sp.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} scale={1.13}><Wheel design={cfg.wheel} color={cfg.wheelColor} side={p.z > 0 ? 1 : -1} /></group>
      ))}

      {sides.map(s => (
        <spotLight key={s} ref={el => { if (el) spots.current[s > 0 ? 0 : 1] = el }} position={[front - 0.25, 0.7, s * 0.6]} angle={0.5} penumbra={0.8} distance={14} color="#e6f1ff" intensity={0}
          target-position={[front + 8, 0, s * 0.8]} />
      ))}

      {/* aero — separate objects placed from the model bounds */}
      {cfg.splitter && <mesh position={[front - 0.3, 0.08, 0]} material={carbon}><boxGeometry args={[0.36, 0.03, hw * 1.45]} /></mesh>}
      {cfg.skirts && sides.map(s => <mesh key={s} position={[midX, 0.2, s * (hw - 0.03)]} material={carbon}><boxGeometry args={[(front - rear) * 0.34, 0.07, 0.06]} /></mesh>)}
      {cfg.spoiler === 'lip' && <mesh position={[rear + 0.5, 0.9, 0]} rotation-z={0.25} material={carbon}><boxGeometry args={[0.3, 0.025, hw * 1.45]} /></mesh>}
      {cfg.spoiler === 'wing' && (
        <group position={[rear + 0.4, 0.82, 0]}>
          <mesh position={[0, 0.24, 0]} rotation-z={0.08} material={carbon}><boxGeometry args={[0.42, 0.03, hw * 1.85]} /></mesh>
          {sides.map(s => <mesh key={s} position={[0.02, 0.1, s * 0.55]} material={carbon}><boxGeometry args={[0.05, 0.26, 0.04]} /></mesh>)}
          {sides.map(s => <mesh key={'e' + s} position={[0, 0.24, s * hw * 0.92]} material={carbon}><boxGeometry args={[0.46, 0.15, 0.02]} /></mesh>)}
        </group>
      )}
    </group>
  )
}

