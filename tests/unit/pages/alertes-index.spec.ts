/** Page Alertes : filtre de sévérité et fiche détaillée d'une alerte. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'

vi.stubGlobal('definePageMeta', vi.fn())

const svc = vi.hoisted(() => ({ list: vi.fn(), resolve: vi.fn(), violations: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

const row = {
  id: 'a1', type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: 'Paiement p1 en séquestre',
  payload: {}, resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00',
}

async function mountPage() {
  const mod = await import('@/pages/alertes/index.vue')
  const w = mount(mod.default, { global: { stubs: { PaginationControls: true, NuxtLink: true } } })
  await flushPromises()
  return w
}

describe('pages/alertes', () => {
  beforeEach(() => {
    seedAuth('ADMIN')
    svc.list.mockReset().mockResolvedValue({ content: [row], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    svc.resolve.mockReset().mockResolvedValue({ ...row, resolved: true })
  })

  it('filtre par sévérité', async () => {
    const w = await mountPage()
    await w.find('[data-test="severity-CRITICAL"]').trigger('click')
    await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0].severity).toBe('CRITICAL')
  })

  it('ouvre la fiche puis résout l’alerte depuis la fiche', async () => {
    const w = await mountPage()
    await w.find('[data-test="details-a1"]').trigger('click')
    expect(w.find('[data-test="alert-detail"]').exists()).toBe(true)
    await w.find('[data-test="alert-detail-resolve"]').trigger('click')
    expect(w.text()).toContain('Marquer « Paiement en séquestre depuis plus de 48 h » comme résolue')
    const reason = w.find('[data-test="reason"]')
    await reason.setValue('Colis encore en route, rien à faire')
    await w.find('[data-test="confirm"]').trigger('click')
    await flushPromises()
    expect(svc.resolve).toHaveBeenCalledWith('a1', 'Colis encore en route, rien à faire')
    expect(w.find('[data-test="alert-detail"]').exists()).toBe(false)
  })
})
