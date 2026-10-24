/** Registre des liens : URL exactes du contrat, null sans identifiant valide, permission, sérialisation. */
import { describe, it, expect } from 'vitest'
import * as L from '@/lib/adminLinks'

const U = '0a1b2c3d-1111-4222-8333-444455556666'
const OTHER = '9f8e7d6c-aaaa-4bbb-8ccc-ddddeeeeffff'

describe('constructeurs : URL du contrat', () => {
  it('fiche utilisateur', () => {
    expect(L.userRoute(U)).toEqual({ path: `/users/${U}` })
    expect(L.userRoute(U, 'money')).toEqual({ path: `/users/${U}`, query: { tab: 'money' } })
    expect(L.userLegacyRoute(U)).toEqual({ path: '/users', query: { query: U, open: U } })
    expect(L.supportOfRoute(U)).toEqual({ path: '/support', query: { userId: U } })
    expect(L.supportTicketRoute(U)).toEqual({ path: '/support', query: { ticket: U } })
  })
  it('colis, trajets, demandes', () => {
    expect(L.bidRoute(U)).toEqual({ path: '/colis', query: { open: U } })
    expect(L.bidRoute(U, 'tracking')).toEqual({ path: '/colis', query: { open: U, section: 'tracking' } })
    expect(L.tripRoute(U)).toEqual({ path: '/colis', query: { tab: 'announcements', announcement: U } })
    expect(L.tripBidsRoute(U)).toEqual({ path: '/colis', query: { announcementId: U } })
    expect(L.packageRequestRoute(U)).toEqual({ path: '/colis', query: { tab: 'demandes', open: U } })
  })
  it('incidents, modération, alertes, audit, signalements', () => {
    expect(L.disputeRoute(U)).toEqual({ path: '/incidents', query: { open: U } })
    expect(L.noShowRoute(U)).toEqual({ path: '/incidents', query: { tab: 'noshows', open: U } })
    expect(L.conversationRoute('fs_Abc-42')).toEqual({ path: '/moderation', query: { open: 'fs_Abc-42' } })
    expect(L.alertRoute(U)).toEqual({ path: '/alertes', query: { open: U } })
    expect(L.auditRoute('PAYMENT', U)).toEqual({ path: '/audit', query: { entityType: 'PAYMENT', entityId: U } })
    expect(L.reportRoute(U)).toEqual({ path: '/signalements', query: { open: U } })
  })
  it('transactions', () => {
    expect(L.paymentRoute(U)).toEqual({ path: '/transactions', query: { open: U } })
    expect(L.paymentRoute(U, 'incidents')).toEqual({ path: '/transactions', query: { open: U, section: 'incidents' } })
    expect(L.paymentsOfTripRoute(U)).toEqual({ path: '/transactions', query: { announcementId: U } })
    expect(L.paymentsOfPartyRoute(U)).toEqual({ path: '/transactions', query: { partyId: U } })
    expect(L.paymentsOfBidRoute(U)).toEqual({ path: '/transactions', query: { bidId: U, view: 'ALL' } })
    expect(L.chargebackRoute(U)).toEqual({ path: '/transactions', query: { tab: 'chargebacks', open: U } })
    expect(L.walletRefundRoute(U)).toEqual({ path: '/transactions', query: { tab: 'wallet-refunds', open: U } })
    expect(L.walletsOfPartyRoute(U)).toEqual({ path: '/transactions', query: { tab: 'wallets', partyId: U } })
    expect(L.heldPayoutsRoute()).toEqual({ path: '/transactions', query: { held: 'true' } })
  })
  it('transactionsViewRoute ne garde que les clés fournies', () => {
    expect(L.transactionsViewRoute()).toEqual({ path: '/transactions' })
    expect(L.transactionsViewRoute({ view: 'ATTENTION', alert: 'ESCROW_J48' }))
      .toEqual({ path: '/transactions', query: { view: 'ATTENTION', alert: 'ESCROW_J48' } })
    expect(L.transactionsViewRoute({ tab: 'mobile-money', view: 'FAILED' }))
      .toEqual({ path: '/transactions', query: { tab: 'mobile-money', view: 'FAILED' } })
  })
  it('mobile money, vue Échecs : `view` en minuscules, comme la page l’écrit', () => {
    expect(L.mobileMoneyFailedRoute()).toEqual({ path: '/transactions', query: { tab: 'mobile-money', view: 'failed' } })
    expect(L.toHref(L.mobileMoneyFailedRoute())).toBe('/transactions?tab=mobile-money&view=failed')
  })
  it('pages de liste', () => {
    expect(L.incidentsListRoute()).toEqual({ path: '/incidents' })
    expect(L.alertsListRoute()).toEqual({ path: '/alertes' })
  })
})

