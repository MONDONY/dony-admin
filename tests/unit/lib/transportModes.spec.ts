import { describe, expect, it } from 'vitest'
import { Car, Plane, Route, Ship } from 'lucide-vue-next'
import {
  REQUEST_MODE_FILTERS, TRIP_MODE_FILTERS, modeFilterIgnored, requestTransportLabel, transportModeIcon, tripTransportLabel,
} from '@/lib/transportModes'

describe('transportModes', () => {
  it('CAR et BUS se lisent Route', () => {
    expect(tripTransportLabel('CAR')).toBe('Route')
    expect(tripTransportLabel('BUS')).toBe('Route')
    expect(tripTransportLabel('PLANE')).toBe('Avion')
    expect(tripTransportLabel('BOAT')).toBe('Bateau')
    expect(tripTransportLabel('TRAIN')).toBe('Train')
    expect(tripTransportLabel('OTHER')).toBe('Autre')
  })
  it('trajet : absent = null, inconnu = valeur humanisée', () => {
    expect(tripTransportLabel(null)).toBeNull()
    expect(tripTransportLabel(undefined)).toBeNull()
    expect(tripTransportLabel('SOME_MODE')).toBe('Some mode')
  })
  it('demande sans mode = Peu importe, champ absent = vide, inconnu = brut', () => {
    expect(requestTransportLabel(null)).toBe('Peu importe')
    expect(requestTransportLabel('')).toBe('Peu importe')
    expect(requestTransportLabel(undefined)).toBe('')
    expect(requestTransportLabel('BUS')).toBe('Route')
    expect(requestTransportLabel('ROCKET')).toBe('ROCKET')
  })
  it('icône par mode', () => {
    expect(transportModeIcon('PLANE')).toBe(Plane)
    expect(transportModeIcon('BOAT')).toBe(Ship)
    expect(transportModeIcon('CAR')).toBe(Car)
    expect(transportModeIcon('BUS')).toBe(Car)
    expect(transportModeIcon('TRAIN')).toBe(Route)
    expect(transportModeIcon('ROCKET')).toBe(Route)
    expect(transportModeIcon(null)).toBe(Route)
    expect(transportModeIcon(undefined)).toBe(Route)
  })
  it('puces de filtre', () => {
    expect(TRIP_MODE_FILTERS.map((o) => o.value)).toEqual(['ALL', 'PLANE', 'BOAT', 'CAR'])
    expect(REQUEST_MODE_FILTERS.map((o) => o.label)).toEqual(['Tous', 'Avion', 'Bateau', 'Route', 'Peu importe'])
  })
  it('filtre ignoré par un ancien back', () => {
    expect(modeFilterIgnored([{ transportMode: 'PLANE' }], 'BOAT')).toBe(true)
    expect(modeFilterIgnored([{ transportMode: 'BUS' }], 'CAR')).toBe(false)
    expect(modeFilterIgnored([{ transportMode: 'CAR' }], 'CAR')).toBe(false)
    expect(modeFilterIgnored([{}], 'PLANE')).toBe(true)
    expect(modeFilterIgnored([{ transportMode: 'PLANE' }], 'ALL')).toBe(false)
    expect(modeFilterIgnored([], 'PLANE')).toBe(false)
  })
  it('filtre ANY : seules les lignes sans mode le respectent', () => {
    expect(modeFilterIgnored([{ transportMode: null }], 'ANY')).toBe(false)
    expect(modeFilterIgnored([{ transportMode: 'PLANE' }], 'ANY')).toBe(true)
  })
})
