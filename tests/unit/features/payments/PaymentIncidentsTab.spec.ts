/**
 * Onglet Incidents du tiroir paiement : un bloc par incident dont la donnée existe (retenue, litige
 * bancaire, litige du colis, absence, alertes ouvertes), chaque information ailleurs en lien précis,
 * et rien d'autre qu'« Aucun incident » + les raccourcis quand il n'y a rien.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentIncidentsTab from '@/features/payments/components/PaymentIncidentsTab.vue'
import type { AdminPaymentDetail } from '@/features/payments/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import { IDS, NuxtLink, fullPayment, insightOf, oldPayment } from '~/tests/helpers/paymentDetail'

const global = { stubs: { NuxtLink } }
const mountTab = (payment: AdminPaymentDetail) => mount(PaymentIncidentsTab, { props: { payment }, global })
const hrefOf = (w: ReturnType<typeof mountTab>, test: string) => {
  const el = w.find(`[data-test="${test}"]`)
  expect(el.exists(), test).toBe(true)
  expect(el.element.tagName, test).toBe('A')
  return el.attributes('href')
}
/** Paiement sans aucun incident (rien de retenu, pas de litige, pas d'alerte). */
const calm = (over: Partial<AdminPaymentDetail> = {}) => fullPayment({
  alert: null, payoutHeldAt: null, beneficiaryHeld: false, beneficiaryHoldReason: null, disputed: false, chargeback: undefined,
  links: { announcementId: IDS.ANN, conversationId: IDS.CONV }, openAlerts: [], ...over,
})

