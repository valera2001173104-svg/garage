import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGarage } from '../store'
import { BODY_COLORS, CALIPER_COLORS, INTERIOR_COLORS, LIVERIES, LIVERY_COLORS, SUSPENSION, TINTS, VIEWS, WHEELS, WHEEL_COLORS } from '../lib/catalog'
import { shareBuild } from '../lib/share'
import { saveProject, uid, type CarConfig, type Project } from '../lib/db'
import { useMobile } from '../lib/useMobile'
import { rimThumb } from '../scan/engine'
import { ColorPicker, Field, Ic, IconBtn, Seg, Slider, Swatches, Toggle, type IconName } from './kit'
import { Topbar } from './Shell'
import { NameDialog, downloadBlob, thumb } from './Dialogs'

type Sec = 'look' | 'wheels' | 'stance' | 'light' | 'aero' | 'env'
const SECTIONS: { id: Sec; name: string; short: string; icon: IconName }[] = [
  { id: 'look', name: 'Внешний вид', short: 'Вид', icon: 'paint' },
  { id: 'wheels', name: 'Диски', short: 'Диски', icon: 'wheel' },
  { id: 'stance', name: 'Подвеска', short: 'Посадка', icon: 'stance' },
  { id: 'light', name: 'Свет', short: 'Свет', icon: 'light' },
  { id: 'aero', name: 'Обвес', short: 'Обвес', icon: 'aero' },
  { id: 'env', name: 'Окружение', short: 'Сцена', icon: 'env' }
]

type Zone = 'body' | 'accent' | 'caliper' | 'interior'
const ZONES: { id: Zone; name: string; view: 'three' | 'top' | 'wheel' | 'cabin' }[] = [
  { id: 'body', name: 'Кузов', view: 'three' }, { id: 'accent', name: 'Крыша', view: 'top' }, { id: 'caliper', name: 'Суппорты', view: 'wheel' }, { id: 'interior', name: 'Салон', view: 'cabin' }
]
/** approximate sRGB of the model's factory materials, shown while a zone is untouched */
const FACTORY = { accent: '#363636', caliper: '#d30000', interior: '#800f00' } as const
const ZONE_ITEMS = { accent: BODY_COLORS, caliper: CALIPER_COLORS, interior: INTERIOR_COLORS } as const
const ZONE_LABEL = { accent: 'Крыша, вставки и корпуса зеркал', caliper: 'Тормозные суппорты', interior: 'Акценты салона: сиденья, двери, руль' } as const

