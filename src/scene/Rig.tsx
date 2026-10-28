import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import gsap from 'gsap'
import type { OrbitControls as OC } from 'three-stdlib'
import { useGarage, type ViewId } from '../store'
import { canvasToBlob } from '../lib/db'
import { fx } from './fx'

const T = new THREE.Vector3(0, 0.6, 0)
/** distance multiplier so a portrait screen sees the same horizontal span as a square one (FOV is vertical) */
const fitK = (asp: number) => Math.max(1, 0.95 / asp)
export const VIEWS: Record<Exclude<ViewId, 'reset'>, { p: [number, number, number]; t: [number, number, number] }> = {
  three: { p: [6.6, 2.0, 6.2], t: [0, 0.55, 0] },
  front: { p: [10, 1.3, 0.2], t: [0, 0.6, 0] },
  rear: { p: [-10, 1.4, 0.2], t: [0, 0.6, 0] },
  side: { p: [0.3, 1.1, 10.2], t: [0, 0.6, 0] },
  wheel: { p: [4.6, 0.75, 3.9], t: [1.49, 0.38, 0.95] },
  'rear-wheel': { p: [-4.4, 0.75, 3.9], t: [-1.31, 0.38, 0.95] },
  cabin: { p: [2.3, 2.1, 3.3], t: [0.1, 0.72, 0.1] },
  headlight: { p: [5.2, 0.95, 2.3], t: [2.3, 0.62, 0.55] },
  taillight: { p: [-5.0, 1.1, 2.4], t: [-2.0, 0.72, 0.45] },
  top: { p: [5.4, 5.0, 5.2], t: [0, 0.6, 0] }
}

