import { describe, it, expect } from 'vitest'
import { normalizeSupportPhone, supportPhoneError } from '@/features/settings/lib/supportPhone'

describe('normalizeSupportPhone', () => {
  it('retire les séparateurs et garde le +', () => {
    expect(normalizeSupportPhone(' +33 (6) 12.34-56 78 ')).toBe('+33612345678')
  })
  it('convertit le préfixe 00 en +', () => {
    expect(normalizeSupportPhone('0033612345678')).toBe('+33612345678')
  })
  it('rend une chaîne vide pour une saisie absente ou blanche', () => {
    expect(normalizeSupportPhone(undefined)).toBe('')
    expect(normalizeSupportPhone(null)).toBe('')
    expect(normalizeSupportPhone('   ')).toBe('')
  })
})

describe('supportPhoneError', () => {
  it('accepte le vide et un numéro international', () => {
    expect(supportPhoneError('')).toBeNull()
    expect(supportPhoneError('+33 6 12 34 56 78')).toBeNull()
    expect(supportPhoneError('+221771234567')).toBeNull()
  })
  it('refuse sans indicatif, avec des lettres, trop court ou trop long', () => {
    for (const bad of ['0612345678', '+33abc12345', '+3361', '+0612345678', '+3361234567890123']) {
      expect(supportPhoneError(bad)).toContain('format international')
    }
  })
})
