import { url } from '../lib/base'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { useGarage } from '../store'
import { BODY_COLORS, WHEEL_COLORS } from '../lib/catalog'
import { canvasToBlob, getProject, saveProject, uid, type PhotoParams, type Project, type WheelMark } from '../lib/db'
import { ColorPicker, Field, Ic, IconBtn, Seg, Slider, Swatches, Toggle, type IconName } from '../ui/kit'
import { Topbar } from '../ui/Shell'
import { NameDialog, downloadBlob, thumb } from '../ui/Dialogs'
import { carConfidence, keepLargest, loadSegmenter } from './segment'
import { DEFAULT_PARAMS, RIMS, boxBlur, decode, drawWheels, excludeDark, fillSmallHoles, fitWheel, hexToHsl, photoLuma, recolor, rimThumb, stroke, validateFile, wand } from './engine'

type Tool = 'wand' | 'brush' | 'erase' | 'wheels'
type Tab = 'select' | 'color' | 'wheels' | 'ai'
type Snap = { mask: Uint8ClampedArray; params: PhotoParams; base: HTMLCanvasElement }
type AiStatus = { configured: boolean; provider: string | null; note?: string; presets?: { id: string; name: string; prompt: string }[] } | 'loading' | 'offline'

const MAXSIDE = matchMedia('(pointer: coarse)').matches ? 1600 : 2400
const AUTOSAVE_ID = 'autosave-photo'
const clone = (p: PhotoParams): PhotoParams => ({ ...p, wheels: p.wheels.map(w => ({ ...w })) })
const blank = (): PhotoParams => ({ ...DEFAULT_PARAMS, tint: null, wheels: [] })

