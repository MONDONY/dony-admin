import { describe, it, expect } from 'vitest'
import {
  KYC_DECISION_CODES, KYC_QUEUE_STATUS_TABS, formatWaiting, isOverdue, kycActorLabel, kycDecisionCodeLabel,
  kycDecisionCodeUserMessage, kycDecisionMeta, kycHistoryActionLabel, kycProviderLabel, kycStatusMeta,
  reasonLengthValid, KYC_APPROVE_REASON_MIN, KYC_REVOKE_REASON_MIN, KYC_REASON_MAX,
} from '@/features/kyc/types/index'

describe('types KYC', () => {
  it('ouvre la file sur « En attente de décision »', () => {
    expect(KYC_QUEUE_STATUS_TABS[0]).toEqual({ value: 'IN_REVIEW', label: 'En attente de décision' })
    expect(KYC_QUEUE_STATUS_TABS.map((t) => t.value)).toEqual(['IN_REVIEW', 'REJECTED', 'VERIFIED', 'NOT_STARTED'])
  })

  it('libellés de statut, PENDING compris, et repli sur le code brut', () => {
    expect(kycStatusMeta('IN_REVIEW')).toEqual({ label: 'En attente de décision', tone: 'warning' })
    expect(kycStatusMeta('PENDING').label).toBe('En cours chez le fournisseur')
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

  it('actions de l’historique : connues traduites, inconnues rendues lisibles', () => {
    expect(kycHistoryActionLabel('ADMIN_APPROVED')).toBe('Identité validée par un admin')
    expect(kycHistoryActionLabel('SOME_NEW_ACTION')).toBe('Some new action')
  })

  it('catalogue des codes : repris de l’app mobile, chaque code a un libellé et le message vu par l’utilisateur', () => {
    const values = KYC_DECISION_CODES.map((c) => c.value)
    expect(values).toContain('document_expired')
    expect(values).toContain('selfie_face_mismatch')
    expect(values).toContain('suspected_fraud')
    expect(values).toContain('other')
    for (const c of KYC_DECISION_CODES) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.userMessage.length).toBeGreaterThan(0)
      expect(c.label).not.toContain('—')
      expect(c.userMessage).not.toContain('—')
    }
    expect(kycDecisionCodeLabel('document_expired')).toBe('Document expiré')
    // Codes fournisseur hors catalogue de décision, déjà connus de l'app.
    expect(kycDecisionCodeLabel('consent_declined')).toBe('Consentement refusé')
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
