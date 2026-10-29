import { Component, lazy, Suspense, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { qualityLevel, useGarage } from '../store'
import { Car } from './Car'
import { Studio } from './Studio'
import { Rig } from './Rig'
import { loadModel } from './modelLoader'

const ModelCar = lazy(() => import('./ModelCar'))
const LowPolyCar = lazy(() => import('./LowPolyCar'))

// no-op if App already started it (e.g. user arrived via another screen)
loadModel(qualityLevel(useGarage.getState()) === 2 ? 2 : 1)

/** If the glTF is missing or fails to load, fall back to the procedural demo car. */
class ModelBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: Error) { console.warn('Car model failed, using procedural fallback:', e.message); useGarage.getState().say('Не удалось загрузить модель — показан упрощённый автомобиль') }
  render() { return this.state.failed ? <Car /> : this.props.children }
}

export default function GarageCanvas() {
  const q = useGarage(qualityLevel)
  const auto = useGarage(s => s.quality === 'auto')
  const car = useGarage(s => s.config.car ?? 'concept')
  const step = (d: 1 | -1) => { const s = useGarage.getState(), p = Math.max(0, Math.min(s.perfMax, s.perf + d)) as 0 | 1 | 2; if (p !== s.perf) s.setPerf(p) }
  return (
    <Canvas
      className="stage-canvas"
      dpr={q === 2 ? [1, 2] : q === 1 ? [1, 1.5] : 1}
      camera={{ position: [10.5, 2.4, 11], fov: 34, near: 0.1, far: 80 }}
      gl={{ antialias: q > 0, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace }}
    >
      {auto && <PerformanceMonitor flipflops={3} onDecline={() => step(-1)} onIncline={() => step(1)} />}
      <Suspense fallback={null}>
        <Studio />
        <ModelBoundary>{car === 'concept' ? <ModelCar /> : <LowPolyCar key={car} />}</ModelBoundary>
      </Suspense>
      <Rig />
    </Canvas>
  )
}