describe('identifiant manquant ou invalide : null', () => {
  // eslint-disable-next-line no-unused-vars
  const uuidBuilders: Array<[string, (v: unknown) => unknown]> = [
    ['userRoute', v => L.userRoute(v)], ['userLegacyRoute', L.userLegacyRoute], ['supportOfRoute', L.supportOfRoute],
    ['supportTicketRoute', L.supportTicketRoute], ['bidRoute', v => L.bidRoute(v)], ['tripRoute', L.tripRoute],
    ['tripBidsRoute', L.tripBidsRoute], ['packageRequestRoute', L.packageRequestRoute], ['disputeRoute', L.disputeRoute],
    ['noShowRoute', L.noShowRoute], ['alertRoute', L.alertRoute], ['auditRoute', v => L.auditRoute('PAYMENT', v)],
    ['reportRoute', L.reportRoute], ['paymentRoute', v => L.paymentRoute(v)], ['paymentsOfTripRoute', L.paymentsOfTripRoute],
    ['paymentsOfPartyRoute', L.paymentsOfPartyRoute], ['paymentsOfBidRoute', L.paymentsOfBidRoute],
    ['chargebackRoute', L.chargebackRoute], ['walletRefundRoute', L.walletRefundRoute], ['walletsOfPartyRoute', L.walletsOfPartyRoute],
  ]
  it.each(uuidBuilders)('%s', (_name, build) => {
    for (const bad of [undefined, null, '', 'pas-un-uuid', '../../admin/x']) expect(build(bad)).toBeNull()
  })
  it('conversationRoute refuse un identifiant Firestore invalide', () => {
    for (const bad of [undefined, '', 'a/b', '../x', 'a'.repeat(129)]) expect(L.conversationRoute(bad)).toBeNull()
  })
  it('unchecked accepte un identifiant non UUID mais pas le vide', () => {
    expect(L.unchecked.bidRoute('b1')).toEqual({ path: '/colis', query: { open: 'b1' } })
    expect(L.unchecked.bidRoute('')).toBeNull()
    expect(L.unchecked.bidRoute(undefined)).toBeNull()
  })
})

describe('gate et toHref', () => {
  const route = L.bidRoute(U, 'tracking')
  it('gate : la route seulement avec la permission', () => {
    expect(L.gate(p => p === 'BID_VIEW', 'BID_VIEW', route)).toEqual(route)
    expect(L.gate(() => false, 'BID_VIEW', route)).toBeNull()
    expect(L.gate(() => true, 'BID_VIEW', null)).toBeNull()
  })
  it('toHref sérialise et encode', () => {
    expect(L.toHref(route!)).toBe(`/colis?open=${U}&section=tracking`)
    expect(L.toHref({ path: '/transactions' })).toBe('/transactions')
    expect(L.toHref({ path: '/x', query: { q: 'a b&c' } })).toBe('/x?q=a%20b%26c')
    expect(L.toHref(L.userLegacyRoute(OTHER)!)).toBe(`/users?query=${OTHER}&open=${OTHER}`)
  })
})
