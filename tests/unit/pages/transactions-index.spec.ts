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
vi.mock('@/features/payments/services/paymentsService', () => ({
  paymentsService: {
    list: (...a: unknown[]) => listMock(...a),
    get: (...a: unknown[]) => getMock(...a), forceRelease: vi.fn(), refund: vi.fn(), retryMobileMoneyPayout: vi.fn(), retryMobileMoneyRefund: vi.fn(),
    listChargebacks: vi.fn(),
  },
}))

const finance = vi.hoisted(() => ({ listWalletRefundRequests: vi.fn() }))
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

    it('revenir sur Paiements retire tab de l’URL', async () => {
      const w = await mountPage({ tab: 'wallet-refunds', held: 'true' })
      await w.find('[data-test="tab-payments"]').trigger('click')
      await flushPromises()
      expect(replaceMock).toHaveBeenLastCalledWith({ query: { held: 'true' } })
    })
  })
})
