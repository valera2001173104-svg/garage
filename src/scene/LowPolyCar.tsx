import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { useGarage } from '../store'
import { CARS } from '../lib/catalog'
import { url } from '../lib/base'
import { hexToHsl, hslToHex } from '../lib/color'

/**
 * Kenney "Car Kit" vehicles — © Kenney (www.kenney.nl), Creative Commons Zero (CC0), see public/models/lowpoly/LICENSE-Kenney-CC0.txt.
 * Each car has ONE material with a palette texture (an 8×4 grid of colour cells, 64×128 px each), so there are no separate paint,
 * glass or lamp materials to tween. The body colour lives in one palette cell: we repaint that cell on a canvas copy of the texture,
 * keeping its light-to-dark gradient, which recolours exactly the painted panels and nothing else.
 */
const LEN = 4.6 // metres; Kenney cars are ~2.5 units long, scaled to sit next to Car Concept

const lightness = (r: number, g: number, b: number) => hexToHsl('#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''))[2]

function repaint(img: CanvasImageSource & { width: number; height: number }, cell: readonly [number, number], hex: string | null): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0)
  if (!hex) return c
  const cw = Math.round(img.width / 8), ch = Math.round(img.height / 4), x0 = cell[0] * cw, y0 = cell[1] * ch
  const id = g.getImageData(x0, y0, cw, ch), d = id.data
  const [h, s, l] = hexToHsl(hex)
  let mean = 0
  for (let i = 0; i < d.length; i += 4) mean += lightness(d[i], d[i + 1], d[i + 2])
  mean /= d.length / 4
  for (let i = 0; i < d.length; i += 4) {
    const L = lightness(d[i], d[i + 1], d[i + 2])
    const out = parseInt(hslToHex(h, s, Math.max(0.04, Math.min(0.96, l + (L - mean)))).slice(1), 16)
    d[i] = out >> 16; d[i + 1] = (out >> 8) & 255; d[i + 2] = out & 255
  }
  g.putImageData(id, x0, y0)
  return c
}

export default function LowPolyCar() {
  const cfg = useGarage(s => s.config)
  const compare = useGarage(s => s.compare)
  const info = CARS.find(c => c.id === cfg.car) ?? CARS[1]
  const gltf = useGLTF(url(`models/lowpoly/${info.id}.glb`))

  const car = useMemo(() => {
    const root = gltf.scene.clone(true)
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3())
    const g = new THREE.Group()
    root.position.set(-ctr.x, -box.min.y, -ctr.z)
    g.add(root); g.scale.setScalar(LEN / Math.max(size.x, size.z))
    return g
  }, [gltf])

  // the concept model streams in the background at boot; if this car is on stage first, clear its loading card
  useEffect(() => { useGarage.setState(s => ({ modelLoad: { ...s.modelLoad, state: 'ready' } })) }, [car])

  // private texture copy per car, repainted whenever the colour changes (cheap: one 64×128 cell)
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(document.createElement('canvas'))
    t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  useEffect(() => {
    let src: THREE.Texture | null = null
    gltf.scene.traverse(o => { const mt = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (!src && mt?.map) src = mt.map })
    if (!src || !(src as THREE.Texture).image) return
    tex.image = repaint((src as THREE.Texture).image as HTMLImageElement, info.paint ?? [0, 0], compare ? null : cfg.color)
    tex.needsUpdate = true
  }, [gltf, tex, cfg.color, compare, info])
  useEffect(() => {
    const fin = cfg.finish === 'matte' ? { r: 0.85, m: 0 } : cfg.finish === 'gloss' ? { r: 0.28, m: 0 } : { r: 0.5, m: 0.12 }
    car.traverse(o => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const mat = (mesh.userData.own ??= (mesh.material as THREE.MeshStandardMaterial).clone()) as THREE.MeshStandardMaterial
      mat.map = tex; mat.roughness = fin.r; mat.metalness = fin.m; mat.needsUpdate = true
      mesh.material = mat
    })
  }, [car, tex, cfg.finish])
  useEffect(() => () => car.traverse(o => { const m = (o as THREE.Mesh).userData?.own as THREE.Material | undefined; m?.dispose() }), [car])

  return <group rotation-y={Math.PI / 2}><primitive object={car} /></group>
}
