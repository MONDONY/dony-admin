import { describe, it, expect } from 'vitest'
import { mobileMoneyLinks, mobileMoneyTypeLabel, mobileMoneyRoleLabel } from '@/features/finance/lib/mobileMoneyLinks'
import type { AdminMobileMoneyPayment } from '@/features/finance/types/index'

const U = '11111111-2222-3333-4444-555555555555'
const B = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const P = 'cccccccc-0000-0000-0000-000000000001'
const R = 'dddddddd-0000-0000-0000-000000000002'
const ALL = () => true
const NONE = () => false
const op = (over: Partial<AdminMobileMoneyPayment> = {}): AdminMobileMoneyPayment => ({
  id: 'mm1', paymentId: P, kind: 'DEPOSIT', provider: 'ORANGE_CIV', countryCode: 'CI', phoneNumber: '771234567',
  amountCents: 1000, currency: 'XOF', status: 'COMPLETED', createdAt: '2026-10-01T10:00:00Z',
  purpose: 'BID_PAYMENT', personId: U, personName: 'Awa Diallo', role: 'SENDER', bidId: B, trackingNumber: 'YD-1', corridor: 'Paris → Dakar', ...over,
})

describe('mobileMoneyLinks', () => {
  it('BID_PAYMENT : colis, personne et « Ouvrir le paiement »', () => {
    const l = mobileMoneyLinks(op(), ALL)
    expect(l.bid).toEqual({ path: '/colis', query: { open: B } })
    expect(l.person).toEqual({ path: `/users/${U}` })
    expect(l.main).toEqual({ label: 'Ouvrir le paiement', route: { path: '/transactions', query: { open: P } } })
    expect(l.retry).toBeNull()
  })
  it('WALLET_TOPUP : la personne seule, sur l’onglet Argent, pas de colis ni de paiement', () => {
    const l = mobileMoneyLinks(op({ purpose: 'WALLET_TOPUP', paymentId: null, bidId: null, trackingNumber: null, corridor: null }), ALL)
    expect(l.person).toEqual({ path: `/users/${U}`, query: { tab: 'money' } })
    expect(l.bid).toBeNull()
    expect(l.main).toBeNull()
  })
  it('WALLET_REFUND : la demande de remboursement quand elle est connue', () => {
    const l = mobileMoneyLinks(op({ purpose: 'WALLET_REFUND', paymentId: null, bidId: null, walletRefundRequestId: R }), ALL)
    expect(l.main).toEqual({ label: 'Ouvrir la demande de remboursement', route: { path: '/transactions', query: { tab: 'wallet-refunds', open: R } } })
    expect(l.person).toEqual({ path: `/users/${U}`, query: { tab: 'money' } })
  })
  it('WALLET_REFUND sans demande : la personne seule', () => {
    const l = mobileMoneyLinks(op({ purpose: 'WALLET_REFUND', paymentId: null, bidId: null, walletRefundRequestId: null }), ALL)
    expect(l.main).toBeNull()
    expect(l.person).toEqual({ path: `/users/${U}`, query: { tab: 'money' } })
  })
  it('BID_SUPPLEMENT : le colis sur son onglet Argent', () => {
    const l = mobileMoneyLinks(op({ purpose: 'BID_SUPPLEMENT', paymentId: null }), ALL)
    expect(l.bid).toEqual({ path: '/colis', query: { open: B, section: 'money' } })
    expect(l.main).toBeNull()
  })
  it('retryable : « Relancer depuis le paiement » = onglet Incidents du paiement', () => {
    const l = mobileMoneyLinks(op({ retryable: true }), ALL)
    expect(l.retry).toEqual({ path: '/transactions', query: { open: P, section: 'incidents' } })
  })
  it('retryable sans paiement : pas de lien', () => {
    expect(mobileMoneyLinks(op({ retryable: true, paymentId: null }), ALL).retry).toBeNull()
  })
  it('sans permission : aucun lien', () => {
    const l = mobileMoneyLinks(op({ retryable: true }), NONE)
    expect(l).toEqual({ bid: null, person: null, main: null, retry: null })
  })
  it('permissions séparées : BID_VIEW sans USER_VIEW', () => {
    const l = mobileMoneyLinks(op(), p => p === 'BID_VIEW')
    expect(l.bid).not.toBeNull(); expect(l.person).toBeNull(); expect(l.main).toBeNull()
  })
  it('identifiants absents ou invalides : pas de lien, pas de « undefined »', () => {
    const l = mobileMoneyLinks(op({ personId: 'nope', bidId: undefined, paymentId: null }), ALL)
    expect(l).toEqual({ bid: null, person: null, main: null, retry: null })
  })
  it('ancien back (aucun champ enrichi) : seul le paiement est relié', () => {
    const old = { id: 'mm1', paymentId: P, kind: 'DEPOSIT', provider: 'WAVE_SEN', countryCode: 'SN', phoneNumber: '1', amountCents: 1, currency: 'XOF', status: 'COMPLETED', createdAt: 'x' } as AdminMobileMoneyPayment
    const l = mobileMoneyLinks(old, ALL)
    expect(l.main?.route).toEqual({ path: '/transactions', query: { open: P } })
    expect(l.bid).toBeNull(); expect(l.person).toBeNull()
  })
})

describe('libellés', () => {
  it('type : sens, plus le motif pour une recharge, un remboursement de solde ou un supplément', () => {
    expect(mobileMoneyTypeLabel(op({ kind: 'DEPOSIT', purpose: 'BID_PAYMENT' }))).toEqual({ kind: 'Dépôt', purpose: null })
    expect(mobileMoneyTypeLabel(op({ kind: 'DEPOSIT', purpose: 'WALLET_TOPUP' }))).toEqual({ kind: 'Dépôt', purpose: 'Recharge du solde' })
    expect(mobileMoneyTypeLabel(op({ kind: 'REFUND', purpose: 'WALLET_REFUND' }))).toEqual({ kind: 'Remboursement', purpose: 'Remboursement du solde' })
    expect(mobileMoneyTypeLabel(op({ kind: 'DEPOSIT', purpose: 'BID_SUPPLEMENT' }))).toEqual({ kind: 'Dépôt', purpose: 'Supplément' })
    expect(mobileMoneyTypeLabel(op({ kind: 'PAYOUT', purpose: undefined }))).toEqual({ kind: 'Versement', purpose: null })
  })
  it('rôle', () => {
    expect(mobileMoneyRoleLabel('SENDER')).toBe('Expéditeur')
    expect(mobileMoneyRoleLabel('TRAVELER')).toBe('Voyageur')
    expect(mobileMoneyRoleLabel('USER')).toBe('Utilisateur')
    expect(mobileMoneyRoleLabel(null)).toBeNull()
  })
})
