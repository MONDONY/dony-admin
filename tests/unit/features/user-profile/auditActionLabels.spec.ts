import { describe, it, expect } from 'vitest'
import { AUDIT_ACTION_CODES, auditActionLabel } from '@/features/user-profile/lib/auditActionLabels'

const LISTED = [
  'ACCOUNT_DELETE_IMMEDIATELY_REQUESTED', 'ACTIVE_CURRENCY_CHANGED', 'ADMIN_ALERT_RECURRING_NO_SHOW', 'ANALYTICS_CONSENT_UPDATED',
  'ANNOUNCEMENT_PUBLISHED', 'FIRST_ACTION_REMINDER_SENT', 'GP_PRO_REVOKED', 'GUEST_DATA_CLAIMED', 'GUEST_PROMOTED',
  'HIGH_CANCELLATION_ALERT', 'INTENT_DECLARED', 'KYC_PROVIDER_SESSION_ERASED', 'KYC_PROVIDER_SESSION_ERASURE_FAILED',
  'LAST_SEEN_VISIBILITY_UPDATED', 'PAYOUTS_HELD', 'PAYOUTS_RELEASED_HOLD', 'PHONE_VISIBILITY_UPDATED',
  'PUBLISH_COMMITMENT_ACCEPTED', 'RESIDENCE_ADDRESS_UPDATED', 'RESIDENCE_COUNTRY_CHANGED', 'RESIDENCE_COUNTRY_VISIBILITY_UPDATED',
  'SENDER_CANCELLATION_COUNTED', 'SENDER_REPUTATION_INCIDENT', 'STRIPE_ACCOUNT_CREATED', 'STRIPE_ACCOUNT_DEAUTHORIZED',
  'STRIPE_ACCOUNT_DETACHED', 'STRIPE_CAPABILITY_LOST', 'STRIPE_CONNECT_ACCOUNT_CLOSED', 'STRIPE_CONNECT_ACCOUNT_KEPT',
  'STRIPE_ONBOARDING_COMPLETE', 'STRIPE_ONBOARDING_REMINDER_SENT', 'STRIPE_ONBOARDING_RESUMED_FROM_EMAIL',
  'TRAVELER_PUBLISHING_SUSPENDED', 'TRAVELER_PUBLISHING_SUSPENSION_LIFTED', 'TRIP_TEMPLATES_CURRENCY_PINNED',
  'USER_ADMIN_DELETION', 'USER_AUTO_SUSPENDED', 'USER_BANNED_BY_ADMIN', 'USER_COMMISSION_RATE_OVERRIDE_SET', 'USER_DELETION_CANCELLED',
  'USER_SUSPENDED_BY_ADMIN', 'USER_UNSUSPENDED', 'USER_GDPR_EXECUTED', 'USER_GDPR_DELETION', 'USER_DELETION_CANCELLED_BY_ADMIN',
  'USER_PRO_PROFILE_UPDATED', 'USER_DOWNGRADED_FROM_PRO', 'USER_MESSAGING_MUTED', 'USER_MESSAGING_UNMUTED', 'USER_CREATED',
  'USER_EMAIL_ATTACHED', 'USER_PHONE_ATTACHED', 'USER_PHONE_RECLAIMED', 'USER_REACTIVATED', 'USER_REACTIVATION_DENIED',
  'RECETTE_TESTER_GRANTED', 'RECETTE_TESTER_REVOKED',
]

describe('auditActionLabels', () => {
  it.each(LISTED)('%s a un libellé français', (code) => {
    const label = auditActionLabel(code)
    expect(label).not.toContain('non répertoriée')
    expect(label).not.toMatch(/_/)
    expect(label.length).toBeGreaterThan(3)
  })

  it('libellés clés', () => {
    expect(auditActionLabel('USER_BANNED_BY_ADMIN')).toBe('Compte banni')
    expect(auditActionLabel('USER_SUSPENDED_BY_ADMIN')).toBe('Compte suspendu')
    expect(auditActionLabel('USER_UNSUSPENDED')).toBe('Suspension levée')
    expect(auditActionLabel('PAYOUTS_RELEASED_HOLD')).toBe('Retenue levée')
    expect(auditActionLabel('USER_ADMIN_DELETION')).toBe('Compte supprimé par un administrateur')
  })

  it('code inconnu ou vide', () => {
    expect(auditActionLabel('SOMETHING_NEW')).toBe('Action non répertoriée (SOMETHING_NEW)')
    expect(auditActionLabel(null)).toBe('—')
  })

  it('tous les codes de la table sont testés et aucun libellé n’est partagé', () => {
    for (const c of LISTED) expect(AUDIT_ACTION_CODES).toContain(c)
    const labels = AUDIT_ACTION_CODES.map(c => auditActionLabel(c))
    expect(new Set(labels).size).toBe(labels.length)
  })
})