function Controls({ sec }: { sec: Sec }) {
  const [zone, setZone] = useState<Zone>('body')
  const c = useGarage(s => s.config), set = useGarage(s => s.set), setView = useGarage(s => s.setView)
  const recents = useGarage(s => s.recents)
  const idle = useGarage(s => s.idleOrbit), setIdle = useGarage(s => s.setIdleOrbit)
  if (sec === 'look') return (<>
    <Field label="Зона"><Seg label="Зона окраски" value={zone} onPick={z => { setZone(z); setView(ZONES.find(x => x.id === z)!.view) }} items={ZONES} /></Field>
    {zone === 'body' ? <>
      <ColorPicker label="Цвет кузова" items={BODY_COLORS} value={c.color} recents={recents} onPick={color => set({ color })} />
      <Field label="Покрытие"><Seg label="Покрытие" value={c.finish} onPick={finish => set({ finish })} items={[{ id: 'gloss', name: 'Глянец' }, { id: 'metallic', name: 'Металлик' }, { id: 'matte', name: 'Матовое' }]} /></Field>
      <Field label="Полосы"><Seg label="Полосы" value={c.livery ?? 'none'} onPick={livery => { set({ livery }); setView(livery === 'side' ? 'side' : livery === 'none' ? 'three' : 'top') }} items={[...LIVERIES]} /></Field>
      {(c.livery ?? 'none') !== 'none' && (
        <Field label="Цвет полос" value={LIVERY_COLORS.find(x => x.hex === c.liveryColor)?.name}>
          <Swatches label="Цвет полос" items={LIVERY_COLORS} value={c.liveryColor ?? '#f2f2ee'} onPick={liveryColor => set({ liveryColor })} />
        </Field>
      )}
      <Field label="Тонировка стёкол" value={(c.tint ?? 0) > 0.01 ? `пропускает ${Math.round((1 - (c.tint ?? 0)) * 100)}%` : 'нет'}>
        <Seg label="Тонировка стёкол" value={TINTS.find(t => Math.abs(t.v - (c.tint ?? 0)) < 0.01)?.id ?? ''} onPick={id => { set({ tint: TINTS.find(t => t.id === id)!.v }); setView('side') }} items={TINTS.map(t => ({ id: t.id, name: t.name }))} />
      </Field>
      {(c.tint ?? 0) > 0.31 && <div className="note">В России лобовое и передние боковые стёкла должны пропускать не меньше 70% света. Более тёмная плёнка допустима только на задних стёклах.</div>}
    </> : <>
      <ColorPicker label={ZONE_LABEL[zone]} items={[...ZONE_ITEMS[zone]]} value={c[zone] ?? FACTORY[zone]} recents={recents} onPick={hex => set({ [zone]: hex } as Partial<CarConfig>)} />
      <button className="btn ghost" style={{ alignSelf: 'flex-start' }} disabled={!c[zone]} onClick={() => set({ [zone]: null } as Partial<CarConfig>)}><Ic n="reset" />{c[zone] ? 'Вернуть заводской цвет' : 'Заводской цвет'}</button>
      {zone === 'caliper' && <div className="note">Цвет применяется к суппортам и серийных, и каталожных дисков.</div>}
    </>}
  </>)
  if (sec === 'wheels') return (<>
    <Field label="Дизайн" value={WHEELS.find(w => w.id === c.wheel)?.name}>
      <div className="tiles" role="radiogroup" aria-label="Дизайн дисков">
        {WHEELS.map(w => (
          <button key={w.id} className={'tile' + (c.wheel === w.id ? ' on' : '')} role="radio" aria-checked={c.wheel === w.id} onClick={() => { set({ wheel: w.id }); setView('wheel') }}>
            {w.id === 'stock' ? <Ic n="wheel" /> : <img src={rimThumb(w.id, c.wheelColor)} alt="" />}
            {w.name}
          </button>
        ))}
      </div>
    </Field>
    <Field label="Цвет дисков" value={WHEEL_COLORS.find(x => x.hex === c.wheelColor)?.name}>
      <Swatches label="Цвет дисков" items={WHEEL_COLORS} value={c.wheelColor} onPick={wheelColor => set({ wheelColor })} />
    </Field>
    {c.wheel === 'stock' && <div className="note">Серийные диски модели не перекрашиваются. Выберите дизайн из каталога, чтобы изменить цвет.</div>}
  </>)
  if (sec === 'stance') return (<>
    <Field label="Пресет"><Seg label="Пресет подвески" value={(SUSPENSION.find(s => Math.abs(s.v - c.rideHeight) < 0.01)?.id ?? '') as string} onPick={id => { set({ rideHeight: SUSPENSION.find(s => s.id === id)!.v }); setView('side') }} items={SUSPENSION.map(s => ({ id: s.id, name: s.name }))} /></Field>
    <Field label="Высота кузова" value={`${Math.round(95 + c.rideHeight * 90)} мм`}><Slider label="Высота кузова" value={c.rideHeight} onChange={rideHeight => set({ rideHeight })} /></Field>
    <div className="note">Меняется положение кузова относительно колёс. Значения клиренса ориентировочные.</div>
  </>)
  if (sec === 'light') return (
    <div>
      <Toggle label="Фары" on={c.headlights} onChange={headlights => set({ headlights })} /><hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 0 }} />
      <Toggle label="Задние фонари" on={c.taillights} onChange={taillights => set({ taillights })} />
    </div>
  )
  if (sec === 'aero') return (<>
    <Field label="Спойлер"><Seg label="Спойлер" value={c.spoiler} onPick={spoiler => { set({ spoiler }); setView('rear') }} items={[{ id: 'none', name: 'Нет' }, { id: 'lip', name: 'Lip' }, { id: 'wing', name: 'GT Wing' }]} /></Field>
    <div>
      <Toggle label="Передний сплиттер" on={c.splitter} onChange={splitter => { set({ splitter }); if (splitter) setView('front') }} /><hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 0 }} />
      <Toggle label="Боковые пороги" on={c.skirts} onChange={skirts => { set({ skirts }); if (skirts) setView('side') }} />
    </div>
    <div className="note">Бамперы и сложный обвес не предлагаются: в этой модели нет вариантов этих деталей.</div>
  </>)
  return (<>
    <Field label="Сцена"><Seg label="Сцена" value={c.env} onPick={env => set({ env })} items={[{ id: 'studio', name: 'Студия' }, { id: 'day', name: 'День' }, { id: 'night', name: 'Ночь' }]} /></Field>
    <Toggle label="Медленное вращение камеры" on={idle} onChange={setIdle} />
  </>)
}

