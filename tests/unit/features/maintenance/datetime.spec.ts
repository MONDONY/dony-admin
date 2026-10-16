import { describe, it, expect } from 'vitest'
import { formatLocal, isoToLocalInput, localInputToIso } from '@/features/maintenance/utils/datetime'

describe('datetime maintenance', () => {
  it('aller-retour heure locale ↔ ISO UTC', () => {
    const local = '2026-10-16T14:30'
    const iso = localInputToIso(local)
    expect(iso).toMatch(/Z$/)
    expect(isoToLocalInput(iso)).toBe(local)
  })

  it('valeurs vides ou invalides', () => {
    expect(localInputToIso('')).toBeNull()
    expect(localInputToIso('pas une date')).toBeNull()
    expect(isoToLocalInput(null)).toBe('')
    expect(isoToLocalInput('n/a')).toBe('')
    expect(formatLocal(null)).toBe('')
    expect(formatLocal('n/a')).toBe('')
  })

  it('format court en heure locale', () => {
    const iso = localInputToIso('2026-10-16T09:05')
    expect(formatLocal(iso)).toBe('16/10 à 09:05')
  })
})
