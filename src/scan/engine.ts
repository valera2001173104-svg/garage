// Pure image-processing helpers for GARAGE SCAN (Canvas API, no ML).
import type { PhotoParams, WheelMark } from '../lib/db'
import { hexToHsl, hslToHex } from '../lib/color'

export const DEFAULT_PARAMS: PhotoParams = { hue: 168, sat: 1, light: 0.5, strength: 1, finish: 'metallic', keepHighlights: true, keepShadows: true, tint: '#4FE0C0', wheels: [] }

/* ---------- colour helpers ---------- */
export { hexToHsl, hslToHex } from '../lib/color'
const shade = (hex: string, k: number) => { const [h, s, l] = hexToHsl(hex); return hslToHex(h, s, Math.max(0, Math.min(1, l + k))) }

/* ---------- mask ops ---------- */
export function boxBlur(src: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r < 1) return src.slice()
  const tmp = new Float32Array(w * h), out = new Uint8ClampedArray(w * h), k = 2 * r + 1
  for (let y = 0; y < h; y++) {
    let acc = 0; const o = y * w
    for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[o + x] = acc / k
      acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / k
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

/** Region grow by colour distance to seed colour (not neighbour chain — avoids leaking). */
export function wand(img: ImageData, sx: number, sy: number, tol: number): Uint8ClampedArray {
  const { width: w, height: h, data: d } = img
  let sr = 0, sg = 0, sb = 0, n = 0
  for (let y = Math.max(0, sy - 2); y <= Math.min(h - 1, sy + 2); y++)
    for (let x = Math.max(0, sx - 2); x <= Math.min(w - 1, sx + 2); x++) { const i = (y * w + x) * 4; sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++ }
  sr /= n; sg /= n; sb /= n
  const t2 = tol * tol, out = new Uint8ClampedArray(w * h), stack = new Int32Array(w * h)
  let sp = 0; stack[sp++] = sy * w + sx; out[sy * w + sx] = 255
  const ok = (p: number) => { const i = p * 4, dr = d[i] - sr, dg = d[i + 1] - sg, db = d[i + 2] - sb; return dr * dr * 0.9 + dg * dg * 1.2 + db * db * 0.9 <= t2 }
  while (sp) {
    const p = stack[--sp], x = p % w, y = (p / w) | 0
    if (x > 0 && !out[p - 1] && ok(p - 1)) { out[p - 1] = 255; stack[sp++] = p - 1 }
    if (x < w - 1 && !out[p + 1] && ok(p + 1)) { out[p + 1] = 255; stack[sp++] = p + 1 }
    if (y > 0 && !out[p - w] && ok(p - w)) { out[p - w] = 255; stack[sp++] = p - w }
    if (y < h - 1 && !out[p + w] && ok(p + w)) { out[p + w] = 255; stack[sp++] = p + w }
  }
  return out
}

/** Fill small holes (specular dots, badges) but keep large ones (windows, lights). */
export function fillSmallHoles(m: Uint8ClampedArray, w: number, h: number, maxArea: number) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h)
  for (let s = 0; s < w * h; s++) {
    if (m[s] > 127 || seen[s]) continue
    let sp = 0, cnt = 0, border = false; const list: number[] = []
    stack[sp++] = s; seen[s] = 1
    while (sp) {
      const p = stack[--sp]; cnt++; if (cnt <= maxArea + 1) list.push(p)
      const x = p % w, y = (p / w) | 0
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]
      for (const q of nb) if (q >= 0 && !seen[q] && m[q] <= 127) { seen[q] = 1; stack[sp++] = q }
    }
    if (!border && cnt <= maxArea) for (const p of list) m[p] = 255
  }
}

export function stamp(m: Uint8ClampedArray, w: number, h: number, cx: number, cy: number, r: number, add: boolean, hard = 0.6) {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r)), y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r))
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy) / r
      if (d > 1) continue
      const a = d < hard ? 1 : 1 - (d - hard) / (1 - hard), i = y * w + x
      m[i] = add ? Math.max(m[i], a * 255) : m[i] * (1 - a)
    }
}
export function stroke(m: Uint8ClampedArray, w: number, h: number, x0: number, y0: number, x1: number, y1: number, r: number, add: boolean) {
  const dist = Math.hypot(x1 - x0, y1 - y0), step = Math.max(1, r * 0.35), n = Math.max(1, Math.ceil(dist / step))
  for (let i = 0; i <= n; i++) stamp(m, w, h, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, add)
}

/** Remove very dark pixels from the selection (glass, tyres, grille, lamps interiors). */
export function excludeDark(img: ImageData, m: Uint8ClampedArray, thr: number) {
  const d = img.data
  for (let p = 0; p < m.length; p++) { if (!m[p]) continue; const i = p * 4, l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; if (l < thr) m[p] = 0 }
}

