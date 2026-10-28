import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { useGarage } from '../store'
import { curve, loft, stations } from './loft'
import { Wheel } from './Wheel'
import { fx } from './fx'
import { DEFAULT_CONFIG } from '../lib/catalog'

/**
 * DEMO car: procedurally lofted coupe (no third-party assets).
 * Replace with a licensed glTF: see public/models/README.md for naming requirements.
 * Body / glass / lights / wheels / aero are separate objects, so every option below is a real 3D swap.
 */
const L = 2.25
const W_FRONT = 1.36, W_REAR = -1.32, WZ = 0.84

// blunter nose/tail (Kamm-style) so lamps and bumpers have real surface to sit on
const bodyW = curve([[-L, 0], [-2.245, 0.46], [-2.19, 0.7], [-2.05, 0.82], [-1.7, 0.9], [-1.2, 0.945], [-0.5, 0.955], [0.5, 0.955], [1.2, 0.94], [1.75, 0.9], [2.0, 0.82], [2.15, 0.64], [2.235, 0.4], [L, 0]])
const bodyYt = curve([[-L, 0.66], [-2.1, 0.85], [-1.6, 0.91], [-0.9, 0.91], [0, 0.9], [0.9, 0.87], [1.5, 0.79], [2.05, 0.65], [L, 0.52]])
const bodyYb = curve([[-L, 0.38], [-2.1, 0.25], [-1.6, 0.22], [1.6, 0.22], [2.1, 0.24], [L, 0.3]])
const cabW = curve([[-1.15, 0.02], [-1.05, 0.45], [-0.8, 0.66], [-0.4, 0.73], [0.1, 0.73], [0.45, 0.67], [0.65, 0.56], [0.76, 0.02]])
const cabYt = curve([[-1.15, 0.9], [-0.95, 1.1], [-0.55, 1.24], [0, 1.27], [0.4, 1.2], [0.62, 1.05], [0.76, 0.9]])
const roofYt = curve([[-0.85, 1.14], [-0.55, 1.245], [0, 1.275], [0.3, 1.23]])
/** exact z of the body side surface at (x, y) — lets details sit flush on the lofted skin */
const sideZ = (x: number, y: number) => {
  const a = bodyYb(x), b = bodyYt(x), ym = (a + b) / 2, hh = (b - a) / 2
  const t = Math.min(0.999, Math.abs((y - ym) / hh))
  return bodyW(x) * (1 - t ** 4.2) ** (1 / 4.2)
}

const FINISH = {
  metallic: { metalness: 0.85, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 },
  matte: { metalness: 0.15, roughness: 0.78, clearcoat: 0, clearcoatRoughness: 0.5 },
  gloss: { metalness: 0.05, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }
} as const

