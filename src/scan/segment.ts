import { url } from '../lib/base'
// Local car segmentation: MediaPipe Image Segmenter + DeepLabV3 (PASCAL VOC classes, includes "car").
// Everything is self-hosted under /mediapipe and /models/seg (Apache-2.0); nothing leaves the device.
import type { ImageSegmenter } from '@mediapipe/tasks-vision'

let job: Promise<ImageSegmenter> | null = null

async function create(): Promise<ImageSegmenter> {
  const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
  const files = await FilesetResolver.forVisionTasks(url('mediapipe').replace(/\/$/, '')) // picks SIMD or no-SIMD build itself
  const opts = (delegate: 'GPU' | 'CPU') => ({ baseOptions: { modelAssetPath: url('models/seg/deeplab_v3.tflite'), delegate }, runningMode: 'IMAGE' as const, outputCategoryMask: false, outputConfidenceMasks: true })
  try { return await ImageSegmenter.createFromOptions(files, opts('GPU')) } catch { return await ImageSegmenter.createFromOptions(files, opts('CPU')) }
}
export function loadSegmenter() {
  if (!job) { job = create(); job.catch(() => { job = null }) }
  return job
}

/** Confidence (0..1) that each pixel belongs to a car, at the canvas size. */
export async function carConfidence(src: HTMLCanvasElement): Promise<Float32Array> {
  const seg = await loadSegmenter()
  const labels = seg.getLabels().map(l => l.toLowerCase())
  const ci = labels.indexOf('car')
  if (ci < 0) throw new Error('В модели нет класса «car»')
  const res = seg.segment(src)
  try {
    const m = res.confidenceMasks?.[ci]
    if (!m) throw new Error('Модель не вернула маску')
    const a = m.getAsFloat32Array()
    if (m.width === src.width && m.height === src.height) return a.slice()
    // resample (bilinear) to the working size
    const out = new Float32Array(src.width * src.height), sx = m.width / src.width, sy = m.height / src.height
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
      const fx = Math.min(m.width - 1.001, x * sx), fy = Math.min(m.height - 1.001, y * sy), x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, i = y0 * m.width + x0
      out[y * src.width + x] = (a[i] * (1 - tx) + a[i + 1] * tx) * (1 - ty) + (a[i + m.width] * (1 - tx) + a[i + m.width + 1] * tx) * ty
    }
    return out
  } finally { res.close() }
}

/** Keep only the largest connected blob (the main car), returns its pixel count. */
export function keepLargest(bin: Uint8Array, w: number, h: number): number {
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h)
  let best = 0, bestId = 0, id = 0
  for (let s = 0; s < w * h; s++) {
    if (!bin[s] || lab[s]) continue
    id++; let sp = 0, n = 0; stack[sp++] = s; lab[s] = id
    while (sp) {
      const p = stack[--sp], x = p % w; n++
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]
      for (const q of nb) if (q >= 0 && q < w * h && bin[q] && !lab[q]) { lab[q] = id; stack[sp++] = q }
    }
    if (n > best) { best = n; bestId = id }
  }
  for (let p = 0; p < w * h; p++) bin[p] = lab[p] === bestId ? 1 : 0
  return best
}
