import { describe, it, expect } from 'vitest'
import {
  packageRequestStatusMeta, negotiationStatusMeta, isActiveNegotiation, removeBlockedExplanation,
  isActiveShipmentBlock, parcelSizeLabel, transportModeLabel, paymentMethodsLabel,
  reportStatusLabelMeta, dateToleranceLabel,
} from '@/features/package-requests/labels'
import { PACKAGE_REQUEST_STATUSES } from '@/features/package-requests/types/index'
import { PACKAGE_REQUEST_REMOVAL_REASONS, REMOVAL_REASONS } from '@/features/bids/removalReasons'

describe('packageRequestStatusMeta', () => {
  it('chaque statut connu a un libellé français', () => {
    for (const s of PACKAGE_REQUEST_STATUSES) expect(packageRequestStatusMeta(s).label).not.toBe(s)
  })
  it('retirée par un admin : « Retirée », ton danger', () => {
    expect(packageRequestStatusMeta('REMOVED_BY_ADMIN')).toEqual({ label: 'Retirée', tone: 'danger' })
  })
  it('ouverte : ton succès', () => {
    expect(packageRequestStatusMeta('OPEN')).toEqual({ label: 'Ouverte', tone: 'success' })
  })
  it('statut inconnu affiché brut', () => {
    expect(packageRequestStatusMeta('ARCHIVED')).toEqual({ label: 'ARCHIVED', tone: 'neutral' })
  })
})

describe('négociations', () => {
  it('libellé et activité', () => {
    expect(negotiationStatusMeta('OPEN').label).toBe('En cours')
    expect(negotiationStatusMeta('CANCELLED').label).toBe('Annulée')
    expect(negotiationStatusMeta('WHATEVER')).toEqual({ label: 'WHATEVER', tone: 'neutral' })
    expect(isActiveNegotiation('AWAITING_PAYMENT')).toBe(true)
    expect(isActiveNegotiation('REJECTED')).toBe(false)
  })
})

describe('removeBlockedExplanation', () => {
  it('envoi en cours : renvoie vers les litiges, quelle que soit la forme du code', () => {
    for (const code of ['package-request-has-active-shipment', 'HAS_ACTIVE_SHIPMENT', 'active-shipment']) {
      expect(removeBlockedExplanation(code)).toMatch(/litiges/)
      expect(isActiveShipmentBlock(code)).toBe(true)
    }
  })
  it('déjà retirée', () => {
    expect(removeBlockedExplanation('ALREADY_REMOVED')).toBe('Cette demande est déjà retirée.')
    expect(isActiveShipmentBlock('ALREADY_REMOVED')).toBe(false)
  })
  it('brouillon et terminée : explications dédiées', () => {
    expect(removeBlockedExplanation('package-request-draft')).toBe('Cette demande est un brouillon jamais publié : il n’y a rien à retirer.')
    expect(removeBlockedExplanation('package-request-completed')).toBe('Cette demande est terminée (colis livré) : elle ne peut plus être retirée.')
    expect(removeBlockedExplanation('package-request-already-removed')).toBe('Cette demande est déjà retirée.')
    expect(isActiveShipmentBlock('package-request-draft')).toBe(false)
  })
  it('statut d’un signalement : libellé de la page Signalements, inconnu brut', () => {
    expect(reportStatusLabelMeta('OPEN')).toEqual({ label: 'Ouvert', tone: 'warning' })
    expect(reportStatusLabelMeta('RESOLVED').label).toBe('Résolu')
    expect(reportStatusLabelMeta('ESCALATED')).toEqual({ label: 'ESCALATED', tone: 'neutral' })
  })
  it('tolérance de date', () => {
    expect(dateToleranceLabel(0)).toBe('Date exacte')
    expect(dateToleranceLabel(1)).toBe('± 1 jour')
    expect(dateToleranceLabel(3)).toBe('± 3 jours')
    expect(dateToleranceLabel(undefined)).toBe('Date exacte')
  })
  it('code inconnu : explication générique qui garde le code', () => {
    expect(removeBlockedExplanation('SOMETHING_NEW')).toBe('Retrait impossible pour le moment (SOMETHING_NEW).')
  })
  it('sans code', () => {
    expect(removeBlockedExplanation(null)).toBe('Retrait impossible pour le moment.')
    expect(isActiveShipmentBlock(null)).toBe(false)
  })
})

describe('libellés de fiche', () => {
  it('taille, mode de transport, moyens de paiement', () => {
    expect(parcelSizeLabel('SMALL')).toBe('Petit (5 kg max)')
    expect(parcelSizeLabel('XXL')).toBe('XXL')
    expect(parcelSizeLabel(null)).toBe('Non renseignée')
    expect(transportModeLabel('PLANE')).toBe('Avion')
    expect(transportModeLabel('ROCKET')).toBe('ROCKET')
    expect(transportModeLabel(null)).toBe('Indifférent')
    expect(paymentMethodsLabel(['STRIPE', 'CASH', 'PAWAPAY'])).toBe('Carte, Espèces, Mobile money')
    expect(paymentMethodsLabel([])).toBe('Non renseignés')
    expect(paymentMethodsLabel(undefined)).toBe('Non renseignés')
  })
})

describe('catalogue des motifs publics', () => {
  it('valeurs exactes de AnnouncementRemovalReason (yadony-back #333)', () => {
    expect(PACKAGE_REQUEST_REMOVAL_REASONS.map((r) => r.value)).toEqual([
      'PROHIBITED_ITEM', 'SUSPECTED_FRAUD', 'INAPPROPRIATE_CONTENT', 'MISLEADING_INFO', 'DUPLICATE', 'OTHER',
    ])
  })
  it('mêmes valeurs que le retrait d’annonce (même enum côté back)', () => {
    expect(PACKAGE_REQUEST_REMOVAL_REASONS.map((r) => r.value)).toEqual(REMOVAL_REASONS.map((r) => r.value))
  })
  it('le doublon parle de demande, pas d’annonce', () => {
    expect(PACKAGE_REQUEST_REMOVAL_REASONS.find((r) => r.value === 'DUPLICATE')?.label).toBe('Demande en double')
    expect(REMOVAL_REASONS.find((r) => r.value === 'DUPLICATE')?.label).toBe('Annonce en double')
  })
})
