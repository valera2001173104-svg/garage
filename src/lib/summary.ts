import { BODY_COLORS, CALIPER_COLORS, INTERIOR_COLORS, LIVERIES, LIVERY_COLORS, SUSPENSION, WHEELS, WHEEL_COLORS } from './catalog'
import type { CarConfig } from './db'

const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
const named = (list: { name: string; hex: string }[], v: string) => list.find(x => eq(x.hex, v))?.name ?? v.toUpperCase()

/** Human-readable build summary, one [label, value] per row. Shared by the configurator and project comparison. */
export function configRows(c: CarConfig): [string, string][] {
  const tint = c.tint ?? 0
  return [
    ['Цвет', `${named(BODY_COLORS, c.color)}, ${{ metallic: 'металлик', gloss: 'глянец', matte: 'матовое' }[c.finish]}`],
    ['Диски', c.wheel === 'stock' ? 'Серийные' : `${WHEELS.find(w => w.id === c.wheel)?.name ?? ''}, ${named(WHEEL_COLORS, c.wheelColor)}`],
    ['Посадка', SUSPENSION.find(s => Math.abs(s.v - c.rideHeight) < 0.01)?.name ?? `${Math.round(95 + c.rideHeight * 90)} мм`],
    ['Крыша', c.accent ? named(BODY_COLORS, c.accent) : 'Заводская'],
    ['Суппорты', c.caliper ? named(CALIPER_COLORS, c.caliper) : 'Заводские'],
    ['Салон', c.interior ? named(INTERIOR_COLORS, c.interior) : 'Заводской'],
    ['Полосы', (c.livery ?? 'none') === 'none' ? 'Нет' : `${LIVERIES.find(l => l.id === c.livery)?.name}, ${named(LIVERY_COLORS, c.liveryColor ?? '#f2f2ee')}`],
    ['Тонировка', tint > 0.01 ? `${Math.round((1 - tint) * 100)}%` : 'Нет'],
    ['Обвес', [c.spoiler !== 'none' && 'спойлер', c.splitter && 'сплиттер', c.skirts && 'пороги'].filter(Boolean).join(', ') || 'Нет'],
    ['Свет', [c.headlights && 'фары', c.taillights && 'фонари'].filter(Boolean).join(', ') || 'Выключен'],
    ['Сцена', { studio: 'Студия', day: 'День', night: 'Ночь' }[c.env]]
  ]
}
