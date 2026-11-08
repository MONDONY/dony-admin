import { describe, it, expect } from 'vitest'
import {
  AFRICA_DEFAULT_CALLING_CODES,
  callingCodeLabel,
  callingCodesError,
  countryName,
  diffCallingCodes,
  newCallingCodeError,
  normalizeCallingCodes,
  parseCallingCodes,
  serializeCallingCodes,
} from '@/features/settings/lib/callingCodes'

describe('callingCodes', () => {
  it('nomme en français chaque indicatif de la liste Afrique et les pays de départ', () => {
    for (const code of parseCallingCodes(AFRICA_DEFAULT_CALLING_CODES)) {
      expect(countryName(code), code).not.toBeNull()
    }
    for (const code of ['33', '32', '41', '352', '49', '39', '34', '351', '44', '31', '1']) {
      expect(countryName(code), code).not.toBeNull()
    }
    expect(callingCodeLabel('225')).toBe('+225 Côte d’Ivoire')
    expect(callingCodeLabel('221')).toBe('+221 Sénégal')
    expect(callingCodeLabel('33')).toBe('+33 France')
  })

  it('retombe sur « +xxx » pour un indicatif inconnu', () => {
    expect(countryName('999')).toBeNull()
    expect(callingCodeLabel('999')).toBe('+999')
  })

  it('lit la chaîne du back : retire « + », espaces, doublons et éléments vides, garde l’ordre', () => {
    expect(parseCallingCodes('+225, 221 ,225,,33')).toEqual(['225', '221', '33'])
    expect(parseCallingCodes('')).toEqual([])
    expect(parseCallingCodes(null)).toEqual([])
    expect(parseCallingCodes(undefined)).toEqual([])
    expect(serializeCallingCodes(['225', '221'])).toBe('225,221')
    expect(normalizeCallingCodes(' +225 ,221,225')).toBe('225,221')
  })

  it('valide un indicatif à ajouter : chiffres, 1 à 4, pas de doublon, 60 au plus', () => {
    expect(newCallingCodeError('', [])).toBeNull()
    expect(newCallingCodeError('225', [])).toBeNull()
    expect(newCallingCodeError('+ 225', [])).toBeNull()
    expect(newCallingCodeError('22a', [])).toContain('1 à 4 chiffres')
    expect(newCallingCodeError('12345', [])).toContain('1 à 4 chiffres')
    expect(newCallingCodeError('225', ['225'])).toBe('+225 Côte d’Ivoire est déjà dans la liste.')
    const full = Array.from({ length: 60 }, (_, i) => String(1000 + i))
    expect(newCallingCodeError('7', full)).toBe('60 indicatifs au plus.')
  })

  it('valide la liste entière à enregistrer', () => {
    expect(callingCodesError('')).toBeNull()
    expect(callingCodesError(AFRICA_DEFAULT_CALLING_CODES)).toBeNull()
    expect(callingCodesError('225,abc')).toBe('Indicatif invalide : « abc » (1 à 4 chiffres).')
    expect(callingCodesError('12345')).toContain('12345')
    const tooMany = Array.from({ length: 61 }, (_, i) => String(1000 + i)).join(',')
    expect(callingCodesError(tooMany)).toBe('60 indicatifs au plus.')
  })

  it('décrit ce qui change entre deux listes', () => {
    expect(diffCallingCodes('225,221', '221,33')).toEqual({ removed: ['225'], added: ['33'] })
    expect(diffCallingCodes('', '225')).toEqual({ removed: [], added: ['225'] })
    expect(diffCallingCodes('225', null)).toEqual({ removed: ['225'], added: [] })
  })
})
