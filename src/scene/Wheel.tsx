import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import gsap from 'gsap'
import { useFrame } from '@react-three/fiber'
import { useGarage } from '../store'
import { bindEnv } from './envBind'
import { DISC_SPECS, RIM_SPECS } from '../lib/rims'

/**
 * Catalogue wheel assembly, axis = +Z, outer face toward +Z. Everything is procedural (no unlicensed assets):
 * tyre with tread and sidewall lettering, rim barrel, dished face, hub plate with centre cap and lug nuts,
 * drilled brake disc, arc-shaped caliper, valve stem.
 */
const R = 0.245
const DISH = 0.04 // how far the rim end of the face sits in front of the hub (concave look)
const cache = new Map<string, THREE.BufferGeometry>()

function ext(shape: THREE.Shape, depth = 0.028, bevel = 1) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.0045 * bevel, bevelThickness: 0.006 * bevel, bevelSegments: 2, curveSegments: 8 })
}
const poly = (pts: [number, number][]) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s }
const rot = (g: THREE.BufferGeometry, a: number) => g.clone().rotateZ(a)
/** merge-safe copy: non-indexed, position + normal only */
const flat = (g: THREE.BufferGeometry) => { const c = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal') c.deleteAttribute(k); return c }

function build(design: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const radial = (g: THREE.BufferGeometry, n: number, off = 0) => { for (let i = 0; i < n; i++) parts.push(rot(g, off + (i * Math.PI * 2) / n)) }
  if (design === 'spoke5') {
    radial(ext(poly([[-0.034, 0.05], [0.034, 0.05], [0.05, R - 0.012], [-0.05, R - 0.012]]), 0.026), 5)
    // raised centre rib on every spoke
    radial(ext(poly([[-0.012, 0.075], [0.012, 0.075], [0.02, R - 0.04], [-0.02, R - 0.04]]), 0.012, 0.6).translate(0, 0, 0.022), 5)
  }
  if (design === 'turbine') {
    radial(ext(poly([[-0.014, 0.045], [0.034, 0.045], [0.088, R - 0.012], [0.024, R - 0.012]]), 0.022), 12)
    radial(ext(poly([[-0.004, 0.07], [0.012, 0.07], [0.04, R - 0.05], [0.026, R - 0.05]]), 0.008, 0.4).translate(0, 0, 0.018), 12)
  }
  if (design === 'split') {
    const s = ext(poly([[-0.012, 0.05], [0.012, 0.05], [0.02, R - 0.012], [-0.02, R - 0.012]]), 0.024)
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI * 2) / 10; parts.push(rot(s, a + 0.1)); parts.push(rot(s, a - 0.1)) }
  }
  if (design === 'mesh') {
    const s = ext(poly([[-0.006, 0.05], [0.006, 0.05], [0.006, R - 0.012], [-0.006, R - 0.012]]), 0.018, 0.7)
    for (let i = 0; i < 24; i++) parts.push(rot(s, (i * Math.PI * 2) / 24))
    for (const r of [0.11, 0.17]) { const t = new THREE.TorusGeometry(r, 0.009, 8, 56); t.translate(0, 0, 0.01); parts.push(t) }
  }
  if (design === 'disc') {
    const s = new THREE.Shape(); s.absarc(0, 0, R - 0.008, 0, Math.PI * 2, false)
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI * 2) / 10, h = new THREE.Path(); h.absarc(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.024, 0, Math.PI * 2, true); s.holes.push(h) }
    parts.push(ext(s, 0.02))
    // aero ring around the vented holes
    const ring = new THREE.TorusGeometry(0.2, 0.007, 8, 64); ring.translate(0, 0, 0.022); parts.push(ring)
  }
  const spec = RIM_SPECS.find(r => r.id === design)
  if (spec) {
    for (const grp of spec.groups) {
      radial(ext(poly(grp.pts.map(([x, r]) => [x * R, r * R] as [number, number])), 0.024), grp.n, grp.off ?? 0)
      // raised centre rib along each plain four-point spoke, like a cast relief line
      if (grp.pts.length === 4) radial(ext(poly([[-0.007, 0.075], [0.007, 0.075], [0.011, R * 0.8], [-0.011, R * 0.8]]), 0.01, 0.5).translate(0, 0, 0.02), grp.n, grp.off ?? 0)
    }
    for (const r of spec.rings ?? []) { const t = new THREE.TorusGeometry(r * R, 0.008, 8, 64); t.translate(0, 0, 0.012); parts.push(t) }
    if (spec.bolts) {
      const b = new THREE.CylinderGeometry(0.0065, 0.0065, 0.012, 6).rotateX(Math.PI / 2).translate(R * 0.93, 0, 0.016)
      for (let i = 0; i < spec.bolts; i++) parts.push(rot(b, (i / spec.bolts) * Math.PI * 2))
    }
  }
  const dsc = DISC_SPECS.find(d => d.id === design)
  if (dsc) {
    const s = new THREE.Shape(); s.absarc(0, 0, R - 0.008, 0, Math.PI * 2, false)
    for (let i = 0; i < dsc.holes; i++) { const a = (i * Math.PI * 2) / dsc.holes, h = new THREE.Path(); h.absarc(Math.cos(a) * dsc.at * R, Math.sin(a) * dsc.at * R, dsc.hr * R, 0, Math.PI * 2, true); s.holes.push(h) }
    parts.push(ext(s, 0.022))
    const ring = new THREE.TorusGeometry(R * 0.86, 0.006, 8, 64); ring.translate(0, 0, 0.024); parts.push(ring)
  }
  const g = mergeGeometries(parts.map(flat))!
  if (design !== 'disc' && !dsc) { // concave dish: the further from the hub, the closer to the viewer
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)) / R; p.setZ(i, p.getZ(i) + DISH * r * r) }
    g.computeVertexNormals()
  }
  return g
}
const faceGeo = (d: string) => { if (!cache.has(d)) cache.set(d, build(d)); return cache.get(d)! }

