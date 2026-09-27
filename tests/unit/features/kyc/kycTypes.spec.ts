import { describe, it, expect } from 'vitest'
import {
  KYC_DECISION_CODES, KYC_QUEUE_STATUS_TABS, formatWaiting, isOverdue, kycActorLabel, kycDecisionCodeLabel,
  kycDecisionCodeUserMessage, kycDecisionMeta, kycHistoryActionLabel, kycProviderLabel, kycStatusMeta,
  reasonLengthValid, KYC_APPROVE_REASON_MIN, KYC_REVOKE_REASON_MIN, KYC_REASON_MAX,
} from '@/features/kyc/types/index'

describe('types KYC', () => {
  it('ouvre la file sur « En attente de décision »', () => {
    expect(KYC_QUEUE_STATUS_TABS[0]).toEqual({ value: 'IN_REVIEW', label: 'En attente de décision' })
    expect(KYC_QUEUE_STATUS_TABS.map((t) => t.value)).toEqual(['IN_REVIEW', 'IN_PROGRESS', 'REJECTED', 'VERIFIED', 'NOT_STARTED'])
    expect(KYC_QUEUE_STATUS_TABS[1]!.label).toBe('Parcours en cours')
  })

  it('libellés de statut, PENDING compris, et repli sur le code brut', () => {
    expect(kycStatusMeta('IN_REVIEW')).toEqual({ label: 'En attente de décision', tone: 'warning' })
    expect(kycStatusMeta('PENDING').label).toBe('En cours chez le fournisseur')
    expect(kycStatusMeta('IN_PROGRESS')).toEqual({ label: 'Parcours en cours', tone: 'info' })
    expect(kycStatusMeta('VERIFIED').tone).toBe('success')
    expect(kycStatusMeta('REJECTED').tone).toBe('danger')
    expect(kycStatusMeta('NOT_STARTED').label).toBe('Non commencée')
    expect(kycStatusMeta('FUTUR')).toEqual({ label: 'FUTUR', tone: 'neutral' })
  })

  it('fournisseurs', () => {
    expect(kycProviderLabel('DIDIT')).toBe('Didit')
    expect(kycProviderLabel('STRIPE')).toBe('Stripe Identity')
    expect(kycProviderLabel(null)).toBe('Aucun')
    expect(kycProviderLabel('ONFIDO')).toBe('ONFIDO')
  })

  it('décisions admin', () => {
    expect(kycDecisionMeta('APPROVED')).toEqual({ label: 'Validée par un admin', tone: 'success' })
    expect(kycDecisionMeta('REJECTED').label).toBe('Refusée par un admin')
    expect(kycDecisionMeta('REVOKED').tone).toBe('danger')
    expect(kycDecisionMeta('AUTRE').label).toBe('AUTRE')
  })

  it('auteurs de l’historique', () => {
    expect(kycActorLabel('USER')).toBe('Utilisateur')
    expect(kycActorLabel('ADMIN')).toBe('Administrateur')
    expect(kycActorLabel('SYSTEM')).toBe('Système')
    expect(kycActorLabel('PROVIDER')).toBe('Fournisseur')
    expect(kycActorLabel('X')).toBe('X')
  })

  it('actions de l’historique : les douze actions du back sont traduites, les inconnues rendues lisibles', () => {
    const actions = [
      'KYC_SESSION_CREATED', 'KYC_SESSION_ABANDONED', 'KYC_VERIFIED', 'KYC_REJECTED', 'KYC_IN_REVIEW', 'KYC_ABANDONED',
      'KYC_EXPIRED', 'KYC_CANCELED', 'KYC_RESET_BY_ADMIN', 'KYC_VERIFIED_BY_ADMIN', 'KYC_REJECTED_BY_ADMIN', 'KYC_REVOKED_BY_ADMIN',
    ]
    const labels = actions.map(kycHistoryActionLabel)
    for (const [i, l] of labels.entries()) expect(l, actions[i]).not.toMatch(/^Kyc /)
    expect(new Set(labels).size).toBe(actions.length)
    expect(kycHistoryActionLabel('KYC_SESSION_CREATED')).toBe('Parcours de vérification commencé')
    expect(kycHistoryActionLabel('KYC_VERIFIED_BY_ADMIN')).toBe('Identité validée par un admin')
    expect(kycHistoryActionLabel('KYC_REVOKED_BY_ADMIN')).toBe('Identité révoquée par un admin')
    expect(kycHistoryActionLabel('SOME_NEW_ACTION')).toBe('Some new action')
  })

  it('catalogue local : exactement les 16 codes du back (KycRejectionCodes.ALL), avec libellé et message utilisateur', () => {
    expect(KYC_DECISION_CODES.map((c) => c.value)).toEqual([
      'document_expired', 'document_type_not_supported', 'document_unverified_other', 'country_not_supported',
      'id_number_insufficient_document_data', 'id_number_mismatch', 'id_number_unverified_other',
      'selfie_document_missing_photo', 'selfie_face_mismatch', 'selfie_manipulated', 'selfie_unverified_other',
      'under_supported_age', 'consent_declined', 'session_canceled', 'suspected_fraud', 'other',
    ])
    for (const c of KYC_DECISION_CODES) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.userMessage.length).toBeGreaterThan(0)
      expect(c.label).not.toContain('—')
      expect(c.userMessage).not.toContain('—')
    }
    expect(kycDecisionCodeLabel('document_expired')).toBe('Document expiré')
    expect(kycDecisionCodeLabel('consent_declined')).toBe('Consentement refusé')
    expect(kycDecisionCodeUserMessage('id_number_unverified_other')).toContain('informations de votre document')
    expect(kycDecisionCodeLabel('code_inconnu')).toBe('code_inconnu')
    expect(kycDecisionCodeLabel(null)).toBe('Aucun')
    expect(kycDecisionCodeUserMessage('document_expired')).toContain('expirée')
    expect(kycDecisionCodeUserMessage('inconnu')).toContain('Nous n\'avons pas pu vérifier')
  })

  it('bornes des motifs', () => {
    expect(reasonLengthValid('x'.repeat(KYC_APPROVE_REASON_MIN - 1), KYC_APPROVE_REASON_MIN)).toBe(false)
    expect(reasonLengthValid(`  ${'x'.repeat(KYC_APPROVE_REASON_MIN)}  `, KYC_APPROVE_REASON_MIN)).toBe(true)
    expect(reasonLengthValid('x'.repeat(KYC_REVOKE_REASON_MIN - 1), KYC_REVOKE_REASON_MIN)).toBe(false)
    expect(reasonLengthValid('x'.repeat(KYC_REASON_MAX + 1), KYC_APPROVE_REASON_MIN)).toBe(false)
  })

  it('durée d’attente lisible et seuil des 48 h', () => {
    expect(formatWaiting(null)).toBe('Inconnue')
    expect(formatWaiting(undefined)).toBe('Inconnue')
    expect(formatWaiting(0.4)).toBe('Moins d’1 h')
    expect(formatWaiting(5)).toBe('5 h')
    expect(formatWaiting(47.9)).toBe('47 h')
    expect(formatWaiting(48)).toBe('2 j')
    expect(formatWaiting(75)).toBe('3 j 3 h')
    expect(isOverdue(48)).toBe(false)
    expect(isOverdue(48.5)).toBe(true)
    expect(isOverdue(null)).toBe(false)
  })
})
