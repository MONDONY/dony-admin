import { describe, it, expect } from 'vitest'
import { NAV_GROUPS, ALL_NAV_ENTRIES, resolveActiveEntry, resolveActiveGroup } from '@/components/layout/navConfig'

describe('navConfig', () => {
  it('chaque domaine a une icône et un nom court qui tient sous l’icône du rail', () => {
    for (const g of NAV_GROUPS) {
      expect(g.icon).toBeTruthy()
      expect(g.railLabel.length).toBeLessThanOrEqual(8)
    }
  })

  it('les routes du menu sont uniques', () => {
    const tos = ALL_NAV_ENTRIES.map(e => e.to)
    expect(new Set(tos).size).toBe(tos.length)
  })

  it('la déclaration DAC7 est dans le domaine Argent, sous le droit DAC7_REPORT', () => {
    const e = ALL_NAV_ENTRIES.find(x => x.to === '/dac7')
    expect(e?.permission).toBe('DAC7_REPORT')
    expect(e?.label).toBe('Déclaration DAC7')
    expect(resolveActiveGroup('/dac7')?.id).toBe('money')
  })

  describe('resolveActiveEntry', () => {
    it('route exacte', () => {
      expect(resolveActiveEntry('/colis')?.to).toBe('/colis')
    })
    it('sous-page : reste dans l’entrée racine', () => {
      expect(resolveActiveEntry('/users/abc-123')?.to).toBe('/users')
      expect(resolveActiveEntry('/transactions/x/y')?.to).toBe('/transactions')
    })
    it('la plus spécifique gagne', () => {
      expect(resolveActiveEntry('/users/rgpd')?.to).toBe('/users/rgpd')
    })
    it('l’accueil ne couvre que « / »', () => {
      expect(resolveActiveEntry('/')?.to).toBe('/')
      expect(resolveActiveEntry('/inconnu')).toBeNull()
    })
    it('ne confond pas un préfixe de texte avec un segment', () => {
      expect(resolveActiveEntry('/usersx')).toBeNull()
    })
    it('chemin absent', () => {
      expect(resolveActiveEntry(undefined)).toBeNull()
    })
  })

  describe('resolveActiveGroup', () => {
    it('donne le domaine de la page', () => {
      expect(resolveActiveGroup('/users/rgpd')?.id).toBe('accounts')
      expect(resolveActiveGroup('/transactions')?.id).toBe('money')
      expect(resolveActiveGroup('/audit')?.id).toBe('system')
    })
    it('accueil et pages hors menu : aucun domaine', () => {
      expect(resolveActiveGroup('/')).toBeNull()
      expect(resolveActiveGroup('/change-password')).toBeNull()
    })
  })
})
