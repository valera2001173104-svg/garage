import express from 'express'
import multer from 'multer'
import compression from 'compression'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { stability } from './providers/stability.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const imageProviders = [stability]
const reconstructProviders = [] // CREATE 3D: implement Reconstruct3DProvider (see providers/types.js) and register here.

const app = express()
app.disable('x-powered-by')
app.use(compression()) // gzip JS/CSS/JSON; .glb is already meshopt+WebP and keeps its Content-Length for progress
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 2, fields: 4 } })

const isPng = b => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
const active = () => imageProviders.find(p => p.configured())

app.get('/api/ai/status', (_req, res) => {
  const p = active()
  if (!p) return res.json({ configured: false, provider: null, note: 'Провайдер не подключён. Создайте server/.env с STABILITY_API_KEY=… и перезапустите «npm run server».' })
  res.json({ configured: true, provider: p.label, presets: p.presets })
})

// naive per-IP rate limit
const hits = new Map()
const limited = ip => { const n = Date.now(), a = (hits.get(ip) ?? []).filter(t => n - t < 60_000); a.push(n); hits.set(ip, a); return a.length > 8 }

app.post('/api/ai/edit', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'mask', maxCount: 1 }]), async (req, res) => {
  const p = active()
  if (!p) return res.status(501).json({ error: 'Требуется настройка AI: провайдер не подключён.' })
  if (limited(req.ip)) return res.status(429).json({ error: 'Слишком много запросов. Подождите минуту.' })
  const image = req.files?.image?.[0]?.buffer, mask = req.files?.mask?.[0]?.buffer
  const prompt = String(req.body?.prompt ?? '').trim().slice(0, 500)
  if (!image || !mask || !isPng(image) || !isPng(mask)) return res.status(400).json({ error: 'Нужны изображение и маска в формате PNG.' })
  if (!prompt) return res.status(400).json({ error: 'Пустое описание правки.' })
  const ac = new AbortController(); req.on('close', () => !res.writableEnded && ac.abort())
  try {
    const out = await p.edit({ image, mask, prompt, signal: ac.signal })
    res.type(out.mime).send(out.data)
  } catch (e) {
    if (ac.signal.aborted) return
    console.error('[ai]', e.message)
    res.status(e.status ?? 502).json({ error: e.message || 'Ошибка AI-провайдера' })
  }
})

app.get('/api/3d/status', (_req, res) => {
  const p = reconstructProviders.find(x => x.configured())
  res.json(p ? { configured: true, provider: p.id } : { configured: false, provider: null, note: 'Провайдер 3D-реконструкции не подключён. Реализуйте интерфейс в server/providers/types.js и зарегистрируйте в server/index.js.' })
})

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, _req, res, _next) => res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Файл слишком большой' : 'Некорректный запрос' }))

const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) { app.use(express.static(dist, { setHeaders: (res, f) => {
  // hashed bundles never change; HTML must revalidate so a deploy is picked up immediately
  if (f.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  else if (f.endsWith('.html') || f.endsWith(`${path.sep}sw.js`) || f.endsWith('.webmanifest')) res.setHeader('Cache-Control', 'no-cache')
  else res.setHeader('Cache-Control', 'public, max-age=3600')
} })); app.get('/{*splat}', (_q, r) => { r.setHeader('Cache-Control', 'no-cache'); r.sendFile(path.join(dist, 'index.html')) }) }

const port = process.env.PORT || 8787
app.listen(port, () => console.log(`GARAGE server on :${port} · AI provider: ${active()?.label ?? 'not configured'}`))
