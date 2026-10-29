import { DISC_SPECS, RIM_SPECS } from './rims'

export const BODY_COLORS = [
  { name: 'Pearl White', hex: '#e9e9e4' }, { name: 'Nardo Grey', hex: '#7A7F83' }, { name: 'Gunmetal', hex: '#3b4249' },
  { name: 'Midnight', hex: '#14181d' }, { name: 'Cobalt', hex: '#1f4fc4' }, { name: 'Racing Red', hex: '#c8202a' },
  { name: 'Sunset Orange', hex: '#e8641b' }, { name: 'Yellow Hammer', hex: '#f0c419' }, { name: 'Forest', hex: '#1f4d3a' },
  { name: 'Mint', hex: '#3d9c87' }, { name: 'Violet', hex: '#6a3fb5' }, { name: 'Magenta', hex: '#c01c7c' }
]
export const WHEEL_COLORS = [
  { name: 'Graphite', hex: '#2a2e32' }, { name: 'Silver', hex: '#c4c9cc' }, { name: 'Gloss Black', hex: '#0a0b0c' },
  { name: 'Gold', hex: '#c9a24a' }, { name: 'Bronze', hex: '#7b5a3a' }, { name: 'White', hex: '#eeeeee' }, { name: 'Mint', hex: '#4FE0C0' }
]
export const CALIPER_COLORS = [
  { name: 'Racing Red', hex: '#b3202a' }, { name: 'Yellow', hex: '#e8b916' }, { name: 'Orange', hex: '#e2601c' }, { name: 'Lime', hex: '#8fbf2a' },
  { name: 'Blue', hex: '#1f4fc4' }, { name: 'Black', hex: '#141619' }, { name: 'Silver', hex: '#b9bec2' }, { name: 'Mint', hex: '#3d9c87' }
]
export const INTERIOR_COLORS = [
  { name: 'Carmine', hex: '#7a0d0d' }, { name: 'Black', hex: '#141414' }, { name: 'Tan', hex: '#b08158' }, { name: 'Cognac', hex: '#7a4321' },
  { name: 'Stone Grey', hex: '#8a8d8f' }, { name: 'Navy', hex: '#1d2a44' }, { name: 'Ivory', hex: '#e6dfcf' }, { name: 'Racing Green', hex: '#1f3d2c' }
]
export const WHEELS = [
  { id: 'stock', name: 'Stock' }, { id: 'spoke5', name: 'Five Spoke' }, { id: 'mesh', name: 'Mesh' }, { id: 'turbine', name: 'Turbine' },
  { id: 'split', name: 'Split Ten' }, { id: 'disc', name: 'Aero Disc' },
  ...RIM_SPECS.map(r => ({ id: r.id, name: r.name })), ...DISC_SPECS.map(r => ({ id: r.id, name: r.name }))
]
export const SUSPENSION = [
  { id: 'show', name: 'Шоу', v: 0 }, { id: 'sport', name: 'Спорт', v: 0.28 }, { id: 'street', name: 'Комфорт', v: 0.5 }
]
export const VIEWS = [
  { id: 'front', name: 'Спереди' }, { id: 'rear', name: 'Сзади' }, { id: 'side', name: 'Сбоку' }, { id: 'three', name: '¾' }
] as const
export const DEFAULT_CONFIG = {
  color: '#3b4249', finish: 'metallic', wheel: 'stock', wheelColor: '#2a2e32', rideHeight: 0.5,
  headlights: true, taillights: true, spoiler: 'none', splitter: false, skirts: false, canards: false, diffuser: 'none', env: 'studio', accent: null, caliper: null, interior: null, tint: 0, livery: 'none', liveryColor: '#f2f2ee'
} as const
export const LIVERIES = [
  { id: 'none', name: 'Нет' }, { id: 'twin', name: 'Двойные' }, { id: 'wide', name: 'Широкая' }, { id: 'side', name: 'Боковая' }
] as const
export const LIVERY_COLORS = [
  { name: 'White', hex: '#f2f2ee' }, { name: 'Black', hex: '#111315' }, { name: 'Silver', hex: '#b9bec2' }, { name: 'Racing Red', hex: '#c8202a' },
  { name: 'Gulf Orange', hex: '#e8641b' }, { name: 'Yellow', hex: '#f0c419' }, { name: 'Gulf Blue', hex: '#8ec5e6' }, { name: 'Cobalt', hex: '#1f4fc4' }
]
/** v = share of light blocked; the name is the light that passes through, as tint film is sold */
export const TINTS = [
  { id: '0', name: 'Нет', v: 0 }, { id: '30', name: '70%', v: 0.3 }, { id: '65', name: '35%', v: 0.65 }, { id: '95', name: '5%', v: 0.95 }
]