function Summary() {
  const c = useGarage(s => s.config)
  const rows: [string, string][] = [
    ['Цвет', BODY_COLORS.find(x => x.hex.toLowerCase() === c.color.toLowerCase())?.name ?? c.color.toUpperCase()],
    ['Диски', c.wheel === 'stock' ? 'Серийные' : WHEELS.find(w => w.id === c.wheel)?.name ?? ''],
    ['Посадка', SUSPENSION.find(s => Math.abs(s.v - c.rideHeight) < 0.01)?.name ?? `${Math.round(95 + c.rideHeight * 90)} мм`],
    ['Крыша', c.accent ? BODY_COLORS.find(x => x.hex === c.accent)?.name ?? c.accent.toUpperCase() : 'Заводская'],
    ['Суппорты', c.caliper ? CALIPER_COLORS.find(x => x.hex === c.caliper)?.name ?? c.caliper.toUpperCase() : 'Заводские'],
    ['Салон', c.interior ? INTERIOR_COLORS.find(x => x.hex === c.interior)?.name ?? c.interior.toUpperCase() : 'Заводской'],
    ['Полосы', (c.livery ?? 'none') === 'none' ? 'Нет' : `${LIVERIES.find(l => l.id === c.livery)?.name}, ${LIVERY_COLORS.find(x => x.hex === c.liveryColor)?.name ?? c.liveryColor}`],
    ['Тонировка', (c.tint ?? 0) > 0.01 ? `${Math.round((1 - (c.tint ?? 0)) * 100)}%` : 'Нет'],
    ['Обвес', [c.spoiler !== 'none' && 'спойлер', c.splitter && 'сплиттер', c.skirts && 'пороги'].filter(Boolean).join(', ') || 'Нет']
  ]
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{rows.map(([a, b]) => <div className="sumline" key={a}><span>{a}</span><span>{b}</span></div>)}</div>
}

const H = { peek: 66, half: () => Math.min(Math.round(innerHeight * 0.44), 460), full: () => Math.round(innerHeight * 0.74) }

