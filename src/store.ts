import { create } from 'zustand'
import { BODY_COLORS, CALIPER_COLORS, DEFAULT_CONFIG, INTERIOR_COLORS, LIVERIES, LIVERY_COLORS, SUSPENSION, WHEELS, WHEEL_COLORS } from './lib/catalog'
import type { CarConfig, Project } from './lib/db'
import { parseBuild } from './lib/share'

export type Screen = 'intro' | 'garage' | 'scan' | 'mygarage' | 'create3d'
export type ViewId = 'front' | 'rear' | 'side' | 'three' | 'wheel' | 'rear-wheel' | 'cabin' | 'top' | 'headlight' | 'taillight' | 'reset'
export type Theme = 'dark' | 'light'
export type Quality = 'auto' | 'high' | 'medium' | 'low'
export type Entry = { label: string; config: CarConfig }
type Insets = { l: number; r: number; t: number; b: number }

const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

const hexName = (list: { name: string; hex: string }[], v: string) => list.find(c => c.hex.toLowerCase() === v.toLowerCase())?.name ?? v.toUpperCase()
export function describe(p: Partial<CarConfig>): string {
  if (p.color !== undefined) return `Цвет кузова: ${hexName(BODY_COLORS, p.color)}`
  if (p.accent !== undefined) return p.accent ? `Крыша и вставки: ${hexName(BODY_COLORS, p.accent)}` : 'Крыша и вставки: заводской цвет'
  if (p.caliper !== undefined) return p.caliper ? `Суппорты: ${hexName(CALIPER_COLORS, p.caliper)}` : 'Суппорты: заводской цвет'
  if (p.interior !== undefined) return p.interior ? `Салон: ${hexName(INTERIOR_COLORS, p.interior)}` : 'Салон: заводской цвет'
  if (p.finish) return `Покрытие: ${{ metallic: 'металлик', gloss: 'глянец', matte: 'матовое' }[p.finish]}`
  if (p.wheel) return `Диски: ${WHEELS.find(w => w.id === p.wheel)?.name ?? p.wheel}`
  if (p.wheelColor !== undefined) return `Цвет дисков: ${hexName(WHEEL_COLORS, p.wheelColor)}`
  if (p.rideHeight !== undefined) { const s = SUSPENSION.find(x => Math.abs(x.v - p.rideHeight!) < 0.01); return s ? `Посадка: ${s.name}` : `Клиренс ${Math.round(95 + p.rideHeight * 90)} мм` }
  if (p.headlights !== undefined) return p.headlights ? 'Фары включены' : 'Фары выключены'
  if (p.taillights !== undefined) return p.taillights ? 'Фонари включены' : 'Фонари выключены'
  if (p.spoiler) return `Спойлер: ${{ none: 'нет', lip: 'Lip', duck: 'Ducktail', wing: 'GT Wing', swan: 'Swan Neck' }[p.spoiler]}`
  if (p.splitter !== undefined) return p.splitter ? 'Сплиттер установлен' : 'Сплиттер снят'
  if (p.canards !== undefined) return p.canards ? 'Канарды установлены' : 'Канарды сняты'
  if (p.diffuser) return `Диффузор: ${{ none: 'нет', street: 'Street', race: 'Race' }[p.diffuser]}`
  if (p.skirts !== undefined) return p.skirts ? 'Пороги установлены' : 'Пороги сняты'
  if (p.livery) return `Полосы: ${LIVERIES.find(l => l.id === p.livery)?.name ?? p.livery}`
  if (p.liveryColor) return `Цвет полос: ${hexName(LIVERY_COLORS, p.liveryColor)}`
  if (p.tint !== undefined) return p.tint > 0.01 ? `Тонировка: пропускает ${Math.round((1 - p.tint) * 100)}%` : 'Тонировка снята'
  if (p.env) return `Сцена: ${{ studio: 'Студия', day: 'День', night: 'Ночь' }[p.env]}`
  return 'Изменение'
}

const ownConfig: CarConfig = { ...DEFAULT_CONFIG, ...load<Partial<CarConfig>>('garage.config', {}) }
// opened from a shared link: show that build, keep the visitor's own one a single Undo away
const shared = typeof location !== 'undefined' ? parseBuild(location.hash) : null
if (shared) history.replaceState(null, '', location.pathname + location.search)
const startConfig: CarConfig = shared ?? ownConfig
const startTimeline: Entry[] = shared
  ? [{ label: 'Ваша прошлая сборка', config: ownConfig }, { label: 'Сборка по ссылке', config: shared }]
  : [{ label: 'Исходная конфигурация', config: ownConfig }]
let saveTimer = 0, lastLabel = '', lastT = 0

