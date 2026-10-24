/**
 * Liens sortants de la fiche paiement : chaque route vient du registre, derrière la permission de
 * sa destination ; identifiant absent (ancien back, négociation sans colis) = `null`.
 */
import { describe, it, expect } from 'vitest'
import { paymentLinks } from '@/features/payments/lib/paymentLinks'
import { toHref, type AdminRoute } from '@/lib/adminLinks'
import type { AdminPermission } from '@/stores/auth'
import type { AdminPaymentDetail, PaymentInsight } from '@/features/payments/types/index'

const PAY = '00000000-1111-4111-8111-000000000001'
const SENDER = '11111111-2222-4333-8444-555555555555'
const TRAVELER = '99999999-8888-4777-8666-555555555555'
const BID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const ANN = 'cccccccc-1111-4222-8333-444444444444'
const DISPUTE = 'dddddddd-1111-4222-8333-444444444444'
const CANCEL = 'eeeeeeee-1111-4222-8333-444444444444'
const CB = 'ffffffff-1111-4222-8333-444444444444'
const PR = '12121212-1111-4222-8333-444444444444'
const ALERT1 = '34343434-1111-4222-8333-444444444444'
const ALERT2 = '56565656-1111-4222-8333-444444444444'
const CONV = 'conv_Abc-123'

const insight = (over: Partial<PaymentInsight> = {}): PaymentInsight => ({
  kind: 'BID', bidId: BID, negotiationThreadId: null, sender: { id: SENDER, name: 'Awa' }, traveler: { id: TRAVELER, name: 'Ibrahima' },
  departureCity: 'Paris', arrivalCity: 'Dakar', bidStatus: 'IN_TRANSIT', abandoned: false, netTravelerCents: 100, capturedAt: null,
  fxExchangeRate: null, stripeChargeId: null, stripeDashboardUrl: null, ...over,
})
const full = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: PAY, bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 100, currency: 'EUR', createdAt: '2026-10-19T14:02:00',
  refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, insight: insight(),
  links: { announcementId: ANN, disputeId: DISPUTE, disputeStatus: 'OPEN', cancellationId: CANCEL, conversationId: CONV, chargebackId: CB, packageRequestId: PR },
  openAlerts: [{ id: ALERT1, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN' }, { id: ALERT2, type: 'MONEY_INVARIANT_INV-02', severity: 'CRITICAL' }],
  beneficiaryHoldReason: 'BANNED', travelerId: TRAVELER,
  ...over,
})
const all = () => true
const without = (...missing: AdminPermission[]) => (p: AdminPermission) => !missing.includes(p)
const href = (r: AdminRoute | null) => (r ? toHref(r) : null)

