import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import gsap from 'gsap'
import { useGarage } from '../store'

const R = 0.245
const cache = new Map<string, THREE.BufferGeometry>()

function ext(shape: THREE.Shape, depth = 0.028) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.005, bevelSegments: 1, curveSegments: 6 })
}
const poly = (pts: [number, number][]) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s }
const rot = (g: THREE.BufferGeometry, a: number) => g.clone().rotateZ(a)

function build(design: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const radial = (g: THREE.BufferGeometry, n: number, off = 0) => { for (let i = 0; i < n; i++) parts.push(rot(g, off + (i * Math.PI * 2) / n)) }
  if (design === 'spoke5') radial(ext(poly([[-0.03, 0.05], [0.03, 0.05], [0.045, R - 0.01], [-0.045, R - 0.01]])), 5)
  if (design === 'turbine') radial(ext(poly([[-0.015, 0.045], [0.035, 0.045], [0.085, R - 0.01], [0.02, R - 0.01]]), 0.022), 12)
  if (design === 'split') {
    const s = ext(poly([[-0.012, 0.05], [0.012, 0.05], [0.02, R - 0.01], [-0.02, R - 0.01]]))
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI * 2) / 10; parts.push(rot(s, a + 0.1)); parts.push(rot(s, a - 0.1)) }
  }
  if (design === 'mesh') {
    const s = ext(poly([[-0.006, 0.05], [0.006, 0.05], [0.006, R - 0.01], [-0.006, R - 0.01]]), 0.018)
    for (let i = 0; i < 24; i++) parts.push(rot(s, (i * Math.PI * 2) / 24))
    for (const r of [0.11, 0.17]) { const t = new THREE.TorusGeometry(r, 0.008, 6, 40); t.translate(0, 0, 0.01); parts.push(t) }
  }
  if (design === 'disc') {
    const s = new THREE.Shape(); s.absarc(0, 0, R - 0.008, 0, Math.PI * 2, false)
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI * 2) / 10, h = new THREE.Path(); h.absarc(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0.024, 0, Math.PI * 2, true); s.holes.push(h) }
    parts.push(ext(s, 0.02))
  }
  const g = mergeGeometries(parts.map(p => { const c = p.index ? p.toNonIndexed() : p; return c }))!
  return g
}
const faceGeo = (d: string) => { if (!cache.has(d)) cache.set(d, build(d)); return cache.get(d)! }

let tireGeo: THREE.BufferGeometry | null = null
const getTire = () => {
  if (tireGeo) return tireGeo
  const p: THREE.Vector2[] = []
  const w = 0.125
  const pts: [number, number][] = [[0.225, -w * 0.8], [0.26, -w], [0.31, -w * 0.97], [0.335, -w * 0.6], [0.34, 0], [0.335, w * 0.6], [0.31, w * 0.97], [0.26, w], [0.225, w * 0.8]]
  pts.forEach(([r, y]) => p.push(new THREE.Vector2(r, y)))
  tireGeo = new THREE.LatheGeometry(p, 40).rotateX(Math.PI / 2)
  return tireGeo
}
const barrel = new THREE.CylinderGeometry(R, R - 0.02, 0.22, 36, 1, true).rotateX(Math.PI / 2)
const lip = new THREE.TorusGeometry(R + 0.004, 0.02, 8, 48)
const hub = new THREE.CylinderGeometry(0.05, 0.05, 0.05, 20).rotateX(Math.PI / 2)
const disc = new THREE.CylinderGeometry(0.2, 0.2, 0.02, 40).rotateX(Math.PI / 2)
const caliper = new THREE.BoxGeometry(0.1, 0.12, 0.05)
const tireMat = new THREE.MeshStandardMaterial({ color: '#0d0e0f', roughness: 0.85, metalness: 0 })
const discMat = new THREE.MeshStandardMaterial({ color: '#7d8185', roughness: 0.45, metalness: 0.9 })
const caliperMat = new THREE.MeshStandardMaterial({ color: '#b3202a', roughness: 0.4, metalness: 0.3 })
/** catalogue wheels share one caliper material; null restores the default red */
export const setCaliperColor = (hex: string | null) => caliperMat.color.set(hex ?? '#b3202a')

export function Wheel({ design, color, side }: { design: string; color: string; side: 1 | -1 }) {
  const g = useRef<THREE.Group>(null!)
  const face = useMemo(() => faceGeo(design), [design])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.9 }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useEffect(() => {
    const c = new THREE.Color(color)
    gsap.to(mat.color, { r: c.r, g: c.g, b: c.b, duration: useGarage.getState().reduced ? 0 : 0.5 })
  }, [color, mat])
  // swap animation: new design spins & scales in
  useEffect(() => {
    if (useGarage.getState().reduced) return
    const t = gsap.fromTo(g.current.scale, { x: 0.6, y: 0.6, z: 0.6 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.6)' })
    const r = gsap.fromTo(g.current.rotation, { z: -Math.PI * 0.6 }, { z: 0, duration: 0.9, ease: 'power3.out' })
    return () => { t.kill(); r.kill() }
  }, [design])
  return (
    <group rotation-y={side > 0 ? 0 : Math.PI}>
      <group ref={g}>
        <mesh geometry={getTire()} material={tireMat} />
        <mesh geometry={barrel} material={mat} />
        <mesh geometry={lip} material={mat} position-z={0.105} />
        <mesh geometry={face} material={mat} position-z={0.05} />
        <mesh geometry={hub} material={mat} position-z={0.07} />
        <mesh geometry={disc} material={discMat} position-z={0.0} />
        <mesh geometry={caliper} material={caliperMat} position={[0.12, 0.08, 0.02]} rotation-z={0.6} />
      </group>
    </group>
  )
}
