import { useGarage } from '../store'

const mb = (b: number) => (b / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/** Real progress: bytes received vs Content-Length. No fake percentages — unknown size shows an indeterminate bar. */
export function ModelLoading() {
  const m = useGarage(s => s.modelLoad)
  if (m.state !== 'loading' && m.state !== 'parsing') return null
  const known = m.total > 0
  const pct = known ? Math.min(100, Math.round((m.loaded / m.total) * 100)) : 0
  return (
    <div className="loadcard" role="status" aria-live="polite">
      <div className="loadrow">
        <span>{m.state === 'parsing' ? 'Подготовка модели…' : 'Загрузка автомобиля'}</span>
        <span className="muted">{m.state === 'parsing' ? '' : known ? `${mb(m.loaded)} из ${mb(m.total)} МБ` : `${mb(m.loaded)} МБ`}</span>
      </div>
      {known && m.state === 'loading'
        ? <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: pct + '%' }} /></div>
        : <div className="indet" />}
    </div>
  )
}
