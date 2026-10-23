import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidFilters from '@/features/bids/components/BidFilters.vue'
import type { BidsFilterState } from '@/features/bids/types/index'

const base: BidsFilterState = {
  status: 'TOUS', announcementId: null, query: '', scope: 'ALL', view: 'ALL',
  paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null,
}
function mountFilters(over: Partial<BidsFilterState> = {}, viewsAvailable = true) {
  return mount(BidFilters, { props: { filters: { ...base, ...over }, viewsAvailable } })
}

describe('BidFilters', () => {
  it('propose les 13 statuts plus « Tous les statuts » et émet le choix', async () => {
    const w = mountFilters()
    const options = w.findAll('[data-test="filter-status"] option')
    expect(options).toHaveLength(14)
    expect(options[0]!.text()).toBe('Tous les statuts')
    const texts = options.map(o => o.text())
    expect(texts).toContain('Arrivé')
    expect(texts).toContain('Colis refusé')
    await w.find('[data-test="filter-status"]').setValue('ARRIVED')
    expect(w.emitted('update:status')![0]).toEqual(['ARRIVED'])
  })

  it('émet la période choisie puis l’efface', async () => {
    const w = mountFilters({ dateTo: '2026-07-31' })
    await w.find('[data-test="date-from"]').setValue('2026-07-01')
    expect(w.emitted('update:dateRange')![0]).toEqual(['2026-07-01', '2026-07-31'])
    await w.find('[data-test="date-clear"]').trigger('click')
    expect(w.emitted('update:dateRange')![1]).toEqual([null, null])
  })

  it('affiche les dates venues de l’URL', () => {
    const w = mountFilters({ dateFrom: '2026-07-01', dateTo: '2026-07-31' })
    expect((w.find('[data-test="date-from"]').element as HTMLInputElement).value).toBe('2026-07-01')
    expect((w.find('[data-test="date-to"]').element as HTMLInputElement).value).toBe('2026-07-31')
  })

  it('mode de paiement : libellés lisibles, null pour « Tous »', async () => {
    const w = mountFilters()
    const texts = w.findAll('[data-test="filter-payment"] option').map(o => o.text())
    expect(texts).toEqual(expect.arrayContaining(['Carte', 'Espèces à la remise', 'Mobile money', 'Wave', 'Orange Money']))
    await w.find('[data-test="filter-payment"]').setValue('WAVE')
    expect(w.emitted('update:paymentMethod')![0]).toEqual(['WAVE'])
    await w.find('[data-test="filter-payment"]').setValue('')
    expect(w.emitted('update:paymentMethod')![1]).toEqual([null])
  })

  it('émet le contenu à Entrée', async () => {
    const w = mountFilters()
    await w.find('[data-test="filter-content"]').setValue('vêtements')
    await w.find('[data-test="filter-content"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:content')![0]).toEqual(['vêtements'])
  })

  it('chaque champ a une étiquette accessible', () => {
    const w = mountFilters()
    for (const t of ['filter-status', 'filter-payment', 'filter-content', 'date-from', 'date-to']) {
      const el = w.find(`[data-test="${t}"]`)
      expect(el.attributes('aria-label') ?? el.attributes('id')).toBeTruthy()
    }
  })

  it('BidFilters_reset_visibleOnlyWhenActive', async () => {
    expect(mountFilters().find('[data-test="filters-reset"]').exists()).toBe(false)
    for (const over of [{ status: 'ARRIVED' as const }, { dateFrom: '2026-07-01' }, { paymentMethod: 'WAVE' }, { content: 'x' }]) {
      expect(mountFilters(over).find('[data-test="filters-reset"]').exists()).toBe(true)
    }
    const w = mountFilters({ status: 'ARRIVED' })
    await w.find('[data-test="filters-reset"]').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })

  it('face à un ancien back (vues indisponibles), les filtres de paiement et de contenu sont masqués', () => {
    const w = mountFilters({}, false)
    expect(w.find('[data-test="filter-payment"]').exists()).toBe(false)
    expect(w.find('[data-test="filter-content"]').exists()).toBe(false)
    expect(w.find('[data-test="filter-status"]').exists()).toBe(true)
  })
})
