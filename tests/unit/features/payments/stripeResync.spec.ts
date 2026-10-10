import { describe, it, expect } from 'vitest'
import {
  RESYNC_UNAVAILABLE, alertPaymentId, forceReleaseErrorMessage, isStripeFixAlert, resyncActionLabel, resyncErrorMessage, stripeStatusLabel,
} from '@/features/payments/lib/stripeResync'

const P = '11111111-2222-3333-4444-555555555555'
const Q = '99999999-8888-7777-6666-555555555555'
const problem = (status: number, code?: string, detail?: string) => ({ statusCode: status, data: { ...(code ? { code } : {}), ...(detail ? { detail } : {}) } })

describe('stripeResync — libellés', () => {
  it.each([
    ['ALREADY_IN_SYNC', 'Déjà à jour, rien à faire'],
    ['ESCROW_ACTIVATED', 'Paiement passé en séquestre et encaissé'],
    ['ESCROW_CAPTURED', 'Séquestre encaissé : le voyageur pourra être payé'],
    ['CAPTURE_RECORDED', 'Encaissement Stripe enregistré chez Yadony'],
    ['MARKED_FAILED', 'Paiement marqué échoué (la carte a été refusée chez Stripe)'],
    ['MARKED_CANCELLED', 'Paiement marqué annulé (annulé chez Stripe)'],
  ])('action %s', (action, label) => {
    expect(resyncActionLabel(action)).toBe(label)
  })
  it('action inconnue affichée telle quelle', () => expect(resyncActionLabel('NEW_ONE')).toBe('NEW_ONE'))

  it('statut Stripe traduit, inconnu tel quel, absent en tiret', () => {
    expect(stripeStatusLabel('requires_capture')).toBe('Autorisé, non encaissé (requires_capture)')
    expect(stripeStatusLabel('succeeded')).toBe('Encaissé (succeeded)')
    expect(stripeStatusLabel('weird')).toBe('weird')
    expect(stripeStatusLabel(null)).toBe('—')
  })
})

describe('stripeResync — erreurs de la resynchronisation', () => {
  it.each([
    [409, 'authorization-expired', 'Autorisation carte expirée'],
    [409, 'amount-mismatch', 'montant ou la devise'],
    [409, 'escrow-capture-failed', 'Stripe a refusé l’encaissement'],
    [409, 'resync-not-supported', 'ne sait pas corriger seule'],
    [422, 'payment-intent-not-found', 'PaymentIntent introuvable'],
    [422, 'not-a-card-payment', 'pas un paiement carte'],
    [404, 'payment-not-found', 'Paiement introuvable'],
    [502, 'stripe-unavailable', 'Stripe injoignable, réessayez'],
  ])('%i %s', (status, code, text) => {
    expect(resyncErrorMessage(problem(status, code))).toContain(text)
  })
  it('endpoint absent (404/405 sans code) : action indisponible', () => {
    expect(resyncErrorMessage(problem(404))).toBe(RESYNC_UNAVAILABLE)
    expect(resyncErrorMessage({ status: 405 })).toBe(RESYNC_UNAVAILABLE)
  })
  it('403 : réservé aux super-admins', () => {
    expect(resyncErrorMessage({ response: { status: 403 } })).toBe('Action réservée aux super-administrateurs.')
  })
  it('code inconnu : detail du ProblemDetail, sinon repli', () => {
    expect(resyncErrorMessage(problem(500, 'other', 'Panne'))).toBe('Panne')
    expect(resyncErrorMessage(undefined)).toBe('Resynchronisation impossible')
  })
})

describe('stripeResync — erreurs du versement forcé', () => {
  it.each([
    ['escrow-capture-failed', 'Encaissement de la carte impossible'],
    ['payout-beneficiary-held', 'dérogation motivée'],
    ['payment-disputed', 'dérogation motivée'],
    ['stripe-account-unusable', 'compte Stripe du voyageur est inutilisable'],
    ['transfer-already-attempted', 'déjà été tenté'],
  ])('%s', (code, text) => {
    expect(forceReleaseErrorMessage(problem(422, code))).toContain(text)
  })
  it('403 et repli', () => {
    expect(forceReleaseErrorMessage({ statusCode: 403 })).toBe('Action réservée aux super-administrateurs.')
    expect(forceReleaseErrorMessage(problem(422, 'payment-not-in-escrow', 'Pas en séquestre'))).toBe('Pas en séquestre')
    expect(forceReleaseErrorMessage(null)).toBe('Versement impossible')
  })
})

describe('stripeResync — paiement visé par une alerte', () => {
  it('types traités par la section « Corriger »', () => {
    expect(isStripeFixAlert('ESCROW_J48_TIMEOUT')).toBe(true)
    expect(isStripeFixAlert(`RECON_STRIPE_${P}`)).toBe(true)
    expect(isStripeFixAlert(`ESCROW_CAPTURE_FAILED_${P}`)).toBe(true)
    expect(isStripeFixAlert('PAWAPAY_BALANCE_LOW_XOF')).toBe(false)
  })
  it('paymentId du nouveau back en priorité', () => {
    expect(alertPaymentId({ type: `RECON_STRIPE_${Q}`, paymentId: P, payload: {} })).toBe(P)
  })
  it('sinon payload.paymentId', () => {
    expect(alertPaymentId({ type: 'ESCROW_J48_TIMEOUT', payload: { paymentId: P } })).toBe(P)
  })
  it('ancien back : payload.reference, puis suffixe du type', () => {
    expect(alertPaymentId({ type: `RECON_STRIPE_${Q}`, payload: { reference: P } })).toBe(P)
    expect(alertPaymentId({ type: `RECON_STRIPE_${Q}`, payload: { reference: 'pi_123' } })).toBe(Q)
    expect(alertPaymentId({ type: `ESCROW_CAPTURE_FAILED_${Q}`, payload: null })).toBe(Q)
  })
  it('écart de commission : vise un colis, pas un paiement', () => {
    expect(alertPaymentId({ type: `RECON_STRIPE_${Q}`, payload: { ecart: 'COMMISSION_NON_ENCAISSEE', reference: Q } })).toBeNull()
  })
  it('aucun identifiant exploitable', () => {
    expect(alertPaymentId({ type: 'ESCROW_J48_TIMEOUT', payload: { bidId: 'b1' } })).toBeNull()
    expect(alertPaymentId({ type: 'RECON_STRIPE_pi_123', payload: {} })).toBeNull()
    expect(alertPaymentId({ type: 'PAYOUT_HELD_x', paymentId: 'pas-un-uuid', payload: {} })).toBeNull()
  })
})
