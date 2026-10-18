/**
 * Page Transactions : le filtre « Versements retenus » se lit dans l'URL (?held=true, liens
 * de la vue d'ensemble et de la fiche utilisateur) et s'y reporte quand on le bascule.
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
const summaryMock = vi.fn()
const exportMock = vi.fn()
vi.mock('@/features/payments/services/paymentsService', () => ({
  paymentsService: {
    list: (...a: unknown[]) => listMock(...a),
    get: (...a: unknown[]) => getMock(...a), forceRelease: vi.fn(), refund: vi.fn(), retryMobileMoneyPayout: vi.fn(), retryMobileMoneyRefund: vi.fn(),
    listChargebacks: vi.fn(),
    summary: (...a: unknown[]) => summaryMock(...a), exportCsv: (...a: unknown[]) => exportMock(...a),
  },
}))

const finance = vi.hoisted(() => ({ listWalletRefundRequests: vi.fn(), resolveWalletRefundRequest: vi.fn(), getWalletRefundRetryPreview: vi.fn(), retryWalletRefundRequest: vi.fn() }))
vi.mock('@/features/finance/services/financeService', () => ({ financeService: finance }))

const replaceMock = vi.fn()

async function mountPage(query: Record<string, string> | { meta: object; query: Record<string, string> } = {}) {
  const route = 'meta' in query ? query : { meta: {}, query }
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
    replaceMock.mockReset().mockResolvedValue(undefined)
    finance.listWalletRefundRequests.mockReset().mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
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
    getMock.mockReset().mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    await mountPage({ open: 'p1' })
    expect(getMock).toHaveBeenCalledWith('p1')
  })

  it('sans paramètre : liste sans filtre de retenue', async () => {
    await mountPage()
    expect(listMock.mock.calls[0][0].held).toBe(false)
  })

  it('?held=true : filtre actif dès le premier chargement, puce enfoncée', async () => {
    const w = await mountPage({ held: 'true' })
    expect(listMock.mock.calls[0][0].held).toBe(true)
    expect(w.find('[data-test="chip-held"]').attributes('aria-pressed')).toBe('true')
  })

  it('basculer la puce reporte le filtre dans l’URL et relit la liste', async () => {
    const w = await mountPage({ tab: 'x' })
    await w.find('[data-test="chip-held"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenCalledWith({ query: { tab: 'x', held: 'true' } })
    expect(listMock.mock.calls.at(-1)![0].held).toBe(true)
  })

  it('désactiver retire held de l’URL', async () => {
    const w = await mountPage({ held: 'true' })
    await w.find('[data-test="chip-held"]').trigger('click')
    await flushPromises()
    expect(replaceMock).toHaveBeenCalledWith({ query: {} })
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
      expect(listMock.mock.calls[0][0].held).toBe(true)
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

    it('un clic sur un onglet le reporte dans l’URL en gardant held, Paiements le retire', async () => {
      const w = await mountPage({ held: 'true' })
      await w.find('[data-test="tab-wallet-refunds"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { held: 'true', tab: 'wallet-refunds' } })
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
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { held: 'true' } })
    })
  })

  it('recherche globale : un ?open arrivé après le montage ouvre la fiche du paiement', async () => {
    const route = reactive({ meta: {}, query: {} as Record<string, string> })
    await mountPage(route)
    getMock.mockReset().mockResolvedValue({ id: 'p1', status: 'ESCROW' })
    route.query = { open: 'p1' }
    await flushPromises()
    expect(getMock).toHaveBeenCalledWith('p1')
  })
})
