import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, WHEELS } from './catalog'
import { parseBuild } from './share'

// same encoding as share.ts: JSON → base64url, behind "#build=1."
const enc = (o: unknown) => '#build=1.' + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const base = { ...DEFAULT_CONFIG }

describe('parseBuild: links are untrusted input', () => {
  it('round-trips a normal config', () => {
    const c = parseBuild(enc({ ...base, color: '#c8202a', wheel: 'y7', spoiler: 'swan', diffuser: 'race', canards: true, car: 'sedan' }))!
    expect(c.color).toBe('#c8202a')
    expect(c.wheel).toBe('y7')
    expect(c.spoiler).toBe('swan')
    expect(c.diffuser).toBe('race')
    expect(c.canards).toBe(true)
    expect(c.car).toBe('sedan')
  })

  it('accepts every wheel in the catalogue', () => {
    for (const w of WHEELS) expect(parseBuild(enc({ ...base, wheel: w.id }))!.wheel).toBe(w.id)
  })

  it('falls back to defaults for unknown or malicious values', () => {
    const c = parseBuild(enc({ ...base, wheel: '<script>', car: '../../etc/passwd', color: 'red', spoiler: 'rocket', diffuser: 'x', finish: 'chrome' }))!
    expect(c.wheel).toBe('stock')
    expect(c.car).toBe('concept')
    expect(c.color).toBe(DEFAULT_CONFIG.color)
    expect(c.spoiler).toBe('none')
    expect(c.diffuser).toBe('none')
    expect(c.finish).toBe(DEFAULT_CONFIG.finish)
  })

  it('clamps numbers into 0..1 and rejects NaN', () => {
    expect(parseBuild(enc({ ...base, tint: 7, rideHeight: -3 }))!.tint).toBe(1)
    expect(parseBuild(enc({ ...base, tint: 7, rideHeight: -3 }))!.rideHeight).toBe(0)
    expect(parseBuild(enc({ ...base, tint: 'x' }))!.tint).toBe(0)
  })

  it('returns null for garbage, wrong version, non-objects and oversized links', () => {
    expect(parseBuild('')).toBeNull()
    expect(parseBuild('#build=1.!!!not-base64')).toBeNull()
    expect(parseBuild('#build=2.' + enc(base).slice(9))).toBeNull()
    expect(parseBuild(enc('just a string'))).toBeNull()
    expect(parseBuild('#build=1.' + 'A'.repeat(5000))).toBeNull()
  })
})
