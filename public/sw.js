// GARAGE service worker: after the first visit the app opens offline.
// - /assets/*  hashed by the build → cache-first (never stale)
// - /models/*, /mediapipe/*  fixed names → stale-while-revalidate
// - page navigations → network first, last good copy when offline
// - /api/*  never cached (AI and provider calls always go to the server)
const V = 'garage-v1'
// the app may live under a sub-path (GitHub Pages: /garage/); all matching below is relative to it
const BASE = new URL('./', self.location).pathname
const rel = u => '/' + u.pathname.slice(BASE.length)
const STATIC = [/^\/assets\//, /^\/models\//, /^\/mediapipe\//, /^\/icon-/, /^\/apple-touch-icon/, /^\/manifest/]

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()))
})

// the page reports what it already loaded before the worker took control (first visit), so offline works right away
self.addEventListener('message', e => {
  if (e.data?.type !== 'warm' || !Array.isArray(e.data.urls)) return
  e.waitUntil((async () => {
    const c = await caches.open(V)
    for (const u of e.data.urls.slice(0, 80)) {
      try {
        const url = new URL(u, location.origin)
        if (url.origin !== location.origin || !STATIC.some(re => re.test(rel(url))) || await c.match(url)) continue
        const r = await fetch(url.href); if (r.status === 200) await c.put(url, r)
      } catch { /* skipped: it will be cached on its next normal request */ }
    }
    if (!(await c.match(BASE))) { try { const r = await fetch(BASE); if (r.ok) await c.put(BASE, r) } catch { /* offline */ } }
  })())
})

const put = async (req, res) => { if (res.ok && res.status === 200) { const c = await caches.open(V); await c.put(req, res.clone()) } return res }

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || rel(url).startsWith('/api/') || req.headers.has('range')) return

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => put(new Request(BASE), r)).catch(async () => (await caches.match(BASE)) || Response.error()))
    return
  }
  if (!STATIC.some(re => re.test(rel(url)))) return

  if (rel(url).startsWith('/assets/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => put(req, r))))
    return
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => put(req, r)).catch(() => hit)
    return hit || net
  }))
})
