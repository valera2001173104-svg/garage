import { useEffect, useState } from 'react'
import { useGarage } from '../store'
import { deleteProject, duplicateProject, listProjects, type Project } from '../lib/db'
import { configRows } from '../lib/summary'
import { Ic, IconBtn } from './kit'
import { Topbar } from './Shell'

function Compare({ a, b, urls, onClose, onOpen }: { a: Project; b: Project; urls: Record<string, string>; onClose: () => void; onOpen: (p: Project) => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onClose])
  const ra = configRows(a.config!), rb = configRows(b.config!)
  const rows = ra.map(([k, v], i) => ({ k, a: v, b: rb[i][1], diff: v !== rb[i][1] }))
  const n = rows.filter(r => r.diff).length
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Сравнение проектов" style={{ width: 'min(760px, 100%)', maxHeight: '100%', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 className="h" style={{ fontSize: 18, flex: 1 }}>Сравнение · {n ? `различий: ${n}` : 'сборки одинаковые'}</h3>
          <IconBtn n="close" label="Закрыть" onClick={onClose} />
        </div>
        <div className="thumbs">
          {[a, b].map((p, i) => (
            <figure key={p.id}>
              {urls[p.id] ? <img src={urls[p.id]} alt={`Превью: ${p.name}`} style={{ aspectRatio: '16/10', objectFit: 'cover' }} /> : <div style={{ aspectRatio: '16/10', background: 'var(--surface-2)', borderRadius: 8 }} />}
              <figcaption><b style={{ color: 'var(--text)' }}>№{i + 1} · {p.name}</b></figcaption>
            </figure>
          ))}
        </div>
        <div className="cmp" role="table" aria-label="Различия сборок">
          {rows.map(r => (
            <div key={r.k} role="row" className={'cmp-row' + (r.diff ? ' diff' : '')}>
              <span role="rowheader">{r.k}</span><span role="cell">{r.a}</span><span role="cell">{r.b}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => onOpen(a)}>Открыть №1</button>
          <button className="btn" onClick={() => onOpen(b)}>Открыть №2</button>
        </div>
      </div>
    </div>
  )
}

export default function MyGarage() {
  const go = useGarage(s => s.go), setConfig = useGarage(s => s.setConfig), openProject = useGarage(s => s.openProject), say = useGarage(s => s.say)
  const [items, setItems] = useState<Project[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)

  const refresh = () => listProjects().then(setItems).catch(e => { setErr(e.message); setItems([]) })
  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (!items) return
    const m: Record<string, string> = {}
    items.forEach(p => { if (p.preview) m[p.id] = URL.createObjectURL(p.preview) })
    setUrls(m)
    return () => Object.values(m).forEach(URL.revokeObjectURL)
  }, [items])

  const open = (p: Project) => { openProject(p); if (p.kind === '3d' && p.config) { setConfig(p.config); go('garage') } else go('scan') }
  const del = async (p: Project) => { if (!confirm(`Удалить «${p.name}»? Это действие необратимо.`)) return; await deleteProject(p.id); say('Проект удалён'); refresh() }
  const dup = async (p: Project) => { await duplicateProject(p.id); say('Копия создана'); refresh() }

  // compare: pick two 3D builds, see them side by side with only the differences highlighted
  const [pick, setPick] = useState<string[] | null>(null)
  const [showCmp, setShowCmp] = useState(false)
  const builds = (items ?? []).filter(p => p.kind === '3d' && p.config)
  const chosen = (pick ?? []).map(id => items?.find(p => p.id === id)).filter((p): p is Project => !!p)
  const toggle = (p: Project) => setPick(s => (s ?? []).includes(p.id) ? (s ?? []).filter(x => x !== p.id) : [...(s ?? []), p.id].slice(-2))
  const stopCmp = () => { setPick(null); setShowCmp(false) }
  useEffect(() => { if (pick?.length === 2) setShowCmp(true) }, [pick])

  return (<>
    <Topbar active="mygarage" />
    <main className="screen" id="main">
      <div className="page">
        <h1>Мои проекты</h1>
        <p className="muted" style={{ margin: 0 }}>Хранятся только на этом устройстве.</p>
        {builds.length >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            {pick === null
              ? <button className="btn" onClick={() => setPick([])}><Ic n="compare" />Сравнить два проекта</button>
              : <><span className="muted" role="status">{chosen.length === 0 ? 'Выберите два 3D-проекта' : chosen.length === 1 ? 'Выберите ещё один' : 'Готово'}</span><button className="btn ghost" onClick={stopCmp}>Отмена</button></>}
          </div>
        )}
        {err && <div className="note err" style={{ marginTop: 16 }}>Хранилище недоступно: {err}</div>}
        {items === null ? <div className="muted" style={{ marginTop: 24 }}><span className="spin" /> Загрузка…</div> : items.length === 0 ? (
          <div className="empty">
            <b style={{ fontSize: 18 }}>Пока ничего нет</b>
            <div className="muted" style={{ maxWidth: 380 }}>Соберите автомобиль в 3D-конфигураторе или загрузите фото в GARAGE SCAN, затем нажмите «Сохранить».</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}><button className="btn primary" onClick={() => go('garage')}>3D-конфигуратор</button><button className="btn" onClick={() => go('scan')}>GARAGE SCAN</button></div>
          </div>
        ) : (
          <div className="grid">
            {items.map(p => (
              <article className="card" key={p.id}>
                <button className="thumb" style={{ backgroundImage: urls[p.id] ? `url(${urls[p.id]})` : undefined, outline: pick?.includes(p.id) ? '2px solid var(--accent, #4fe0c0)' : undefined, outlineOffset: -2, opacity: pick !== null && !(p.kind === '3d' && p.config) ? 0.35 : 1 }}
                  disabled={pick !== null && !(p.kind === '3d' && p.config)} aria-pressed={pick !== null ? pick.includes(p.id) : undefined}
                  onClick={() => (pick !== null ? toggle(p) : open(p))} aria-label={pick !== null ? `Выбрать ${p.name} для сравнения` : `Открыть ${p.name}`}>
                  <span className="badge">{pick?.includes(p.id) ? `№${pick.indexOf(p.id) + 1}` : p.kind === '3d' ? '3D' : 'Фото'}</span>
                </button>
                <div className="body">
                  <div><b>{p.name}</b><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{new Date(p.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
                  <div className="row">
                    <button className="btn primary" style={{ flex: 1 }} onClick={() => open(p)}>Открыть</button>
                    <IconBtn n="copy" label="Создать копию" onClick={() => dup(p)} />
                    <IconBtn n="trash" label="Удалить" onClick={() => del(p)} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
    {showCmp && chosen.length === 2 && <Compare a={chosen[0]} b={chosen[1]} urls={urls} onClose={() => setShowCmp(false)} onOpen={p => { stopCmp(); open(p) }} />}
  </>)
}