/* ── tyre: lathe profile + a generated bump map (tread blocks, grooves, sidewall lettering) ── */
const W = 0.125
const TIRE_PTS: [number, number][] = [[0.225, -W * 0.8], [0.26, -W], [0.31, -W * 0.97], [0.335, -W * 0.6], [0.34, 0], [0.335, W * 0.6], [0.31, W * 0.97], [0.26, W], [0.225, W * 0.8]]
let tireGeo: THREE.BufferGeometry | null = null
const getTire = () => (tireGeo ??= new THREE.LatheGeometry(TIRE_PTS.map(([r, y]) => new THREE.Vector2(r, y)), 96).rotateX(Math.PI / 2))

function tireBump(): THREE.CanvasTexture {
  const w = 2048, h = 512, c = document.createElement('canvas'); c.width = w; c.height = h
  const x = c.getContext('2d')!
  x.fillStyle = '#8a8a8a'; x.fillRect(0, 0, w, h)
  const v = (t: number) => (1 - t) * h // lathe v (0 = inner bead … 1 = outer bead) → canvas y
  // tread: v 3/8 … 5/8 — circumferential grooves and slanted blocks between them
  x.fillStyle = '#2c2c2c'
  for (const t of [0.4, 0.45, 0.5, 0.55, 0.6]) x.fillRect(0, v(t) - 4, w, 8)
  x.strokeStyle = '#303030'; x.lineWidth = 7
  for (let i = 0; i < 96; i++) for (let j = 0; j < 4; j++) {
    const px = (i + (j % 2) * 0.5) * (w / 96), y0 = v(0.4 + j * 0.05), y1 = v(0.45 + j * 0.05)
    x.beginPath(); x.moveTo(px, y0); x.lineTo(px + 22, y1); x.stroke()
  }
  // sidewall on the outer side (v 5/8 … 1): rim-protector ridge, fine ticks, lettering
  x.fillStyle = '#b4b4b4'; x.fillRect(0, v(0.86) - 5, w, 10)
  x.fillStyle = '#6a6a6a'; x.fillRect(0, v(0.9) - 3, w, 6)
  for (let i = 0; i < 360; i++) { x.fillStyle = '#a0a0a0'; x.fillRect((i * w) / 360, v(0.745) - 7, 3, 14) }
  x.fillStyle = '#e2e2e2'; x.textBaseline = 'middle'
  x.save(); x.scale(0.5, 1) // the sidewall is ~2× longer per pixel around than across; squeeze the glyphs back
  x.font = '700 40px Inter, Arial, sans-serif'
  const label = 'GARAGE  PERFORMANCE   245/35 R20   TUBELESS   '
  for (let k = 0; k < 2; k++) x.fillText(label, k * (w / 0.5 / 2) + 40, v(0.8))
  x.restore()
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping
  return t
}
let tireTex: THREE.CanvasTexture | null = null

