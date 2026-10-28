import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Environment, Lightformer, MeshReflectorMaterial } from '@react-three/drei'
import { qualityLevel, useGarage } from '../store'
import { fx } from './fx'
import { bindEnv } from './envBind'

function concrete() {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const x = c.getContext('2d')!
  x.fillStyle = '#6a6e72'; x.fillRect(0, 0, 512, 512)
  const img = x.getImageData(0, 0, 512, 512)
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 38; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n }
  x.putImageData(img, 0, 0)
  x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 3; x.strokeRect(0, 0, 512, 512)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 8); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

const BG = { dark: { studio: '#0e1113', day: '#3a4249', night: '#05070a' }, light: { studio: '#e4e7e9', day: '#d3dce3', night: '#171c21' } } as const
const ENV = {
  studio: { bg: '#0B0D0F', env: 1.0, key: 1.4, strips: 1 },
  day: { bg: '#3a4249', env: 1.5, key: 2.6, strips: 0.15 },
  night: { bg: '#040506', env: 0.35, key: 0.25, strips: 0.45 }
} as const

export function Studio() {
  const env = useGarage(s => s.config.env)
  const photo = useGarage(s => s.photoMode)
  const pbg = useGarage(s => s.photoBg)
  const q = useGarage(qualityLevel)
  const theme = useGarage(s => s.theme)
  const low = q < 2
  const bgMode = photo ? pbg : 'garage'
  const scene = useThree(s => s.scene)
  const tex = useMemo(concrete, [])
  useEffect(() => () => tex.dispose(), [tex])
  const E = ENV[env]
  const light = bgMode === 'light'
  const bg = light ? '#cfd4d8' : bgMode === 'void' ? '#050607' : BG[theme][env]

  const roomRef = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(() => {
    scene.environmentIntensity = fx.env * E.env * (light ? 1.4 : 1)
    if (roomRef.current) bindEnv(scene, roomRef.current, 0.25) // walls stay dark: they should frame the car, not glow
  })

  const stripCount = 7
  const strips = Array.from({ length: stripCount }, (_, i) => -7.2 + i * 2.4)
  const stripMats = useMemo(() => strips.map(() => new THREE.MeshBasicMaterial({ color: '#000', toneMapped: false })), [])
  useEffect(() => () => stripMats.forEach(m => m.dispose()), [stripMats])
  useFrame(() => {
    const k = fx.lights * E.strips
    // dark theme: dimmer than the env lights on purpose (full white in the mirror floor reads as road markings);
    // light theme: bright, so the reflection melts into the pale floor instead of showing as a grey streak
    const f = env === 'night' ? 0.3 : theme === 'light' ? 1.2 : 0.5
    stripMats.forEach(m => m.color.setRGB(0.9 * k * f, 0.96 * k * f, 1.0 * k * f))
  })

  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, 14, 34]} />
      <Environment key={env + bgMode + q} resolution={q < 1 ? 128 : 256} frames={1}>
        {strips.map((z, i) => <Lightformer key={i} form="rect" intensity={env === 'night' ? 1.2 : 3.2} color={env === 'day' ? '#fff3df' : '#dce9ff'} position={[0, 5, z]} rotation-x={Math.PI / 2} scale={[14, 1.4, 1]} />)}
        {/* long side softboxes: give the flanks the classic car-photography highlight bands */}
        {[1, -1].map(s => <Lightformer key={'side' + s} form="rect" intensity={env === 'day' ? 2.4 : env === 'night' ? 0.55 : 1.5} color={env === 'day' ? '#fff3df' : '#e4eeff'} position={[0, 1.7, s * 8]} rotation-y={s > 0 ? Math.PI : 0} scale={[16, 1.5, 1]} />)}
        {[1, -1].map(s => <Lightformer key={'low' + s} form="rect" intensity={env === 'night' ? 0.2 : 0.55} color="#cfdcf5" position={[0, 0.5, s * 8]} rotation-y={s > 0 ? Math.PI : 0} scale={[16, 0.6, 1]} />)}
        {/* broad dim ceiling: keeps metal and dark paint from turning pitch black between the strips */}
        <Lightformer form="rect" intensity={env === 'night' ? 0.12 : env === 'day' ? 0.5 : 0.45} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[26, 26, 1]} color="#cfdcf5" />
        <Lightformer form="rect" intensity={env === 'day' ? 4 : 1.1} position={[-9, 2.5, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} color={env === 'day' ? '#fff0d8' : '#c9dcff'} />
        <Lightformer form="rect" intensity={env === 'night' ? 2.2 : 0.9} position={[9, 1.5, -3]} rotation-y={-Math.PI / 2} scale={[8, 0.6, 1]} color="#cfe0ff" />
        {env === 'day' && <Lightformer form="rect" intensity={1.8} position={[0, 9, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} color="#dbe8ff" />}
      </Environment>

      <directionalLight position={[4, 8, 3]} intensity={E.key} color={env === 'day' ? '#fff3e0' : '#cfe0ff'} />
      <directionalLight position={[-6, 3, -5]} intensity={E.key * 0.35} color="#b9c9e6" />

      {/* room */}
      {bgMode === 'garage' && (
        <group>
          {/* room floor sits 2 cm below the studio floor: coplanar faces z-fight into blocky patches */}
          <mesh position={[0, 4.98, 0]}><boxGeometry args={[34, 10, 34]} /><meshStandardMaterial ref={roomRef} color={theme === 'light' ? '#d3d7da' : '#12161a'} roughness={0.95} side={THREE.BackSide} /></mesh>
          {/* one-sided panels facing down: seen from the car, invisible when the camera sits above them */}
          {strips.map((z, i) => <mesh key={i} position={[0, 4.95, z]} rotation-x={Math.PI / 2} material={stripMats[i]}><planeGeometry args={[14, 0.4]} /></mesh>)}
        </group>
      )}

      {/* floor */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[60, 60]} />
        {low ? (
          <meshStandardMaterial map={tex} color={light ? '#9aa0a4' : theme === 'light' ? '#d4d8db' : '#555a5e'} roughness={0.82} metalness={0.08} envMapIntensity={0.15} />
        ) : (
          <MeshReflectorMaterial map={tex} color={light ? '#a8aeb2' : theme === 'light' ? '#d4d8db' : '#4a4e52'} blur={[0, 0]} resolution={1024} mixBlur={0} mixStrength={light ? 4 : 6} mixContrast={1}
            roughness={0.85} metalness={0.4} mirror={0.55} depthScale={0} />
        )}
      </mesh>
      <ContactShadows position={[0, 0.005, 0]} opacity={0.75} scale={9} blur={2.4} far={1.6} resolution={256} frames={q < 1 ? 1 : Infinity} />
    </>
  )
}
