import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AnnouncementsTable from '@/features/bids/components/AnnouncementsTable.vue'

const anns = [
  {
    id: 'a1',
    status: 'ACTIVE',
    travelerName: 'Awa',
    corridor: 'Lyon → Abidjan',
    departureDate: '2026-07-01',
    availableKg: 10,
    pricePerKg: 8,
  },
  {
    id: 'a2',
    status: 'FULL',
    travelerName: 'Boudou',
    corridor: 'Paris → Dakar',
    departureDate: '2026-07-15',
    availableKg: 0,
    pricePerKg: 12,
  },
  {
    id: 'a3',
    status: 'CANCELLED',
    travelerName: null,
    corridor: 'Marseille → Douala',
    departureDate: '2026-06-20',
    availableKg: 5,
    pricePerKg: 10,
  },
]

describe('AnnouncementsTable', () => {
  it('renders rows', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: anns, loading: false },
    })
    expect(wrapper.text()).toContain('Lyon → Abidjan')
    expect(wrapper.text()).toContain('Awa')
  })

  it('renders multiple rows', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: anns, loading: false },
    })
    expect(wrapper.findAll('[data-test^="ann-row-"]')).toHaveLength(3)
  })

  it('renders data-test attribute for each row', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: anns, loading: false },
    })
    expect(wrapper.find('[data-test="ann-row-a1"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="ann-row-a2"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="ann-row-a3"]').exists()).toBe(true)
  })

  it('empty state', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: [], loading: false },
    })
    expect(wrapper.text()).toMatch(/Aucune annonce/i)
  })

  it('shows loading state', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: [], loading: true },
    })
    expect(wrapper.text()).toContain('Chargement…')
  })

  it('does not show empty state when loading', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: [], loading: true },
    })
    expect(wrapper.text()).not.toMatch(/Aucune annonce/i)
  })

  it('handles null travelerName', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: [anns[2]], loading: false },
    })
    expect(wrapper.text()).toContain('—')
  })

  it('formats date correctly', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: [anns[0]], loading: false },
    })
    // 2026-07-01 should format to '01/07/2026' in fr-FR locale
    expect(wrapper.text()).toContain('01/07/2026')
  })

  it('displays status badges for different statuses', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: anns, loading: false },
    })
    expect(wrapper.text()).toContain('ACTIVE')
    expect(wrapper.text()).toContain('FULL')
    expect(wrapper.text()).toContain('CANCELLED')
  })
})
