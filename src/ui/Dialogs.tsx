import { useEffect, useRef, useState } from 'react'
import { useGarage } from '../store'

export function Toast() {
  const t = useGarage(s => s.toast)
  return t ? <div className="toast" role="status">{t}</div> : null
}

export function NameDialog({ title, initial, cta, onCancel, onOk }: { title: string; initial: string; cta: string; onCancel: () => void; onOk: (name: string) => void }) {
  const [v, setV] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select(); const k = (e: KeyboardEvent) => e.key === 'Escape' && onCancel(); addEventListener('keydown', k); return () => removeEventListener('keydown', k) }, [onCancel])
  return (
    <div className="modal-bg" onClick={onCancel}>
      <form className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onOk(v.trim() || initial) }}>
        <h3 className="h" style={{ fontSize: 18 }}>{title}</h3>
        <input ref={ref} className="input" value={v} maxLength={60} onChange={e => setV(e.target.value)} aria-label="Название проекта" />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="btn ghost" onClick={onCancel}>Отмена</button>
          <button type="submit" className="btn primary">{cta}</button>
        </div>
      </form>
    </div>
  )
}

export function downloadBlob(b: Blob, name: string) {
  const u = URL.createObjectURL(b), a = document.createElement('a')
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(u), 4000)
}

export async function thumb(src: Blob, w = 560): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(src)
    const k = Math.min(1, w / bmp.width), c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close()
    return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))
  } catch { return null }
}
