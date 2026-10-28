import { useEffect, useState, type ReactNode } from 'react'
import { useGarage, type Quality, type Screen } from '../store'
import { IconBtn, Ic, Seg, Toggle, type IconName } from './kit'

export const NAV: { id: Screen; name: string; icon: IconName }[] = [
  { id: 'garage', name: '3D-конфигуратор', icon: 'car' },
  { id: 'scan', name: 'GARAGE SCAN', icon: 'scan' },
  { id: 'mygarage', name: 'Мои проекты', icon: 'folder' },
  { id: 'create3d', name: '3D из фото', icon: 'cube' }
]
const QUALITY: { id: Quality; name: string }[] = [{ id: 'auto', name: 'Авто' }, { id: 'high', name: 'Высокое' }, { id: 'medium', name: 'Среднее' }, { id: 'low', name: 'Низкое' }]

type History = { items: string[]; cursor: number; onJump: (i: number) => void }
type Props = { active: Screen; undo?: () => void; redo?: () => void; canUndo?: boolean; canRedo?: boolean; history?: History; guard?: () => boolean; status?: ReactNode; children?: ReactNode }

export function Topbar({ active, undo, redo, canUndo, canRedo, history, guard, status, children }: Props) {
  const go = useGarage(s => s.go)
  const theme = useGarage(s => s.theme), setTheme = useGarage(s => s.setTheme)
  const quality = useGarage(s => s.quality), setQuality = useGarage(s => s.setQuality)
  const perf = useGarage(s => s.perf)
  const idle = useGarage(s => s.idleOrbit), setIdle = useGarage(s => s.setIdleOrbit)
  const [pop, setPop] = useState<null | 'history' | 'settings'>(null)
  const nav = (id: Screen) => { if (guard && !guard()) return; setPop(null); go(id) }
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && setPop(null); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [])
  return (
    <>
      <header className="top">
        <div className="brand">GARAGE</div>
        <nav className="nav" aria-label="Разделы">
          {NAV.map(n => <button key={n.id} aria-current={active === n.id ? 'page' : undefined} onClick={() => nav(n.id)}>{n.name}</button>)}
        </nav>
        <div className="spacer" />
        {status}
        {undo && <>
          <IconBtn n="undo" label="Отменить (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
          <IconBtn n="redo" label="Повторить (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo} />
        </>}
        {history && <IconBtn n="history" label="История изменений" className="hide-m" pressed={pop === 'history'} onClick={() => setPop(pop === 'history' ? null : 'history')} />}
        {children}
        <IconBtn n="sliders" label="Настройки" pressed={pop === 'settings'} onClick={() => setPop(pop === 'settings' ? null : 'settings')} />
      </header>
      {pop && <div style={{ position: 'absolute', inset: 0, zIndex: 25 }} onClick={() => setPop(null)} />}
      {pop === 'history' && history && (
        <div className="pop" role="dialog" aria-label="История изменений">
          <h4>История ({history.items.length})</h4>
          {history.items.map((l, i) => (
            <button key={i} className={'item' + (i === history.cursor ? ' cur' : i > history.cursor ? ' future' : '')} onClick={() => history.onJump(i)} aria-current={i === history.cursor}>
              <span>{l}</span>{i === history.cursor && <Ic n="check" />}
            </button>
          )).reverse()}
        </div>
      )}
      {pop === 'settings' && (
        <div className="pop" role="dialog" aria-label="Настройки" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="mobile-nav" style={{ display: 'contents' }}>
            {NAV.map(n => <button key={n.id} className="sec show-m" aria-current={active === n.id} onClick={() => nav(n.id)}><Ic n={n.icon} />{n.name}</button>)}
          </div>
          <div><div className="label" style={{ marginBottom: 8 }}>Тема</div><Seg label="Тема" value={theme} onPick={setTheme} items={[{ id: 'dark', name: 'Тёмная' }, { id: 'light', name: 'Светлая' }]} /></div>
          <div>
            <div className="label" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}><span>Качество 3D</span>{quality === 'auto' && <span>сейчас: {['низкое', 'среднее', 'высокое'][perf]}</span>}</div>
            <Seg label="Качество графики" value={quality} onPick={setQuality} items={QUALITY} />
          </div>
          <Toggle label="Медленное вращение камеры" on={idle} onChange={setIdle} />
        </div>
      )}
    </>
  )
}
