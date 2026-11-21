/**
 * Page /promo : filtre Origine, combiné au filtre de statut, et message sur 409.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', () => {})
const svc = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), setStatus: vi.fn(), remove: vi.fn() }))
vi.mock('@/features/promo/services/promoService', () => ({ promoService: svc }))

const code = (id: string, status: 'ACTIVE' | 'DISABLED', origin?: string) => ({
  id, code: id.toUpperCase(), rate: 0.05, target: 'ANY', validFrom: null, validTo: null, maxRedemptions: null,
  perUserLimit: 1, redeemedCount: 0, status, createdAt: '2026-01-01T00:00:00', origin,
})

async function mountPage() {
  seedAuth('ADMIN', {})
  const mod = await import('@/pages/promo/index.vue')
  const w = mount(mod.default, { global: { stubs: { NuxtLink: { props: ['to'], template: '<a :data-to="to"><slot /></a>' } } } })
  await flushPromises()
  return w
}

describe('/promo filtre Origine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list.mockResolvedValue([code('a', 'ACTIVE', 'ADMIN'), code('r', 'DISABLED', 'REFERRAL_REWARD')])
    svc.setStatus.mockResolvedValue({})
  })

  it('charge tout par défaut et propose Tous, Créés par l\'admin, Parrainage', async () => {
    const w = await mountPage()
    expect(svc.list).toHaveBeenCalledWith('ALL')
    const sel = w.find('[data-test="promo-origin-ALL"]')
    expect(sel.text()).toBe('Tous')
    expect(w.find('[data-test="promo-origin-ADMIN"]').text()).toBe('Créés par l\'admin')
    expect(w.find('[data-test="promo-origin-REFERRAL"]').text()).toBe('Parrainage')
  })

  it('Parrainage puis Créés par l\'admin interrogent le service, Tous revient sans filtre', async () => {
    const w = await mountPage()
    await w.find('[data-test="promo-origin-REFERRAL"]').trigger('click')
    await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('REFERRAL')
    await w.find('[data-test="promo-origin-ADMIN"]').trigger('click')
    await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('ADMIN')
    await w.find('[data-test="promo-origin-ALL"]').trigger('click')
    await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('ALL')
  })

  it('se combine avec l\'onglet de statut', async () => {
    const w = await mountPage()
    await w.find('[data-test="promo-origin-REFERRAL"]').trigger('click')
    await flushPromises()
    await w.find('[data-test="promo-tab-DISABLED"]').trigger('click')
    expect(w.find('[data-test="promo-row-r"]').exists()).toBe(true)
    expect(w.find('[data-test="promo-row-a"]').exists()).toBe(false)
  })

  it('le statut reste modifiable sur un code de parrainage, sans Éditer ni Supprimer', async () => {
    const w = await mountPage()
    expect(w.find('[data-test="toggle-r"]').exists()).toBe(true)
    expect(w.find('[data-test="edit-r"]').exists()).toBe(false)
    await w.find('[data-test="toggle-r"]').trigger('click')
    expect(svc.setStatus).toHaveBeenCalledWith('r', 'ACTIVE')
  })

  it('affiche un message clair si le back répond 409 à la suppression', async () => {
    svc.remove.mockRejectedValue(Object.assign(new Error('409'), { statusCode: 409 }))
    const w = await mountPage()
    await w.find('[data-test="remove-a"]').trigger('click')
    await flushPromises()
    const dlg = w.findComponent({ name: 'ConfirmActionDialog' })
    dlg.vm.$emit('confirm')
    await flushPromises()
    expect(w.find('[data-test="promo-action-error"]').text()).toMatch(/parrainage/i)
  })
})