export default function Configurator() {
  const [sec, setSec] = useState<Sec>('look')
  const [saving, setSaving] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const mobile = useMobile()
  const go = useGarage(s => s.go), setView = useGarage(s => s.setView), setPhotoMode = useGarage(s => s.setPhotoMode), say = useGarage(s => s.say)
  const opened = useGarage(s => s.opened), capture = useGarage(s => s.capture)
  const view = useGarage(s => s.view.id)
  const timeline = useGarage(s => s.timeline), cursor = useGarage(s => s.cursor)
  const undo = useGarage(s => s.undo), redo = useGarage(s => s.redo), jump = useGarage(s => s.jump)
  const savedAt = useGarage(s => s.savedAt)
  const compare = useGarage(s => s.compare), setCompare = useGarage(s => s.setCompare)
  const setInsets = useGarage(s => s.setInsets), resetConfig = useGarage(s => s.resetConfig)

  // mobile bottom sheet: 3 snap points, drag the grip
  const [snap, setSnap] = useState<'peek' | 'half' | 'full'>('half')
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef({ y: 0, h: 0, t: 0 })
  const sheetH = drag ?? (snap === 'peek' ? H.peek : snap === 'half' ? H.half() : H.full())
  const gripDown = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); start.current = { y: e.clientY, h: sheetH, t: performance.now() }; setDrag(sheetH) }
  const gripMove = (e: React.PointerEvent) => { if (drag === null) return; setDrag(Math.max(H.peek, Math.min(H.full(), start.current.h - (e.clientY - start.current.y)))) }
  const gripUp = (e: React.PointerEvent) => {
    if (drag === null) return
    const moved = Math.abs(e.clientY - start.current.y), v = (start.current.y - e.clientY) / Math.max(1, performance.now() - start.current.t)
    const pts = { peek: H.peek, half: H.half(), full: H.full() }, target = drag + v * 180
    const next = moved < 6 ? (snap === 'peek' ? 'half' : 'peek') : (Object.entries(pts).sort((a, b) => Math.abs(a[1] - target) - Math.abs(b[1] - target))[0][0] as typeof snap)
    setDrag(null); setSnap(next)
  }
  useEffect(() => {
    // keep the car centred in the free area: desktop panels or mobile sheet
    setInsets(mobile ? { l: 0, r: 0, t: 56, b: sheetH + 58 + 8 } : { l: 256, r: 364, t: 56, b: 76 })
  }, [mobile, sheetH, setInsets])
  useEffect(() => () => setInsets({ l: 0, r: 0, t: 0, b: 0 }), [setInsets])

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (useGarage.getState().reduced) return
      gsap.from('.left, .right', { opacity: 0, y: 12, duration: 0.5, ease: 'power2.out', stagger: 0.05, clearProps: 'opacity,transform' })
      gsap.from('.dock', { opacity: 0, duration: 0.6, delay: 0.2, clearProps: 'opacity' })
    }, root)
    return () => ctx.revert()
  }, [])
  useEffect(() => { gsap.fromTo('.rbody > *', { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.03, ease: 'power2.out', overwrite: true, clearProps: 'opacity,transform' }) }, [sec])

  const save = async (name: string) => {
    setSaving(false)
    const png = await capture?.({ width: 900, type: 'image/jpeg', q: 0.85 })
    const cfg = useGarage.getState().config
    const p: Project = { id: opened?.kind === '3d' ? opened.id : uid(), name, kind: '3d', createdAt: opened?.createdAt ?? Date.now(), updatedAt: Date.now(), preview: png ? await thumb(png) : null, config: { ...cfg } }
    try { await saveProject(p); useGarage.getState().openProject(p); say('Сохранено в «Мои проекты»') } catch (e) { say('Не удалось сохранить: ' + (e as Error).message) }
  }
  const share = async () => {
    const r = await shareBuild(useGarage.getState().config)
    if (r === 'copied') say('Ссылка на сборку скопирована')
    else if (r === 'failed') say('Не удалось поделиться ссылкой')
  }
  const shot = async () => { const b = await capture?.({ width: 2400, type: 'image/png' }); if (b) downloadBlob(b, 'garage-render.png'); else say('Рендер недоступен') }
  const title = SECTIONS.find(s => s.id === sec)!.name
  const cmpHold = { onPointerDown: () => setCompare(true), onPointerUp: () => setCompare(false), onPointerLeave: () => setCompare(false), onPointerCancel: () => setCompare(false), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter') setCompare(true) }, onKeyUp: () => setCompare(false) }

  return (
    <div className="layer" ref={root} style={{ ['--il' as string]: mobile ? '0px' : '244px', ['--ir' as string]: mobile ? '0px' : '352px' }}>
      <Topbar active="garage" undo={undo} redo={redo} canUndo={cursor > 0} canRedo={cursor < timeline.length - 1}
        history={{ items: timeline.map(t => t.label), cursor, onJump: jump }}
        status={savedAt ? <span className="chip hide-m" role="status"><i />Сохранено автоматически</span> : null}>
        <IconBtn n="share" label="Поделиться ссылкой на сборку" onClick={share} />
        <IconBtn n="camera" label="Фото-режим" onClick={() => setPhotoMode(true)} />
        <IconBtn n="save" label="Сохранить конфигурацию" className="show-m" onClick={() => setSaving(true)} />
      </Topbar>

      {!mobile && (
        <aside className="left panel" aria-label="Автомобиль и разделы">
          <div className="car-card"><span className="label">Автомобиль</span><b>Car Concept</b><span className="muted" style={{ fontSize: 12 }}>Khronos sample · CC BY 4.0</span></div>
          <button className="btn wide" onClick={() => go('scan')}><Ic n="plus" />Добавить свою машину</button>
          <nav aria-label="Разделы кастомизации" style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {SECTIONS.map(s => <button key={s.id} className="sec" aria-current={sec === s.id} onClick={() => { setSec(s.id); if (s.id === 'wheels') setView('wheel') }}><Ic n={s.icon} />{s.name}</button>)}
          </nav>
          <div className="spacer" />
          <button className="btn ghost wide" onClick={() => setPhotoMode(true)}><Ic n="camera" />Фото-режим</button>
        </aside>
      )}

      {!mobile && (
        <aside className="right panel" aria-label={title}>
          <div className="rhead"><h2>{title}</h2></div>
          <div className="rbody" id="main" tabIndex={-1}><Controls sec={sec} /></div>
          <div className="rfoot">
            <Summary />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn ghost" onClick={resetConfig}><Ic n="reset" />Сбросить</button>
              <button className="btn primary" style={{ flex: 1, minWidth: 0 }} onClick={() => setSaving(true)}><Ic n="save" />Сохранить</button>
            </div>
          </div>
        </aside>
      )}

      {compare && <div className="compare-chip" role="status"><span>Серийная конфигурация</span></div>}
      <div className="dock" role="toolbar" aria-label="Ракурсы камеры">
        <div className="floating">
          {VIEWS.map(v => <button key={v.id} className={'btn ghost sm'} aria-pressed={view === v.id} style={view === v.id ? { color: 'var(--text)', background: 'var(--surface-2)' } : undefined} onClick={() => setView(v.id)}>{v.name}</button>)}
          <button className="btn ghost sm hide-m" onClick={() => setView('reset')}>Сброс</button>
          <span style={{ width: 1, height: 20, background: 'var(--line)', margin: '0 4px' }} />
          <IconBtn n="compare" label="Сравнить с серийной (удерживайте)" pressed={compare} {...cmpHold} />
          <IconBtn n="download" label="Скачать рендер PNG" className="hide-m" onClick={shot} />
        </div>
      </div>

      {mobile && (<>
        <section className={'sheet' + (drag === null ? ' snap' : '')} style={{ height: sheetH }} aria-label={title}>
          <div className="grip" role="button" tabIndex={0} aria-label="Потяните, чтобы изменить высоту панели" aria-expanded={snap !== 'peek'}
            onPointerDown={gripDown} onPointerMove={gripMove} onPointerUp={gripUp} onPointerCancel={gripUp}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSnap(snap === 'peek' ? 'half' : 'peek') }} />
          <div className="rhead"><h2>{title}</h2><button className="btn sm" onClick={() => setSaving(true)}>Сохранить</button></div>
          <div className="rbody" id="main" tabIndex={-1}><Controls sec={sec} /><Summary /></div>
        </section>
        <nav className="tabs" aria-label="Разделы кастомизации">
          {SECTIONS.map(s => <button key={s.id} className="tab" aria-current={sec === s.id} onClick={() => { setSec(s.id); if (snap === 'peek') setSnap('half'); if (s.id === 'wheels') setView('wheel') }}><Ic n={s.icon} />{s.short}</button>)}
        </nav>
      </>)}

      {saving && <NameDialog title="Сохранить конфигурацию" initial={opened?.kind === '3d' ? opened.name : 'Car Concept'} cta="Сохранить" onCancel={() => setSaving(false)} onOk={save} />}
    </div>
  )
}
