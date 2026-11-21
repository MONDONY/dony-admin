import { describe, expect, it } from 'vitest'
import {
  availableCapacityShort, capacityText, formatDimensionsCm, formatM3, pricePerUnit, priceUnit,
} from '@/lib/capacity'

describe('capacity', () => {
  it('formatM3 et dimensions : null sans donnée complète', () => {
    expect(formatM3(12.5)).toBe('12,5 m³')
    expect(formatM3(null)).toBeNull()
    expect(formatM3(undefined)).toBeNull()
    expect(formatDimensionsCm(40, 30, 20)).toBe('40 × 30 × 20 cm')
    expect(formatDimensionsCm(40, null, 20)).toBeNull()
  })
  it('capacité : kilos d’abord, sinon m³, jamais « null kg »', () => {
    expect(capacityText({ availableKg: 5, totalKg: 23 })).toBe('5 kg restants sur 23 kg')
    expect(capacityText({ availableKg: 5 })).toBe('5 kg restants')
    expect(capacityText({ totalKg: 23 })).toBe('23 kg')
    expect(capacityText({ availableKg: null, totalKg: null, availableVolumeM3: 12.5, volumeCapacityM3: 40 })).toBe('12,5 m³ restants sur 40 m³')
    expect(capacityText({ availableVolumeM3: 3 })).toBe('3 m³ restants')
    expect(capacityText({ volumeCapacityM3: 40 })).toBe('40 m³')
    expect(capacityText({})).toBeNull()
  })
  it('capacité courte', () => {
    expect(availableCapacityShort({ availableKg: 12 })).toBe('12 kg')
    expect(availableCapacityShort({ availableKg: null, availableVolumeM3: 12.5 })).toBe('12,5 m³')
    expect(availableCapacityShort({})).toBeNull()
  })
  it('prix unitaire : au kilo, au m³ ou rien', () => {
    expect(priceUnit({ pricePerKg: 8 })).toBe('kg')
    expect(priceUnit({ pricePerKg: null, pricePerM3: 90 })).toBe('m³')
    expect(priceUnit({})).toBeNull()
    expect(pricePerUnit({ pricePerKg: 8, pricePerM3: 90 })).toBe(8)
    expect(pricePerUnit({ pricePerM3: 90 })).toBe(90)
    expect(pricePerUnit({})).toBeNull()
  })
})
