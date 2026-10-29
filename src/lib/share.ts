// Share a build as a link. The whole config lives in the URL fragment (#build=…),
// which browsers never send to a server, so sharing needs no backend.
import { DEFAULT_CONFIG, WHEELS } from './catalog'
import type { CarConfig } from './db'

const KEY = 'build'
const VER = '1'
const HEX = /^#[0-9a-f]{6}$/i

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))

export function buildLink(c: CarConfig): string {
  const url = new URL(location.href)
  url.hash = `${KEY}=${VER}.${b64url(JSON.stringify(c))}`
  return url.toString()
}

/** Link data is untrusted: every field is checked, anything odd falls back to the default. */
export function parseBuild(hash: string): CarConfig | null {
  const m = new URLSearchParams(hash.replace(/^#/, '')).get(KEY)
  if (!m || !m.startsWith(VER + '.') || m.length > 4000) return null
  let raw: Record<string, unknown>
  try { raw = JSON.parse(unb64url(m.slice(VER.length + 1))) } catch { return null }
  if (!raw || typeof raw !== 'object') return null
  const d = DEFAULT_CONFIG as unknown as CarConfig
  const hex = (v: unknown, f: string) => (typeof v === 'string' && HEX.test(v) ? v : f)
  const zone = (v: unknown) => (typeof v === 'string' && HEX.test(v) ? v : null)
  const pick = <T extends string>(v: unknown, list: readonly T[], f: T) => (list.includes(v as T) ? (v as T) : f)
  const bool = (v: unknown, f: boolean) => (typeof v === 'boolean' ? v : f)
  const num = (v: unknown, f: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : f)
  return {
    color: hex(raw.color, d.color),
    finish: pick(raw.finish, ['metallic', 'matte', 'gloss'] as const, d.finish),
    wheel: pick(raw.wheel, WHEELS.map(w => w.id), d.wheel),
    wheelColor: hex(raw.wheelColor, d.wheelColor),
    rideHeight: num(raw.rideHeight, d.rideHeight),
    headlights: bool(raw.headlights, d.headlights),
    taillights: bool(raw.taillights, d.taillights),
    spoiler: pick(raw.spoiler, ['none', 'lip', 'duck', 'wing', 'swan'] as const, d.spoiler),
    splitter: bool(raw.splitter, d.splitter),
    skirts: bool(raw.skirts, d.skirts),
    canards: bool(raw.canards, false),
    diffuser: pick(raw.diffuser, ['none', 'street', 'race'] as const, 'none'),
    env: pick(raw.env, ['studio', 'day', 'night'] as const, d.env),
    accent: zone(raw.accent),
    caliper: zone(raw.caliper),
    interior: zone(raw.interior),
    tint: num(raw.tint, 0),
    livery: pick(raw.livery, ['none', 'twin', 'wide', 'side'] as const, 'none'),
    liveryColor: hex(raw.liveryColor, '#f2f2ee')
  }
}

/** Opens the native share sheet on phones, copies the link elsewhere. */
export async function shareBuild(c: CarConfig): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const url = buildLink(c)
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try { await navigator.share({ title: 'Моя сборка в GARAGE', url }); return 'shared' } catch (e) { return (e as Error).name === 'AbortError' ? 'cancelled' : 'failed' }
  }
  try { await navigator.clipboard.writeText(url); return 'copied' } catch { /* insecure context or denied */ }
  try { window.prompt('Скопируйте ссылку на сборку', url); return 'copied' } catch { return 'failed' }
}
