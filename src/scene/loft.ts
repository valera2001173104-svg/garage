import * as THREE from 'three'

/** Monotone-ish cubic Hermite through key points (x ascending). */
export function curve(pts: [number, number][]) {
  const n = pts.length
  const m = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]
    return (b[1] - a[1]) / (b[0] - a[0] || 1)
  })
  return (x: number) => {
    if (x <= pts[0][0]) return pts[0][1]
    if (x >= pts[n - 1][0]) return pts[n - 1][1]
    let i = 0
    while (x > pts[i + 1][0]) i++
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1]
    const h = x1 - x0, t = (x - x0) / h, t2 = t * t, t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m[i + 1]
  }
}

export const stations = (a: number, b: number, n: number) =>
  Array.from({ length: n + 1 }, (_, k) => a + (b - a) * (0.5 - 0.5 * Math.cos((Math.PI * k) / n)))

/** Lofts superellipse cross-sections along X. Smooth indexed mesh, car length along +X. */
export function loft(xs: number[], w: (x: number) => number, yb: (x: number) => number, yt: (x: number) => number, ex = 4, seg = 44) {
  const pos: number[] = [], idx: number[] = []
  const sp = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / ex)
  for (const x of xs) {
    const W = Math.max(w(x), 0.0005), a = yb(x), b = yt(x)
    const ym = (a + b) / 2, hh = Math.max((b - a) / 2, 0.0005)
    for (let j = 0; j < seg; j++) {
      const t = (j / seg) * Math.PI * 2
      pos.push(x, ym + hh * sp(Math.sin(t)), W * sp(Math.cos(t)))
    }
  }
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg)
      idx.push(a, c, b, b, c, d)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
