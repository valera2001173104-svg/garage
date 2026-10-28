// Stability AI "Edit → Inpaint" (https://api.stability.ai/v2beta/stable-image/edit/inpaint).
// White pixels of the mask are regenerated. Enabled only when STABILITY_API_KEY is set.
const URL_ = 'https://api.stability.ai/v2beta/stable-image/edit/inpaint'

/** @type {import('./types.js').ImageEditProvider} */
export const stability = {
  id: 'stability',
  label: 'Stability AI · Inpaint',
  configured: () => !!process.env.STABILITY_API_KEY,
  presets: [
    { id: 'bodykit', name: 'Обвес', prompt: 'aggressive widebody kit with carbon fiber fender flares, photorealistic, same car, same lighting' },
    { id: 'spoiler', name: 'Спойлер', prompt: 'add a GT-style rear wing spoiler on the trunk, photorealistic, matching paint, same lighting' },
    { id: 'bumper', name: 'Бампер', prompt: 'sporty front bumper with larger air intakes and splitter, photorealistic, same car' },
    { id: 'style', name: 'Стиль', prompt: 'matte black stealth styling with subtle accents, photorealistic, same car, same environment' }
  ],
  async edit({ image, mask, prompt, signal }) {
    const fd = new FormData()
    fd.append('image', new Blob([image], { type: 'image/png' }), 'image.png')
    fd.append('mask', new Blob([mask], { type: 'image/png' }), 'mask.png')
    fd.append('prompt', prompt)
    fd.append('output_format', 'png')
    const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${process.env.STABILITY_API_KEY}`, Accept: 'image/*' }, body: fd, signal })
    if (!r.ok) {
      let detail = ''
      try { const j = await r.json(); detail = j.errors?.join('; ') || j.message || '' } catch { /* ignore */ }
      const err = new Error(`Провайдер вернул ${r.status}${detail ? ': ' + detail : ''}`)
      err.status = r.status === 401 || r.status === 403 ? 502 : r.status === 429 ? 429 : 502
      throw err
    }
    return { data: Buffer.from(await r.arrayBuffer()), mime: r.headers.get('content-type') || 'image/png' }
  }
}