type S = {
  screen: Screen
  go: (s: Screen) => void
  config: CarConfig
  set: (p: Partial<CarConfig>) => void
  setConfig: (c: CarConfig) => void
  timeline: Entry[]
  cursor: number
  undo: () => void
  redo: () => void
  jump: (i: number) => void
  resetConfig: () => void
  savedAt: number | null
  recents: string[]
  compare: boolean
  setCompare: (b: boolean) => void
  view: { id: ViewId; n: number }
  setView: (id: ViewId) => void
  photoMode: boolean
  setPhotoMode: (b: boolean) => void
  uiHidden: boolean
  setUiHidden: (b: boolean) => void
  photoBg: 'garage' | 'void' | 'light'
  setPhotoBg: (b: 'garage' | 'void' | 'light') => void
  idleOrbit: boolean
  setIdleOrbit: (b: boolean) => void
  theme: Theme
  setTheme: (t: Theme) => void
  quality: Quality
  setQuality: (q: Quality) => void
  perf: 0 | 1 | 2
  /** auto mode never climbs above this (phones: medium); the user can still force High */
  perfMax: 0 | 1 | 2
  setPerf: (p: 0 | 1 | 2) => void
  insets: Insets
  setInsets: (i: Insets) => void
  reduced: boolean
  opened: Project | null
  openProject: (p: Project | null) => void
  toast: string | null
  say: (m: string | null) => void
  modelLoad: { state: 'idle' | 'loading' | 'parsing' | 'ready' | 'error'; loaded: number; total: number; error?: string }
  capture: ((o?: { width?: number; type?: string; q?: number }) => Promise<Blob | null>) | null
  setCapture: (f: S['capture']) => void
}

const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const coarse = typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || innerWidth < 760)
const weak = coarse || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4

export const useGarage = create<S>((set, get) => ({
  screen: shared || load('garage.intro', false) ? 'garage' : 'intro',
  go: screen => set({ screen, photoMode: false, uiHidden: false }),
  config: startConfig,
  timeline: startTimeline,
  cursor: startTimeline.length - 1,
  savedAt: null,
  recents: load<string[]>('garage.recents', []),
  compare: false,
  setCompare: compare => set({ compare }),
  set: patch => {
    const s = get(), config = { ...s.config, ...patch }, label = describe(patch), now = performance.now()
    let { timeline, cursor } = s
    if (label === lastLabel && now - lastT < 900) timeline = [...timeline.slice(0, cursor), { label, config }] // coalesce slider drags
    else { timeline = [...timeline.slice(0, cursor + 1), { label, config }].slice(-60); cursor = timeline.length - 1 }
    lastLabel = label; lastT = now
    let recents = s.recents
    if (patch.color) { recents = [patch.color, ...recents.filter(c => c !== patch.color)].slice(0, 6); save('garage.recents', recents) }
    set({ config, timeline, cursor, recents })
    clearTimeout(saveTimer); saveTimer = window.setTimeout(() => { save('garage.config', get().config); set({ savedAt: Date.now() }) }, 500)
  },
  setConfig: config => { lastLabel = ''; set({ config, timeline: [{ label: 'Открытый проект', config }], cursor: 0 }); save('garage.config', config) },
  jump: i => { const s = get(); if (i < 0 || i >= s.timeline.length) return; lastLabel = ''; const config = s.timeline[i].config; set({ cursor: i, config }); save('garage.config', config); set({ savedAt: Date.now() }) },
  undo: () => get().jump(get().cursor - 1),
  redo: () => get().jump(get().cursor + 1),
  resetConfig: () => get().set({ ...DEFAULT_CONFIG }),
  view: { id: 'three', n: 0 },
  setView: id => set(s => ({ view: { id, n: s.view.n + 1 } })),
  photoMode: false,
  setPhotoMode: photoMode => set({ photoMode, uiHidden: false }),
  uiHidden: false,
  setUiHidden: uiHidden => set({ uiHidden }),
  photoBg: 'garage',
  setPhotoBg: photoBg => set({ photoBg }),
  idleOrbit: load('garage.idle', true),
  setIdleOrbit: b => { save('garage.idle', b); set({ idleOrbit: b }) },
  theme: load<Theme>('garage.theme', 'dark'),
  setTheme: theme => { save('garage.theme', theme); set({ theme }) },
  quality: load<Quality>('garage.quality', 'auto'),
  setQuality: quality => { save('garage.quality', quality); set({ quality }) },
  perf: weak ? 1 : 2,
  perfMax: weak ? 1 : 2,
  setPerf: perf => set({ perf }),
  insets: { l: 0, r: 0, t: 0, b: 0 },
  setInsets: insets => set({ insets }),
  reduced: !!mq?.matches,
  opened: null,
  openProject: opened => set({ opened }),
  toast: shared ? 'Открыта сборка по ссылке. Ваша прошлая — на шаг назад (Отменить)' : null,
  say: m => { set({ toast: m }); if (m) setTimeout(() => get().toast === m && set({ toast: null }), 3200) },
  modelLoad: { state: 'idle', loaded: 0, total: 0 },
  capture: null,
  setCapture: capture => set({ capture })
}))
mq?.addEventListener?.('change', e => useGarage.setState({ reduced: e.matches }))

/** 0 = low, 1 = medium, 2 = high. Auto follows the live frame-rate monitor. */
export const qualityLevel = (s: S): 0 | 1 | 2 => (s.quality === 'auto' ? s.perf : ({ high: 2, medium: 1, low: 0 } as const)[s.quality])
export const markIntroSeen = () => save('garage.intro', true)
