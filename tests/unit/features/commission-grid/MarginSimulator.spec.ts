import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import MarginSimulator from '@/features/commission-grid/components/MarginSimulator.vue'
import { SIMULATOR_DEBOUNCE_MS } from '@/features/commission-grid/composables/useMarginSimulator'
import { GRID, SCHEDULED, httpError, row, simulation } from './fixtures'

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

async function mountSim(props: Record<string, unknown> = {}) {
  const w = mount(MarginSimulator, { props: { current: GRID, scheduled: null, ...props } })
  await flushPromises()
  return w
}

describe('MarginSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    svc.simulate.mockResolvedValue(simulation([row(20, 1, 1.4)]))
  })
  afterEach(() => { vi.useRealTimers() })

  it('simule la grille en vigueur au montage ; tableau par rail, aperçu expéditeur, mention Connect', async () => {
    const w = await mountSim()
    expect(svc.simulate).toHaveBeenCalledWith({ gridId: 'g-current', currency: 'EUR', nets: [20], vatRatePercent: 20 })
    expect(plain(w.find('[data-test="simulator-preview"]').text())).toContain('Frais de service Yadony : 1,40 €')
    const card = plain(w.find('[data-test="simulator-rail-CARD_STANDARD"]').text())
    expect(card).toContain('Carte européenne standard')
    expect(card).toContain('1,40 €')
    expect(card).toContain('21,40 €')
    expect(card).toContain('0,60 €')
    expect(card).toContain('0,57 €')
    expect(w.find('[data-test="simulator-rail-CASH"] td:last-child').classes()).toContain('text-danger')
    expect(plain(w.find('[data-test="simulator-connect"]').text())).toBe('Connect : 2,00 € par voyageur payé dans le mois, non inclus.')
  })

  it('aperçu avec minimum appliqué', async () => {
    svc.simulate.mockResolvedValue(simulation([row(5, 1, 1, true)]))
    const w = await mountSim()
    expect(plain(w.find('[data-test="simulator-preview"]').text())).toContain('1,00 € (minimum)')
  })

  it('devise, montant et TVA relancent la simulation ; TVA mémorisée', async () => {
    const w = await mountSim()
    await w.find('[data-test="simulator-currency"]').setValue('XOF')
    await w.find('[data-test="simulator-amount"]').setValue('10000')
    await w.find('[data-test="simulator-vat"]').setValue('18')
    await vi.advanceTimersByTimeAsync(SIMULATOR_DEBOUNCE_MS)
    await flushPromises()
    expect(svc.simulate).toHaveBeenLastCalledWith({ gridId: 'g-current', currency: 'XOF', nets: [10000], vatRatePercent: 18 })
    expect(localStorage.getItem('yadony-admin-commission-vat')).toBe('18')
  })

  it('saisie invalide : message, pas de tableau', async () => {
    const w = await mountSim()
    await w.find('[data-test="simulator-amount"]').setValue('-3')
    expect(w.find('[data-test="simulator-input-error"]').exists()).toBe(true)
    expect(w.find('[data-test="simulator-table"]').exists()).toBe(false)
  })

  it('sources : en vigueur ou programmée ; grille par défaut sans grille en vigueur', async () => {
    const w = await mountSim({ scheduled: SCHEDULED })
    const options = w.findAll('[data-test="simulator-source"] option').map(o => o.text())
    expect(options[0]).toBe('Grille en vigueur')
    expect(options[1]).toContain('Grille programmée (1 décembre 2026')
    await w.find('[data-test="simulator-source"]').setValue('scheduled')
    await vi.advanceTimersByTimeAsync(SIMULATOR_DEBOUNCE_MS)
    expect(svc.simulate.mock.calls.at(-1)![0].gridId).toBe('g-next')

    // La programmée disparaît (annulée) : retour sur la grille en vigueur.
    await w.setProps({ scheduled: null })
    expect((w.find('[data-test="simulator-source"]').element as HTMLSelectElement).value).toBe('current')

    const none = await mountSim({ current: null })
    expect(none.find('[data-test="simulator-source"]').text()).toContain('Grille par défaut')
    const req = svc.simulate.mock.calls.at(-1)![0]
    expect(req.gridId).toBeUndefined()
    expect(req.draft.tiers[0]).toEqual({ fromEur: 0, rate: 0.07 })
  })

  it('erreur et serveur pas à jour', async () => {
    svc.simulate.mockRejectedValueOnce(httpError(500, { detail: 'Panne' }))
    const w = await mountSim()
    expect(w.find('[data-test="simulator-error"]').text()).toBe('Panne')
    svc.simulate.mockRejectedValueOnce(httpError(404))
    const old = await mountSim()
    expect(old.find('[data-test="simulator-unavailable"]').exists()).toBe(true)
  })

  it('rail inconnu : code brut ; Connect absent : pas de mention', async () => {
    const r = row(20, 1, 1.4)
    r.rails = [{ rail: 'NEW_RAIL' as never, providerCost: 0.1, marginExVat: 1 }]
    svc.simulate.mockResolvedValue({ rows: [r], warnings: [], connectActiveAccountMonthly: null })
    const w = await mountSim()
    expect(w.find('[data-test="simulator-rail-NEW_RAIL"]').text()).toContain('NEW_RAIL')
    expect(w.find('[data-test="simulator-connect"]').exists()).toBe(false)
  })
})
