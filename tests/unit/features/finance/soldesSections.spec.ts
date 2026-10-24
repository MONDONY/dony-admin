/**
 * Sections de la page Transactions branchées sur leur liste : chaque contrôle appelle la bonne
 * action (filtre, vue, puce, réessayer), sans logique propre.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, reactive, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { seedAuth } from '~/tests/helpers/auth'
import WalletsSection from '@/features/finance/components/WalletsSection.vue'
import CashCommissionsSection from '@/features/finance/components/CashCommissionsSection.vue'
import MobileMoneySection from '@/features/finance/components/MobileMoneySection.vue'
import ChargebacksSection from '@/features/payments/components/ChargebacksSection.vue'

const stubs = { NuxtLink: { props: ['to'], template: '<a><slot /></a>' }, PaginationControls: true }

/** Fausse liste : l'état que lit la section et les actions qu'elle appelle. */
function fakeList(filters: Record<string, string>, extra: Record<string, unknown> = {}) {
  return {
    rows: ref([]), isLoading: ref(false), error: ref<string | null>(null), currentPage: ref(0), totalPages: ref(1),
    filters: reactive(filters), counts: ref({ attention: 1, all: 2, open: 1, won: 0, lost: 0, failed: 1, done: 0 }),
    countsError: ref<string | null>('Oups'), viewsReady: ref(true), openId: ref(null), openMissing: ref(false),
    chips: computed(() => [{ key: 'partyId', label: 'Titulaire : Awa' }]), providers: computed(() => []),
    setFilter: vi.fn(), setView: vi.fn(), goToPage: vi.fn(), reload: vi.fn(), removeChip: vi.fn(), clearChips: vi.fn(),
    setQuery: vi.fn(), setKind: vi.fn(), setProvider: vi.fn(),
    ...extra,
  }
}

describe('sections Soldes et Litiges', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('Portefeuilles : devise, signe, recherche (Entrée), puce retirée et tout effacer', async () => {
    const list = fakeList({ query: '', currency: '', balanceSign: '', partyId: 'x' })
    const w = mount(WalletsSection, { props: { list: list as never }, global: { stubs } })
    await w.find('[data-test="wallets-filter-currency"]').setValue('XOF')
    await w.find('[data-test="wallets-filter-sign"]').setValue('ZERO')
    await w.find('[data-test="wallets-search"]').setValue('awa')
    await w.find('[data-test="wallets-search"]').trigger('keydown', { key: 'Enter' })
    expect(list.setFilter.mock.calls).toEqual([['currency', 'XOF'], ['balanceSign', 'ZERO'], ['query', 'awa']])
    await w.find('[data-test="active-chip-partyId-remove"]').trigger('click')
    expect(list.removeChip).toHaveBeenCalledWith('partyId')
    await w.find('[data-test="active-chips-clear"]').trigger('click')
    expect(list.clearChips).toHaveBeenCalled()
  })

  it('Portefeuilles : une erreur s’affiche et remplace l’état vide', () => {
    const list = fakeList({ query: '', currency: '', balanceSign: '', partyId: '' }, { error: ref('Refusé') })
    const w = mount(WalletsSection, { props: { list: list as never }, global: { stubs } })
    expect(w.find('[data-test="transactions-error"]').text()).toBe('Refusé')
    expect(w.text()).not.toContain('Aucun portefeuille')
  })

  it('Commissions cash : vue, statut, recherche après la pause de frappe, Réessayer, puce', async () => {
    vi.useFakeTimers()
    const list = fakeList({ view: 'ATTENTION', query: '', status: '', partyId: 'x' })
    const w = mount(CashCommissionsSection, { props: { list: list as never }, global: { stubs } })
    expect(w.text()).toContain('Rien à traiter')
    await w.find('[data-test="cash-view-ALL"]').trigger('click')
    expect(list.setView).toHaveBeenCalledWith('ALL')
    await w.find('[data-test="cash-filter-status"]').setValue('FAILED')
    expect(list.setFilter).toHaveBeenCalledWith('status', 'FAILED')
    await w.find('[data-test="cash-search"]').setValue('YD-1')
    vi.advanceTimersByTime(300)
    expect(list.setFilter).toHaveBeenLastCalledWith('query', 'YD-1')
    await w.find('[data-test="cash-counts-retry"]').trigger('click')
    expect(list.reload).toHaveBeenCalled()
    await w.find('[data-test="active-chip-partyId-remove"]').trigger('click')
    await w.find('[data-test="active-chips-clear"]').trigger('click')
    expect(list.removeChip).toHaveBeenCalledWith('partyId')
    expect(list.clearChips).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('Litiges : vue, Réessayer, ligne demandée absente signalée', async () => {
    const list = fakeList({ view: 'OPEN', query: '' }, { openMissing: ref(true) })
    const w = mount(ChargebacksSection, { props: { list: list as never }, global: { stubs } })
    expect(w.find('[data-test="open-row-missing"]').exists()).toBe(true)
    expect(w.text()).toContain('Aucun litige ouvert')
    await w.find('[data-test="cb-view-WON"]').trigger('click')
    expect(list.setView).toHaveBeenCalledWith('WON')
    await w.find('[data-test="cb-counts-retry"]').trigger('click')
    expect(list.reload).toHaveBeenCalled()
  })

  it('Mobile money : vue et Réessayer passent par la liste', async () => {
    const list = fakeList({ view: 'FAILED', kind: '', provider: '', query: '' })
    const w = mount(MobileMoneySection, { props: { list: list as never }, global: { stubs } })
    await w.find('[data-test="mm-view-DONE"]').trigger('click')
    expect(list.setView).toHaveBeenCalledWith('DONE')
    await w.find('[data-test="mm-counts-retry"]').trigger('click')
    await flushPromises()
    expect(list.reload).toHaveBeenCalled()
    expect(w.text()).toContain('Aucune opération en échec')
  })
})
