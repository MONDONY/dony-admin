/**
 * Page Transactions : le filtre « Versements retenus » se lit dans l'URL (?held=true, liens
 * de la vue d'ensemble et de la fiche utilisateur) et s'y reporte quand on le bascule.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useNuxtApp', () => ({ $firebaseAuth: null }))
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBaseUrl: '', firebaseApiKey: '' } }))

const listMock = vi.fn()
vi.mock('@/features/payments/services/paymentsService', () => ({
  paymentsService: {
    list: (...a: unknown[]) => listMock(...a),
    get: vi.fn(), forceRelease: vi.fn(), refund: vi.fn(), retryMobileMoneyPayout: vi.fn(), retryMobileMoneyRefund: vi.fn(),
    listChargebacks: vi.fn(),
  },
}))

const replaceMock = vi.fn()

async function mountPage(query: Record<string, string> = {}) {
  vi.stubGlobal('useRoute', () => ({ meta: {}, query }))
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
})
