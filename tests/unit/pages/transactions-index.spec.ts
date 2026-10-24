/**
 * Page Transactions : sections, onglets historiques (?tab=), fiche ouverte (?open=) et filtres de
 * la section Paiements dans l'URL. `?held=true` (liens de la vue d'ensemble et de la fiche
 * utilisateur) reste un lien d'entrée : il devient l'alerte HELD (`alert=HELD`, vue À traiter).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))

const listMock = vi.fn()
const getMock = vi.fn()
const countsMock = vi.fn()
const suggestMock = vi.fn()
const financeCountsMock = vi.fn()
const summaryMock = vi.fn()
const exportMock = vi.fn()
const cbListMock = vi.fn()
const cbCountsMock = vi.fn()
vi.mock('@/features/payments/services/paymentsService', () => ({
  paymentsService: {
    list: (...a: unknown[]) => listMock(...a),
    get: (...a: unknown[]) => getMock(...a), forceRelease: vi.fn(), refund: vi.fn(), retryMobileMoneyPayout: vi.fn(), retryMobileMoneyRefund: vi.fn(),
    listChargebacks: (...a: unknown[]) => cbListMock(...a), chargebackCounts: (...a: unknown[]) => cbCountsMock(...a),
    summary: (...a: unknown[]) => summaryMock(...a), exportCsv: (...a: unknown[]) => exportMock(...a),
    counts: (...a: unknown[]) => countsMock(...a), suggest: (...a: unknown[]) => suggestMock(...a),
  },
}))
vi.mock('@/features/transactions/services/transactionsService', () => ({
  transactionsService: { counts: () => financeCountsMock() },
}))
const missing = () => Object.assign(new Error('nf'), { statusCode: 404, data: {} })
const COUNTS = { attention: 2, escrow: 5, releasedRecent: 1, refunded: 0, failed: 0, all: 9, abandoned: 23, alerts: { held: 1, chargebackOpen: 0, mmFailed: 0, escrowJ48: 1 } }
const FINANCE = { payments: 2, mobileMoney: 3, soldes: 0, chargebacks: 1, details: { paymentsAttention: 2, mobileMoneyAttention: 3, walletRefundsPending: 0, cashCommissionsAttention: 0, chargebacksOpen: 1 } }
const P1 = 'aaaaaaaa-1111-4111-8111-111111111111'
const U1 = 'bbbbbbbb-1111-4111-8111-111111111111'
const CB1 = 'cccccccc-1111-4111-8111-111111111111'
const R1 = 'dddddddd-1111-4111-8111-111111111111'
const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }

const finance = vi.hoisted(() => ({
  listWalletRefundRequests: vi.fn(), resolveWalletRefundRequest: vi.fn(), getWalletRefundRetryPreview: vi.fn(), retryWalletRefundRequest: vi.fn(),
  listMobileMoneyPayments: vi.fn(), mobileMoneyCounts: vi.fn(), listWallets: vi.fn(), listCashCommissions: vi.fn(), cashCommissionCounts: vi.fn(),
  getMobileMoneyCommissionsForDays: vi.fn(),
}))
vi.mock('@/features/finance/services/financeService', () => ({ financeService: finance }))

const replaceMock = vi.fn()

async function mountPage(query: Record<string, string> | { meta: object; query: Record<string, string> } = {}) {
  const route = 'meta' in query ? query : { meta: {}, query }
  // Comme le vrai routeur : la query suit le dernier `replace`.
  replaceMock.mockImplementation(async (to: { query: Record<string, string> }) => { route.query = to.query })
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => ({ replace: replaceMock }))
  const mod = await import('@/pages/transactions/index.vue')
  const w = mount(mod.default, { global: { stubs: { PaymentDetailPanel: true, PaginationControls: true, NuxtLink: true } } })
  await flushPromises()
  return w
}

describe('pages/transactions', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    listMock.mockReset().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    replaceMock.mockReset()
    countsMock.mockReset().mockResolvedValue(COUNTS)
    suggestMock.mockReset().mockResolvedValue({ senders: [], travelers: [], trips: [], parcels: [] })
    financeCountsMock.mockReset().mockRejectedValue(missing())
    getMock.mockReset().mockResolvedValue({ id: P1, status: 'ESCROW' })
    finance.listWalletRefundRequests.mockReset().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    finance.listMobileMoneyPayments.mockReset().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    finance.mobileMoneyCounts.mockReset().mockResolvedValue({ failed: 2, open: 1, done: 7, all: 10, attention: 2 })
    finance.listWallets.mockReset().mockResolvedValue(EMPTY)
    finance.listCashCommissions.mockReset().mockResolvedValue(EMPTY)
    finance.cashCommissionCounts.mockReset().mockResolvedValue({ attention: 1, all: 3 })
    cbListMock.mockReset().mockResolvedValue(EMPTY)
    cbCountsMock.mockReset().mockResolvedValue({ open: 1, won: 2, lost: 0, all: 3 })
  })

  it('totaux par devise et export CSV de la liste filtrée', async () => {
    summaryMock.mockReset().mockResolvedValue([{ currency: 'EUR', count: 2, escrowCents: 100, releasedCents: 0, refundedCents: 0, commissionCents: 10, pendingCount: 0 }])
    exportMock.mockReset().mockResolvedValue(new Blob(['x']))
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() })
    const w = await mountPage()
    expect(summaryMock.mock.calls[0][0]).toMatchObject({ hideAbandoned: true })
    expect(w.find('[data-test="payment-totals-EUR"]').exists()).toBe(true)
    await w.find('[data-test="payments-export"]').trigger('click')
    await flushPromises()
    expect(exportMock).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalled()
  })

  it('sans droit d’export : pas de bouton', async () => {
    seedAuth('ADMIN', { EXPORT_RUN: false })
    const w = await mountPage()
    expect(w.find('[data-test="payments-export"]').exists()).toBe(false)
  })

  it('?open=<paymentId> (lien depuis une alerte) : ouvre la fiche du paiement', async () => {
    await mountPage({ open: P1 })
    expect(getMock).toHaveBeenCalledWith(P1)
  })

  it('?open= qui n’est pas un identifiant de paiement : ignoré, aucun appel', async () => {
    await mountPage({ open: '../../admin/x' })
    expect(getMock).not.toHaveBeenCalled()
  })

  it('?tab=payments&open= ouvre la fiche ; avec un autre onglet, `open` n’est pas un paiement', async () => {
    await mountPage({ tab: 'payments', open: P1 })
    expect(getMock).toHaveBeenCalledWith(P1)
    getMock.mockClear()
    await mountPage({ tab: 'chargebacks', open: P1 })
    expect(getMock).not.toHaveBeenCalled()
  })

  it('filtres de l’URL (?status=ESCROW&method=PAWAPAY&currency=XOF&dateFrom=…) appliqués au premier chargement', async () => {
    await mountPage({ status: 'ESCROW', method: 'PAWAPAY', currency: 'XOF', dateFrom: '2026-07-01', dateTo: '2026-07-31', hideAbandoned: 'false' })
    expect(listMock).toHaveBeenCalledTimes(1)
    expect(listMock.mock.calls[0][0]).toMatchObject({
      status: 'ESCROW', method: 'PAWAPAY', currency: 'XOF', dateFrom: '2026-07-01', dateTo: '2026-07-31', hideAbandoned: false,
    })
  })

  it('un filtre inconnu dans l’URL est ignoré', async () => {
    await mountPage({ status: 'PIRATE', currency: 'ZZZ', dateFrom: 'hier' })
    expect(listMock.mock.calls[0][0]).toMatchObject({ status: 'TOUS', currency: 'TOUTES', dateFrom: null })
  })

  it('changer la méthode réécrit l’URL sans toucher à l’onglet', async () => {
    const w = await mountPage({ tab: 'payments' })
    await w.find('[data-test="filter-method"]').setValue('STRIPE')
    await flushPromises()
    // Un filtre présent fait de « Tous » la vue par défaut : la vue courante (À traiter) s'écrit donc aussi.
    expect(replaceMock).toHaveBeenCalledWith({ query: { tab: 'payments', method: 'STRIPE', view: 'ATTENTION' } })
  })

  it('les onglets sont regroupés par sujet', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="tab-group-Paiements"]').findAll('button')).toHaveLength(2)
    expect(w.find('[data-test="tab-group-Mobile money"]').findAll('button')).toHaveLength(2)
    expect(w.find('[data-test="tab-group-Soldes"]').findAll('button')).toHaveLength(3)
  })

  it('sans paramètre : vue À traiter, sans filtre de retenue, URL intacte', async () => {
    await mountPage()
    expect(listMock.mock.calls[0][0]).toMatchObject({ view: 'ATTENTION', alert: null, held: false })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('?held=true : alerte HELD et vue À traiter dès le premier chargement, puce enfoncée, `held` retiré de l’URL', async () => {
    const w = await mountPage({ held: 'true' })
    expect(listMock.mock.calls[0][0]).toMatchObject({ alert: 'HELD', view: 'ATTENTION' })
    expect(w.find('[data-test="chip-held"]').attributes('aria-pressed')).toBe('true')
    expect(w.find('[data-test="active-chip-alert"]').text()).toContain('Versement retenu')
    expect(replaceMock).toHaveBeenCalledWith({ query: { alert: 'HELD', view: 'ATTENTION' } })
  })

  it('basculer la puce reporte l’alerte HELD dans l’URL et relit la liste', async () => {
    const w = await mountPage({ tab: 'x' })
    await w.find('[data-test="chip-held"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenCalledWith({ query: { tab: 'x', alert: 'HELD', view: 'ATTENTION' } })
    expect(listMock.mock.calls.at(-1)![0].alert).toBe('HELD')
  })

  it('désactiver retire l’alerte de l’URL', async () => {
    const w = await mountPage({ held: 'true' })
    await w.find('[data-test="chip-held"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
  })

  it('page déjà ouverte : un ?held=true arrivé ensuite filtre sur l’alerte HELD', async () => {
    const route = reactive({ meta: {}, query: {} as Record<string, string> })
    await mountPage(route)
    route.query = { held: 'true' }
    await flushPromises()
    expect(listMock.mock.calls.at(-1)![0]).toMatchObject({ alert: 'HELD', view: 'ATTENTION' })
    expect(route.query).toEqual({ alert: 'HELD', view: 'ATTENTION' })
  })

  it('ancien back : le filtre non pris en charge est signalé', async () => {
    listMock.mockResolvedValue({ content: [{ id: 'p1', bidId: null, status: 'ESCROW', method: 'STRIPE', amountCents: 1, commissionCents: 0, currency: 'EUR', createdAt: '2026-09-01' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const w = await mountPage({ held: 'true' })
    expect(w.find('[data-test="held-filter-unsupported"]').exists()).toBe(true)
  })
  describe('onglet dans l’URL (?tab=)', () => {
    it('?tab=wallet-refunds : onglet Remboursements wallet ouvert et chargé', async () => {
      const w = await mountPage({ tab: 'wallet-refunds' })
      expect(w.find('[data-test="tab-wallet-refunds"]').attributes('aria-pressed')).toBe('true')
      expect(finance.listWalletRefundRequests).toHaveBeenCalledTimes(1)
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('onglet Remboursements wallet : toutes les demandes par défaut, puis filtre par vue', async () => {
      const w = await mountPage({ tab: 'wallet-refunds' })
      expect(finance.listWalletRefundRequests).toHaveBeenLastCalledWith(0, 20, ['PENDING', 'PROCESSING', 'FAILED', 'REFUNDED', 'RESOLVED'])
      expect(w.find('[data-test="wrr-view-all"]').attributes('aria-pressed')).toBe('true')
      await w.find('[data-test="wrr-view-failed"]').trigger('click')
      await flushPromises()
      expect(finance.listWalletRefundRequests).toHaveBeenLastCalledWith(0, 20, ['FAILED'])
      expect(w.find('[data-test="wrr-view-failed"]').attributes('aria-pressed')).toBe('true')
      expect(w.text()).toContain('Aucun remboursement en échec')
      await w.find('[data-test="wrr-view-failed"]').trigger('click')
      await flushPromises()
      expect(finance.listWalletRefundRequests).toHaveBeenCalledTimes(2)
    })

    it('?tab= se combine avec ?held=true sans le perdre', async () => {
      const w = await mountPage({ tab: 'wallet-refunds', held: 'true' })
      expect(listMock.mock.calls[0][0].alert).toBe('HELD')
      expect(w.find('[data-test="tab-wallet-refunds"]').attributes('aria-pressed')).toBe('true')
    })

    it('valeur inconnue : onglet Paiements', async () => {
      const w = await mountPage({ tab: 'nimporte' })
      expect(w.find('[data-test="tab-payments"]').attributes('aria-pressed')).toBe('true')
    })

    it('navigation interne vers ?tab=wallet-refunds alors que la page est ouverte', async () => {
      const route = reactive({ meta: {}, query: {} as Record<string, string> })
      const w = await mountPage(route)
      route.query = { tab: 'wallet-refunds' }
      await flushPromises()
      expect(w.find('[data-test="tab-wallet-refunds"]').attributes('aria-pressed')).toBe('true')
      expect(finance.listWalletRefundRequests).toHaveBeenCalledTimes(1)
    })

    it('un clic sur un onglet le reporte dans l’URL sans les paramètres des Paiements ; revenir aux Paiements les réécrit', async () => {
      const w = await mountPage({ held: 'true' })
      await w.find('[data-test="tab-wallet-refunds"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'wallet-refunds' } })
      await w.find('[data-test="tab-payments"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { alert: 'HELD', view: 'ATTENTION' } })
      expect(listMock.mock.calls.at(-1)![0].alert).toBe('HELD')
    })

    it('Marquer remboursée ouvre la saisie du montant versé, puis envoie {paidAmount, note}', async () => {
      const pending = { id: 'r1', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-17T10:00:00', channel: 'MANUAL_ADMIN' }
      finance.listWalletRefundRequests.mockResolvedValue({ content: [pending], totalElements: 1, totalPages: 1, number: 0, size: 20 })
      finance.resolveWalletRefundRequest.mockReset().mockResolvedValue({ ...pending, status: 'RESOLVED', paidAmount: 487 })
      const w = await mountPage({ tab: 'wallet-refunds' })
      expect(w.find('[data-test="wrr-resolve-dialog"]').exists()).toBe(false)
      await w.find('[data-test="wrr-resolve-r1"]').trigger('click')
      expect(finance.resolveWalletRefundRequest).not.toHaveBeenCalled()
      await w.find('[data-test="wrr-paid-amount"]').setValue('487')
      await w.find('[data-test="wrr-note"]').setValue('Wave')
      await w.find('[data-test="wrr-resolve-confirm"]').trigger('click')
      await flushPromises()
      expect(finance.resolveWalletRefundRequest).toHaveBeenCalledWith('r1', { paidAmount: 487, note: 'Wave' })
      expect(w.find('[data-test="wrr-resolve-dialog"]').exists()).toBe(false)
      expect(finance.listWalletRefundRequests).toHaveBeenCalledTimes(2)
    })

    it('un refus du back reste dans la boîte de dialogue, et Annuler la ferme', async () => {
      const pending = { id: 'r1', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-17T10:00:00', channel: 'MANUAL_ADMIN' }
      finance.listWalletRefundRequests.mockResolvedValue({ content: [pending], totalElements: 1, totalPages: 1, number: 0, size: 20 })
      finance.resolveWalletRefundRequest.mockReset().mockRejectedValue({ data: { detail: 'Cette demande a déjà été traitée' } })
      const w = await mountPage({ tab: 'wallet-refunds' })
      await w.find('[data-test="wrr-resolve-r1"]').trigger('click')
      await w.find('[data-test="wrr-resolve-confirm"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="wrr-resolve-error"]').text()).toBe('Cette demande a déjà été traitée')
      await w.find('[data-test="wrr-resolve-cancel"]').trigger('click')
      expect(w.find('[data-test="wrr-resolve-dialog"]').exists()).toBe(false)
    })

    const MOMO_CHILD = { id: 'r1', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00', channel: 'MANUAL_ADMIN', sourceRail: 'PAWAPAY', parentRequestId: 'p0', failureReason: 'PAWAPAY_WALLET_OUT_OF_FUNDS' }
    const PREVIEW_OK = { requestId: 'r1', currency: 'XOF', country: 'CI', provider: 'ORANGE_CIV', msisdnMasked: '+225 •••• 90', grossAmount: 500, amountDue: 477, walletBalance: 491.5, maxSafeAmount: 477, suggestedAmount: 477, topUpNeeded: 0, refundRatePercent: 3, retryAvailable: true, unavailableReason: null }

    it('Relancer le remboursement : aperçu, envoi du dû, ligne « En cours » puis rechargement', async () => {
      finance.listWalletRefundRequests.mockResolvedValue({ content: [{ ...MOMO_CHILD }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
      finance.getWalletRefundRetryPreview.mockReset().mockResolvedValue(PREVIEW_OK)
      let release: (_v: unknown) => void = () => {}
      finance.retryWalletRefundRequest.mockReset().mockResolvedValue({ request: { ...MOMO_CHILD, status: 'PROCESSING' }, amount: 477, amountDue: 477, walletBalance: 491.5, maxSafeAmount: 477 })
      const w = await mountPage({ tab: 'wallet-refunds' })
      finance.listWalletRefundRequests.mockImplementation(() => new Promise((r) => { release = r }))
      await w.find('[data-test="wrr-retry-r1"]').trigger('click')
      await flushPromises()
      expect(finance.getWalletRefundRetryPreview).toHaveBeenCalledWith('r1')
      expect(w.find('[data-test="wrr-retry-due"]').text()).toContain('477')
      await w.find('[data-test="wrr-retry-confirm"]').trigger('click')
      await flushPromises()
      expect(finance.retryWalletRefundRequest).toHaveBeenCalledWith('r1', { amount: 477 })
      expect(w.find('[data-test="wrr-retry-dialog"]').exists()).toBe(false)
      expect(w.find('[data-test="wrr-row-r1"]').text()).toContain('En cours')
      release({ content: [{ ...MOMO_CHILD, status: 'PROCESSING' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
      await flushPromises()
      expect(finance.listWalletRefundRequests).toHaveBeenCalledTimes(2)
    })

    it('Relancer : un 422 de l’aperçu s’affiche, un 422 de l’envoi reste dans la fenêtre, Actualiser relit', async () => {
      finance.listWalletRefundRequests.mockResolvedValue({ content: [{ ...MOMO_CHILD }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
      finance.getWalletRefundRetryPreview.mockReset().mockRejectedValueOnce({ data: { detail: 'Cette demande ne vient pas d’une recharge mobile money : remboursez hors app' } })
      const w = await mountPage({ tab: 'wallet-refunds' })
      await w.find('[data-test="wrr-retry-r1"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="wrr-retry-preview-error"]').text()).toContain('remboursez hors app')
      expect((w.find('[data-test="wrr-retry-confirm"]').element as HTMLButtonElement).disabled).toBe(true)
      await w.find('[data-test="wrr-retry-cancel"]').trigger('click')
      expect(w.find('[data-test="wrr-retry-dialog"]').exists()).toBe(false)

      finance.getWalletRefundRetryPreview.mockResolvedValueOnce({ ...PREVIEW_OK, walletBalance: 487.5, maxSafeAmount: 473, suggestedAmount: null, topUpNeeded: 4, retryAvailable: false, unavailableReason: 'pawapay-insufficient-funds' })
      await w.find('[data-test="wrr-retry-r1"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="wrr-retry-topup"]').text()).toContain('4 XOF')
      finance.getWalletRefundRetryPreview.mockResolvedValueOnce(PREVIEW_OK)
      await w.find('[data-test="wrr-retry-refresh"]').trigger('click')
      await flushPromises()
      expect(finance.getWalletRefundRetryPreview).toHaveBeenCalledTimes(3)
      finance.retryWalletRefundRequest.mockReset().mockRejectedValue({ data: { detail: 'Le wallet pawaPay CI XOF ne couvre pas le montant dû' } })
      await w.find('[data-test="wrr-retry-confirm"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="wrr-retry-error"]').text()).toContain('ne couvre pas')
      expect(w.find('[data-test="wrr-retry-dialog"]').exists()).toBe(true)
      expect(w.find('[data-test="wrr-retry-due"]').text()).toContain('477')
    })

    it('revenir sur Paiements retire tab de l’URL', async () => {
      const w = await mountPage({ tab: 'wallet-refunds', held: 'true' })
      await w.find('[data-test="tab-payments"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { alert: 'HELD', view: 'ATTENTION' } })
    })
  })

  it('recherche globale : un ?open arrivé après le montage ouvre la fiche du paiement', async () => {
    const route = reactive({ meta: {}, query: {} as Record<string, string> })
    await mountPage(route)
    route.query = { open: P1 }
    await flushPromises()
    expect(getMock).toHaveBeenCalledWith(P1)
  })

  describe('sections et vues', () => {
    it('avec les nombres des sections : quatre sections à pastilles, un clic émet l’onglet historique', async () => {
      financeCountsMock.mockResolvedValue(FINANCE)
      const w = await mountPage()
      expect(w.find('[data-test="tab-payments"]').exists()).toBe(false)
      expect(w.find('[data-test="section-mobile-money"] [data-test="tab-count"]').text()).toBe('3')
      await w.find('[data-test="section-wallets"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'wallets' } })
      expect(w.find('[data-test="sub-wallets"]').attributes('aria-pressed')).toBe('true')
    })

    it('?tab=wallet-refunds avec sections : section Soldes, sous-onglet Remboursements wallet', async () => {
      financeCountsMock.mockResolvedValue(FINANCE)
      const w = await mountPage({ tab: 'wallet-refunds' })
      expect(w.find('[data-test="section-wallets"]').attributes('aria-pressed')).toBe('true')
      expect(w.find('[data-test="sub-wallet-refunds"]').attributes('aria-pressed')).toBe('true')
    })

    it('nombres pas encore reçus : quatre sections sans pastille et hauteur des vues réservée, puis les nombres', async () => {
      let releaseFinance: (_v: unknown) => void = () => {}
      let releaseViews: (_v: unknown) => void = () => {}
      financeCountsMock.mockImplementation(() => new Promise((r) => { releaseFinance = r }))
      countsMock.mockImplementation(() => new Promise((r) => { releaseViews = r }))
      const w = await mountPage()
      expect(w.find('[data-test="tab-payments"]').exists()).toBe(false)
      expect(w.findAll('[data-test^="section-"]')).toHaveLength(4)
      expect(w.find('[data-test="tab-count"]').exists()).toBe(false)
      expect(w.find('[data-test="payment-views-skeleton"]').exists()).toBe(true)
      expect(w.find('[data-test="payment-view-ATTENTION"]').exists()).toBe(false)
      releaseFinance(FINANCE); releaseViews(COUNTS)
      await flushPromises()
      expect(w.find('[data-test="section-mobile-money"] [data-test="tab-count"]').text()).toBe('3')
      expect(w.find('[data-test="payment-views-skeleton"]').exists()).toBe(false)
      expect(w.find('[data-test="payment-view-ATTENTION"]').exists()).toBe(true)
    })

    it('ancien back : sections le temps de la réponse, puis les sept onglets plats ; ni vues ni réserve de hauteur', async () => {
      countsMock.mockRejectedValue(missing())
      const w = await mountPage()
      expect(w.find('[data-test="tab-payments"]').exists()).toBe(true)
      expect(w.find('[data-test^="section-"]').exists()).toBe(false)
      expect(w.find('[data-test="payment-views-skeleton"]').exists()).toBe(false)
      expect(w.find('[data-test="payment-view-ATTENTION"]').exists()).toBe(false)
    })

    it('nombres des sections en erreur : onglets plats et message', async () => {
      financeCountsMock.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500 }))
      const w = await mountPage()
      expect(w.find('[data-test="tab-payments"]').exists()).toBe(true)
      expect(w.find('[data-test="finance-counts-error"]').exists()).toBe(true)
    })

    it('un geste relit la liste, les nombres des vues et les pastilles', async () => {
      const w = await mountPage({ open: P1 })
      const before = [listMock.mock.calls.length, countsMock.mock.calls.length, financeCountsMock.mock.calls.length]
      w.findComponent({ name: 'PaymentDetailPanel' }).vm.$emit('refund')
      await flushPromises()
      expect([listMock.mock.calls.length, countsMock.mock.calls.length, financeCountsMock.mock.calls.length]).toEqual(before.map(n => n + 1))
    })

    it('un geste réussi relit aussi la fiche ouverte', async () => {
      const w = await mountPage({ open: P1 })
      const before = getMock.mock.calls.length
      w.findComponent({ name: 'PaymentDetailPanel' }).vm.$emit('refund')
      await flushPromises()
      expect(getMock.mock.calls.length).toBe(before + 1)
      expect(getMock).toHaveBeenLastCalledWith(P1)
    })

    it('fiche : ouverte depuis la liste → ?open= ; onglet → ?section= ; fermée → retirés', async () => {
      const w = await mountPage()
      w.findComponent({ name: 'PaymentsTable' }).vm.$emit('select', P1)
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: expect.objectContaining({ open: P1 }) })
      const panel = w.findComponent({ name: 'PaymentDetailPanel' })
      panel.vm.$emit('update:section', 'incidents')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: expect.objectContaining({ open: P1, section: 'incidents' }) })
      panel.vm.$emit('close')
      await flushPromises()
      const last = replaceMock.mock.calls.at(-1)![0].query
      expect(last.open).toBeUndefined()
      expect(last.section).toBeUndefined()
      expect(w.findComponent({ name: 'PaymentDetailPanel' }).exists()).toBe(false)
    })

    it('?open=&section= : la fiche s’ouvre sur l’onglet demandé', async () => {
      const w = await mountPage({ open: P1, section: 'incidents' })
      expect(w.findComponent({ name: 'PaymentDetailPanel' }).props('section')).toBe('incidents')
    })

    it('vues à nombre, lien « checkouts abandonnés masqués · les afficher »', async () => {
      const w = await mountPage()
      expect(w.find('[data-test="payment-view-ATTENTION"] [data-test="tab-count"]').text()).toBe('2')
      expect(w.find('[data-test="abandoned-hidden"]').text()).toContain('23 checkouts abandonnés masqués')
      await w.find('[data-test="abandoned-show"]').trigger('click')
      await flushPromises()
      expect(listMock.mock.calls.at(-1)![0].hideAbandoned).toBe(false)
      expect(w.find('[data-test="abandoned-hidden"]').exists()).toBe(false)
    })

    it('ancien back (nombres absents) : pas de vues, aucun nombre, vue Tous', async () => {
      countsMock.mockRejectedValue(missing())
      const w = await mountPage()
      expect(w.find('[data-test="payment-view-ATTENTION"]').exists()).toBe(false)
      expect(w.find('[data-test="abandoned-hidden"]').exists()).toBe(false)
      expect(w.text()).not.toContain('Rien à traiter')
      expect(replaceMock).not.toHaveBeenCalled()
    })

    it('nombres des vues en erreur : message et Réessayer', async () => {
      countsMock.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500 }))
      const w = await mountPage()
      expect(w.find('[data-test="payment-counts-error"]').exists()).toBe(true)
      countsMock.mockResolvedValue(COUNTS)
      await w.find('[data-test="payment-counts-retry"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="payment-counts-error"]').exists()).toBe(false)
    })
  })

  describe('section Mobile money', () => {
    it('?tab=mobile-money&view=done&kind=PAYOUT : filtres de la section, pas ceux des Paiements', async () => {
      await mountPage({ tab: 'mobile-money', view: 'done', kind: 'PAYOUT', query: 'awa' })
      expect(finance.listMobileMoneyPayments.mock.calls[0][0]).toMatchObject({ view: 'DONE', kind: 'PAYOUT', q: 'awa' })
      expect(listMock.mock.calls[0][0].query).toBe('')
      expect(listMock.mock.calls[0][0].view).toBe('ATTENTION')
    })
    it('vue par défaut Échecs quand il y a de l’attention ; écrite dans l’URL en minuscules avec tab', async () => {
      await mountPage({ tab: 'mobile-money' })
      expect(finance.listMobileMoneyPayments.mock.calls[0][0]).toMatchObject({ view: 'FAILED' })
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'mobile-money', view: 'failed' } })
    })
    it('un clic sur la vue Réussies recharge la liste et l’URL', async () => {
      const w = await mountPage({ tab: 'mobile-money' })
      await w.find('[data-test="mm-view-DONE"]').trigger('click')
      await flushPromises()
      expect(finance.listMobileMoneyPayments.mock.calls.at(-1)![0]).toMatchObject({ view: 'DONE', page: 0 })
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'mobile-money', view: 'done' } })
    })
    it('quitter la section retire ses paramètres et revenir aux Paiements ne les reprend pas', async () => {
      const w = await mountPage({ tab: 'mobile-money', view: 'done', kind: 'PAYOUT' })
      await w.find('[data-test="tab-payments"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
    })
    it('ancien back : pas de vues, liste plate', async () => {
      finance.mobileMoneyCounts.mockReset().mockRejectedValue(missing())
      const w = await mountPage({ tab: 'mobile-money', view: 'failed' })
      expect(w.find('[data-test="mm-view-FAILED"]').exists()).toBe(false)
      expect(finance.listMobileMoneyPayments.mock.calls[0][0]).toMatchObject({ view: 'ALL' })
    })
    it('vue Échecs vide : « Aucune opération en échec »', async () => {
      const w = await mountPage({ tab: 'mobile-money' })
      expect(w.text()).toContain('Aucune opération en échec')
    })
  })

  describe('sections Soldes et Litiges bancaires', () => {
    const W = { id: 'w1', userId: U1, balanceCents: 100, currency: 'EUR', updatedAt: '2026-10-01T10:00:00', userName: 'Awa Diallo' }
    const CB = { id: CB1, bidId: null, amountCents: 100, currency: 'EUR', reason: 'fraudulent', status: 'WON', openedAt: '2026-10-01T10:00:00' }

    it('Paiements filtrés → Portefeuilles : URL de l’onglet seule ; un filtre des portefeuilles s’y écrit, pas dans Paiements', async () => {
      const w = await mountPage({ view: 'ESCROW', query: 'awa', currency: 'XOF', partyId: P1 })
      await w.find('[data-test="tab-wallets"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'wallets' } })
      expect(finance.listWallets.mock.calls[0][0]).toMatchObject({ q: '', currency: '', partyId: '' })
      await w.find('[data-test="wallets-filter-sign"]').setValue('NEGATIVE')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'wallets', balanceSign: 'NEGATIVE' } })
      await w.find('[data-test="tab-payments"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { view: 'ESCROW', query: 'awa', currency: 'XOF', partyId: P1 } })
    })

    it('?tab=wallets&partyId= (fiche utilisateur) : portefeuilles du titulaire, puce à son nom', async () => {
      finance.listWallets.mockResolvedValue({ ...EMPTY, content: [W], totalElements: 1, totalPages: 1 })
      const w = await mountPage({ tab: 'wallets', partyId: U1 })
      expect(finance.listWallets.mock.calls[0][0]).toMatchObject({ partyId: U1 })
      expect(listMock.mock.calls[0][0].partyId).toBeFalsy()
      expect(w.find('[data-test="active-chip-partyId"]').text()).toContain('Titulaire : Awa Diallo')
      expect(w.find('[data-test="wallet-holder-w1"]').exists()).toBe(true)
    })

    it('page déjà ouverte sur Portefeuilles : un lien vers un autre titulaire est appliqué', async () => {
      const route = reactive({ meta: {}, query: { tab: 'wallets' } as Record<string, string> })
      await mountPage(route)
      route.query = { tab: 'wallets', partyId: U1 }
      await flushPromises()
      expect(finance.listWallets.mock.calls.at(-1)![0]).toMatchObject({ partyId: U1, page: 0 })
    })

    it('liste en échec : message, jamais l’état vide', async () => {
      finance.listWallets.mockRejectedValue({ data: { detail: 'Accès refusé' } })
      const w = await mountPage({ tab: 'wallets' })
      expect(w.find('[data-test="transactions-error"]').text()).toBe('Accès refusé')
      expect(w.text()).not.toContain('Aucun portefeuille')
    })

    it('commissions cash : vue À traiter par défaut, écrite dans l’URL ; Toutes au clic', async () => {
      const w = await mountPage({ tab: 'cash-commissions' })
      expect(finance.listCashCommissions.mock.calls[0][0]).toMatchObject({ view: 'ATTENTION' })
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'cash-commissions', view: 'attention' } })
      expect(w.find('[data-test="cash-view-ATTENTION"] [data-test="tab-count"]').text()).toBe('1')
      await w.find('[data-test="cash-view-ALL"]').trigger('click')
      await flushPromises()
      expect(finance.listCashCommissions.mock.calls.at(-1)![0]).toMatchObject({ view: 'ALL' })
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'cash-commissions' } })
    })

    it('commissions cash, ancien back : pas de vues, liste plate', async () => {
      finance.cashCommissionCounts.mockRejectedValue(missing())
      const w = await mountPage({ tab: 'cash-commissions', view: 'attention' })
      expect(w.find('[data-test="cash-view-ATTENTION"]').exists()).toBe(false)
      expect(finance.listCashCommissions.mock.calls[0][0]).toMatchObject({ view: 'ALL' })
    })

    it('litiges : vue Ouverts par défaut ; nombres en erreur gardés et Réessayer', async () => {
      const w = await mountPage({ tab: 'chargebacks' })
      expect(cbListMock.mock.calls[0][0]).toMatchObject({ view: 'OPEN' })
      cbCountsMock.mockRejectedValueOnce(Object.assign(new Error('x'), { statusCode: 500 }))
      await w.find('[data-test="cb-search"]').setValue('dakar')
      await w.find('[data-test="cb-search"]').trigger('keydown', { key: 'Enter' })
      await flushPromises()
      expect(w.find('[data-test="cb-counts-error"]').exists()).toBe(true)
      expect(w.find('[data-test="cb-view-OPEN"] [data-test="tab-count"]').text()).toBe('1')
      await w.find('[data-test="cb-counts-retry"]').trigger('click')
      await flushPromises()
      expect(w.find('[data-test="cb-counts-error"]').exists()).toBe(false)
    })

    it('?tab=chargebacks&open=<litige> : vue Tous, ligne mise en évidence, aucun tiroir paiement', async () => {
      cbListMock.mockResolvedValue({ ...EMPTY, content: [CB], totalElements: 1, totalPages: 1 })
      const w = await mountPage({ tab: 'chargebacks', open: CB1 })
      expect(cbListMock.mock.calls[0][0]).toMatchObject({ view: 'ALL' })
      expect(w.find(`[data-test="cb-row-${CB1}"]`).attributes('aria-current')).toBe('true')
      expect(getMock).not.toHaveBeenCalled()
    })

    it('quitter les litiges retire leurs paramètres (open compris) : rien n’ouvre un paiement en revenant', async () => {
      const w = await mountPage({ tab: 'chargebacks', open: CB1, query: 'dakar' })
      await w.find('[data-test="tab-payments"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: {} })
      expect(getMock).not.toHaveBeenCalled()
    })

    it('?tab=wallet-refunds avec des tickets en attente : vue À traiter', async () => {
      financeCountsMock.mockResolvedValue({ ...FINANCE, details: { ...FINANCE.details, walletRefundsPending: 2 } })
      const w = await mountPage({ tab: 'wallet-refunds' })
      expect(finance.listWalletRefundRequests).toHaveBeenLastCalledWith(0, 20, ['PENDING'])
      expect(w.find('[data-test="wrr-view-pending"]').attributes('aria-pressed')).toBe('true')
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { tab: 'wallet-refunds', view: 'pending' } })
    })

    it('?tab=wallet-refunds&open=<demande> : toutes les demandes, ligne mise en évidence', async () => {
      financeCountsMock.mockResolvedValue({ ...FINANCE, details: { ...FINANCE.details, walletRefundsPending: 2 } })
      finance.listWalletRefundRequests.mockResolvedValue({ ...EMPTY, content: [{ id: R1, userId: 'u1', currency: 'XOF', amount: 5, status: 'FAILED', requestedAt: '2026-10-01T10:00:00' }], totalElements: 1, totalPages: 1 })
      const w = await mountPage({ tab: 'wallet-refunds', open: R1 })
      expect(finance.listWalletRefundRequests).toHaveBeenLastCalledWith(0, 20, ['PENDING', 'PROCESSING', 'FAILED', 'REFUNDED', 'RESOLVED'])
      expect(w.find(`[data-test="wrr-row-${R1}"]`).attributes('aria-current')).toBe('true')
      expect(getMock).not.toHaveBeenCalled()
    })
  })
})