export default function Scan() {
  const go = useGarage(s => s.go)
  const say = useGarage(s => s.say)
  const opened = useGarage(s => s.opened)
  const openProject = useGarage(s => s.openProject)

  const [stage, setStage] = useState<'upload' | 'edit'>('upload')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)
  const [tab, setTab] = useState<Tab>('select')
  const [tool, setTool] = useState<Tool>('wand')
  const [tol, setTol] = useState(42)
  const [brush, setBrush] = useState(0.035)
  const [sub, setSub] = useState(false)
  const [showMask, setShowMask] = useState(true)
  const [params, setParams] = useState<PhotoParams>(blank)
  const [cmp, setCmp] = useState<'after' | 'before' | 'slider'>('after')
  const [pos, setPos] = useState(0.5)
  const [sel, setSel] = useState(-1)
  const [rim, setRim] = useState('spoke5')
  const [rimColor, setRimColor] = useState('#c4c9cc')
  const [saving, setSaving] = useState(false)
  const [ai, setAi] = useState<AiStatus>('loading')
  const [prompt, setPrompt] = useState('')
  const [recent, setRecent] = useState<Project | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [, bump] = useState(0)
  const [loadId, setLoadId] = useState(0)
  const recents = useGarage(s => s.recents)

  const dims = useRef({ w: 0, h: 0 })
  const origC = useRef<HTMLCanvasElement | null>(null)
  const baseC = useRef<HTMLCanvasElement | null>(null)
  const baseData = useRef<ImageData | null>(null)
  const outData = useRef<ImageData | null>(null)
  const maskImg = useRef<ImageData | null>(null)
  const mask = useRef<Uint8ClampedArray>(new Uint8ClampedArray(0))
  const srcBlob = useRef<Blob | null>(null)
  const resC = useRef<HTMLCanvasElement>(null)
  const cmpC = useRef<HTMLCanvasElement>(null)
  const ovC = useRef<HTMLCanvasElement>(null)
  const thO = useRef<HTMLCanvasElement>(null)
  const thR = useRef<HTMLCanvasElement>(null)
  const hist = useRef<Snap[]>([])
  const cur = useRef(-1)
  const raf = useRef(0)
  const lastThumb = useRef(0)
  const autosave = useRef(0)
  const pending = useRef(false)
  const dirtyMask = useRef(true)
  const luma = useRef(0.5)
  const P = useRef(params); P.current = params
  const drag = useRef<null | { kind: 'paint' | 'move' | 'rx' | 'ry' | 'rot' | 'cmp'; lx: number; ly: number; add?: boolean }>(null)
  const abort = useRef<AbortController | null>(null)
  const inputG = useRef<HTMLInputElement>(null)
  const inputC = useRef<HTMLInputElement>(null)
  const showMaskRef = useRef(showMask); showMaskRef.current = showMask
  const toolRef = useRef(tool); toolRef.current = tool
  const tabRef = useRef(tab); tabRef.current = tab
  const selRef = useRef(sel); selRef.current = sel

  /* ───── rendering ───── */
  const paint = useCallback(() => {
    const r = resC.current, ov = ovC.current, bd = baseData.current
    if (!r || !ov || !bd) return
    const { w, h } = dims.current
    if (!outData.current) outData.current = new ImageData(w, h)
    const ctx = r.getContext('2d')!
    recolor(bd, mask.current, P.current, outData.current)
    ctx.putImageData(outData.current, 0, 0)
    drawWheels(ctx, P.current.wheels, luma.current)

    const o = ov.getContext('2d')!
    o.clearRect(0, 0, w, h)
    if (showMaskRef.current && tabRef.current === 'select') {
      if (dirtyMask.current || !maskImg.current) {
        const im = maskImg.current ?? new ImageData(w, h), d = im.data, m = mask.current
        for (let i = 0; i < m.length; i++) { const j = i * 4; d[j] = 255; d[j + 1] = 96; d[j + 2] = 64; d[j + 3] = m[i] * 0.45 } // warm tint: reads on any paint colour
        maskImg.current = im; dirtyMask.current = false
      }
      o.putImageData(maskImg.current, 0, 0)
    }
    if (toolRef.current === 'wheels') {
      const u = Math.max(1, w / 700)
      P.current.wheels.forEach((m, i) => {
        o.save(); o.translate(m.x, m.y); o.rotate(m.rot)
        o.lineWidth = 2 * u; o.strokeStyle = i === selRef.current ? '#ffffff' : 'rgba(255,255,255,.65)'
        o.setLineDash(i === selRef.current ? [] : [6 * u, 4 * u])
        o.beginPath(); o.ellipse(0, 0, m.rx, m.ry, 0, 0, 7); o.stroke()
        if (i === selRef.current) {
          o.fillStyle = '#ffffff'
          for (const [hx, hy] of [[m.rx, 0], [0, m.ry], [0, -m.ry - 34 * u]]) { o.beginPath(); o.arc(hx, hy, 7 * u, 0, 7); o.fill() }
          o.beginPath(); o.moveTo(0, -m.ry); o.lineTo(0, -m.ry - 34 * u); o.stroke()
        }
        o.restore()
      })
    }
    const now = performance.now()
    if (now - lastThumb.current > 200 && thO.current && thR.current && origC.current) {
      lastThumb.current = now
      for (const [c, src] of [[thO.current, origC.current], [thR.current, r]] as const) { c.width = 300; c.height = Math.round((300 * h) / w); c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height) }
    }
  }, [])
  const request = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; paint() }) }, [paint])
  useEffect(() => { request() }, [params, tool, tab, showMask, sel, request, stage])
  useEffect(() => () => { cancelAnimationFrame(raf.current); clearTimeout(autosave.current); abort.current?.abort() }, [])

  /* ───── history (undo + redo) ───── */
  const buildProject = useCallback(async (id: string, name: string, created = Date.now()): Promise<Project> => {
    const { w, h } = dims.current
    const mc = document.createElement('canvas'); mc.width = w; mc.height = h
    const g = mc.getContext('2d')!, im = g.createImageData(w, h)
    for (let i = 0; i < mask.current.length; i++) { const v = mask.current[i], j = i * 4; im.data[j] = im.data[j + 1] = im.data[j + 2] = v; im.data[j + 3] = 255 }
    g.putImageData(im, 0, 0)
    const rc = document.createElement('canvas'); rc.width = w; rc.height = h
    const rg = rc.getContext('2d')!; rg.putImageData(outData.current ?? new ImageData(w, h), 0, 0); drawWheels(rg, P.current.wheels, luma.current)
    return {
      id, name, kind: 'photo', createdAt: created, updatedAt: Date.now(), preview: await thumb(await canvasToBlob(rc)),
      photo: { original: srcBlob.current!, mask: await canvasToBlob(mc), params: clone(P.current), size: { w, h }, base: baseC.current !== origC.current ? await canvasToBlob(baseC.current!) : undefined }
    }
  }, [])
  const scheduleAutosave = useCallback(() => {
    clearTimeout(autosave.current)
    autosave.current = window.setTimeout(async () => {
      if (!srcBlob.current || cur.current < 1) return
      try { paint(); await saveProject(await buildProject(AUTOSAVE_ID, 'Автосохранение (фото)')); setSavedAt(Date.now()) } catch { /* storage full / private mode: not critical */ }
    }, 2500)
  }, [buildProject, paint])
  const commit = useCallback(() => {
    hist.current = hist.current.slice(0, cur.current + 1)
    hist.current.push({ mask: mask.current.slice(), params: clone(P.current), base: baseC.current! })
    if (hist.current.length > 20) hist.current.shift()
    cur.current = hist.current.length - 1
    bump(n => n + 1); scheduleAutosave()
  }, [scheduleAutosave])
  const restore = (s: Snap) => {
    mask.current = s.mask.slice(); dirtyMask.current = true
    if (baseC.current !== s.base) { baseC.current = s.base; baseData.current = s.base.getContext('2d')!.getImageData(0, 0, dims.current.w, dims.current.h) }
    P.current = clone(s.params); setParams(P.current); setSel(-1); request(); bump(n => n + 1); scheduleAutosave()
  }
  const undo = () => { if (cur.current > 0) { cur.current--; restore(hist.current[cur.current]) } }
  const redo = () => { if (cur.current < hist.current.length - 1) { cur.current++; restore(hist.current[cur.current]) } }
  const canUndo = cur.current > 0, canRedo = cur.current < hist.current.length - 1
  const edits = cur.current > 0
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      e.preventDefault(); e.shiftKey ? redo() : undo()
    }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })

  const setP = (n: PhotoParams) => { P.current = n; setParams(n); request() }
  const setWheels = (fn: (w: WheelMark[]) => WheelMark[]) => setP({ ...P.current, wheels: fn(P.current.wheels) })
  const resetAll = () => {
    if (!origC.current) return
    baseC.current = origC.current; baseData.current = origC.current.getContext('2d')!.getImageData(0, 0, dims.current.w, dims.current.h)
    mask.current = new Uint8ClampedArray(dims.current.w * dims.current.h); dirtyMask.current = true
    setP(blank()); setSel(-1); commit(); say('Возврат к оригиналу (можно отменить)')
  }

  /* ───── loading ───── */
  const setup = useCallback((c: HTMLCanvasElement, blob: Blob, m?: Uint8ClampedArray, p?: PhotoParams, base?: HTMLCanvasElement) => {
    const w = c.width, h = c.height
    dims.current = { w, h }; origC.current = c; srcBlob.current = blob
    baseC.current = base ?? c
    baseData.current = baseC.current.getContext('2d')!.getImageData(0, 0, w, h); luma.current = photoLuma(baseData.current)
    outData.current = null; maskImg.current = null
    mask.current = m ?? new Uint8ClampedArray(w * h); dirtyMask.current = true
    const np = p ? clone({ ...DEFAULT_PARAMS, ...p }) : blank()
    P.current = np; setParams(np); setSel(-1); hist.current = []; cur.current = -1
    setStage('edit'); setCmp('after'); setTab('select'); setTool('wand')
    pending.current = true; setLoadId(n => n + 1)
  }, [])
  useLayoutEffect(() => {
    if (!pending.current || stage !== 'edit') return
    pending.current = false
    const { w, h } = dims.current
    for (const cv of [resC.current, cmpC.current, ovC.current]) if (cv) { cv.width = w; cv.height = h }
    cmpC.current?.getContext('2d')!.drawImage(origC.current!, 0, 0)
    commit(); paint()
  }, [loadId, stage, commit, paint])

  const loadFile = async (f: File | undefined | null) => {
    if (!f) return
    setError(null); setBusy('Проверка файла…')
    try {
      const bad = await validateFile(f)
      if (bad) throw new Error(bad)
      setBusy('Чтение изображения…')
      setup(await decode(f, MAXSIDE), f)
    } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }
  const loadProject = useCallback(async (p: Project) => {
    if (!p.photo) return
    setBusy('Открываю проект…'); setError(null)
    try {
      const c = await decode(p.photo.original, MAXSIDE), w = c.width, h = c.height
      const mc = await decode(p.photo.mask, 99999)
      const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h
      const tg = tmp.getContext('2d')!; tg.drawImage(mc, 0, 0, w, h)
      const id = tg.getImageData(0, 0, w, h).data, m = new Uint8ClampedArray(w * h)
      for (let i = 0; i < m.length; i++) m[i] = id[i * 4]
      const k = w / p.photo.size.w
      const params = clone({ ...DEFAULT_PARAMS, ...p.photo.params }); params.wheels = params.wheels.map(q => ({ ...q, x: q.x * k, y: q.y * k, rx: q.rx * k, ry: q.ry * k }))
      let bc: HTMLCanvasElement | undefined
      if (p.photo.base) { const b = await decode(p.photo.base, 99999); bc = document.createElement('canvas'); bc.width = w; bc.height = h; bc.getContext('2d')!.drawImage(b, 0, 0, w, h) }
      setup(c, p.photo.original, m, params, bc)
    } catch (e) { setError('Не удалось открыть проект: ' + (e as Error).message) } finally { setBusy(null) }
  }, [setup])
  useEffect(() => {
    const p = opened
    if (p?.kind === 'photo' && p.photo) loadProject(p)
    else getProject(AUTOSAVE_ID).then(r => r?.photo && setRecent(r)).catch(() => undefined)
    return () => { openProject(null) }
  }, [])
  useEffect(() => {
    if (tab !== 'ai' || ai !== 'loading') return
    fetch(url('api/ai/status')).then(r => r.json()).then(setAi).catch(() => setAi('offline'))
  }, [tab, ai])

  /* ───── pointer ───── */
  const pt = (e: React.PointerEvent) => { const r = ovC.current!.getBoundingClientRect(), { w, h } = dims.current; return { x: ((e.clientX - r.left) / r.width) * w, y: ((e.clientY - r.top) / r.height) * h } }
  const toLocal = (m: WheelMark, x: number, y: number) => { const dx = x - m.x, dy = y - m.y, c = Math.cos(-m.rot), s = Math.sin(-m.rot); return { x: dx * c - dy * s, y: dx * s + dy * c } }
  const down = (e: React.PointerEvent) => {
    if (cmp !== 'after' || stage !== 'edit') return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ }
    const { x, y } = pt(e), { w, h } = dims.current
    if (tool === 'wand') {
      const sx = Math.max(0, Math.min(w - 1, Math.round(x))), sy = Math.max(0, Math.min(h - 1, Math.round(y)))
      setBusy('Выделение…')
      setTimeout(() => {
        const reg = wand(baseData.current!, sx, sy, tol)
        fillSmallHoles(reg, w, h, Math.round(w * h * 0.0006))
        const soft = boxBlur(reg, w, h, 2).map(v => Math.min(255, v * 1.9)), m = mask.current
        for (let i = 0; i < m.length; i++) m[i] = sub ? Math.min(m[i], 255 - soft[i]) : Math.max(m[i], soft[i])
        dirtyMask.current = true; commit(); request(); setBusy(null)
      }, 16)
    } else if (tool === 'brush' || tool === 'erase') {
      drag.current = { kind: 'paint', lx: x, ly: y, add: tool === 'brush' }
      stroke(mask.current, w, h, x, y, x, y, brush * w, tool === 'brush'); dirtyMask.current = true; request()
    } else if (tool === 'wheels') {
      const u = Math.max(1, w / 700), m = P.current.wheels[sel]
      if (m) {
        const l = toLocal(m, x, y), hs = 18 * u, near = (hx: number, hy: number) => Math.abs(l.x - hx) < hs && Math.abs(l.y - hy) < hs
        if (near(m.rx, 0)) { drag.current = { kind: 'rx', lx: x, ly: y }; return }
        if (near(0, m.ry)) { drag.current = { kind: 'ry', lx: x, ly: y }; return }
        if (near(0, -m.ry - 34 * u)) { drag.current = { kind: 'rot', lx: x, ly: y }; return }
      }
      const hit = P.current.wheels.findIndex(q => { const l = toLocal(q, x, y); return (l.x / q.rx) ** 2 + (l.y / q.ry) ** 2 <= 1 })
      if (hit >= 0) { setSel(hit); selRef.current = hit; drag.current = { kind: 'move', lx: x, ly: y } }
      else {
        const r = w * 0.085, n = P.current.wheels.length
        const fit = baseData.current ? fitWheel(baseData.current, x, y, w * 0.2) : null
        setWheels(ws => [...ws, { ...(fit ?? { x, y, rx: r, ry: r * 1.1, rot: 0 }), design: rim, color: rimColor }])
        setSel(n); selRef.current = n; commit()
        say(fit ? 'Диск подогнан по фото. Если рамка неточная, поправьте белыми точками' : 'Границу колеса найти не удалось: подгоните рамку вручную')
      }
    }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const { x, y } = pt(e), { w, h } = dims.current
    if (d.kind === 'paint') { stroke(mask.current, w, h, d.lx, d.ly, x, y, brush * w, !!d.add); d.lx = x; d.ly = y; dirtyMask.current = true; request(); return }
    const i = selRef.current, m = P.current.wheels[i]; if (!m) return
    if (d.kind === 'move') { const dx = x - d.lx, dy = y - d.ly; d.lx = x; d.ly = y; setWheels(ws => ws.map((q, k) => (k === i ? { ...q, x: q.x + dx, y: q.y + dy } : q))) }
    else if (d.kind === 'rx') { const l = toLocal(m, x, y); setWheels(ws => ws.map((q, k) => (k === i ? { ...q, rx: Math.max(8, Math.abs(l.x)) } : q))) }
    else if (d.kind === 'ry') { const l = toLocal(m, x, y); setWheels(ws => ws.map((q, k) => (k === i ? { ...q, ry: Math.max(8, Math.abs(l.y)) } : q))) }
    else if (d.kind === 'rot') setWheels(ws => ws.map((q, k) => (k === i ? { ...q, rot: Math.atan2(y - q.y, x - q.x) + Math.PI / 2 } : q)))
  }
  const up = () => { if (drag.current) { drag.current = null; commit() } }
  const cmpDown = (e: React.PointerEvent) => { drag.current = { kind: 'cmp', lx: 0, ly: 0 }; try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* synthetic */ } }
  const cmpMove = (e: React.PointerEvent) => { if (drag.current?.kind !== 'cmp') return; const r = ovC.current!.getBoundingClientRect(); setPos(Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width))) }

  /* ───── actions ───── */
  const upd = (patch: Partial<PhotoParams>) => setP({ ...P.current, ...patch })
  const pickColor = (hex: string) => {
    const [h] = hexToHsl(hex); setP({ ...P.current, tint: hex, hue: h, sat: 1, light: 0.5 }); commit()
    useGarage.setState(s => ({ recents: [hex, ...s.recents.filter(c => c !== hex)].slice(0, 6) }))
  }
  const invert = () => { const m = mask.current; for (let i = 0; i < m.length; i++) m[i] = 255 - m[i]; dirtyMask.current = true; commit(); request() }
  /** blur then re-sharpen the mask: removes jagged teeth and one-pixel specks on the border without moving it */
  const smoothEdges = () => {
    const { w, h } = dims.current, b = boxBlur(mask.current, w, h, 2), m = mask.current
    for (let i = 0; i < m.length; i++) m[i] = Math.max(0, Math.min(255, (b[i] - 128) * 2.2 + 128))
    dirtyMask.current = true; commit(); request(); say('Края выделения сглажены')
  }
  const clearMask = () => { mask.current.fill(0); dirtyMask.current = true; commit(); request() }
  const noDark = () => { excludeDark(baseData.current!, mask.current, 0.2); dirtyMask.current = true; commit(); request(); say('Стёкла, шины и тёмные зоны исключены') }
  const autoSelect = async () => {
    if (!baseC.current || busy) return
    setError(null); setBusy('Загрузка модели распознавания (один раз)…')
    try {
      await loadSegmenter()
      setBusy('Ищу автомобиль на фото…')
      await new Promise(r => setTimeout(r, 30))
      const { w, h } = dims.current
      const conf = await carConfidence(baseC.current)
      const bin = new Uint8Array(w * h)
      for (let i = 0; i < bin.length; i++) bin[i] = conf[i] > 0.5 ? 1 : 0
      if (keepLargest(bin, w, h) < w * h * 0.02) throw new Error('Автомобиль на фото не найден. Выделите кузов вручную инструментом «Кузов».')
      // hysteresis: near the confident blob, also accept weaker pixels (highlights on paint lower the model's confidence)
      const core = new Uint8ClampedArray(w * h)
      for (let i = 0; i < core.length; i++) core[i] = bin[i] ? 255 : 0
      const near = boxBlur(core, w, h, Math.max(4, Math.round(w * 0.012)))
      let m = new Uint8ClampedArray(w * h)
      for (let i = 0; i < m.length; i++) m[i] = near[i] > 0 && conf[i] > 0.22 ? Math.min(255, conf[i] * 2 * 255) : 0
      m = boxBlur(m, w, h, 1)
      excludeDark(baseData.current!, m, 0.16) // glass, tyres, grille
      fillSmallHoles(m, w, h, Math.round(w * h * 0.0004))
      mask.current = m; dirtyMask.current = true
      setShowMask(true); setTab('select'); setTool('brush'); commit(); request()
      say('Кузов выделен. Проверьте диски и фары — уберите их ластиком, если попали')
    } catch (e) { setError((e as Error).message || 'Не удалось загрузить модель распознавания') } finally { setBusy(null) }
  }
  const selWheel = params.wheels[sel]
  const patchWheel = (patch: Partial<WheelMark>) => setWheels(ws => ws.map((q, k) => (k === sel ? { ...q, ...patch } : q)))
  const hasMask = () => mask.current.some(v => v > 127)
  const pickTool = (t: Tool) => { setTool(t); setTab(t === 'wheels' ? 'wheels' : 'select') }

  const exportPng = async () => { paint(); try { downloadBlob(await canvasToBlob(resC.current!), `garage-scan-${Date.now()}.png`); say('PNG экспортирован') } catch (e) { say((e as Error).message) } }
  /** one image: original on the left, result on the right (stacked on portrait photos), with small labels */
  const exportCompare = async () => {
    paint()
    const { w, h } = dims.current, o = origC.current, r = resC.current
    if (!o || !r) return
    const stack = h > w * 1.1, c = document.createElement('canvas')
    c.width = stack ? w : w * 2; c.height = stack ? h * 2 : h
    const g = c.getContext('2d')!
    g.drawImage(o, 0, 0, w, h); g.drawImage(r, stack ? 0 : w, stack ? h : 0, w, h)
    const u = Math.max(1, w / 900); g.font = `700 ${14 * u}px Inter, Arial, sans-serif`; g.textBaseline = 'middle'
    for (const [t, x, y] of [['ДО', 12 * u, 12 * u], ['ПОСЛЕ', (stack ? 0 : w) + 12 * u, (stack ? h : 0) + 12 * u]] as const) {
      const tw = g.measureText(t).width + 16 * u
      g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.roundRect(x, y, tw, 26 * u, 13 * u); g.fill()
      g.fillStyle = '#fff'; g.fillText(t, x + 8 * u, y + 13 * u)
    }
    try { downloadBlob(await canvasToBlob(c), `garage-scan-before-after-${Date.now()}.png`); say('Сравнение «до/после» сохранено') } catch (e) { say((e as Error).message) }
  }
  const save = async (name: string) => {
    setSaving(false)
    try {
      paint()
      const old = useGarage.getState().opened
      const p = await buildProject(old?.kind === 'photo' ? old.id : uid(), name, old?.createdAt)
      await saveProject(p); openProject(p); say('Сохранено в «Мои проекты»')
    } catch (e) { say('Не удалось сохранить: ' + (e as Error).message) }
  }
  const runAi = async () => {
    const { w, h } = dims.current
    if (!prompt.trim()) return say('Опишите, что изменить')
    if (!hasMask()) return say('Сначала выделите область для AI-правки')
    abort.current?.abort(); const ac = (abort.current = new AbortController())
    setBusy('AI обрабатывает изображение…'); setError(null)
    try {
      const mc = document.createElement('canvas'); mc.width = w; mc.height = h
      const g = mc.getContext('2d')!, im = g.createImageData(w, h)
      for (let i = 0; i < mask.current.length; i++) { const v = mask.current[i] > 127 ? 255 : 0, j = i * 4; im.data[j] = im.data[j + 1] = im.data[j + 2] = v; im.data[j + 3] = 255 }
      g.putImageData(im, 0, 0)
      const fd = new FormData()
      fd.append('image', await canvasToBlob(baseC.current!), 'image.png'); fd.append('mask', await canvasToBlob(mc), 'mask.png'); fd.append('prompt', prompt)
      const r = await fetch(url('api/ai/edit'), { method: 'POST', body: fd, signal: ac.signal })
      if (!r.ok) { let m = `Ошибка AI-сервиса (${r.status})`; try { m = (await r.json()).error ?? m } catch { /* not json */ } throw new Error(m) }
      const out = await decode(await r.blob(), 99999)
      const nb = document.createElement('canvas'); nb.width = w; nb.height = h
      nb.getContext('2d')!.drawImage(out, 0, 0, w, h)
      baseC.current = nb; baseData.current = nb.getContext('2d')!.getImageData(0, 0, w, h)
      commit(); request(); say('AI-правка применена (можно отменить)')
    } catch (e) { if ((e as Error).name !== 'AbortError') setError((e as Error).message) } finally { setBusy(null) }
  }
  const guard = () => !edits || confirm('Выйти? Автосохранение оставит последнюю версию, её можно продолжить позже.')
  const status = savedAt ? <span className="chip hide-m" role="status"><i />Сохранено автоматически</span> : null

  /* ───── upload ───── */
  if (stage === 'upload') return (
    <><Topbar active="scan" />
    <div className="screen" id="main" tabIndex={-1} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); loadFile(e.dataTransfer.files[0]) }}>
      <div className="page" style={{ maxWidth: 720 }}>
        <h1>GARAGE SCAN</h1>
        <p className="muted" style={{ margin: '0 0 24px', maxWidth: 520 }}>Загрузите фото своей машины: перекрасьте кузов, примерьте диски и сравните с оригиналом. Всё обрабатывается на вашем устройстве.</p>
        <div className={'drop' + (over ? ' over' : '')}>
          <Ic n="upload" />
          <div><b style={{ fontSize: 16 }}>Перетащите фото сюда</b><div className="muted" style={{ marginTop: 4 }}>JPG, PNG или WebP до 25 МБ</div></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn primary lg" onClick={() => inputG.current?.click()} disabled={!!busy}><Ic n="folder" />Выбрать из галереи</button>
            <button className="btn lg" onClick={() => inputC.current?.click()} disabled={!!busy}><Ic n="camera" />Сделать фото</button>
          </div>
          <input ref={inputG} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={e => { loadFile(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={inputC} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e => { loadFile(e.target.files?.[0]); e.target.value = '' }} />
          {busy && <div className="muted"><span className="spin" /> {busy}</div>}
          {error && <div className="note err" role="alert" style={{ textAlign: 'left', width: '100%' }}>{error}</div>}
          <div className="steps">
            <div><b>1. Снимок сбоку или в ¾</b>Дневной свет, машина целиком, без сильных бликов.</div>
            <div><b>2. Выделите кузов</b>Нажмите на кузов: окна, колёса и фары остаются нетронутыми.</div>
            <div><b>3. Меняйте и сравнивайте</b>Цвет, покрытие и диски. Любой шаг можно отменить.</div>
          </div>
        </div>
        {recent && <button className="card" style={{ marginTop: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left' }} onClick={() => loadProject(recent)}>
          <Ic n="history" /><span style={{ flex: 1 }}><b>Продолжить прошлую сессию</b><br /><span className="muted" style={{ fontSize: 12 }}>Автосохранение · {new Date(recent.updatedAt).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</span></span><Ic n="chevron" />
        </button>}
      </div>
    </div></>
  )

  /* ───── editor ───── */
  const rail: { id: string; name: string; icon: IconName; on?: boolean; act: () => void; off?: boolean }[] = [
    { id: 'auto', name: 'Авто', icon: 'ai', act: autoSelect, off: !!busy },
    { id: 'wand', name: 'Кузов', icon: 'wand', on: tool === 'wand', act: () => pickTool('wand') },
    { id: 'brush', name: 'Кисть', icon: 'brush', on: tool === 'brush', act: () => pickTool('brush') },
    { id: 'erase', name: 'Ластик', icon: 'eraser', on: tool === 'erase', act: () => pickTool('erase') },
    { id: 'wheels', name: 'Колёса', icon: 'wheel', on: tool === 'wheels', act: () => pickTool('wheels') },
    { id: 'glass', name: 'Стёкла', icon: 'windows', act: noDark, off: !hasMask() },
    { id: 'cmp', name: 'Сравнить', icon: 'compare', on: cmp === 'slider', act: () => setCmp(cmp === 'slider' ? 'after' : 'slider') },
    { id: 'reset', name: 'Сбросить', icon: 'reset', act: resetAll, off: !edits }
  ]
  return (
    <>
      <Topbar active="scan" undo={undo} redo={redo} canUndo={canUndo} canRedo={canRedo} guard={guard} status={status}>
        <IconBtn n="compare" label="Скачать «до / после»" onClick={exportCompare} />
        <IconBtn n="download" label="Скачать PNG" onClick={exportPng} />
        <button className="btn primary" onClick={() => setSaving(true)}><Ic n="save" /><span className="hide-m">Сохранить фото</span></button>
      </Topbar>
      <div className="scan">
        <nav className="tools" aria-label="Инструменты">
          {rail.map((t, i) => (<span key={t.id} style={{ display: 'contents' }}>
            {i === 6 && <hr />}
            <button aria-pressed={t.on ?? false} disabled={t.off} onClick={t.act}><svg viewBox="0 0 24 24" aria-hidden><path d={ICON_D[t.icon]} /></svg>{t.name}</button>
          </span>))}
        </nav>

        <div className="scan-main">
          <div className="canvas-wrap" style={{ aspectRatio: `${dims.current.w} / ${dims.current.h}` }}>
            <canvas ref={resC} />
            <canvas ref={cmpC} className="overlay" style={{ display: cmp === 'after' ? 'none' : 'block', clipPath: cmp === 'slider' ? `inset(0 ${100 - pos * 100}% 0 0)` : undefined }} />
            <canvas ref={ovC} className="overlay" aria-label="Фото для редактирования" style={{ cursor: tool === 'wheels' ? 'cell' : 'crosshair', pointerEvents: cmp === 'after' ? 'auto' : 'none', touchAction: 'none' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            {cmp === 'slider' && <>
              <span className="pill" style={{ left: 12 }}>ДО</span><span className="pill" style={{ right: 12 }}>ПОСЛЕ</span>
              <div className="cmp-handle" role="slider" aria-label="Сравнение до и после" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos * 100)} tabIndex={0}
                style={{ left: `${pos * 100}%`, touchAction: 'none' }} onPointerDown={cmpDown} onPointerMove={cmpMove} onPointerUp={() => (drag.current = null)}
                onKeyDown={e => { if (e.key === 'ArrowLeft') setPos(p => Math.max(0.02, p - 0.03)); if (e.key === 'ArrowRight') setPos(p => Math.min(0.98, p + 0.03)) }} />
            </>}
            {cmp === 'before' && <span className="pill" style={{ left: 12 }}>ДО</span>}
            {busy && <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: 'var(--surface)' }}><div className="indet" /><div className="muted" style={{ padding: '8px 12px', lineHeight: 1.4 }}><span className="spin" /> {busy}</div></div>}
          </div>
          <div className="floating" style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)' }}>
            <Seg label="Режим просмотра" value={cmp} onPick={setCmp} items={[{ id: 'before', name: 'До' }, { id: 'slider', name: 'Слайдер' }, { id: 'after', name: 'После' }]} />
          </div>
        </div>

        <aside className="scan-side" aria-label="Настройки">
          <div style={{ padding: '14px 18px 4px' }}><Seg label="Раздел" value={tab} onPick={setTab} items={[{ id: 'select', name: 'Выделение' }, { id: 'color', name: 'Цвет' }, { id: 'wheels', name: 'Диски' }, { id: 'ai', name: 'AI' }]} /></div>
          <div className="rbody" style={{ paddingTop: 16, flex: 1 }}>
            {tab === 'select' && <>
              <button className="btn primary wide" onClick={autoSelect} disabled={!!busy}><Ic n="ai" />Выделить кузов автоматически</button>
              <div className="note">Распознавание работает на устройстве, фото никуда не отправляется. Стёкла и шины исключаются сами; диски и фары проверьте и при необходимости уберите ластиком. Можно и вручную: инструмент «Кузов» — нажмите на кузов.</div>
              {error && <div className="note err" role="alert">{error}</div>}
              {tool === 'wand' ? <>
                <Field label="Допуск по цвету" value={tol}><Slider label="Допуск по цвету" min={8} max={140} step={1} value={tol} onChange={setTol} /></Field>
                <Toggle label="Вычитать из выделения" on={sub} onChange={setSub} />
              </> : tool === 'wheels' ? null : <Field label="Размер кисти" value={`${Math.round(brush * 1000) / 10}%`}><Slider label="Размер кисти" min={0.008} max={0.12} step={0.002} value={brush} onChange={setBrush} /></Field>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn sm" onClick={invert}>Инвертировать</button>
                <button className="btn sm" onClick={smoothEdges} disabled={!hasMask()}>Сгладить края</button>
                <button className="btn sm" onClick={clearMask} disabled={!hasMask()}>Снять выделение</button>
              </div>
              <Toggle label="Показывать выделение" on={showMask} onChange={setShowMask} />
            </>}

            {tab === 'color' && <>
              <ColorPicker label="Цвет кузова" items={BODY_COLORS} value={params.tint ?? ''} recents={recents} onPick={pickColor} />
              <Field label="Покрытие"><Seg label="Покрытие" value={params.finish ?? 'metallic'} onPick={finish => { upd({ finish }); commit() }} items={[{ id: 'gloss', name: 'Глянец' }, { id: 'metallic', name: 'Металлик' }, { id: 'matte', name: 'Матовое' }]} /></Field>
              <Field label="Насыщенность" value={`${Math.round(params.sat * 100)}%`}><Slider label="Насыщенность" min={0} max={2} step={0.01} value={params.sat} onChange={sat => upd({ sat })} onCommit={commit} /></Field>
              <Field label="Яркость" value={`${params.light > 0.5 ? '+' : ''}${Math.round((params.light - 0.5) * 100)}`}><Slider label="Яркость" value={params.light} onChange={light => upd({ light })} onCommit={commit} /></Field>
              <Field label="Сила эффекта" value={`${Math.round(params.strength * 100)}%`}><Slider label="Сила эффекта" value={params.strength} onChange={strength => upd({ strength })} onCommit={commit} /></Field>
              <div>
                <Toggle label="Сохранять блики" on={params.keepHighlights ?? true} onChange={keepHighlights => { upd({ keepHighlights }); commit() }} />
                <Toggle label="Сохранять тени" on={params.keepShadows ?? true} onChange={keepShadows => { upd({ keepShadows }); commit() }} />
              </div>
              {!hasMask() && <div className="note warn">Сначала выделите кузов (вкладка «Выделение»). Цвет применяется только к выделенной области.</div>}
              {!params.tint && hasMask() && <div className="note">Выберите цвет, чтобы увидеть результат.</div>}
              <div className="thumbs">
                <figure><canvas ref={thO} aria-label="Исходное фото" /><figcaption>Исходное фото</figcaption></figure>
                <figure><canvas ref={thR} aria-label="Результат" /><figcaption>Результат</figcaption></figure>
              </div>
            </>}

            {tab === 'wheels' && <>
              <div className="note">Нажмите на центр колеса на фото: рамка подгонится по тёмной шине сама. Белые точки меняют ширину, высоту и наклон. Это 2D-наложение, а не генерация.</div>
              <Field label="Диск из каталога">
                <div className="tiles">{RIMS.map(r => (
                  <button key={r.id} className={'tile' + ((selWheel?.design ?? rim) === r.id ? ' on' : '')} onClick={() => { setRim(r.id); if (selWheel) { patchWheel({ design: r.id }); commit() } }}>
                    <img src={rimThumb(r.id, selWheel?.color ?? rimColor)} alt="" />{r.name}
                  </button>))}
                </div>
              </Field>
              <Field label="Цвет"><Swatches label="Цвет диска" items={WHEEL_COLORS} value={selWheel?.color ?? rimColor} onPick={c => { setRimColor(c); if (selWheel) { patchWheel({ color: c }); commit() } }} /></Field>
              {selWheel ? <>
                <Field label="Ширина" value={Math.round(selWheel.rx)}><Slider label="Ширина диска" min={10} max={dims.current.w * 0.25} step={1} value={selWheel.rx} onChange={rx => patchWheel({ rx })} onCommit={commit} /></Field>
                <Field label="Высота" value={Math.round(selWheel.ry)}><Slider label="Высота диска" min={10} max={dims.current.w * 0.25} step={1} value={selWheel.ry} onChange={ry => patchWheel({ ry })} onCommit={commit} /></Field>
                <Field label="Поворот" value={`${Math.round((selWheel.rot * 180) / Math.PI)}°`}><Slider label="Поворот диска" min={-1.6} max={1.6} step={0.01} value={selWheel.rot} onChange={rot => patchWheel({ rot })} onCommit={commit} /></Field>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn sm danger" style={{ flex: 1 }} onClick={() => { setWheels(ws => ws.filter((_, k) => k !== sel)); setSel(-1); commit() }}><Ic n="trash" />Удалить</button>
                  <button className="btn sm" style={{ flex: 1 }} onClick={() => { setWheels(ws => [...ws, { ...selWheel, x: selWheel.x + selWheel.rx * 2.2 }]); setSel(params.wheels.length); commit() }}><Ic n="copy" />Дубль</button>
                </div>
              </> : <div className="muted">Дисков на фото: {params.wheels.length}</div>}
            </>}

            {tab === 'ai' && <>
              {ai === 'loading' && <div className="muted"><span className="spin" /> Проверка сервера…</div>}
              {ai === 'offline' && <div className="note warn"><b>Требуется настройка AI.</b> Серверный модуль не запущен: выполните <code>npm run server</code>. Ключи провайдера хранятся только на сервере.</div>}
              {typeof ai === 'object' && !ai.configured && <div className="note warn"><b>Требуется настройка AI.</b> {ai.note ?? 'Провайдер не подключён.'}</div>}
              {typeof ai === 'object' && ai.configured && <>
                <div className="label">Провайдер: {ai.provider}</div>
                <div className="note">AI изменит <b>только выделенную область</b> (вкладка «Выделение»). Результат — генерация и может отличаться от реальных деталей. Его всегда можно отменить.</div>
                <div className="tiles" style={{ gridTemplateColumns: '1fr 1fr' }}>{(ai.presets ?? []).map(p => <button key={p.id} className="tile" onClick={() => setPrompt(p.prompt)}>{p.name}</button>)}</div>
                <textarea className="input" aria-label="Описание правки" placeholder="Что изменить, например: карбоновый обвес" value={prompt} onChange={e => setPrompt(e.target.value)} maxLength={500} />
                <button className="btn primary" onClick={runAi} disabled={!!busy}>{busy ? 'Обработка…' : 'Применить AI'}</button>
                {busy && <button className="btn sm ghost" onClick={() => abort.current?.abort()}>Отмена</button>}
              </>}
              {error && <div className="note err" role="alert">{error}</div>}
            </>}
          </div>
        </aside>
      </div>
      {saving && <NameDialog title="Сохранить проект" initial={opened?.kind === 'photo' ? opened.name : 'Моя машина'} cta="Сохранить" onCancel={() => setSaving(false)} onOk={save} />}
    </>
  )
}

import { ICONS as ICON_D } from '../ui/kit'
