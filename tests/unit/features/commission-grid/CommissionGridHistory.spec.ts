import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CommissionGridHistory from '@/features/commission-grid/components/CommissionGridHistory.vue'
import { seedAuth } from '~/tests/helpers/auth'
import { GRID } from './fixtures'

const ITEMS = [
  { ...GRID, id: 'g-future', effectiveFrom: '2099-01-01T00:00:00', note: 'Hausse 2099', createdBy: 'u1', createdAt: '2026-10-18T08:00:00' },
  { ...GRID, id: 'g-current', note: null, createdBy: 'abcdef12-3456-7890-abcd-ef1234567890', createdAt: '2026-09-30T08:00:00' },
  { ...GRID, id: 'g-cancel', effectiveFrom: '2099-02-01T00:00:00', cancelledAt: '2026-10-10T08:00:00', note: 'Erreur', createdBy: null, createdAt: '2026-10-09T08:00:00' },
  { ...GRID, id: 'g-past', effectiveFrom: '2026-01-01T00:00:00', note: 'Lancement', createdBy: 'u2', createdAt: '2025-12-20T08:00:00' },
]

function mountHistory(props: Record<string, unknown> = {}) {
  return mount(CommissionGridHistory, { props: { items: ITEMS, currentId: 'g-current', page: 0, totalPages: 1, ...props } })
}

describe('CommissionGridHistory', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('état de chaque grille : programmée, en vigueur, annulée, passée', () => {
    const w = mountHistory()
    expect(w.find('[data-test="history-state-g-future"]').text()).toBe('Programmée')
    expect(w.find('[data-test="history-state-g-current"]').text()).toBe('En vigueur')
    expect(w.find('[data-test="history-state-g-cancel"]').text()).toBe('Annulée')
    expect(w.find('[data-test="history-state-g-past"]').text()).toBe('Passée')
  })

  it('auteur : « Vous », identifiant abrégé, inconnu ; note visible', () => {
    const w = mountHistory()
    expect(w.find('[data-test="history-row-g-future"]').text()).toContain('Vous')
    expect(w.find('[data-test="history-row-g-current"]').text()).toContain('Admin abcdef12')
    expect(w.find('[data-test="history-row-g-cancel"]').text()).toContain('Inconnu')
    expect(w.find('[data-test="history-row-g-past"]').text()).toContain('Lancement')
  })

  it('détail dépliable : tranches, minimums, dates de programmation et d’annulation', async () => {
    const w = mountHistory()
    expect(w.find('[data-test="history-detail-g-cancel"]').exists()).toBe(false)
    await w.find('[data-test="history-toggle-g-cancel"]').trigger('click')
    const detail = w.find('[data-test="history-detail-g-cancel"]').text()
    expect(detail).toContain('Programmée le 9 octobre 2026 à 10:00, annulée le 10 octobre 2026 à 10:00.')
    expect(detail).toContain('Erreur')
    expect(w.find('[data-test="history-detail-g-cancel"] [data-test="grid-summary-tiers"]').exists()).toBe(true)
    await w.find('[data-test="history-toggle-g-cancel"]').trigger('click')
    expect(w.find('[data-test="history-detail-g-cancel"]').exists()).toBe(false)
  })

  it('liste vide, chargement, pagination', async () => {
    expect(mountHistory({ items: [] }).find('[data-test="history-empty"]').exists()).toBe(true)
    expect(mountHistory({ items: [], loading: true }).text()).toContain('Chargement…')
    const w = mountHistory({ totalPages: 3 })
    await w.find('[data-test="next"]').trigger('click')
    expect(w.emitted('page')?.[0]).toEqual([1])
    expect(mountHistory().find('[data-test="next"]').exists()).toBe(false)
  })
})