/* ---------- recolour ---------- */
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export function recolor(base: ImageData, mask: Uint8ClampedArray, p: PhotoParams, out: ImageData) {
  const d = base.data, o = out.data
  o.set(d)
  if (!p.tint || p.strength <= 0) return
  const [th, ts0, tl0] = hexToHsl(p.tint)
  void th // swatch seeds the hue slider; the slider value is what is applied
  const H = p.hue, S = Math.min(1, ts0 * p.sat), TL = Math.max(0.03, Math.min(0.97, tl0 + (p.light - 0.5)))
  // mean luminance of the selection (reference for remapping shading)
  let sum = 0, cnt = 0
  for (let q = 0; q < mask.length; q += 3) if (mask[q] > 127) { const i = q * 4; sum += (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; cnt++ }
  const mean = cnt ? Math.max(0.05, Math.min(0.95, sum / cnt)) : 0.5
  const hh = H / 60
  const finish = p.finish ?? 'metallic', keepHi = p.keepHighlights ?? true, keepSh = p.keepShadows ?? true
  for (let q = 0; q < mask.length; q++) {
    const a = (mask[q] / 255) * p.strength
    if (a <= 0.004) continue
    const i = q * 4, r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
    // remap lightness keeping relative shading; protect specular highlights
    let nl = TL <= mean ? l * (TL / mean) : 1 - (1 - l) * ((1 - TL) / (1 - mean))
    if (finish === 'matte') nl = TL + (nl - TL) * 0.8 // soft, low-contrast
    else if (finish === 'metallic') nl = TL + (nl - TL) * 1.12 // punchier
    nl = Math.max(0, Math.min(1, nl))
    if (keepHi) nl = nl + (l - nl) * smooth(0.82, 1, l)
    if (keepSh) nl = nl + (l - nl) * (1 - smooth(0.02, 0.1, l)) // keep deep shadows
    // chroma stays tied to lightness so shadows do not get neon
    const s = S * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, nl)))
    const c = (1 - Math.abs(2 * nl - 1)) * s, x = c * (1 - Math.abs((hh % 2) - 1)), m0 = nl - c / 2
    let rr = 0, gg = 0, bb = 0
    const k = Math.floor(hh) % 6
    if (k === 0) { rr = c; gg = x } else if (k === 1) { rr = x; gg = c } else if (k === 2) { gg = c; bb = x } else if (k === 3) { gg = x; bb = c } else if (k === 4) { rr = x; bb = c } else { rr = c; bb = x }
    o[i] = (d[i] + ((rr + m0) * 255 - d[i]) * a)
    o[i + 1] = (d[i + 1] + ((gg + m0) * 255 - d[i + 1]) * a)
    o[i + 2] = (d[i + 2] + ((bb + m0) * 255 - d[i + 2]) * a)
  }
}

/* ---------- wheels ---------- */
export const RIMS = [
  { id: 'spoke5', name: 'Five Spoke' }, { id: 'mesh', name: 'Mesh' }, { id: 'turbine', name: 'Turbine' }, { id: 'split', name: 'Split Ten' }, { id: 'disc', name: 'Aero Disc' }
]

function drawRim(g: CanvasRenderingContext2D, design: string, color: string) {
  const grad = g.createLinearGradient(-1, -1, 1, 1)
  grad.addColorStop(0, shade(color, 0.28)); grad.addColorStop(0.5, color); grad.addColorStop(1, shade(color, -0.22))
  // barrel / depth
  const bg = g.createRadialGradient(0, 0, 0.2, 0, 0, 1)
  bg.addColorStop(0, '#202326'); bg.addColorStop(1, '#030303')
  g.fillStyle = bg; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill()
  g.fillStyle = grad
  const spokes = (n: number, pts: number[][], off = 0) => {
    for (let i = 0; i < n; i++) {
      g.save(); g.rotate(off + (i * Math.PI * 2) / n); g.beginPath()
      pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill()
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.012; g.stroke(); g.restore()
    }
  }
  if (design === 'spoke5') spokes(5, [[-0.13, -0.1], [0.13, -0.1], [0.2, -0.86], [-0.2, -0.86]])
  if (design === 'turbine') spokes(12, [[-0.03, -0.12], [0.1, -0.12], [0.3, -0.86], [0.14, -0.86]])
  if (design === 'split') { spokes(10, [[-0.06, -0.12], [0.0, -0.12], [0.05, -0.86], [-0.04, -0.86]], 0.1); spokes(10, [[-0.06, -0.12], [0.0, -0.12], [0.05, -0.86], [-0.04, -0.86]], -0.1) }
  if (design === 'mesh') {
    spokes(28, [[-0.012, -0.12], [0.012, -0.12], [0.012, -0.86], [-0.012, -0.86]])
    g.strokeStyle = grad; g.lineWidth = 0.035; for (const r of [0.34, 0.6]) { g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke() }
  }
  if (design === 'disc') {
    g.beginPath(); g.arc(0, 0, 0.88, 0, 7); g.fill()
    g.fillStyle = 'rgba(0,0,0,.75)'
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI * 2) / 10; g.beginPath(); g.arc(Math.cos(a) * 0.6, Math.sin(a) * 0.6, 0.08, 0, 7); g.fill() }
  }
  // lip, hub, lugs
  g.strokeStyle = grad; g.lineWidth = 0.1; g.beginPath(); g.arc(0, 0, 0.93, 0, 7); g.stroke()
  g.fillStyle = grad; g.beginPath(); g.arc(0, 0, 0.17, 0, 7); g.fill()
  g.fillStyle = 'rgba(0,0,0,.55)'
  for (let i = 0; i < 5; i++) { const a = (i * Math.PI * 2) / 5 - Math.PI / 2; g.beginPath(); g.arc(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.022, 0, 7); g.fill() }
  // soft highlight
  const hl = g.createRadialGradient(-0.4, -0.45, 0.05, -0.2, -0.2, 1)
  hl.addColorStop(0, 'rgba(255,255,255,.22)'); hl.addColorStop(0.6, 'rgba(255,255,255,0)')
  g.fillStyle = hl; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill()
}

