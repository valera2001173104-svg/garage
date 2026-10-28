import { url } from './lib/base'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(<App />)

// offline + install: production only, so the dev server is never cached
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(url('sw.js')).then(() => navigator.serviceWorker.ready).then(reg => {
      // give the worker the files this first visit already downloaded (the 3D model arrives a bit later, hence the delay)
      setTimeout(() => reg.active?.postMessage({ type: 'warm', urls: performance.getEntriesByType('resource').map(r => r.name) }), 4000)
    }).catch(() => { /* private mode or blocked: the app works online as before */ })
  })
}
