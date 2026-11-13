import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TransportModeFilter from '@/components/ui/TransportModeFilter.vue'
import { REQUEST_MODE_FILTERS, TRIP_MODE_FILTERS } from '@/lib/transportModes'

describe('TransportModeFilter', () => {
  it('groupe radio : une puce par option, la valeur courante cochée', () => {
    const w = mount(TransportModeFilter, { props: { options: TRIP_MODE_FILTERS, modelValue: 'BOAT' } })
    expect(w.get('[role="radiogroup"]').exists()).toBe(true)
    expect(w.findAll('[role="radio"]')).toHaveLength(4)
    expect(w.get('[data-test="mode-filter-BOAT"]').attributes('aria-checked')).toBe('true')
    expect(w.get('[data-test="mode-filter-ALL"]').attributes('aria-checked')).toBe('false')
  })
  it('émet la valeur cliquée, y compris « Peu importe » pour les demandes', async () => {
    const w = mount(TransportModeFilter, { props: { options: REQUEST_MODE_FILTERS, modelValue: 'ALL', label: 'Mode des demandes' } })
    await w.get('[data-test="mode-filter-CAR"]').trigger('click')
    await w.get('[data-test="mode-filter-ANY"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['CAR'], ['ANY']])
    expect(w.get('[role="radiogroup"]').attributes('aria-label')).toBe('Mode des demandes')
  })
})
