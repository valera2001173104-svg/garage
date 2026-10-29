/**
 * Catalogue rim designs shared by the 3D wheel (src/scene/Wheel.tsx) and the 2D photo overlay (src/scan/engine.ts).
 * These are original shapes drawn for GARAGE, built from common wheel archetypes (multi-spoke, twin-spoke, Y-spoke, mesh…).
 * They are not copies of any manufacturer's wheel and carry no brand names.
 *
 * Coordinates are fractions of the rim radius: x across the spoke, r outward from the centre (0 = hub, 1 = rim edge).
 */
export type SpokeGroup = { n: number; pts: [number, number][]; off?: number }
export type RimSpec = {
  id: string
  name: string
  groups: SpokeGroup[]
  /** extra circular rings at these radii */
  rings?: number[]
  /** decorative bolts on the outer lip (three-piece look) */
  bolts?: number
}

const spoke = (w0: number, w1: number, r0 = 0.2, r1 = 0.96): [number, number][] => [[-w0, r0], [w0, r0], [w1, r1], [-w1, r1]]

export const RIM_SPECS: RimSpec[] = [
  { id: 'multi10', name: 'Ten Spoke', groups: [{ n: 10, pts: spoke(0.05, 0.075) }] },
  { id: 'twin5', name: 'Twin Five', groups: [{ n: 5, off: 0.13, pts: spoke(0.05, 0.065) }, { n: 5, off: -0.13, pts: spoke(0.05, 0.065) }] },
  { id: 'star6', name: 'Star Six', groups: [{ n: 6, pts: spoke(0.1, 0.055) }] },
  { id: 'blade8', name: 'Blade', groups: [{ n: 8, pts: [[-0.03, 0.2], [0.11, 0.2], [0.22, 0.96], [0.08, 0.96]] }] },
  {
    id: 'y7', name: 'Y Spoke',
    groups: [{ n: 7, pts: [[-0.06, 0.2], [0.06, 0.2], [0.06, 0.56], [0.22, 0.96], [0.1, 0.96], [0, 0.7], [-0.1, 0.96], [-0.22, 0.96], [-0.06, 0.56]] }]
  },
  { id: 'cross6', name: 'Lattice', bolts: 24, groups: [{ n: 6, off: 0.2, pts: spoke(0.035, 0.035) }, { n: 6, off: -0.2, pts: spoke(0.035, 0.035) }], rings: [0.58] },
  { id: 'mono6', name: 'Wide Six', bolts: 18, groups: [{ n: 6, pts: spoke(0.13, 0.16) }] },
  { id: 'fan12', name: 'Fan', groups: [{ n: 12, pts: [[-0.03, 0.2], [0.035, 0.2], [0.115, 0.96], [0.05, 0.96]] }] }
]

/** plate-style designs: a solid face with a ring of holes */
export type DiscSpec = { id: string; name: string; holes: number; at: number; hr: number }
export const DISC_SPECS: DiscSpec[] = [{ id: 'classic', name: 'Classic Eight', holes: 8, at: 0.7, hr: 0.13 }]
