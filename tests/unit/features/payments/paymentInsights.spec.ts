/**
 * Transactions enrichies : recherche, checkouts abandonnés, totaux, export, colonnes parties /
 * trajet, fiche (personnes, montants, références) et chronologie.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminPaymentDetail, AdminPaymentListItem, PaymentInsight } from '@/features/payments/types/index'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
const downloadMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/downloadBlob', () => ({ downloadBlob: downloadMock }))

import { paymentsService } from '@/features/payments/services/paymentsService'
import { usePayments } from '@/features/payments/composables/usePayments'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentTotalsBar from '@/features/payments/components/PaymentTotalsBar.vue'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import PaymentTimeline from '@/features/payments/components/PaymentTimeline.vue'
import { bidStatusLabel, paymentKindLabel, routeLabel, shortId, timelineActionLabel } from '@/features/payments/lib/paymentLabels'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="JSON.stringify(to)"><slot /></a>' }
const SENDER = '11111111-2222-3333-4444-555555555555'
const TRAVELER = '99999999-8888-7777-6666-555555555555'
const BID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function insight(over: Partial<PaymentInsight> = {}): PaymentInsight {
  return {
    kind: 'NEGOTIATION', bidId: BID, negotiationThreadId: 'thread-1',
    sender: { id: SENDER, name: 'Awa Diallo (@awa)' }, traveler: { id: TRAVELER, name: 'Moussa Keita' },
    departureCity: 'Lyon', arrivalCity: 'Abidjan', bidStatus: 'IN_TRANSIT', abandoned: false,
    netTravelerCents: 1905, capturedAt: '2026-10-05T10:05:00Z', fxExchangeRate: null,
    stripeChargeId: 'ch_1', stripeDashboardUrl: 'https://dashboard.stripe.com/test/payments/pi_1', ...over,
  }
}
const row = (over: Partial<AdminPaymentListItem> = {}): AdminPaymentListItem => ({
  id: 'p1-0000-0000', bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 2000, commissionCents: 95,
  currency: 'EUR', createdAt: '2026-10-05T10:00:00', insight: insight(), ...over,
})

describe('paymentsService — filtres partagés', () => {
  beforeEach(() => { apiMock.mockReset() })
  const f = { status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, query: '  awa ', hideAbandoned: true } as const

  it('list envoie q (trim) et hideAbandoned', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await paymentsService.list({ ...f }, 0, 20)
    expect(apiMock.mock.calls[0][1].query).toEqual({ q: 'awa', hideAbandoned: 'true', page: 0, size: 20 })
  })
  it('summary, export (blob) et timeline', async () => {
    apiMock.mockResolvedValue([])
    await paymentsService.summary({ ...f, query: '' })
    await paymentsService.exportCsv({ ...f, hideAbandoned: false })
    await paymentsService.timeline('p1')
    expect(apiMock.mock.calls[0]).toEqual(['/admin/payments/summary', { query: { hideAbandoned: 'true' } }])
    expect(apiMock.mock.calls[1]).toEqual(['/admin/payments/export', { query: { q: 'awa' }, responseType: 'blob' }])
    expect(apiMock.mock.calls[2]).toEqual(['/admin/payments/p1/timeline'])
  })
})

describe('usePayments — totaux, recherche, export', () => {
  beforeEach(() => { apiMock.mockReset(); downloadMock.mockReset() })

  function route(totals: unknown) {
    apiMock.mockImplementation((url: string) => {
      if (url === '/admin/payments/summary') return totals instanceof Error ? Promise.reject(totals) : Promise.resolve(totals)
      if (url === '/admin/payments/export') return Promise.resolve(new Blob(['x']))
      return Promise.resolve({ content: [row()], totalElements: 1, totalPages: 3, number: 0, size: 20 })
    })
  }

  it('masque les abandonnés par défaut et charge les totaux avec la liste', async () => {
    route([{ currency: 'EUR', count: 1, escrowCents: 2000, releasedCents: 0, refundedCents: 0, commissionCents: 95, pendingCount: 0 }])
    const p = usePayments()
    expect(p.filters.hideAbandoned).toBe(true)
    await p.fetchPayments(); await flushPromises()
    expect(p.totals.value).toHaveLength(1)
  })
  it('changer de page ne recharge pas les totaux ; chercher, si', async () => {
    route([])
    const p = usePayments()
    await p.fetchPayments(); await flushPromises()
    await p.goToPage(1)
    const summaryCalls = () => apiMock.mock.calls.filter(c => c[0] === '/admin/payments/summary').length
    expect(summaryCalls()).toBe(1)
    await p.setQuery('pi_1'); await p.setHideAbandoned(false); await flushPromises()
    expect(summaryCalls()).toBe(3)
    expect(p.currentPage.value).toBe(0)
    expect(p.filters).toMatchObject({ query: 'pi_1', hideAbandoned: false })
  })
  it('ancien back sans totaux : rien à afficher, pas d’erreur', async () => {
    route(Object.assign(new Error('404'), { statusCode: 404 }))
    const p = usePayments()
    await p.fetchPayments(); await flushPromises()
    expect(p.totals.value).toBeNull()
    expect(p.error.value).toBeNull()
  })
  it('exportCsv télécharge le fichier', async () => {
    route([])
    const p = usePayments()
    await p.exportCsv()
    expect(downloadMock).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^paiements_\d{4}-\d{2}-\d{2}\.csv$/))
    expect(p.exporting.value).toBe(false)
  })
  it('exportCsv refusé : erreur lisible', async () => {
    apiMock.mockRejectedValue(Object.assign(new Error('403'), { data: { detail: 'Accès refusé' } }))
    const p = usePayments()
    await p.exportCsv()
    expect(p.error.value).toBe('Accès refusé')
  })
})

describe('PaymentsTable', () => {
  it('type, trajet, parties et badge checkout abandonné', async () => {
    const w = mount(PaymentsTable, { props: { loading: false, payments: [row(), row({ id: 'p2', status: 'PENDING', insight: insight({ kind: 'BID', abandoned: true }) })] } })
    expect(w.text()).toContain('Négociation')
    expect(w.text()).toContain('Lyon → Abidjan')
    expect(w.find('[data-test="payment-sender-p1-0000-0000"]').text()).toBe('Awa Diallo (@awa)')
    expect(w.text()).toContain('colis aaaaaaaa')
    expect(w.find('[data-test="payment-abandoned-p2"]').exists()).toBe(true)
    await w.find('[data-test="payment-row-p2"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['p2'])
  })
  it('ancien back sans contexte : tirets, pas d’erreur', () => {
    const w = mount(PaymentsTable, { props: { loading: false, payments: [row({ insight: undefined, bidId: BID })] } })
    expect(w.text()).toContain('Colis')
    expect(w.text()).toContain('—')
  })
})

describe('PaymentTotalsBar', () => {
  it('une carte par devise', () => {
    const w = mount(PaymentTotalsBar, { props: { totals: [
      { currency: 'EUR', count: 3, escrowCents: 2000, releasedCents: 10000, refundedCents: 500, commissionCents: 1200, pendingCount: 1 },
      { currency: 'XOF', count: 1, escrowCents: 660000, releasedCents: 0, refundedCents: 0, commissionCents: 60000, pendingCount: 0 },
    ] } })
    expect(w.find('[data-test="payment-totals-EUR"]').text()).toContain('3 paiement(s) · 1 en attente')
    expect(w.find('[data-test="payment-totals-EUR"]').text()).toContain('100,00 EUR')
    expect(w.find('[data-test="payment-totals-XOF"]').text()).toMatch(/6.600,00 XOF/)
  })
  it('rien sans totaux', () => {
    expect(mount(PaymentTotalsBar, { props: { totals: [] } }).find('[data-test="payment-totals"]').exists()).toBe(false)
  })
})

describe('PaymentFilters — recherche et abandonnés', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())
  const base = { modelStatus: 'TOUS', modelMethod: 'TOUS', modelCurrency: 'TOUTES', modelDateFrom: null, modelDateTo: null } as const

  it('recherche envoyée après 300 ms, ou tout de suite sur Entrée', async () => {
    const w = mount(PaymentFilters, { props: { ...base, modelQuery: '' } })
    await w.find('[data-test="payment-search"]').setValue('awa ')
    expect(w.emitted('update:query')).toBeUndefined()
    vi.advanceTimersByTime(300)
    expect(w.emitted('update:query')![0]).toEqual(['awa'])
    await w.find('[data-test="payment-search"]').setValue('pi_1')
    await w.find('[data-test="payment-search"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:query')![1]).toEqual(['pi_1'])
    vi.advanceTimersByTime(500)
    expect(w.emitted('update:query')).toHaveLength(2)
  })
  it('bascule l’affichage des checkouts abandonnés', async () => {
    const w = mount(PaymentFilters, { props: { ...base, modelHideAbandoned: true } })
    expect(w.find('[data-test="chip-abandoned"]').text()).toBe('Afficher les checkouts abandonnés')
    await w.find('[data-test="chip-abandoned"]').trigger('click')
    expect(w.emitted('update:hideAbandoned')![0]).toEqual([false])
  })
})

describe('PaymentDetailPanel — fiche enrichie', () => {
  beforeEach(() => { seedAuth('ADMIN'); apiMock.mockReset().mockResolvedValue([]) })
  const detail = (over: Partial<AdminPaymentDetail> = {}): AdminPaymentDetail => ({
    ...row(), refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false, ...over,
  } as AdminPaymentDetail)

  it('personnes, colis, montants détaillés et lien Stripe', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: detail(), open: true }, global: { stubs: { NuxtLink } } })
    expect(w.find('[data-test="payment-sender-link"]').attributes('href')).toContain(SENDER)
    expect(w.find('[data-test="payment-traveler-link"]').text()).toBe('Moussa Keita')
    expect(w.find('[data-test="payment-bid-link"]').attributes('href')).toContain(BID)
    expect(w.text()).toContain('En transit')
    expect(w.find('[data-test="payment-detail-net"]').text()).toBe('19,05 EUR')
    expect(w.find('[data-test="payment-stripe-link"]').attributes('href')).toBe('https://dashboard.stripe.com/test/payments/pi_1')
    expect(w.find('[data-test="payment-abandoned-notice"]').exists()).toBe(false)
  })
  it('négociation sans colis et checkout abandonné', () => {
    const w = mount(PaymentDetailPanel, {
      props: { payment: detail({ status: 'PENDING', insight: insight({ bidId: null, abandoned: true, bidStatus: null }) }), open: true },
      global: { stubs: { NuxtLink } },
    })
    expect(w.text()).toContain('Pas encore créé (négociation)')
    expect(w.find('[data-test="payment-abandoned-notice"]').exists()).toBe(true)
  })
  it('mobile money : opérations pawaPay et lien vers l’onglet', () => {
    const w = mount(PaymentDetailPanel, {
      props: { payment: detail({ method: 'PAWAPAY', pawapayDepositId: 'dep-1', insight: insight({ stripeDashboardUrl: null }) }), open: true },
      global: { stubs: { NuxtLink } },
    })
    expect(w.text()).toContain('dep-1')
    expect(w.find('[data-test="payment-mobile-money-link"]').exists()).toBe(true)
    expect(w.find('[data-test="payment-stripe-link"]').exists()).toBe(false)
  })
  it('copier la référence', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = mount(PaymentDetailPanel, { props: { payment: detail(), open: true }, global: { stubs: { NuxtLink } } })
    await w.find('[data-test="payment-copy-pi"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('pi_1')
    expect(w.find('[data-test="payment-copy-pi"]').text()).toBe('Copié')
  })
})

describe('PaymentTimeline', () => {
  beforeEach(() => { apiMock.mockReset() })
  it('étapes en clair, auteur et motif', async () => {
    apiMock.mockResolvedValue([
      { at: '2026-10-05T10:00:00', action: 'PAYMENT_CREATED', source: 'PAYMENT', actorId: null, actorKind: null, actorLabel: null, payload: {} },
      { at: '2026-10-06T09:00:00', action: 'ESCROW_FORCE_RELEASED', source: 'AUDIT', actorId: 'a', actorKind: 'ADMIN', actorLabel: 'ops@yadony.com', payload: { reason: 'colis livré, confirmé par téléphone' } },
    ])
    const w = mount(PaymentTimeline, { props: { paymentId: 'p1' } })
    await flushPromises()
    expect(w.find('[data-test="timeline-PAYMENT_CREATED"]').text()).toContain('Paiement créé')
    const forced = w.find('[data-test="timeline-ESCROW_FORCE_RELEASED"]').text()
    expect(forced).toContain('Versement forcé par un admin')
    expect(forced).toContain('admin ops@yadony.com')
    expect(forced).toContain('reason : colis livré, confirmé par téléphone')
  })
  it('ancien back : message de mise à jour', async () => {
    const missing = Object.assign(new Error('404'), { statusCode: 404, data: {} })
    apiMock.mockImplementation(() => Promise.reject(missing))
    const w = mount(PaymentTimeline, { props: { paymentId: 'p1' } })
    await flushPromises()
    expect(w.find('[data-test="payment-timeline-error"]').text()).toContain('après la mise à jour du serveur')
  })
  it('vide', async () => {
    apiMock.mockResolvedValue([])
    const w = mount(PaymentTimeline, { props: { paymentId: 'p1' } })
    await flushPromises()
    expect(w.text()).toContain('Aucun évènement')
  })
})

describe('paymentLabels', () => {
  it('libellés', () => {
    expect(timelineActionLabel('MM_PAYOUT_FAILED')).toBe('Versement mobile money échoué')
    expect(timelineActionLabel('SOMETHING_NEW')).toBe('Something new')
    expect(paymentKindLabel('BID')).toBe('Colis')
    expect(paymentKindLabel(null)).toBe('Colis')
    expect(routeLabel(insight({ departureCity: null }))).toBe('? → Abidjan')
    expect(routeLabel(insight({ departureCity: null, arrivalCity: null }))).toBeNull()
    expect(routeLabel(null)).toBeNull()
    expect(bidStatusLabel('COMPLETED')).toBe('Livré')
    expect(bidStatusLabel('ARRIVED')).toBe('ARRIVED')
    expect(bidStatusLabel(null)).toBeNull()
    expect(shortId(null)).toBe('—')
  })
})
