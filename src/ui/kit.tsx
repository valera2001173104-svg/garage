import { useEffect, useState, type ReactNode } from 'react'
import { hexToHsl, hslToHex, isHex } from '../lib/color'

export const ICONS = {
  car: 'M4 16v-3.2L5.6 8.5A2 2 0 017.5 7h9a2 2 0 011.9 1.5L20 12.8V16M4 16h16M4 16v2.5h3V16M20 16v2.5h-3V16M7 12h10',
  paint: 'M4 20l4-1 10-10-3-3L5 16l-1 4zM14 6l3 3M15 3l6 6',
  wheel: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM12 3v6.5M12 14.5V21M3.6 8l5.8 2.8M14.6 13.2L20.4 16M3.6 16l5.8-2.8M14.6 10.8L20.4 8',
  stance: 'M3 17h18M6 17v-3l3-4h6l3 4v3M3 21h18M12 3v4M10 5l2-2 2 2',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  aero: 'M3 9h18M5 9v5M19 9v5M3 17h18',
  env: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  back: 'M15 5l-7 7 7 7',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 100 7 3.5 3.5 0 000-7z',
  save: 'M5 3h12l3 3v15H5zM8 3v6h8V3M8 21v-7h8v7',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 000 11H13',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2',
  compare: 'M12 3v18M8 6H4v12h4M16 6h4v12h-4',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
  scan: 'M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M7 12h10',
  folder: 'M3 7a2 2 0 012-2h4l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevron: 'M9 6l6 6-6 6',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  reset: 'M4 4v6h6M4.5 10A8 8 0 1112 20',
  menu: 'M4 7h16M4 12h16M4 17h16',
  windows: 'M5 19l3-12h8l3 12zM9 7l-1 12M15 7l1 12',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  close: 'M5 5l14 14M19 5L5 19',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  share: 'M12 15V3M8 7l4-4 4 4M5 11v9h14v-9',
  wand: 'M4 20L16 8M14 4l1.5 2.5L18 8l-2.5 1.5L14 12l-1.5-2.5L10 8l2.5-1.5zM19 14l.8 1.2 1.2.8-1.2.8L19 18l-.8-1.2-1.2-.8 1.2-.8z',
  brush: 'M18 3l3 3-9 9-3-3zM9 12c-3 0-4 2-4 4s-1 3-2 4c3 1 8 0 8-4',
  eraser: 'M16 3l5 5-10 10H6L3 15zM8 19h13',
  ai: 'M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4'
}
export type IconName = keyof typeof ICONS
export const Ic = ({ n }: { n: IconName }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[n]} /></svg>

export function IconBtn({ n, label, onClick, disabled, pressed, className = '', ...rest }: { n: IconName; label: string; onClick?: () => void; disabled?: boolean; pressed?: boolean; className?: string } & Record<string, unknown>) {
  return <button className={'ib ' + className} title={label} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick} {...rest}><Ic n={n} /></button>
}

export function Field({ label, value, children }: { label: string; value?: ReactNode; children: ReactNode }) {
  return <div className="field"><div className="label"><span>{label}</span>{value !== undefined && <b>{value}</b>}</div>{children}</div>
}
export function Swatches({ items, value, onPick, label }: { items: { name: string; hex: string }[]; value: string; onPick: (h: string) => void; label: string }) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {items.map(c => {
        const on = c.hex.toLowerCase() === value.toLowerCase()
        return <button key={c.hex} className={'sw' + (on ? ' on' : '')} style={{ background: c.hex }} title={c.name} aria-label={c.name} role="radio" aria-checked={on} onClick={() => onPick(c.hex)} />
      })}
    </div>
  )
}
export function Seg<T extends string>({ items, value, onPick, label }: { items: { id: T; name: string }[]; value: T | ''; onPick: (v: T) => void; label: string }) {
  return <div className="seg" role="radiogroup" aria-label={label}>{items.map(i => <button key={i.id} className={i.id === value ? 'on' : ''} role="radio" aria-checked={i.id === value} onClick={() => onPick(i.id)}>{i.name}</button>)}</div>
}
export function Slider({ min = 0, max = 1, step = 0.01, value, onChange, onCommit, label }: { min?: number; max?: number; step?: number; value: number; onChange: (v: number) => void; onCommit?: () => void; label: string }) {
  const p = ((value - min) / (max - min)) * 100
  return <input type="range" aria-label={label} min={min} max={max} step={step} value={value} style={{ ['--p' as string]: p + '%' }} onChange={e => onChange(+e.target.value)} onPointerUp={onCommit} onKeyUp={onCommit} />
}
export function Toggle({ label, on, onChange, disabled }: { label: string; on: boolean; onChange: (b: boolean) => void; disabled?: boolean }) {
  return <button className="tog" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}><span>{label}</span><span className="sw2" /></button>
}

/** palette + hex field + hue slider + recently used (the 3DTuning "custom colour" pattern, without the paywall) */
export function ColorPicker({ items, value, recents, onPick, label }: { items: { name: string; hex: string }[]; value: string; recents: string[]; onPick: (h: string) => void; label: string }) {
  const [hex, setHex] = useState(value.toUpperCase())
  useEffect(() => setHex(value.toUpperCase()), [value])
  const commit = (v: string) => { const t = (v.startsWith('#') ? v : '#' + v).toLowerCase(); if (isHex(t)) onPick(t); else setHex(value.toUpperCase()) }
  const [h, s, l] = hexToHsl(value)
  return (
    <>
      <Field label={label} value={items.find(c => c.hex.toLowerCase() === value.toLowerCase())?.name ?? 'Свой цвет'}><Swatches label={label} items={items} value={value} onPick={onPick} /></Field>
      <Field label="Оттенок">
        <div className="hue" /><Slider label="Оттенок" min={0} max={360} step={1} value={h} onChange={v => onPick(hslToHex(v, Math.max(s, 0.35), Math.min(Math.max(l, 0.3), 0.6)))} />
      </Field>
      <Field label="Свой цвет (HEX)">
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" aria-label="HEX-код цвета" value={hex} maxLength={7} spellCheck={false} onChange={e => setHex(e.target.value)} onBlur={e => commit(e.target.value)} onKeyDown={e => e.key === 'Enter' && commit(hex)} style={{ fontVariantNumeric: 'tabular-nums' }} />
          <span style={{ width: 36, height: 36, borderRadius: 8, background: value, border: '1px solid var(--line-strong)', flexShrink: 0 }} aria-hidden />
        </div>
      </Field>
      {recents.length > 0 && <Field label="Недавние"><div className="swatches">{recents.map(c => <button key={c} className={'sw' + (c.toLowerCase() === value.toLowerCase() ? ' on' : '')} style={{ background: c }} aria-label={`Цвет ${c}`} onClick={() => onPick(c)} />)}</div></Field>}
    </>
  )
}
