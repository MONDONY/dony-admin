import { describe, it, expect } from 'vitest'
import {
  blockerInfo, DAC7_BLOCKER_CODES, DAC7_FILTERS, diligenceActionLabel, eurLabel, identityMeta, residencyMeta,
  solicitationMeta, anomalyTypeLabel, refundSourceLabel, dac7CodeMessage, DAC7_NOTE_MAX, noteValid,
  yearOptions, countLabel,
} from '@/features/dac7/types/index'

describe('blocages', () => {
  it('chaque code du contrat a une explication française complète', () => {
    expect(DAC7_BLOCKER_CODES).toEqual([
      'IDENTITY_INCOMPLETE', 'TAX_INFO_MISSING', 'EUR_INCOMPLETE', 'COMMISSION_INCOMPLETE',
      'INVALID_PARTNER_JURISDICTION', 'NO_SELLERS',
    ])
    for (const code of DAC7_BLOCKER_CODES) {
      const info = blockerInfo(code)
      expect(info.title.length).toBeGreaterThan(3)
      expect(info.explanation.length).toBeGreaterThan(30)
      expect(info.explanation).not.toContain('—')
      expect(info.known).toBe(true)
    }
  })
  it('un code inconnu s’affiche tel quel, sans casser', () => {
    const info = blockerInfo('NOUVEAU_CODE')
    expect(info.known).toBe(false)
    expect(info.title).toBe('NOUVEAU_CODE')
    expect(info.explanation).toMatch(/pas connu de cette version/i)
  })
})

describe('libellés', () => {
  it('filtres du contrat, dans l’ordre', () => {
    expect(DAC7_FILTERS.map(f => f.value)).toEqual(['ALL', 'MISSING_TAX_INFO', 'IDENTITY_REVIEW', 'UNKNOWN_RESIDENCE', 'NON_DECLARABLE'])
    expect(DAC7_FILTERS.map(f => f.label)).toEqual(['Tous', 'Numéro fiscal manquant', 'Identité à revoir', 'Résidence inconnue', 'Non déclarables'])
  })
  it('résidence, identité, sollicitation', () => {
    expect(residencyMeta('DECLARABLE').label).toBe('Déclarable')
    expect(residencyMeta('NON_DECLARABLE').label).toBe('Non déclarable')
    expect(residencyMeta('RESIDENCE_INCONNUE').label).toBe('Résidence inconnue')
    expect(residencyMeta(undefined).label).toBe('Inconnu')
    expect(residencyMeta('AUTRE').label).toBe('AUTRE')
    expect(identityMeta('COMPLETE').label).toBe('Complète')
    expect(identityMeta('INCOMPLETE').label).toBe('À revoir')
    expect(identityMeta(undefined).label).toBe('Inconnue')
    expect(solicitationMeta('SOLLICITER').label).toBe('À solliciter')
    expect(solicitationMeta('DEJA_FOURNI').label).toBe('Déjà fourni')
    expect(solicitationMeta('NE_PAS_SOLLICITER').label).toBe('Ne pas solliciter')
    expect(solicitationMeta(null).label).toBe('Inconnu')
  })
  it('registre des diligences', () => {
    expect(diligenceActionLabel('REQUEST')).toBe('Demande envoyée')
    expect(diligenceActionLabel('REMINDER_1')).toBe('Premier rappel')
    expect(diligenceActionLabel('REMINDER_2')).toBe('Second rappel')
    expect(diligenceActionLabel('PROVIDED')).toBe('Numéro fiscal fourni')
    expect(diligenceActionLabel('TEAM_DECISION')).toBe('Décision de l’équipe')
    expect(diligenceActionLabel('X')).toBe('X')
    expect(diligenceActionLabel(undefined)).toBe('Action inconnue')
  })
  it('anomalies et remboursements', () => {
    expect(anomalyTypeLabel('EXCHANGE_RATE_MISSING')).toMatch(/taux de change/i)
    expect(anomalyTypeLabel('COMMISSION_UNKNOWN')).toMatch(/commission/i)
    expect(anomalyTypeLabel('REFUND_DATE_ESTIMATED')).toMatch(/remboursement/i)
    expect(anomalyTypeLabel('DELIVERY_DATE_ESTIMATED')).toMatch(/livraison/i)
    expect(anomalyTypeLabel('TRAVELER_UNKNOWN')).toMatch(/voyageur/i)
    expect(anomalyTypeLabel('Z')).toBe('Z')
    expect(anomalyTypeLabel(undefined)).toBe('Anomalie')
    expect(refundSourceLabel('PAYMENT')).toBe('Paiement')
    expect(refundSourceLabel('CASH')).toBe('Espèces')
    expect(refundSourceLabel('SUPPLEMENT')).toBe('Supplément')
    expect(refundSourceLabel('AMENDMENT')).toBe('Modification')
    expect(refundSourceLabel('Q')).toBe('Q')
    expect(refundSourceLabel(undefined)).toBe('Inconnue')
  })
  it('euros : format français, tiret quand absent', () => {
    // Intl met des espaces insécables (fines) : on compare à l'espace normal.
    expect(eurLabel(1234.5).replace(/\s/g, ' ')).toBe('1 234,50 €')
    expect(eurLabel(0).replace(/\s/g, ' ')).toBe('0,00 €')
    expect(eurLabel(undefined)).toBe('–')
    expect(eurLabel(null)).toBe('–')
  })
  it('compteur : 0 par défaut', () => {
    expect(countLabel(undefined)).toBe('0')
    expect(countLabel(12)).toBe('12')
  })
})

describe('décision et codes d’erreur', () => {
  it('note : 1 à 500 caractères après trim', () => {
    expect(DAC7_NOTE_MAX).toBe(500)
    expect(noteValid('')).toBe(false)
    expect(noteValid('   ')).toBe(false)
    expect(noteValid('ok')).toBe(true)
    expect(noteValid('a'.repeat(500))).toBe(true)
    expect(noteValid('a'.repeat(501))).toBe(false)
  })
  it('messages clairs des deux 409 de relance', () => {
    expect(dac7CodeMessage('dac7-not-solicitable')).toMatch(/pas sollicitable|ne peut pas être sollicité/i)
    expect(dac7CodeMessage('dac7-remind-too-soon')).toMatch(/7 jours/)
    expect(dac7CodeMessage('dac7-export-blocked')).toMatch(/bloqu/i)
    expect(dac7CodeMessage('autre')).toBeNull()
    expect(dac7CodeMessage(null)).toBeNull()
  })
})

describe('années', () => {
  it('de l’année courante à 2023, la plus récente d’abord', () => {
    expect(yearOptions(2026)).toEqual([2026, 2025, 2024, 2023])
    expect(yearOptions(2023)).toEqual([2023])
    expect(yearOptions(2022)).toEqual([2023])
  })
})
