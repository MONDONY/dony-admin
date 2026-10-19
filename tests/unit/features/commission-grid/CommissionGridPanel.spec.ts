import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const svc = vi.hoisted(() => ({ list: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), simulate: vi.fn() }))
vi.mock('@/features/commission-grid/services/commissionGridService', () => ({ commissionGridService: svc }))

import CommissionGridPanel from '@/features/commission-grid/components/CommissionGridPanel.vue'
import { GRID, SCHEDULED, simulation } from './fixtures'

const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')

describe('CommissionGridPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); svc.simulate.mockResolvedValue(simulation([])) })

  it('grille en vigueur : date en heure de Paris, tranches et minimums', () => {
    const w = mount(CommissionGridPanel, { props: { current: GRID, scheduled: null } })
    const card = plain(w.find('[data-test="grid-current"]').text())
    expect(card).toContain('En vigueur depuis le 1er octobre 2026 à 10:00')
    expect(card).toContain('De 0,00 € à 100,00 €')
    expect(card).toContain('7 %')
    expect(card).toContain('650 F CFA')
    expect(w.find('[data-test="grid-scheduled"]').exists()).toBe(false)
  })

  it('aucune grille : taux unique du réglage Paramètres', () => {
    const w = mount(CommissionGridPanel, { props: { current: null, scheduled: null, flatRate: '0.05' } })
    expect(plain(w.find('[data-test="grid-current-empty"]').text())).toBe('Aucune grille : taux unique de 5 % (réglage Paramètres).')
    const noRate = mount(CommissionGridPanel, { props: { current: null, scheduled: null } })
    expect(noRate.find('[data-test="grid-current-empty"]').text()).toBe('Aucune grille : taux unique (réglage Paramètres).')
  })

  it('grille programmée : annulation confirmée', async () => {
    const w = mount(CommissionGridPanel, { props: { current: GRID, scheduled: SCHEDULED } })
    expect(w.find('[data-test="grid-scheduled"]').text()).toContain('Programmée pour le 1er décembre 2026 à 09:00')
    await w.find('[data-test="grid-scheduled-cancel"]').trigger('click')
    expect(w.text()).toContain('ne prendra pas effet')
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeUndefined()
    await w.find('[data-test="grid-scheduled-cancel"]').trigger('click')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('cancel')?.[0]).toEqual(['g-next'])
  })

  it('annulation en cours : bouton désactivé', () => {
    const w = mount(CommissionGridPanel, { props: { current: GRID, scheduled: SCHEDULED, cancelling: true } })
    expect(w.find('[data-test="grid-scheduled-cancel"]').attributes('disabled')).toBeDefined()
    expect(w.find('[data-test="grid-scheduled-cancel"]').text()).toBe('Annulation…')
  })

  it('« Préparer une nouvelle grille » ouvre l’éditeur ; fermé à la programmation', async () => {
    const w = mount(CommissionGridPanel, { props: { current: GRID, scheduled: null } })
    await w.find('[data-test="grid-prepare"]').trigger('click')
    expect(w.find('[data-test="grid-editor"]').exists()).toBe(true)
    await w.find('[data-test="editor-close"]').trigger('click')
    expect(w.find('[data-test="grid-editor"]').exists()).toBe(false)

    await w.find('[data-test="grid-prepare"]').trigger('click')
    w.findComponent({ name: 'CommissionGridEditor' }).vm.$emit('scheduled', SCHEDULED)
    await w.vm.$nextTick()
    expect(w.emitted('scheduled')?.[0]).toEqual([SCHEDULED])
    expect(w.find('[data-test="grid-editor"]').exists()).toBe(false)
  })
})
