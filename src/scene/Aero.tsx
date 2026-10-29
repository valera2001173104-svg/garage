import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural aero kit (original geometry, no third-party assets). Car frame: +X nose, -X tail, ±Z sides, +Y up.
 * Every part is an extruded profile, so edges are bevelled and catch highlights like real moulded carbon.
 */
export type AeroCfg = { spoiler: 'none' | 'lip' | 'duck' | 'wing' | 'swan'; splitter: boolean; skirts: boolean; canards?: boolean; diffuser?: 'none' | 'street' | 'race' }

const flat = (g: THREE.BufferGeometry) => { const c = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(c.attributes)) if (k !== 'position' && k !== 'normal') c.deleteAttribute(k); return c }
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map(flat))!
const ext = (s: THREE.Shape, depth: number, bevel = 0.004) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, -depth / 2)
const poly = (pts: [number, number][]) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s }

/** wing section: rounded leading edge, thin trailing edge, chord along X, thickness along Y */
function airfoil(chord: number, thick: number) {
  const s = new THREE.Shape(), c = chord, t = thick
  s.moveTo(c / 2, 0)
  s.bezierCurveTo(c * 0.25, t * 0.95, -c * 0.3, t * 0.7, -c / 2, t * 0.1)
  s.lineTo(-c / 2, -t * 0.05)
  s.bezierCurveTo(-c * 0.2, -t * 0.55, c * 0.2, -t * 0.7, c / 2, 0)
  return s
}

