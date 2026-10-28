import { url } from '../lib/base'
import { useGarage } from '../store'

/** Desktop gets 2048px textures, weak devices 1024px (≈17 MB less VRAM). Both are meshopt + WebP (see `npm run models`). */
const URLS = { high: url('models/car.glb'), low: url('models/car-mobile.glb') }
let job: Promise<string> | null = null

/** Streams the GLB with real byte progress (Content-Length), then hands the loader a blob URL. Started once per session. */
export function loadModel(level: 0 | 1 | 2): Promise<string> {
  if (job) return job
  const url = level < 2 ? URLS.low : URLS.high
  const set = (m: Partial<ReturnType<typeof useGarage.getState>['modelLoad']>) => useGarage.setState(s => ({ modelLoad: { ...s.modelLoad, ...m } }))
  job = (async () => {
    set({ state: 'loading', loaded: 0, total: 0 })
    const r = await fetch(url)
    if (!r.ok) throw new Error(`Файл модели недоступен (${r.status})`)
    const total = Number(r.headers.get('content-length')) || 0
    set({ total })
    let blob: Blob
    const reader = r.body?.getReader()
    if (!reader) blob = await r.blob()
    else {
      const chunks: BlobPart[] = []
      let loaded = 0, last = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value as BlobPart); loaded += value.byteLength
        const now = performance.now()
        if (now - last > 80) { last = now; set({ loaded }) }
      }
      set({ loaded })
      blob = new Blob(chunks, { type: 'model/gltf-binary' })
    }
    set({ state: 'parsing' })
    return URL.createObjectURL(blob)
  })()
  job.catch(e => { set({ state: 'error', error: (e as Error).message }); job = null })
  return job
}