export function Rig() {
  const { camera, gl, scene, size } = useThree()
  const ctl = useRef<OC>(null!)
  const view = useGarage(s => s.view)
  const screen = useGarage(s => s.screen)
  const idle = useGarage(s => s.idleOrbit)
  const reduced = useGarage(s => s.reduced)
  const setCapture = useGarage(s => s.setCapture)
  const insets = useGarage(s => s.insets)
  const off = useRef({ x: 0, y: 0 })
  const last = useRef(performance.now())
  const tween = useRef<gsap.core.Timeline | null>(null)

  // Intro: lights on, car emerges, slow dolly-in
  useEffect(() => {
    if (screen !== 'intro') return
    // portrait screens: pull the intro camera back so the whole car fits
    const asp = size.width / Math.max(1, size.height), k = fitK(asp)
    const P = (x: number, y: number, z: number) => ({ x: T.x + (x - T.x) * k, y: T.y + (y - T.y) * k, z: T.z + (z - T.z) * k })
    const a = P(10.5, 2.4, 11), b = P(7.5, 1.9, 7.2)
    camera.position.set(a.x, a.y, a.z); ctl.current?.target.copy(T); ctl.current?.update()
    const tl = gsap.timeline()
    if (useGarage.getState().reduced) { fx.lights = 1; fx.env = 1; camera.position.set(b.x, b.y, b.z) }
    else {
      tl.to(fx, { lights: 1, duration: 2.6, ease: 'power2.in' }, 0.5)
        .to(fx, { env: 1, duration: 3.2, ease: 'power2.out' }, 1.1)
        .to(camera.position, { ...b, duration: 6, ease: 'power2.out' }, 0)
    }
    return () => { tl.kill() }
  }, [screen === 'intro'])

  // returning visitors skip the intro: lights are already on and the camera sits at the working angle
  useEffect(() => {
    if (useGarage.getState().screen === 'intro') return
    fx.lights = 1; fx.env = 1
    const v = VIEWS.three, asp = size.width / Math.max(1, size.height), k = fitK(asp)
    camera.position.set(v.t[0] + (v.p[0] - v.t[0]) * k, v.t[1] + (v.p[1] - v.t[1]) * k, v.t[2] + (v.p[2] - v.t[2]) * k)
    ctl.current?.target.set(...v.t); ctl.current?.update()
  }, [])

  // keep the car centred in the area not covered by panels / the mobile sheet
  useEffect(() => {
    const t = gsap.to(off.current, { x: (insets.l - insets.r) / 2, y: (insets.t - insets.b) / 2, duration: useGarage.getState().reduced ? 0 : 0.45, ease: 'power2.out' })
    return () => { t.kill() }
  }, [insets])

  // Preset camera moves
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const id = view.id === 'reset' ? 'three' : view.id
    const v = VIEWS[id]; if (!v || !ctl.current) return
    tween.current?.kill()
    const d = useGarage.getState().reduced ? 0 : 1.5
    ctl.current.autoRotate = false
    // portrait screens need more distance to frame the same car
    const asp = size.width / Math.max(1, size.height), k = fitK(asp)
    const px = v.t[0] + (v.p[0] - v.t[0]) * k, py = v.t[1] + (v.p[1] - v.t[1]) * k, pz = v.t[2] + (v.p[2] - v.t[2]) * k
    tween.current = gsap.timeline({ defaults: { duration: d, ease: 'power3.inOut' } })
      .to(camera.position, { x: px, y: py, z: pz }, 0)
      .to(ctl.current.target, { x: v.t[0], y: v.t[1], z: v.t[2], onUpdate: () => ctl.current.update() }, 0)
  }, [view.n])

  // entering the workspace from the intro
  useEffect(() => {
    if (screen === 'garage' && ctl.current && !(useGarage.getState().view.n > 0)) useGarage.getState().setView('three')
  }, [screen])

  useEffect(() => {
    setCapture(async o => {
      const el = gl.domElement, pr = gl.getPixelRatio()
      const target = Math.min(o?.width ?? el.clientWidth * pr, gl.capabilities.maxTextureSize, 4096)
      gl.setPixelRatio(target / Math.max(1, el.clientWidth))
      camera.clearViewOffset(); camera.updateProjectionMatrix() // export is centred, not offset by the panels
      gl.render(scene, camera)
      const b = await canvasToBlob(el, o?.type ?? 'image/png', o?.q)
      gl.setPixelRatio(pr)
      return b
    })
    return () => setCapture(null)
  }, [gl, scene, camera, setCapture])

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(off.current.x) > 0.5 || Math.abs(off.current.y) > 0.5) { cam.setViewOffset(size.width, size.height, -off.current.x, -off.current.y, size.width, size.height) }
    else if (cam.view?.enabled) { cam.clearViewOffset() }
    const c = ctl.current; if (!c) return
    const inactive = performance.now() - last.current > 4500
    c.autoRotate = idle && !reduced && inactive && (screen === 'garage' || screen === 'intro') && !tween.current?.isActive()
    c.autoRotateSpeed = 0.45
    c.target.x = THREE.MathUtils.clamp(c.target.x, -3, 3); c.target.z = THREE.MathUtils.clamp(c.target.z, -3, 3); c.target.y = THREE.MathUtils.clamp(c.target.y, 0.1, 2)
    if (screen === 'intro') { c.autoRotate = false; c.update() }
  })

  // portrait screens need a longer leash, otherwise the distance clamp undoes the framing above
  const kAsp = fitK(size.width / Math.max(1, size.height))
  return (
    <OrbitControls ref={ctl as never} makeDefault enableDamping dampingFactor={0.07} target={T}
      minDistance={2.2} maxDistance={11 * kAsp} minPolarAngle={0.2} maxPolarAngle={Math.PI / 2 - 0.02}
      enablePan screenSpacePanning={false} rotateSpeed={0.7} zoomSpeed={0.8}
      enabled={screen !== 'intro'} onStart={() => { last.current = performance.now(); tween.current?.kill() }} onChange={() => { last.current = performance.now() }} />
  )
}
