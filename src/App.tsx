import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { qualityLevel, useGarage } from './store'
import { loadModel } from './scene/modelLoader'
import { Intro } from './ui/Home'
import { Toast } from './ui/Dialogs'
import { ModelLoading } from './ui/ModelLoading'

// the car download starts at boot, in parallel with the 3D code chunk (not after it)
if (useGarage.getState().screen === 'intro' || useGarage.getState().screen === 'garage') loadModel(qualityLevel(useGarage.getState()) === 2 ? 2 : 1)

const GarageCanvas = lazy(() => import('./scene/GarageCanvas'))
const Configurator = lazy(() => import('./ui/Configurator'))
const PhotoBar = lazy(() => import('./ui/PhotoBar'))
const MyGarage = lazy(() => import('./ui/MyGarage'))
const Create3D = lazy(() => import('./ui/Create3D'))
const Scan = lazy(() => import('./scan/Scan'))

class Boundary extends Component<{ children: ReactNode; label: string }, { err: Error | null }> {
  state = { err: null as Error | null }
  static getDerivedStateFromError(err: Error) { return { err } }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>
        <div className="empty" style={{ maxWidth: 480 }}>
          <b style={{ fontSize: 18 }}>{this.props.label}</b>
          <div className="muted">{this.state.err.message}. Проверьте, что в браузере включён WebGL, и перезагрузите страницу.</div>
          <button className="btn primary" onClick={() => location.reload()}>Перезагрузить</button>
        </div>
      </div>
    )
  }
}

const Loading = () => <div className="layer" style={{ display: 'grid', placeItems: 'center' }}><span className="muted"><span className="spin" /> Загрузка…</span></div>

export default function App() {
  const screen = useGarage(s => s.screen)
  const photo = useGarage(s => s.photoMode)
  const theme = useGarage(s => s.theme)
  const stage = screen === 'intro' || screen === 'garage'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0e1113' : '#f3f4f5')
  }, [theme])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const s = useGarage.getState(), typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === 'Escape' && s.photoMode) s.setPhotoMode(false)
      if ((e.key === 'h' || e.key === 'H') && s.photoMode && !typing) s.setUiHidden(!s.uiHidden)
      if (s.screen === 'garage' && !s.photoMode && !typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo() }
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [])

  return (
    <div className="app">
      <a className="skip" href="#main">К содержимому</a>
      {stage && (
        <div className="stage" role="img" aria-label="3D-сцена с автомобилем: вращайте, чтобы осмотреть">
          <Boundary label="3D-сцена недоступна"><Suspense fallback={null}><GarageCanvas /></Suspense></Boundary>
        </div>
      )}
      <Boundary label="Не удалось загрузить раздел">
        <Suspense fallback={<Loading />}>
          {screen === 'intro' && <Intro />}
          {screen === 'garage' && (photo ? <PhotoBar /> : <Configurator />)}
          {screen === 'mygarage' && <MyGarage />}
          {screen === 'create3d' && <Create3D />}
          {screen === 'scan' && <Scan />}
        </Suspense>
      </Boundary>
      {stage && !photo && <ModelLoading />}
      <Toast />
    </div>
  )
}
