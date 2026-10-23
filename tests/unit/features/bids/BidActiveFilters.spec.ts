import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidActiveFilters from '@/features/bids/components/BidActiveFilters.vue'

describe('BidActiveFilters', () => {
  it('ne rend rien sans puce', () => {
    expect(mount(BidActiveFilters, { props: { chips: [] } }).find('[data-test^="active-chip-"]').exists()).toBe(false)
  })
  it('affiche les puces, retire l’une ou efface tout', async () => {
    const w = mount(BidActiveFilters, { props: { chips: [{ key: 'sender', label: 'Expéditeur : Jean' }, { key: 'trip', label: 'Trajet : Paris → Dakar' }] } })
    expect(w.find('[data-test="active-chip-sender"]').text()).toContain('Expéditeur : Jean')
    await w.find('[data-test="active-chip-trip-remove"]').trigger('click')
    expect(w.emitted('remove')![0]).toEqual(['trip'])
    await w.find('[data-test="active-chips-clear"]').trigger('click')
    expect(w.emitted('clear')).toHaveLength(1)
  })
})