/* ── fixed parts ── */
const barrel = new THREE.CylinderGeometry(R, R - 0.022, 0.23, 48, 1, true).rotateX(Math.PI / 2)
const lip = new THREE.TorusGeometry(R + 0.003, 0.019, 10, 64)
const hubPlate = new THREE.CylinderGeometry(0.088, 0.1, 0.024, 32).rotateX(Math.PI / 2)
const capBase = new THREE.CylinderGeometry(0.046, 0.05, 0.02, 32).rotateX(Math.PI / 2)
const capDome = new THREE.SphereGeometry(0.04, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1, 1, 0.35)
const capRing = new THREE.TorusGeometry(0.046, 0.005, 8, 40)
const lug = new THREE.CylinderGeometry(0.0125, 0.0125, 0.026, 6).rotateX(Math.PI / 2)
const valve = new THREE.CylinderGeometry(0.005, 0.006, 0.034, 10).rotateX(Math.PI / 2)
const valveCap = new THREE.CylinderGeometry(0.0075, 0.0075, 0.012, 10).rotateX(Math.PI / 2)

/** drilled brake rotor with a hat; thickness along Z */
const rotor = (() => {
  const s = new THREE.Shape(); s.absarc(0, 0, 0.2, 0, Math.PI * 2, false)
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.1, 0, Math.PI * 2, true); s.holes.push(hole)
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2, p = new THREE.Path(); p.absarc(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.0075, 0, Math.PI * 2, true); s.holes.push(p) }
  const body = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 24 }).translate(0, 0, -0.011)
  const hat = new THREE.CylinderGeometry(0.108, 0.108, 0.05, 36).rotateX(Math.PI / 2).translate(0, 0, 0.015)
  return mergeGeometries([flat(body), flat(hat)])!
})()

/** arc-shaped caliper straddling the rotor rim; stays inside the rim barrel (r < 0.222) */
const CAL = { a0: 0.55, a1: 1.45, ro: 0.213, ri: 0.138 }
const caliperGeo = (() => {
  const { a0, a1, ro, ri } = CAL
  const s = new THREE.Shape()
  s.absarc(0, 0, ro, a0, a1, false)
  s.lineTo(Math.cos(a1) * ri, Math.sin(a1) * ri)
  s.absarc(0, 0, ri, a1, a0, true)
  s.closePath()
  return new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.007, bevelSegments: 3, curveSegments: 20 }).translate(0, 0, -0.035)
})()
const plate = new THREE.BoxGeometry(0.065, 0.015, 0.003)
const bleed = new THREE.CylinderGeometry(0.0055, 0.0055, 0.02, 8)

const tireMat = new THREE.MeshStandardMaterial({ color: '#101112', roughness: 0.88, metalness: 0, bumpScale: 1.6 })
const discMat = new THREE.MeshPhysicalMaterial({ color: '#8d9297', roughness: 0.42, metalness: 0.85, envMapIntensity: 1.6 })
const lugMat = new THREE.MeshStandardMaterial({ color: '#c3c7cb', roughness: 0.3, metalness: 1, envMapIntensity: 1.8 })
const capMat = new THREE.MeshPhysicalMaterial({ color: '#15171a', roughness: 0.28, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 })
const plateMat = new THREE.MeshStandardMaterial({ color: '#e8e9ea', roughness: 0.5, metalness: 0.2 })
const caliperMat = new THREE.MeshPhysicalMaterial({ color: '#b3202a', roughness: 0.38, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 })
/** catalogue wheels share one caliper material; null restores the default red */
export const setCaliperColor = (hex: string | null) => caliperMat.color.set(hex ?? '#b3202a')