const cache = new Map<string, HTMLCanvasElement>()
function rimSprite(design: string, color: string) {
  const k = design + color
  let c = cache.get(k)
  if (!c) {
    c = document.createElement('canvas'); c.width = c.height = 384
    const g = c.getContext('2d')!; g.translate(192, 192); g.scale(190, 190); drawRim(g, design, color)
    if (cache.size > 24) cache.clear()
    cache.set(k, c)
  }
  return c
}

export function drawWheels(ctx: CanvasRenderingContext2D, marks: WheelMark[]) {
  for (const m of marks) {
    ctx.save()
    ctx.translate(m.x, m.y); ctx.rotate(m.rot)
    // feathered edge so the rim melts into the tyre
    const tmp = document.createElement('canvas'); const sz = 384; tmp.width = tmp.height = sz
    const t = tmp.getContext('2d')!
    t.drawImage(rimSprite(m.design, m.color), 0, 0)
    t.globalCompositeOperation = 'destination-in'
    const fm = t.createRadialGradient(sz / 2, sz / 2, sz * 0.44, sz / 2, sz / 2, sz * 0.5)
    fm.addColorStop(0, 'rgba(0,0,0,1)'); fm.addColorStop(1, 'rgba(0,0,0,0)')
    t.fillStyle = fm; t.fillRect(0, 0, sz, sz)
    ctx.drawImage(tmp, -m.rx, -m.ry, m.rx * 2, m.ry * 2)
    ctx.restore()
  }
}

/* ---------- file handling ---------- */
export const MAX_BYTES = 25 * 1024 * 1024
export async function validateFile(f: File): Promise<string | null> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return 'Поддерживаются только JPG, PNG и WebP.'
  if (f.size > MAX_BYTES) return `Файл слишком большой (${(f.size / 1048576).toFixed(1)} МБ). Максимум — 25 МБ.`
  if (f.size < 1024) return 'Файл слишком маленький или повреждён.'
  const b = new Uint8Array(await f.slice(0, 12).arrayBuffer())
  const jpg = b[0] === 0xff && b[1] === 0xd8, png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const webp = b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45
  if (!jpg && !png && !webp) return 'Содержимое файла не соответствует изображению.'
  return null
}

export async function decode(f: Blob, maxSide: number): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap | HTMLImageElement
  try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }) }
  catch {
    bmp = await new Promise<HTMLImageElement>((res, rej) => { const u = URL.createObjectURL(f), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); res(i) }; i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Не удалось прочитать изображение')) }; i.src = u })
  }
  const nw = 'naturalWidth' in bmp ? bmp.naturalWidth : bmp.width, nh = 'naturalHeight' in bmp ? bmp.naturalHeight : bmp.height
  if (nw < 320 || nh < 240) throw new Error('Изображение слишком маленькое (минимум 320×240).')
  if (nw * nh > 120e6) throw new Error('Изображение слишком большое для обработки в браузере.')
  const k = Math.min(1, maxSide / Math.max(nw, nh))
  const c = document.createElement('canvas'); c.width = Math.round(nw * k); c.height = Math.round(nh * k)
  const g = c.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height)
  if ('close' in bmp) bmp.close()
  return c
}

const thumbs = new Map<string, string>()
/** small data-URL preview of a rim design for pickers */
export function rimThumb(design: string, color: string) {
  const k = design + color
  if (!thumbs.has(k)) { const c = rimSprite(design, color), t = document.createElement('canvas'); t.width = t.height = 96; t.getContext('2d')!.drawImage(c, 0, 0, 96, 96); thumbs.set(k, t.toDataURL('image/png')) }
  return thumbs.get(k)!
}