describe('paymentLinks', () => {
  it('toutes permissions : chaque lien à l’URL exacte du contrat', () => {
    const l = paymentLinks(full(), all)
    expect(href(l.sender)).toBe(`/users/${SENDER}`)
    expect(href(l.traveler)).toBe(`/users/${TRAVELER}`)
    expect(href(l.travelerMoney)).toBe(`/users/${TRAVELER}?tab=money`)
    expect(href(l.senderSupport)).toBe(`/support?userId=${SENDER}`)
    expect(href(l.travelerSupport)).toBe(`/support?userId=${TRAVELER}`)
    expect(href(l.bid)).toBe(`/colis?open=${BID}`)
    expect(href(l.bidTracking)).toBe(`/colis?open=${BID}&section=tracking`)
    expect(href(l.bidMoney)).toBe(`/colis?open=${BID}&section=money`)
    expect(href(l.bidIncidents)).toBe(`/colis?open=${BID}&section=incidents`)
    expect(href(l.bidChat)).toBe(`/colis?open=${BID}&section=chat`)
    expect(href(l.trip)).toBe(`/colis?tab=announcements&announcement=${ANN}`)
    expect(href(l.tripBids)).toBe(`/colis?announcementId=${ANN}`)
    expect(href(l.packageRequest)).toBe(`/colis?tab=demandes&open=${PR}`)
    expect(href(l.dispute)).toBe(`/incidents?open=${DISPUTE}`)
    expect(href(l.noShow)).toBe(`/incidents?tab=noshows&open=${CANCEL}`)
    expect(href(l.conversation)).toBe(`/moderation?open=${CONV}`)
    expect(href(l.chargeback)).toBe(`/transactions?tab=chargebacks&open=${CB}`)
    expect(l.alerts.map(a => [a.id, a.type, a.severity, toHref(a.to)])).toEqual([
      [ALERT1, 'ESCROW_J48_TIMEOUT', 'WARN', `/alertes?open=${ALERT1}`],
      [ALERT2, 'MONEY_INVARIANT_INV-02', 'CRITICAL', `/alertes?open=${ALERT2}`],
    ])
    expect(href(l.audit)).toBe(`/audit?entityType=PAYMENT&entityId=${PAY}`)
    expect(href(l.holdCause)).toBe(`/users/${TRAVELER}?tab=manage`)
  })

  it('cause de la retenue : identité révoquée → onglet Identité, et seulement avec USER_KYC', () => {
    const kyc = full({ beneficiaryHoldReason: 'KYC_REVOKED' })
    expect(href(paymentLinks(kyc, all).holdCause)).toBe(`/users/${TRAVELER}?tab=identity`)
    expect(paymentLinks(kyc, without('USER_KYC')).holdCause).toBeNull()
    expect(href(paymentLinks(full(), without('USER_KYC')).holdCause)).toBe(`/users/${TRAVELER}?tab=manage`)
    expect(paymentLinks(full({ beneficiaryHoldReason: null }), all).holdCause).toBeNull()
  })

  it('sans USER_VIEW : parties et cause de la retenue à null', () => {
    const l = paymentLinks(full(), without('USER_VIEW'))
    expect([l.sender, l.traveler, l.holdCause]).toEqual([null, null, null])
    expect(l.senderSupport).not.toBeNull()
  })

  it('argent du voyageur : USER_VIEW et PAYMENT_VIEW requis, identifiant du voyageur requis', () => {
    expect(paymentLinks(full(), without('USER_VIEW')).travelerMoney).toBeNull()
    const noPay = paymentLinks(full(), without('PAYMENT_VIEW'))
    expect(noPay.travelerMoney).toBeNull()
    expect(noPay.traveler).not.toBeNull()
    expect(paymentLinks(full({ insight: insight({ traveler: null }), travelerId: null }), all).travelerMoney).toBeNull()
    // Ancien back sans contexte : le voyageur de la ligne suffit.
    expect(href(paymentLinks(full({ insight: undefined }), all).travelerMoney)).toBe(`/users/${TRAVELER}?tab=money`)
  })

  it('sans DISPUTE_VIEW : litige et absence à null', () => {
    const l = paymentLinks(full(), without('DISPUTE_VIEW'))
    expect(l.dispute).toBeNull()
    expect(l.noShow).toBeNull()
    expect(l.conversation).not.toBeNull()
  })

  it('sans MODERATION_VIEW : conversation et échanges du colis à null, le reste du colis reste', () => {
    const l = paymentLinks(full(), without('MODERATION_VIEW'))
    expect(l.conversation).toBeNull()
    expect(l.bidChat).toBeNull()
    expect(l.bid).not.toBeNull()
  })

  it('sans BID_VIEW : colis, trajet et demande à null', () => {
    const l = paymentLinks(full(), without('BID_VIEW'))
    expect([l.bid, l.bidTracking, l.bidMoney, l.bidIncidents, l.bidChat, l.trip, l.tripBids, l.packageRequest]).toEqual(Array(8).fill(null))
  })

  it('sans ALERT_VIEW : aucune alerte ; sans AUDIT_VIEW : pas de journal ; sans SUPPORT_TICKET_VIEW : pas de support', () => {
    expect(paymentLinks(full(), without('ALERT_VIEW')).alerts).toEqual([])
    expect(paymentLinks(full(), without('AUDIT_VIEW')).audit).toBeNull()
    const s = paymentLinks(full(), without('SUPPORT_TICKET_VIEW'))
    expect([s.senderSupport, s.travelerSupport]).toEqual([null, null])
  })

  it('sans PAYMENT_VIEW : pas de lien vers le litige bancaire', () => {
    expect(paymentLinks(full(), without('PAYMENT_VIEW')).chargeback).toBeNull()
  })

  it('ancien back (ni links, ni openAlerts, ni contexte) : seuls les liens dont l’identifiant existe', () => {
    const old = full({ insight: undefined, links: undefined, openAlerts: undefined, beneficiaryHoldReason: undefined, bidId: BID })
    const l = paymentLinks(old, all)
    expect(l.sender).toBeNull()
    expect(href(l.traveler)).toBe(`/users/${TRAVELER}`)
    expect(href(l.bid)).toBe(`/colis?open=${BID}`)
    expect([l.trip, l.tripBids, l.packageRequest, l.dispute, l.noShow, l.conversation, l.chargeback, l.holdCause]).toEqual(Array(8).fill(null))
    expect(l.alerts).toEqual([])
    expect(JSON.stringify(l)).not.toContain('undefined')
  })

  it('négociation sans colis : aucun lien colis ; annonce de la ligne reprise à défaut de links', () => {
    const neg = full({ insight: insight({ kind: 'NEGOTIATION', bidId: null }), links: { packageRequestId: PR }, announcementId: ANN })
    const l = paymentLinks(neg, all)
    expect([l.bid, l.bidTracking, l.bidMoney, l.bidIncidents, l.bidChat]).toEqual(Array(5).fill(null))
    expect(href(l.packageRequest)).toBe(`/colis?tab=demandes&open=${PR}`)
    expect(href(l.tripBids)).toBe(`/colis?announcementId=${ANN}`)
  })

  it('identifiants mal formés (compte supprimé, valeur vide) : null, jamais d’URL inventée', () => {
    const bad = full({
      insight: insight({ sender: { id: '', name: null }, traveler: null, bidId: 'pas-un-uuid' }), travelerId: null,
      links: { disputeId: 'x', conversationId: 'conv/../x', chargebackId: '' }, openAlerts: [{ id: 'nope', type: 'X', severity: 'INFO' }],
    })
    const l = paymentLinks(bad, all)
    expect([l.sender, l.traveler, l.senderSupport, l.bid, l.dispute, l.conversation, l.chargeback, l.holdCause]).toEqual(Array(8).fill(null))
    expect(l.alerts).toEqual([])
  })

  it('litige bancaire : repris du résumé `chargeback` à défaut de links.chargebackId', () => {
    const l = paymentLinks(full({ links: {}, chargeback: { id: CB, status: 'OPEN' } }), all)
    expect(href(l.chargeback)).toBe(`/transactions?tab=chargebacks&open=${CB}`)
  })
})
