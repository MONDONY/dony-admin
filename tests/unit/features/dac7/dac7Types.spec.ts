import { describe, it, expect } from 'vitest'
import {
  blockerInfo, DAC7_BLOCKER_CODES, DAC7_FILTERS, diligenceActionLabel, eurLabel, identityMeta, residencyMeta,
  solicitationMeta, anomalyTypeLabel, refundSourceLabel, dac7CodeMessage, DAC7_NOTE_MAX, noteValid,
  yearOptions, countLabel, partialMayHelp, closedYears, identityHint, defaultYear, currentUtcYear, NOT_AVAILABLE,
} from '@/features/dac7/types/index'

describe('blocages', () => {
  it('chaque code du contrat a une explication française complète', () => {
    expect(DAC7_BLOCKER_CODES).toEqual([
      'IDENTITY_INCOMPLETE', 'TAX_INFO_MISSING', 'EUR_INCOMPLETE', 'COMMISSION_INCOMPLETE',
      'INVALID_PARTNER_JURISDICTION', 'NO_SELLERS', 'OPERATOR_CONFIG_MISSING',
      'IDENTITY_UNAVAILABLE', 'PENDING_SPLITS', 'XSD_INVALID',
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
    expect(info.title).toBe('Blocage non reconnu : NOUVEAU_CODE')
    expect(info.explanation).toMatch(/pas connu de cette version/i)
    expect(info.explanation).not.toMatch(/partiel/i)
  })
  it('les trois nouveaux blocages du back, expliqués en français', () => {
    expect(blockerInfo('IDENTITY_UNAVAILABLE').explanation).toBe('La vérification d’identité est temporairement indisponible pour certains voyageurs : réessayez plus tard.')
    expect(blockerInfo('PENDING_SPLITS').explanation).toBe('Des partages de colis décidés par l’équipe n’ont pas encore été versés aux voyageurs : attendez la fin des transferts.')
    expect(blockerInfo('XSD_INVALID').explanation).toBe('Le fichier n’est pas conforme au format de la DGFiP pour certains voyageurs : voir la liste.')
  })
  it('société déclarante non configurée : à régler côté serveur, sans suggérer le mode Partiel', () => {
    const info = blockerInfo('OPERATOR_CONFIG_MISSING')
    expect(info.explanation).toBe('Les informations de la société déclarante ne sont pas configurées côté serveur : contactez l’équipe technique.')
    expect(info.explanation).not.toMatch(/partiel/i)
  })
  it('le mode Partiel n’est proposé que pour des blocages connus qu’il contourne', () => {
    expect(partialMayHelp(['TAX_INFO_MISSING'])).toBe(true)
    expect(partialMayHelp(['TAX_INFO_MISSING', 'IDENTITY_INCOMPLETE'])).toBe(true)
    expect(partialMayHelp([])).toBe(false)
    expect(partialMayHelp(['IDENTITY_UNAVAILABLE', 'PENDING_SPLITS', 'XSD_INVALID'])).toBe(true)
    expect(partialMayHelp(['NO_SELLERS'])).toBe(false)
    expect(partialMayHelp(['OPERATOR_CONFIG_MISSING'])).toBe(false)
    expect(partialMayHelp(['TAX_INFO_MISSING', 'OPERATOR_CONFIG_MISSING'])).toBe(false)
    expect(partialMayHelp(['TAX_INFO_MISSING', 'INCONNU'])).toBe(false)
  })
})

describe('libellés', () => {
  it('filtres du contrat, dans l’ordre', () => {
    expect(DAC7_FILTERS.map(f => f.value)).toEqual(['ALL', 'MISSING_TAX_INFO', 'IDENTITY_REVIEW', 'UNKNOWN_RESIDENCE', 'NON_DECLARABLE'])
    expect(DAC7_FILTERS.map(f => f.label)).toEqual(['Tous', 'Numéro fiscal manquant', 'Identité à revoir', 'Résidence inconnue', 'Non déclarables'])
  })
  it('résidence, identité, sollicitation', () => {
    expect(identityMeta('UNAVAILABLE').label).toBe('Indisponible')
    expect(identityHint('UNAVAILABLE')).toBe('Lecture d’identité indisponible, réessayez plus tard')
    expect(identityHint('COMPLETE')).toBeNull()
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
    expect(anomalyTypeLabel('RATE_DATE_ESTIMATED')).toMatch(/dernier taux/i)
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
    expect(eurLabel(undefined)).toBe('n/d')
    expect(eurLabel(null)).toBe('n/d')
    expect(NOT_AVAILABLE).toBe('n/d')
  })
  it('compteur : n/d quand le serveur ne l’envoie pas, 0 quand il envoie zéro', () => {
    expect(countLabel(undefined)).toBe('n/d')
    expect(countLabel(0)).toBe('0')
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
    expect(dac7CodeMessage('dac7-year-not-closed')).toBe('Le récapitulatif d’une année ne peut être envoyé qu’après la fin de cette année.')
    expect(dac7CodeMessage('dac7-unencrypted-not-allowed')).toBe('L’export non chiffré est refusé en production : configurez la clé de la DGFiP.')
    expect(dac7CodeMessage('dac7-note-sensitive')).toBe('La note semble contenir un numéro : retirez-le.')
    expect(dac7CodeMessage('dac7-reminders-exhausted')).toBe('Demande et deux rappels déjà envoyés.')
    expect(dac7CodeMessage('dac7-collection-disabled')).toBe('La collecte est éteinte : aucun message ne peut être envoyé.')
    expect(dac7CodeMessage('autre')).toBeNull()
    expect(dac7CodeMessage(null)).toBeNull()
  })
})

describe('années', () => {
  it('l’année UTC courante et les deux précédentes, la plus récente d’abord', () => {
    expect(yearOptions(2026)).toEqual([2026, 2025, 2024])
    expect(yearOptions(2024)).toEqual([2024, 2023])
    expect(yearOptions(2023)).toEqual([2023])
    expect(yearOptions(2022)).toEqual([2023])
  })
  it('années terminées : les trois dernières avant l’année UTC', () => {
    expect(closedYears(2026)).toEqual([2025, 2024, 2023])
    expect(closedYears(2025)).toEqual([2024, 2023])
    expect(closedYears(2023)).toEqual([])
    expect(closedYears(2030)).toEqual([2029, 2028, 2027])
  })
  it('année par défaut : l’année courante, sauf en janvier (l’année écoulée)', () => {
    expect(defaultYear(new Date('2026-11-11T10:00:00Z'))).toBe(2026)
    expect(defaultYear(new Date('2026-12-31T23:59:59Z'))).toBe(2026)
    expect(defaultYear(new Date('2027-01-01T00:00:00Z'))).toBe(2026)
    expect(defaultYear(new Date('2027-01-31T12:00:00Z'))).toBe(2026)
    expect(defaultYear(new Date('2027-02-01T00:00:00Z'))).toBe(2027)
    expect(defaultYear(new Date('2023-01-10T00:00:00Z'))).toBe(2023)
  })
  it('l’année se lit en UTC : le 1er janvier à 0 h 30 heure de Paris, le serveur est encore en 2026', () => {
    expect(currentUtcYear(new Date('2026-12-31T23:30:00Z'))).toBe(2026)
    expect(yearOptions(currentUtcYear(new Date('2026-12-31T23:30:00Z')))[0]).toBe(2026)
  })
})