export function Wheel({ design, color, side }: { design: string; color: string; side: 1 | -1 }) {
  const g = useRef<THREE.Group>(null!)
  const face = useMemo(() => faceGeo(design), [design])
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.8, clearcoat: 0.55, clearcoatRoughness: 0.18, envMapIntensity: 1.7, side: THREE.DoubleSide }), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => mat.dispose(), [mat])
  // metals get their own reflection strength (the shared brake/lug materials are re-bound by every wheel, which is cheap)
  useFrame(({ scene }) => { bindEnv(scene, mat, 1.5); bindEnv(scene, discMat, 1.4); bindEnv(scene, lugMat, 1.6) })
  useEffect(() => { tireTex ??= tireBump(); tireMat.bumpMap = tireTex; tireMat.needsUpdate = true }, [])
  useEffect(() => {
    const c = new THREE.Color(color)
    const t = gsap.to(mat.color, { r: c.r, g: c.g, b: c.b, duration: useGarage.getState().reduced ? 0 : 0.5 })
    return () => { t.kill() }
  }, [color, mat])
  // swap animation: new design spins & scales in
  useEffect(() => {
    if (useGarage.getState().reduced) return
    const t = gsap.fromTo(g.current.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.6)' })
    const r = gsap.fromTo(g.current.rotation, { z: -Math.PI * 0.6 }, { z: 0, duration: 0.9, ease: 'power3.out' })
    return () => { t.kill(); r.kill() }
  }, [design])
  const lugs = useMemo(() => Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 + Math.PI / 5; return [Math.cos(a) * 0.068, Math.sin(a) * 0.068] as const }), [])
  const aMid = (CAL.a0 + CAL.a1) / 2
  return (
    <group rotation-y={side > 0 ? 0 : Math.PI}>
      <group ref={g}>
        <mesh geometry={getTire()} material={tireMat} />
        <mesh geometry={barrel} material={mat} />
        <mesh geometry={lip} material={mat} position-z={0.108} />
        <mesh geometry={lip} material={mat} position-z={-0.108} />
        <mesh geometry={face} material={mat} position-z={0.05} />
        {/* hub: plate, lug nuts, centre cap */}
        <mesh geometry={hubPlate} material={mat} position-z={0.052} />
        {lugs.map(([x, y], i) => <mesh key={i} geometry={lug} material={lugMat} position={[x, y, 0.074]} rotation-z={i} />)}
        <mesh geometry={capBase} material={capMat} position-z={0.076} />
        <mesh geometry={capRing} material={mat} position-z={0.087} />
        <mesh geometry={capDome} material={capMat} position-z={0.086} />
        <mesh geometry={valve} material={lugMat} position={[-0.13, -0.2, 0.112]} />
        <mesh geometry={valveCap} material={capMat} position={[-0.13, -0.2, 0.136]} />
        {/* brakes */}
        <mesh geometry={rotor} material={discMat} />
        <mesh geometry={caliperGeo} material={caliperMat} />
        <mesh geometry={plate} material={plateMat} position={[Math.cos(aMid) * 0.178, Math.sin(aMid) * 0.178, 0.0435]} rotation-z={aMid - Math.PI / 2} />
        {[CAL.a0 + 0.17, CAL.a1 - 0.17].map(a => <mesh key={a} geometry={bleed} material={lugMat} position={[Math.cos(a) * 0.217, Math.sin(a) * 0.217, 0]} rotation-z={a - Math.PI / 2} />)}
      </group>
    </group>
  )
}