export function Aero({ cfg, front, rear, hw, mat }: { cfg: AeroCfg; front: number; rear: number; hw: number; mat: THREE.Material }) {
  const W = hw * 1.45 // overall width used by every wide part
  const len = front - rear
  const midX = (front + rear) / 2

  const splitter = useMemo(() => {
    // plan-view plate: wide at the back, rounded at the lip, with end plates and two struts
    const s = new THREE.Shape()
    s.moveTo(-0.2, -W / 2); s.lineTo(0.14, -W / 2 + 0.05); s.quadraticCurveTo(0.2, 0, 0.14, W / 2 - 0.05); s.lineTo(-0.2, W / 2); s.closePath()
    const plate = ext(s, 0.022, 0.004).rotateX(Math.PI / 2) // XY shape → XZ plane, thin along Y
    const endp = [1, -1].map(k => ext(poly([[-0.2, 0], [0.12, 0], [0.12, 0.05], [-0.2, 0.09]]), 0.012, 0.003).translate(0, 0.02, k * (W / 2 - 0.01)))
    const strut = [0.28, -0.28].map(z => new THREE.CylinderGeometry(0.006, 0.006, 0.1, 8).translate(-0.05, 0.06, z * W))
    return merge([plate, ...endp, ...strut])
  }, [W])

  const canards = useMemo(() => {
    const blade = ext(poly([[0, 0], [0.2, 0], [0.12, 0.12], [0.02, 0.1]]), 0.01, 0.003) // swept triangular fin
    const parts: THREE.BufferGeometry[] = []
    for (const k of [1, -1]) for (const j of [0, 1]) {
      parts.push(blade.clone().rotateX(Math.PI / 2 + k * 0.28).translate(-0.16 - j * 0.04, 0.2 + j * 0.07, k * (hw * 0.62 + j * hw * 0.04)))
    }
    return merge(parts)
  }, [hw])

  const skirt = useMemo(() => {
    // side blade seen from the front: thin wall with a turned-out lower lip, stretched along X
    const prof = poly([[0, 0], [0.012, 0], [0.012, -0.05], [0.05, -0.062], [0.05, -0.075], [-0.005, -0.075], [-0.005, -0.012]])
    const body = new THREE.ExtrudeGeometry(prof, { depth: len * 0.36, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.004, bevelSegments: 2 }).translate(0, 0, -len * 0.18)
    return flat(body.rotateY(-Math.PI / 2)) // profile X → Z (outward), extrusion Z → X (length)
  }, [len])

  const diff = useMemo(() => {
    const n = cfg.diffuser === 'race' ? 7 : cfg.diffuser === 'street' ? 4 : 0
    if (!n) return null
    const dw = hw * 1.3
    const tray = ext(poly([[0, 0], [0.32, 0], [0.32, 0.015], [0, 0.015]]), dw, 0.003).rotateZ(-0.22) // gently rising floor panel
    const fins: THREE.BufferGeometry[] = []
    for (let i = 0; i < n; i++) {
      const z = (-0.5 + (i + 0.5) / n) * dw * 0.92
      fins.push(ext(poly([[0, 0], [0.32, 0], [0.32, 0.1], [0.04, 0.012]]), 0.008, 0.002).rotateZ(-0.22).translate(0, 0, z))
    }
    return merge([tray, ...fins])
  }, [cfg.diffuser, hw])

  const wing = useMemo(() => {
    const swan = cfg.spoiler === 'swan'
    const chord = 0.36, span = W * 1.02
    const blade = ext(airfoil(chord, 0.045), span, 0.003)
    const gurney = ext(poly([[-0.002, 0], [0.002, 0], [0.002, 0.035], [-0.002, 0.035]]), span, 0).translate(-chord / 2, 0.012, 0)
    const parts: THREE.BufferGeometry[] = [blade.rotateZ(0.12), gurney.rotateZ(0.12)]
    // end plates: tall at the back, tapering toward the front
    for (const k of [1, -1]) parts.push(ext(poly([[-0.16, -0.03], [0.16, -0.02], [0.15, 0.05], [-0.16, 0.1]]), 0.012, 0.003).translate(0, 0, k * span / 2))
    // pylons: curved hanging "swan neck" mounts, or straight uprights for the GT wing
    for (const k of [1, -1]) {
      const z = k * W * 0.28
      if (swan) {
        const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.16, z), new THREE.Vector3(0.04, -0.07, z), new THREE.Vector3(0.1, 0, z), new THREE.Vector3(0.1, 0.03, z)])
        parts.push(new THREE.TubeGeometry(c, 18, 0.014, 8, false))
      } else parts.push(ext(poly([[-0.03, -0.14], [0.04, -0.14], [0.025, 0], [-0.012, 0]]), 0.018, 0.003).translate(0, 0, z))
    }
    return merge(parts)
  }, [cfg.spoiler, W])

  const duck = useMemo(() => {
    // ducktail: rear deck kicked up in a smooth curve, full width
    const s = new THREE.Shape()
    s.moveTo(0, 0); s.bezierCurveTo(-0.1, 0, -0.18, 0.04, -0.24, 0.12)
    s.lineTo(-0.245, 0.135); s.bezierCurveTo(-0.18, 0.07, -0.1, 0.03, 0.02, 0.025); s.closePath()
    return ext(s, W * 0.98, 0.003)
  }, [W])

  const lip = useMemo(() => ext(poly([[0.14, 0], [0.1, 0.045], [-0.06, 0.05], [-0.1, 0.012], [-0.04, 0.012], [0.04, 0.012]]), W * 0.98, 0.003), [W])

  return (
    <>
      {cfg.splitter && <mesh geometry={splitter} position={[front - 0.28, 0.07, 0]} material={mat} />}
      {cfg.canards && <mesh geometry={canards} position={[front - 0.2, 0, 0]} material={mat} />}
      {cfg.skirts && [1, -1].map(k => <mesh key={k} geometry={skirt} position={[midX, 0.26, k * (hw - 0.01)]} scale={[1, 1, k]} material={mat} />)}
      {diff && <mesh geometry={diff} position={[rear + 0.02, 0.1, 0]} material={mat} />}
      {cfg.spoiler === 'lip' && <mesh geometry={lip} position={[rear + 0.5, 0.88, 0]} rotation-z={0.12} material={mat} />}
      {cfg.spoiler === 'duck' && <mesh geometry={duck} position={[rear + 0.46, 0.84, 0]} material={mat} />}
      {(cfg.spoiler === 'wing' || cfg.spoiler === 'swan') && <mesh geometry={wing} position={[rear + 0.42, cfg.spoiler === 'swan' ? 1.06 : 1.02, 0]} material={mat} />}
    </>
  )
}
