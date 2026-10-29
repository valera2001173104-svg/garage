import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, fitWheel, hexToHsl, photoLuma, recolor } from './engine'

/** Node has no ImageData: the engine only reads data / width / height, so a plain object is enough. */
function image(w: number, h: number, px: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = px(x, y), i = (y * w + x) * 4; data[i] = data[i + 1] = data[i + 2] = v; data[i + 3] = 255 }
  return { data, width: w, height: h, colorSpace: 'srgb' } as unknown as ImageData
}
const disc = (cx: number, cy: number, r: number) => (x: number, y: number) => Math.hypot(x - cx, y - cy) <= r

describe('photoLuma', () => {
  it('is 0 for black, 1 for white and in between for grey', () => {
    expect(photoLuma(image(64, 48, () => 0))).toBe(0)
    expect(photoLuma(image(64, 48, () => 255))).toBeCloseTo(1, 2)
    expect(photoLuma(image(64, 48, () => 128))).toBeCloseTo(0.5, 1)
  })
})

describe('fitWheel', () => {
  const W = 800, H = 600, bg = 210

  it('finds a light rim inside a dark tyre', () => {
    const tyre = disc(400, 300, 100), rim = disc(400, 300, 70)
    const img = image(W, H, (x, y) => (rim(x, y) ? 180 : tyre(x, y) ? 15 : bg))
    const f = fitWheel(img, 412, 291, 170)! // click off-centre on purpose
    expect(f).not.toBeNull()
    expect(Math.abs(f.x - 400)).toBeLessThan(6)
    expect(Math.abs(f.y - 300)).toBeLessThan(6)
    expect(Math.abs(f.rx - 70)).toBeLessThan(9)
    expect(Math.abs(f.ry - 70)).toBeLessThan(9)
  })

  it('handles a black rim on a black tyre (rim ≈ 74% of the dark mass)', () => {
    const tyre = disc(400, 300, 100)
    const img = image(W, H, (x, y) => (tyre(x, y) ? 12 : bg))
    const f = fitWheel(img, 405, 296, 170)!
    expect(f).not.toBeNull()
    expect(Math.abs(f.x - 400)).toBeLessThan(6)
    expect(Math.abs(f.rx - 74)).toBeLessThan(9)
  })

  it('gives up instead of guessing on a featureless photo', () => {
    expect(fitWheel(image(W, H, () => bg), 400, 300, 170)).toBeNull()
  })
})

describe('recolor', () => {
  const mid = image(8, 8, () => 120)
  const run = (mask: number, tint: string) => {
    const out = image(8, 8, () => 0), m = new Uint8ClampedArray(64).fill(mask)
    // like the colour picker: the tint is a label, the hue / sat / light below are what the engine uses
    recolor(mid, m, { ...DEFAULT_PARAMS, tint, hue: hexToHsl(tint)[0], sat: 1, light: 0.5, strength: 1 }, out)
    return out.data
  }

  it('leaves unselected pixels untouched', () => {
    const d = run(0, '#c8202a')
    for (let i = 0; i < 64 * 4; i += 4) expect([d[i], d[i + 1], d[i + 2]]).toEqual([120, 120, 120])
  })

  it('tints selected pixels toward the chosen colour', () => {
    const d = run(255, '#c8202a')
    expect(d[0]).toBeGreaterThan(d[2]) // red wins over blue
    expect(d[3]).toBe(255) // alpha stays opaque
  })
})