export function Car() {
  const cfg = useGarage(s => (s.compare ? DEFAULT_CONFIG : s.config))
  const bodyRef = useRef<THREE.Group>(null!)
  const ride = useRef({ v: cfg.rideHeight })
  const lights = useRef({ h: cfg.headlights ? 1 : 0, t: cfg.taillights ? 1 : 0 })

  const geo = useMemo(() => ({
    body: loft(stations(-L, L, 70), bodyW, bodyYb, bodyYt, 4.2),
    cabin: loft(stations(-1.15, 0.76, 40), cabW, () => 0.8, cabYt, 3.2),
    sail: loft(stations(-1.15, -0.78, 10), x => cabW(x) * 1.012, () => 0.8, cabYt, 3.2),
    roof: loft(stations(-0.85, 0.3, 24), x => 0.52 * (1 - Math.abs(x + 0.28) * 0.16), x => roofYt(x) - 0.025, x => roofYt(x) + 0.004, 6)
  }), [])
  useEffect(() => () => { Object.values(geo).forEach(g => g.dispose()) }, [geo])

  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cfg.color, ...FINISH[cfg.finish] }), [])
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0a131a', metalness: 0.75, roughness: 0.03, clearcoat: 1, envMapIntensity: 1.4 }), [])
  const black = useMemo(() => new THREE.MeshStandardMaterial({ color: '#08090a', roughness: 0.6, metalness: 0.2 }), [])
  const carbon = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111315', roughness: 0.35, metalness: 0.6 }), [])
  const headMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dfe9f2', emissive: '#cfe6ff', emissiveIntensity: 0, roughness: 0.2 }), [])
  const tailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a0508', emissive: '#ff1a22', emissiveIntensity: 0, roughness: 0.3 }), [])
  useEffect(() => () => { [paint, glass, black, carbon, headMat, tailMat].forEach(m => m.dispose()) }, [paint, glass, black, carbon, headMat, tailMat])

  const dur = (d: number) => (useGarage.getState().reduced ? 0 : d)
  useEffect(() => {
    const c = new THREE.Color(cfg.color), f = FINISH[cfg.finish]
    const a = gsap.to(paint.color, { r: c.r, g: c.g, b: c.b, duration: dur(0.7), ease: 'power2.inOut' })
    const b = gsap.to(paint, { ...f, duration: dur(0.7), ease: 'power2.inOut' })
    return () => { a.kill(); b.kill() }
  }, [cfg.color, cfg.finish, paint])
  useEffect(() => { const t = gsap.to(ride.current, { v: cfg.rideHeight, duration: dur(0.9), ease: 'power3.inOut' }); return () => { t.kill() } }, [cfg.rideHeight])
  useEffect(() => { const t = gsap.to(lights.current, { h: cfg.headlights ? 1 : 0, duration: dur(0.35) }); return () => { t.kill() } }, [cfg.headlights])
  useEffect(() => { const t = gsap.to(lights.current, { t: cfg.taillights ? 1 : 0, duration: dur(0.35) }); return () => { t.kill() } }, [cfg.taillights])

  const spots = useRef<THREE.SpotLight[]>([])
  useFrame(() => {
    bodyRef.current.position.y = -0.075 + ride.current.v * 0.15
    const dark = 1 - fx.lights * 0.35
    headMat.emissiveIntensity = lights.current.h * 3.2 * dark
    tailMat.emissiveIntensity = lights.current.t * 2.6
    spots.current.forEach(s => s && (s.intensity = lights.current.h * (cfg.env === 'night' ? 90 : 25)))
  })

  const wheels = [[W_FRONT, 1], [W_FRONT, -1], [W_REAR, 1], [W_REAR, -1]] as const
  const sides = [1, -1] as const
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ced1', metalness: 1, roughness: 0.15 }), [])
  const accent = useMemo(() => new THREE.MeshBasicMaterial({ color: '#4FE0C0', toneMapped: false }), [])
  const seam = useMemo(() => new THREE.MeshStandardMaterial({ color: '#050607', roughness: 0.7 }), [])
  useEffect(() => () => { chrome.dispose(); accent.dispose(); seam.dispose() }, [chrome, accent, seam])
  return (
    <group>
      {wheels.map(([x, s]) => (
        <group key={`${x}${s}`} position={[x, 0.33, s * WZ]}><Wheel design={cfg.wheel === 'stock' ? 'spoke5' : cfg.wheel} color={cfg.wheelColor} side={s} /></group>
      ))}
      <group ref={bodyRef}>
        <mesh geometry={geo.body} material={paint} castShadow />
        <mesh geometry={geo.cabin} material={glass} />
        <mesh geometry={geo.roof} material={paint} />
        <mesh geometry={geo.sail} material={paint} />

        {/* wheel wells + painted fender lips */}
        {wheels.map(([x, s]) => (
          <group key={`a${x}${s}`}>
            <mesh position={[x, 0.33, s * 0.6]} rotation-x={Math.PI / 2} material={black}><cylinderGeometry args={[0.39, 0.39, 0.5, 32]} /></mesh>
            <mesh position={[x, 0.33, s * (sideZ(x, 0.72) + 0.004)]} material={paint}><torusGeometry args={[0.415, 0.03, 10, 36, Math.PI]} /></mesh>
          </group>
        ))}

        {/* door cuts, handles, sill */}
        {sides.map(s => (
          <group key={`d${s}`}>
            {[0.62, -0.95].map(x => <mesh key={x} position={[x, 0.6, s * (sideZ(x, 0.6) + 0.004)]} material={seam}><boxGeometry args={[0.012, 0.52, 0.012]} /></mesh>)}
            <mesh position={[-0.2, 0.46, s * (sideZ(-0.2, 0.46) + 0.004)]} material={seam}><boxGeometry args={[1.58, 0.012, 0.012]} /></mesh>
            <mesh position={[0.28, 0.77, s * (sideZ(0.28, 0.77) + 0.008)]} material={chrome}><boxGeometry args={[0.2, 0.03, 0.02]} /></mesh>
            <mesh position={[-0.6, 0.77, s * (sideZ(-0.6, 0.77) + 0.008)]} material={chrome}><boxGeometry args={[0.2, 0.03, 0.02]} /></mesh>
            {/* mirrors */}
            <mesh position={[0.6, 0.93, s * 0.8]} material={black}><boxGeometry args={[0.05, 0.04, 0.12]} /></mesh>
            <mesh position={[0.58, 1.0, s * 0.9]} rotation-y={s * -0.15} material={paint}><boxGeometry args={[0.16, 0.09, 0.1]} /></mesh>
            {/* intakes behind the doors */}
            <mesh position={[-1.35, 0.5, s * (sideZ(-1.35, 0.5) + 0.004)]} rotation-z={-0.2} material={seam}><boxGeometry args={[0.34, 0.1, 0.012]} /></mesh>
          </group>
        ))}
        <mesh position={[0.8, 0.874, 0]} rotation-z={-0.07} material={seam}><boxGeometry args={[0.46, 0.008, 0.5]} /></mesh>
        <mesh position={[1.45, 0.805, 0]} rotation-z={-0.17} material={seam}><boxGeometry args={[0.5, 0.01, 0.46]} /></mesh>

        {/* front fascia: grille, intakes, headlights, mint signature */}
        <mesh position={[2.2, 0.47, 0]} material={black}><boxGeometry args={[0.07, 0.1, 0.92]} /></mesh>
        <mesh position={[2.2, 0.33, 0]} material={black}><boxGeometry args={[0.05, 0.08, 1.0]} /></mesh>
        {sides.map(s => (
          <group key={`f${s}`}>
            <mesh position={[2.13, 0.56, s * 0.56]} rotation-y={s * -0.75} rotation-z={-0.1} material={black}><boxGeometry args={[0.07, 0.085, 0.4]} /></mesh>
            <mesh position={[2.165, 0.565, s * 0.56]} rotation-y={s * -0.75} rotation-z={-0.1} material={headMat}><boxGeometry args={[0.03, 0.05, 0.34]} /></mesh>
            <mesh position={[-2.17, 0.74, s * 0.5]} rotation-y={s * 0.18} material={tailMat}><boxGeometry args={[0.05, 0.065, 0.58]} /></mesh>
            <mesh position={[-2.2, 0.38, s * 0.5]} rotation-z={Math.PI / 2} material={chrome}><cylinderGeometry args={[0.05, 0.05, 0.14, 18]} /></mesh>
            <mesh position={[-2.2, 0.38, s * 0.5]} rotation-z={Math.PI / 2} material={black}><cylinderGeometry args={[0.035, 0.035, 0.15, 18]} /></mesh>
            <spotLight ref={el => { if (el) spots.current[s > 0 ? 0 : 1] = el }} position={[2.1, 0.62, s * 0.58]} angle={0.5} penumbra={0.8} distance={14} color="#e6f1ff" intensity={0}
              target-position={[9, 0, s * 0.8]} />
          </group>
        ))}
        <mesh position={[2.168, 0.545, 0]} material={accent}><boxGeometry args={[0.012, 0.012, 0.9]} /></mesh>
        <mesh position={[-2.19, 0.74, 0]} material={tailMat}><boxGeometry args={[0.04, 0.025, 0.4]} /></mesh>
        <mesh position={[-2.2, 0.52, 0]} material={black}><boxGeometry args={[0.06, 0.1, 0.7]} /></mesh>
        <mesh position={[-2.12, 0.27, 0]} rotation-z={0.25} material={carbon}><boxGeometry args={[0.26, 0.04, 1.0]} /></mesh>

        {/* aero — real separate objects */}
        {cfg.splitter && <mesh position={[2.17, 0.2, 0]} material={carbon}><boxGeometry args={[0.4, 0.03, 1.55]} /></mesh>}
        {cfg.skirts && sides.map(s => (
          <mesh key={s} position={[0, 0.25, s * (sideZ(0, 0.25) + 0.03)]} material={carbon}><boxGeometry args={[1.6, 0.07, 0.06]} /></mesh>
        ))}
        {cfg.spoiler === 'lip' && <mesh position={[-2.06, 0.9, 0]} rotation-z={0.28} material={carbon}><boxGeometry args={[0.26, 0.025, 1.3]} /></mesh>}
        {cfg.spoiler === 'wing' && (
          <group position={[-2.0, 1.0, 0]}>
            <mesh position={[0, 0.2, 0]} rotation-z={0.08} material={carbon}><boxGeometry args={[0.38, 0.03, 1.7]} /></mesh>
            {sides.map(s => <mesh key={s} position={[0.02, 0.09, s * 0.5]} material={carbon}><boxGeometry args={[0.05, 0.22, 0.04]} /></mesh>)}
            {sides.map(s => <mesh key={'e' + s} position={[0, 0.2, s * 0.86]} material={carbon}><boxGeometry args={[0.42, 0.14, 0.02]} /></mesh>)}
          </group>
        )}
      </group>
    </group>
  )
}
