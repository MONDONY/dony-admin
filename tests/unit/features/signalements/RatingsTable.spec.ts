import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingsTable from '@/features/signalements/components/RatingsTable.vue'

const ratings = [
  {
    id: 'rt1', bidId: 'b1', raterName: 'Awa', ratedName: 'Karim', score: 1,
    comment: 'arnaqueur', flagged: true, excluded: false, excludedReason: null,
    createdAt: '2026-06-01T10:00:00Z',
  },
]

describe('RatingsTable', () => {
  it('renders rows with score + comment + names', () => {
    const w = mount(RatingsTable, { props: { ratings, loading: false } })
    expect(w.find('[data-test="rating-row-rt1"]').exists()).toBe(true)
    expect(w.text()).toContain('arnaqueur')
    expect(w.text()).toContain('Karim')
  })

  it('shows a flagged badge', () => {
    const w = mount(RatingsTable, { props: { ratings, loading: false } })
    expect(w.find('[data-test="flagged-rt1"]').exists()).toBe(true)
  })

  it('emits exclude and remove', async () => {
    const w = mount(RatingsTable, { props: { ratings, loading: false } })
    await w.find('[data-test="exclude-rt1"]').trigger('click')
    expect(w.emitted('exclude')![0]).toEqual(['rt1'])
    await w.find('[data-test="remove-rt1"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['rt1'])
  })

  it('shows excluded state instead of exclude button', () => {
    const excluded = [{ ...ratings[0], excluded: true }]
    const w = mount(RatingsTable, { props: { ratings: excluded, loading: false } })
    expect(w.find('[data-test="exclude-rt1"]').exists()).toBe(false)
    expect(w.text()).toMatch(/Exclu/i)
  })

  it('empty state', () => {
    expect(mount(RatingsTable, { props: { ratings: [], loading: false } }).text()).toMatch(/Aucun avis/i)
  })

  it('loading state', () => {
    expect(mount(RatingsTable, { props: { ratings: [], loading: true } }).text()).toMatch(/Chargement/i)
  })

  it('renders placeholders for missing optional fields', () => {
    const w = mount(RatingsTable, {
      props: {
        ratings: [{ ...ratings[0], flagged: false, comment: null, raterName: null, ratedName: null }],
        loading: false,
      },
    })
    expect(w.find('[data-test="flagged-rt1"]').exists()).toBe(false)
    expect(w.text()).toContain('— → —')
  })
})
