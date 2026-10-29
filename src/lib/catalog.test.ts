import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CARS, WHEELS } from './catalog'
import { DISC_SPECS, RIM_SPECS } from './rims'

const BUILTIN = ['stock', 'spoke5', 'mesh', 'turbine', 'split', 'disc']

describe('wheel catalogue', () => {
  it('has unique ids', () => {
    const ids = WHEELS.map(w => w.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every wheel is either built in or has a shared spec', () => {
    const known = new Set([...BUILTIN, ...RIM_SPECS.map(r => r.id), ...DISC_SPECS.map(d => d.id)])
    for (const w of WHEELS) expect(known.has(w.id), w.id).toBe(true)
  })

  it('every spec is listed in the catalogue (nothing drawn but unreachable)', () => {
    const ids = new Set(WHEELS.map(w => w.id))
    for (const r of [...RIM_SPECS, ...DISC_SPECS]) expect(ids.has(r.id), r.id).toBe(true)
  })

  it('spoke polygons are well formed (fractions of the rim radius)', () => {
    for (const r of RIM_SPECS) {
      expect(r.groups.length, r.id).toBeGreaterThan(0)
      for (const g of r.groups) {
        expect(g.n, r.id).toBeGreaterThan(0)
        expect(g.pts.length, r.id).toBeGreaterThanOrEqual(3)
        for (const [x, rad] of g.pts) {
          expect(Math.abs(x), r.id).toBeLessThan(0.3)
          expect(rad, r.id).toBeGreaterThan(0.05)
          expect(rad, r.id).toBeLessThanOrEqual(1)
        }
      }
    }
    for (const d of DISC_SPECS) {
      expect(d.holes).toBeGreaterThan(2)
      expect(d.at + d.hr).toBeLessThan(0.95) // holes stay inside the plate
    }
  })
})

describe('car picker', () => {
  it('has unique ids and the concept car first', () => {
    const ids = CARS.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('concept')
  })

  it('every low-poly car has its GLB, a valid palette cell and a credit', () => {
    for (const c of CARS.filter(c => c.id !== 'concept')) {
      expect(existsSync(`public/models/lowpoly/${c.id}.glb`), c.id).toBe(true)
      const [col, row] = c.paint as readonly [number, number]
      expect(col >= 0 && col < 8 && row >= 0 && row < 4, c.id).toBe(true)
      expect(c.credit).toMatch(/CC0/)
    }
  })

  it('the palette texture the GLBs point at ships next to them, with the licence', () => {
    expect(existsSync('public/models/lowpoly/Textures/colormap.png')).toBe(true)
    expect(readFileSync('public/models/lowpoly/LICENSE-Kenney-CC0.txt', 'utf8')).toMatch(/Creative Commons Zero/)
    // GLB = 12-byte header + JSON chunk; the image must be referenced as Textures/colormap.png
    const glb = readFileSync('public/models/lowpoly/sedan.glb')
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'))
    expect(json.images[0].uri).toBe('Textures/colormap.png')
  })
})
