/** Onglet Résumé du tiroir paiement : parcours, parties, montants en clair, colis lié. */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentSummaryTab from '@/features/payments/components/PaymentSummaryTab.vue'
import PaymentPartiesRow from '@/features/payments/components/PaymentPartiesRow.vue'
import PaymentFlow from '@/features/payments/components/PaymentFlow.vue'
import type { AdminPaymentDetail, PaymentInsight } from '@/features/payments/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const global = { stubs: { NuxtLink } }
const SENDER = '11111111-2222-4333-8444-555555555555'
const TRAVELER = '99999999-8888-4777-8666-555555555555'
const BID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const insight = (over: Partial<PaymentInsight> = {}): PaymentInsight => ({
  kind: 'BID', bidId: BID, negotiationThreadId: null, sender: { id: SENDER, name: 'Awa Diallo' }, traveler: { id: TRAVELER, name: 'Ibrahima Ndiaye' },
  departureCity: 'Paris', arrivalCity: 'Dakar', bidStatus: 'IN_TRANSIT', abandoned: false, netTravelerCents: 19440, capturedAt: null,
  fxExchangeRate: null, stripeChargeId: null, stripeDashboardUrl: null, ...over,
})
const pay = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
  id: 'p1', bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 21300, commissionCents: 1860, currency: 'EUR',
  createdAt: '2026-10-19T14:02:00', refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false,
  insight: insight(), ...over,
})

describe('PaymentPartiesRow', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('expéditeur et voyageur : liens vers leur fiche (USER_VIEW)', () => {
    const w = mount(PaymentPartiesRow, { props: { payment: pay() }, global })
    expect(w.find('[data-test="payment-sender-link"]').attributes('href')).toContain(`/users/${SENDER}`)
    expect(w.find('[data-test="payment-traveler-link"]').text()).toBe('Ibrahima Ndiaye')
    expect(w.find('[data-test="payment-traveler-link"]').attributes('href')).toContain(`/users/${TRAVELER}`)
  })

  it('sans USER_VIEW : les noms restent lisibles, aucun lien', () => {
    seedAuth('ADMIN', { USER_VIEW: false })
    const w = mount(PaymentPartiesRow, { props: { payment: pay() }, global })
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('[data-test="party-sender"]').text()).toContain('Awa Diallo')
  })

  it('badge « Banni » depuis beneficiaryHoldReason', () => {
    const w = mount(PaymentPartiesRow, { props: { payment: pay({ beneficiaryHoldReason: 'BANNED', beneficiaryHeld: true }) }, global })
    expect(w.find('[data-test="party-traveler-banned"]').text()).toBe('Banni')
    expect(mount(PaymentPartiesRow, { props: { payment: pay() }, global }).find('[data-test="party-traveler-banned"]').exists()).toBe(false)
  })

  it('ancien back sans contexte : voyageur repris de travelerId, expéditeur non renseigné, jamais « undefined »', () => {
    const w = mount(PaymentPartiesRow, { props: { payment: pay({ insight: undefined, travelerId: TRAVELER }) }, global })
    expect(w.find('[data-test="payment-traveler-link"]').attributes('href')).toContain(TRAVELER)
    expect(w.find('[data-test="party-sender"]').text()).toContain('Non renseigné')
    expect(w.html()).not.toContain('undefined')
  })
})

describe('PaymentFlow', () => {
  it('une étape par jalon, l’arrêt est marqué et annoncé', () => {
    const w = mount(PaymentFlow, { props: { payment: pay({ beneficiaryHeld: true, capturedAt: '2026-10-19T15:00:00', insight: insight({ bidStatus: 'COMPLETED' }) }) } })
    expect(w.findAll('[data-test^="flow-step-"]')).toHaveLength(4)
    expect(w.find('[data-test="flow-step-outcome"]').attributes('data-state')).toBe('stop')
    expect(w.find('[data-test="flow-step-outcome"]').text()).toContain('Versement retenu')
    expect(w.find('[data-test="flow-step-paid"]').text()).toMatch(/19 oct\./)
  })
})

describe('PaymentSummaryTab', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('montants en gros : payé, net voyageur, commission', () => {
    const w = mount(PaymentSummaryTab, { props: { payment: pay() }, global })
    expect(w.find('[data-test="payment-detail-amount"]').text()).toBe('213,00 EUR')
    expect(w.find('[data-test="payment-detail-net"]').text()).toBe('194,40 EUR')
    expect(w.find('[data-test="payment-summary-commission"]').text()).toBe('18,60 EUR')
    expect(w.find('[data-test="payment-detail-amount"]').classes()).toContain('tabular-nums')
  })

  it('net voyageur sans contexte : montant moins commission', () => {
    const w = mount(PaymentSummaryTab, { props: { payment: pay({ insight: null }) }, global })
    expect(w.find('[data-test="payment-detail-net"]').text()).toBe('194,40 EUR')
  })

  it('colis lié : statut et lien vers la fiche colis (BID_VIEW)', () => {
    const w = mount(PaymentSummaryTab, { props: { payment: pay() }, global })
    const card = w.find('[data-test="payment-linked-bid"]')
    expect(card.text()).toContain('En transit')
    expect(w.find('[data-test="payment-bid-link"]').attributes('href')).toContain(BID)
  })

  it('sans BID_VIEW : colis en texte, sans lien', () => {
    seedAuth('ADMIN', { BID_VIEW: false })
    const w = mount(PaymentSummaryTab, { props: { payment: pay() }, global })
    expect(w.find('[data-test="payment-bid-link"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-linked-bid"]').text()).toContain(BID.slice(0, 8))
  })

  it('négociation sans colis : « Pas encore créé (négociation) », sans lien', () => {
    const w = mount(PaymentSummaryTab, { props: { payment: pay({ insight: insight({ kind: 'NEGOTIATION', bidId: null, bidStatus: null }) }) }, global })
    expect(w.find('[data-test="payment-linked-bid"]').text()).toContain('Pas encore créé (négociation)')
    expect(w.find('[data-test="payment-bid-link"]').exists()).toBe(false)
  })

  it('parcours et parties présents', () => {
    const w = mount(PaymentSummaryTab, { props: { payment: pay() }, global })
    expect(w.find('[data-test="payment-flow"]').exists()).toBe(true)
    expect(w.find('[data-test="party-sender"]').exists()).toBe(true)
  })
})
