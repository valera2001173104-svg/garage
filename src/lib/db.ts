// IndexedDB storage for MY GARAGE projects (images/blobs never go to localStorage).
export type CarConfig = {
  color: string
  finish: 'metallic' | 'matte' | 'gloss'
  /** which model is on the stage; missing = the detailed Car Concept */
  car?: string
  wheel: string
  wheelColor: string
  rideHeight: number // 0 (slammed) .. 1 (raised)
  headlights: boolean
  taillights: boolean
  spoiler: 'none' | 'lip' | 'duck' | 'wing' | 'swan'
  splitter: boolean
  skirts: boolean
  canards?: boolean
  diffuser?: 'none' | 'street' | 'race'
  env: 'studio' | 'day' | 'night'
  /** per-zone colours; null = factory colour of the model */
  accent?: string | null
  caliper?: string | null
  interior?: string | null
  /** window tint 0 (clear) .. 1 (limo) */
  tint?: number
  livery?: 'none' | 'twin' | 'wide' | 'side'
  liveryColor?: string
}

export type PhotoParams = {
  hue: number
  sat: number
  light: number
  strength: number
  finish?: 'gloss' | 'matte' | 'metallic'
  keepHighlights?: boolean
  keepShadows?: boolean
  tint: string | null
  wheels: WheelMark[]
}
export type WheelMark = { x: number; y: number; rx: number; ry: number; rot: number; design: string; color: string }

export type Project = {
  id: string
  name: string
  kind: '3d' | 'photo'
  createdAt: number
  updatedAt: number
  preview: Blob | null
  config?: CarConfig
  photo?: { original: Blob; mask: Blob; params: PhotoParams; base?: Blob; size: { w: number; h: number } }
}

const DB = 'garage-db'
const STORE = 'projects'

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('IndexedDB недоступна в этом браузере'))
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error ?? new Error('Не удалось открыть хранилище'))
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const rq = fn(t.objectStore(STORE))
    t.oncomplete = () => { db.close(); res(rq.result) }
    t.onerror = t.onabort = () => { db.close(); rej(t.error ?? new Error('Ошибка хранилища')) }
  })
}

export const listProjects = async () => (await tx('readonly', s => s.getAll() as IDBRequest<Project[]>)).sort((a, b) => b.updatedAt - a.updatedAt)
export const saveProject = (p: Project) => tx('readwrite', s => s.put(p))
export const deleteProject = (id: string) => tx('readwrite', s => s.delete(id))
export const getProject = (id: string) => tx('readonly', s => s.get(id) as IDBRequest<Project | undefined>)
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now())

export async function duplicateProject(id: string) {
  const p = await getProject(id)
  if (!p) throw new Error('Проект не найден')
  const c: Project = { ...p, id: uid(), name: p.name + ' (копия)', createdAt: Date.now(), updatedAt: Date.now() }
  await saveProject(c)
  return c
}

export const canvasToBlob = (c: HTMLCanvasElement, type = 'image/png', q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Не удалось закодировать изображение'))), type, q))
