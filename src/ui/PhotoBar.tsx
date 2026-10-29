import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGarage } from '../store'
import { VIEWS } from '../lib/catalog'
import { useMobile } from '../lib/useMobile'
import { Field, Ic, IconBtn, Seg, Toggle } from './kit'
import { downloadBlob } from './Dialogs'

const RES = [{ id: '1920', name: 'HD' }, { id: '2560', name: '2K' }, { id: '3840', name: '4K' }]
const FMT = [{ id: 'png', name: 'PNG' }, { id: 'jpeg', name: 'JPG' }, { id: 'webp', name: 'WebP' }] as const

/** Photo mode: scene, background, resolution and format; the interface can be hidden entirely (H / Esc). */
export default function PhotoBar() {
  const setView = useGarage(s => s.setView), setPhotoMode = useGarage(s => s.setPhotoMode)
  const uiHidden = useGarage(s => s.uiHidden), setUiHidden = useGarage(s => s.setUiHidden)
  const capture = useGarage(s => s.capture), say = useGarage(s => s.say)
  const photoBg = useGarage(s => s.photoBg), setPhotoBg = useGarage(s => s.setPhotoBg)
  const env = useGarage(s => s.config.env), set = useGarage(s => s.set)
  const mobile = useMobile()
  const flash = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState(mobile ? '1920' : '2560')
  const spin = useGarage(s => s.spin)
  const [secs, setSecs] = useState('8')
  const [left, setLeft] = useState(0)
  const [fmt, setFmt] = useState<(typeof FMT)[number]['id']>('png')

  const cut = photoBg === 'cutout'
  // the page shows a checkerboard behind the transparent canvas so the cut-out is visible
  useEffect(() => { document.body.toggleAttribute('data-cutout', cut); return () => document.body.removeAttribute('data-cutout') }, [cut])
  const shoot = async () => {
    const type = cut && fmt === 'jpeg' ? 'png' : fmt // JPG cannot hold transparency
    setBusy(true)
    gsap.fromTo(flash.current, { opacity: 0.8 }, { opacity: 0, duration: 0.45 })
    const b = await capture?.({ width: +res, type: 'image/' + type, q: 0.93 })
    setBusy(false)
    if (b) { downloadBlob(b, `garage-photo-${Date.now()}.${type === 'jpeg' ? 'jpg' : type}`); say('Снимок сохранён') } else say('Не удалось получить снимок')
  }
  /** one smooth 360° orbit around the car, recorded straight from the 3D canvas (no UI in the video) */
  const record = async () => {
    if (!spin || left) return
    const n = +secs
    setLeft(n); const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000)
    const b = await spin({ seconds: n }); clearInterval(t); setLeft(0)
    if (!b) return say('Этот браузер не умеет записывать видео с 3D-сцены')
    downloadBlob(b, `garage-360-${Date.now()}.${b.type.includes('mp4') ? 'mp4' : 'webm'}`)
    say(cut ? 'Видео сохранено. Прозрачность видео не хранит: фон будет чёрным' : 'Видео-облёт сохранён')
  }
  const turn = (
    <>
      <Seg label="Длительность облёта" value={secs} onPick={setSecs} items={[{ id: '5', name: '5 с' }, { id: '8', name: '8 с' }, { id: '12', name: '12 с' }]} />
      <button className="btn wide" onClick={record} disabled={!spin || left > 0}><Ic n="camera" />{left ? `Запись… ${left} с` : 'Видео-облёт 360°'}</button>
    </>
  )
  const scenes = <Seg label="Сцена" value={env} onPick={e => set({ env: e })} items={[{ id: 'studio', name: 'Студия' }, { id: 'day', name: 'День' }, { id: 'night', name: 'Ночь' }]} />
  const bgs = (<>
    <Seg label="Фон" value={cut ? '' : photoBg} onPick={setPhotoBg} items={[{ id: 'garage', name: 'Гараж' }, { id: 'void', name: 'Тёмный' }, { id: 'light', name: 'Светлый' }]} />
    <Toggle label="Прозрачный фон" on={cut} onChange={on => setPhotoBg(on ? 'cutout' : 'garage')} />
  </>)
  return (
    <div className="layer">
      <div className="flash" ref={flash} />
      {uiHidden ? (
        <button className="btn sm floating" style={{ position: 'absolute', right: 14, top: 'calc(14px + var(--safe-t))', opacity: 0.7 }} onClick={() => setUiHidden(false)}><Ic n="eye" />Интерфейс</button>
      ) : (<>
        <div className="dock" style={{ top: 'calc(14px + var(--safe-t))', bottom: 'auto', left: 0, right: 0 }}>
          <div className="floating" role="toolbar" aria-label="Ракурсы">
            {VIEWS.map(v => <button key={v.id} className="btn ghost sm" onClick={() => setView(v.id)}>{v.name}</button>)}
            <button className="btn ghost sm" onClick={() => setView('wheel')}>Колесо</button>
          </div>
        </div>
        {mobile ? (
          <div className="floating photo-bar" style={{ position: 'absolute', left: 8, right: 8, bottom: 10, flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 10 }}>
            {scenes}{bgs}
            {turn}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><Seg label="Разрешение" value={res} onPick={setRes} items={RES} /></div>
              <button className="shutter" aria-label="Сделать снимок" disabled={busy} onClick={shoot} />
              <IconBtn n="eye" label="Скрыть интерфейс" onClick={() => setUiHidden(true)} />
              <IconBtn n="close" label="Выйти из фото-режима" onClick={() => setPhotoMode(false)} />
            </div>
          </div>
        ) : (<>
          <aside className="left panel" style={{ width: 224, bottom: 'auto' }} aria-label="Сцена">
            <div className="rhead" style={{ padding: '6px 4px' }}><h2>Фото-режим</h2></div>
            <Field label="Сцена">{scenes}</Field>
            <Field label="Фон">{bgs}</Field>
            <button className="btn ghost wide" onClick={() => setPhotoMode(false)}><Ic n="back" />Вернуться</button>
          </aside>
          <aside className="right panel" style={{ width: 224, bottom: 'auto' }} aria-label="Экспорт">
            <div className="rbody" style={{ padding: 16 }}>
              <Field label="Разрешение"><Seg label="Разрешение" value={res} onPick={setRes} items={RES} /></Field>
              <Field label="Формат"><Seg label="Формат" value={fmt} onPick={setFmt} items={FMT.map(f => ({ id: f.id, name: f.name }))} /></Field>
              {cut && <div className="note">Фон прозрачный: снимок сохранится как PNG или WebP (JPG не хранит прозрачность).</div>}
              <button className="shutter" style={{ alignSelf: 'center' }} aria-label="Сделать снимок" disabled={busy} onClick={shoot} />
              <div className="muted" style={{ textAlign: 'center', fontSize: 12 }}>Сделать снимок</div>
              <Field label="Видео-облёт">{turn}</Field>
              <button className="btn ghost wide" onClick={() => setUiHidden(true)}><Ic n="eye" />Скрыть интерфейс (H)</button>
            </div>
          </aside>
        </>)}
      </>)}
    </div>
  )
}
