import { url } from '../lib/base'
import { useEffect, useState } from 'react'
import { Ic } from './kit'
import { Topbar } from './Shell'

type Status = { configured: boolean; provider: string | null; note?: string }

export default function Create3D() {
  const [st, setSt] = useState<Status | 'loading' | 'offline'>('loading')
  const [files, setFiles] = useState<File[]>([])
  useEffect(() => { fetch(url('api/3d/status')).then(r => r.json()).then(setSt).catch(() => setSt('offline')) }, [])
  const ok = typeof st === 'object' && st.configured
  const add = (l: FileList | null) => l && setFiles(f => [...f, ...[...l].filter(x => /^image\/(jpeg|png|webp)$/.test(x.type))].slice(0, 30))
  return (<>
    <Topbar active="create3d" />
    <main className="screen" id="main">
      <div className="page" style={{ maxWidth: 680 }}>
        <h1>3D из фото</h1>
        <p className="muted" style={{ lineHeight: 1.6 }}>Построение 3D-модели по нескольким фотографиям через внешний сервис реконструкции. Одна фотография не даёт геометрически точной модели: нужно 20–60 снимков вокруг автомобиля.</p>
        <div className="note warn" style={{ margin: '20px 0' }}>
          {st === 'loading' && 'Проверка сервера…'}
          {st === 'offline' && 'Сервер недоступен. Запустите «npm run server»: ключи провайдера хранятся только на сервере.'}
          {typeof st === 'object' && !st.configured && (st.note ?? 'Требуется настройка: ни один провайдер 3D-реконструкции не подключён.')}
          {ok && `Провайдер подключён: ${(st as Status).provider}`}
        </div>
        <label className="btn" style={{ cursor: 'pointer' }}><Ic n="upload" />Добавить фотографии<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={e => add(e.target.files)} /></label>
        <div className="muted" style={{ margin: '14px 0' }}>Выбрано: {files.length}{files.length > 0 && files.length < 20 && ' · рекомендуется минимум 20'}</div>
        <button className="btn primary" disabled={!ok || files.length < 8}>Отправить на реконструкцию</button>
        <div className="note" style={{ marginTop: 28 }}>Если результат — единый меш, независимая замена колёс и обвеса недоступна и как рабочая не показывается. Контракт провайдера: <code>server/providers/types.js</code>.</div>
      </div>
    </main>
  </>)
}