describe('PaymentIncidentsTab', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('nouveau back complet : chaque bloc et chaque lien à son URL exacte', () => {
    const w = mountTab(fullPayment())
    expect(w.findAll('[data-incident]').map(b => b.attributes('data-incident'))).toEqual(['hold', 'chargeback', 'dispute', 'noshow', 'alerts'])
    expect(hrefOf(w, 'payment-hold-traveler-link')).toBe(`/users/${IDS.TRAVELER}?tab=manage`)
    expect(hrefOf(w, 'payment-hold-traveler-money-link')).toBe(`/users/${IDS.TRAVELER}?tab=money`)
    expect(w.find('[data-test="payment-hold-traveler-money-link"]').text()).toBe('Voir l’argent du voyageur')
    expect(hrefOf(w, 'payment-chargeback-link')).toBe(`/transactions?tab=chargebacks&open=${IDS.CB}`)
    expect(hrefOf(w, 'payment-dispute-link')).toBe(`/incidents?open=${IDS.DISPUTE}`)
    expect(hrefOf(w, 'payment-noshow-link')).toBe(`/incidents?tab=noshows&open=${IDS.CANCEL}`)
    expect(hrefOf(w, `payment-open-alert-link-${IDS.ALERT1}`)).toBe(`/alertes?open=${IDS.ALERT1}`)
    expect(hrefOf(w, `payment-open-alert-link-${IDS.ALERT2}`)).toBe(`/alertes?open=${IDS.ALERT2}`)
    expect(hrefOf(w, 'payment-sender-support-link')).toBe(`/support?userId=${IDS.SENDER}`)
    expect(hrefOf(w, 'payment-traveler-support-link')).toBe(`/support?userId=${IDS.TRAVELER}`)
    expect(hrefOf(w, 'payment-conversation-link')).toBe(`/moderation?open=${IDS.CONV}`)
    expect(hrefOf(w, 'payment-bid-incidents-link')).toBe(`/colis?open=${IDS.BID}&section=incidents`)
    expect(w.find('[data-test="payment-no-incident"]').exists()).toBe(false)
    // Cibles tactiles d'au moins 40 px.
    for (const a of w.findAll('a')) expect(a.classes()).toContain('min-h-10')
  })

  it('retenue + litige bancaire + une alerte : trois blocs', () => {
    const w = mountTab(fullPayment({ links: {}, openAlerts: [{ id: IDS.ALERT1, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN' }] }))
    expect(w.findAll('[data-incident]')).toHaveLength(3)
  })

  it('retenue : cause, date et texte de l’encart d’avant', () => {
    const w = mountTab(fullPayment())
    const notice = w.find('[data-test="payment-hold-notice"]')
    expect(notice.text()).toContain('Versement retenu')
    expect(notice.text()).toContain('Le voyageur a été banni.')
    expect(w.find('[data-test="payment-hold-since"]').text()).toContain(new Date('2026-10-19T10:00:00Z').toLocaleDateString('fr-FR'))
    expect(w.find('[data-test="payment-hold-traveler-link"]').text()).toContain('onglet Gestion')
  })

  it('identité révoquée : lien vers l’onglet Identité ; sans USER_KYC, la fiche du voyageur', () => {
    const kyc = fullPayment({ beneficiaryHoldReason: 'KYC_REVOKED' })
    expect(hrefOf(mountTab(kyc), 'payment-hold-traveler-link')).toBe(`/users/${IDS.TRAVELER}?tab=identity`)
    seedAuth('ADMIN', { USER_KYC: false })
    const w = mountTab(kyc)
    expect(hrefOf(w, 'payment-hold-traveler-link')).toBe(`/users/${IDS.TRAVELER}`)
    expect(w.find('[data-test="payment-hold-traveler-link"]').text()).toBe('Voir la fiche du voyageur')
  })

  it('argent du voyageur : absent sans PAYMENT_VIEW, sans USER_VIEW ou sans identifiant ; la cause reste', () => {
    seedAuth('ADMIN', { PAYMENT_VIEW: false })
    const noPay = mountTab(fullPayment())
    expect(noPay.find('[data-test="payment-hold-traveler-money-link"]').exists()).toBe(false)
    expect(noPay.find('[data-test="payment-hold-traveler-link"]').exists()).toBe(true)
    seedAuth('ADMIN', { USER_VIEW: false })
    expect(mountTab(fullPayment()).find('[data-test="payment-hold-notice"] a').exists()).toBe(false)
    seedAuth('ADMIN')
    const noId = mountTab(fullPayment({ travelerId: null, insight: insightOf({ traveler: null }) }))
    expect(noId.find('[data-test="payment-hold-notice"] a').exists()).toBe(false)
  })

  it('litige bancaire : statut, motif, issue et date d’ouverture', () => {
    const w = mountTab(fullPayment({ chargeback: { id: IDS.CB, status: 'LOST', reason: 'fraudulent', outcome: 'Fonds débités', openedAt: '2026-10-20T08:00:00' } }))
    const block = w.find('[data-test="payment-disputed"]')
    expect(block.find('[data-test="payment-chargeback-status"]').text()).toBe('Perdu')
    expect(block.text()).toContain('fraudulent')
    expect(block.text()).toContain('Fonds débités')
    expect(block.text()).toContain('20/10/2026')
  })

  it('litige du colis et alertes : statut et libellés lisibles', () => {
    const w = mountTab(fullPayment())
    expect(w.find('[data-test="payment-dispute"]').text()).toContain('ouvert')
    const row = w.find(`[data-test="payment-open-alert-${IDS.ALERT1}"]`)
    expect(row.text()).toContain('Paiement en séquestre depuis plus de 48 h')
    expect(row.text()).toContain('Attention')
    expect(w.find(`[data-test="payment-open-alert-${IDS.ALERT2}"]`).text()).toContain('Critique')
  })

  it('sans aucune permission de destination : aucun <a>, les textes restent lisibles', () => {
    seedAuth('ADMIN', {
      USER_VIEW: false, DISPUTE_VIEW: false, MODERATION_VIEW: false, ALERT_VIEW: false, SUPPORT_TICKET_VIEW: false, BID_VIEW: false, PAYMENT_VIEW: false,
    })
    const w = mountTab(fullPayment())
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('[data-test="payment-hold-notice"]').text()).toContain('Le voyageur a été banni.')
    expect(w.find('[data-test="payment-chargeback-status"]').text()).toBe('Ouvert')
    expect(w.find('[data-test="payment-dispute"]').text()).toContain('ouvert')
    expect(w.find(`[data-test="payment-open-alert-${IDS.ALERT1}"]`).text()).toContain('Paiement en séquestre depuis plus de 48 h')
  })

  it('ancien back : encart de retenue et litige d’avant, lien vers la fiche, aucun autre bloc', () => {
    const w = mountTab(oldPayment({ beneficiaryHeld: true, travelerId: IDS.TRAVELER, disputed: true, insight: null }))
    expect(w.findAll('[data-incident]').map(b => b.attributes('data-incident'))).toEqual(['hold', 'chargeback'])
    expect(w.find('[data-test="payment-hold-notice"]').text()).toContain('Le voyageur est bloqué.')
    expect(hrefOf(w, 'payment-hold-traveler-link')).toBe(`/users/${IDS.TRAVELER}`)
    expect(w.find('[data-test="payment-disputed"]').text()).toContain('conteste ce paiement')
    expect(w.find('[data-test="payment-chargeback-link"]').exists()).toBe(false)
    expect(w.html()).not.toContain('undefined')
  })

  it('aucun incident : « Aucun incident » et les raccourcis qui existent', () => {
    const w = mountTab(calm())
    expect(w.find('[data-test="payment-no-incident"]').text()).toBe('Aucun incident sur ce paiement.')
    expect(w.findAll('[data-incident]')).toHaveLength(0)
    expect(hrefOf(w, 'payment-sender-support-link')).toBe(`/support?userId=${IDS.SENDER}`)
    expect(hrefOf(w, 'payment-conversation-link')).toBe(`/moderation?open=${IDS.CONV}`)
  })

  it('aucun incident, ancien back sans contexte et sans droit support : ni raccourci ni lien', () => {
    seedAuth('ADMIN', { SUPPORT_TICKET_VIEW: false })
    const w = mountTab(oldPayment({ insight: insightOf({ bidId: null }) }))
    expect(w.find('[data-test="payment-no-incident"]').exists()).toBe(true)
    expect(w.find('[data-test="payment-incident-shortcuts"]').exists()).toBe(false)
    expect(w.find('a').exists()).toBe(false)
  })
})
