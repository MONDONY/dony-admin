import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AnnouncementsTable from '@/features/bids/components/AnnouncementsTable.vue'
import { seedAuth } from '~/tests/helpers/auth'

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

const removedAnn = {
  id: 'a4',
  status: 'REMOVED_BY_ADMIN',
  travelerName: 'Fatou',
  corridor: 'Paris → Bamako',
  departureDate: '2026-07-20',
  availableKg: 8,
  pricePerKg: 9,
}

const completedAnn = {
  id: 'a5',
  status: 'COMPLETED',
  travelerName: 'Ibrahim',
  corridor: 'Lyon → Dakar',
  departureDate: '2026-05-01',
  availableKg: 0,
  pricePerKg: 11,
}

describe('AnnouncementsTable', () => {
  beforeEach(() => seedAuth('ADMIN'))

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

  it('a removed announcement carries the danger tone badge', () => {
    const wrapper = mount(AnnouncementsTable, {
      props: { announcements: [removedAnn], loading: false },
    })
    const badge = wrapper.find('[data-test="ann-row-a4"] .bg-danger\\/15')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('REMOVED_BY_ADMIN')
  })

  describe('actions column visibility', () => {
    it('shows the actions column for an admin with CONTENT_REMOVE', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: anns, loading: false },
      })
      expect(wrapper.find('[data-test="col-actions"]').exists()).toBe(true)
    })

    it('hides the actions column for SUPPORT (no CONTENT_REMOVE) — including Restaurer on a removed row', () => {
      seedAuth('SUPPORT')
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [...anns, removedAnn], loading: false },
      })
      expect(wrapper.find('[data-test="col-actions"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="remove-a1"]').exists()).toBe(false)
      expect(wrapper.find('[data-test="restore-a4"]').exists()).toBe(false)
    })
  })

  describe('Retirer', () => {
    it('shows Retirer on an ACTIVE announcement', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      expect(wrapper.find('[data-test="remove-a1"]').exists()).toBe(true)
    })

    it('also shows Retirer on a COMPLETED announcement (backend has no status guard, only an in-flight-bid guard)', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [completedAnn], loading: false },
      })
      expect(wrapper.find('[data-test="remove-a5"]').exists()).toBe(true)
    })

    it('also shows Retirer on a CANCELLED announcement', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[2]], loading: false },
      })
      expect(wrapper.find('[data-test="remove-a3"]').exists()).toBe(true)
    })

    it('does not show Retirer on an already-removed announcement', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [removedAnn], loading: false },
      })
      expect(wrapper.find('[data-test="remove-a4"]').exists()).toBe(false)
    })

    it('opens a confirmation dialog requiring a reason', async () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      await wrapper.find('[data-test="remove-a1"]').trigger('click')
      expect(wrapper.find('[data-test="overlay"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="reason"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="confirm"]').attributes('disabled')).toBeDefined()
    })

    it('émet le motif catalogué et la note interne séparément', async () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      await wrapper.find('[data-test="remove-a1"]').trigger('click')
      await wrapper.find('[data-test="reason-choice"]').setValue('SUSPECTED_FRAUD')
      await wrapper.find('[data-test="reason"]').setValue('signalé par Awa, ticket #4821')
      await wrapper.find('[data-test="confirm"]').trigger('click')

      // Deux valeurs distinctes : seule la première atteindra le voyageur.
      expect(wrapper.emitted('remove')![0])
        .toEqual(['a1', 'SUSPECTED_FRAUD', 'signalé par Awa, ticket #4821'])
    })

    it('sans motif catalogué choisi, la confirmation reste bloquée', async () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      await wrapper.find('[data-test="remove-a1"]').trigger('click')
      await wrapper.find('[data-test="reason"]').setValue('note seule')

      expect((wrapper.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
      await wrapper.find('[data-test="confirm"]').trigger('click')
      expect(wrapper.emitted('remove')).toBeUndefined()
    })

    it('emits nothing and closes the dialog on cancel', async () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      await wrapper.find('[data-test="remove-a1"]').trigger('click')
      await wrapper.find('[data-test="cancel"]').trigger('click')
      expect(wrapper.emitted('remove')).toBeUndefined()
      expect(wrapper.find('[data-test="overlay"]').exists()).toBe(false)
    })
  })

  describe('Restaurer', () => {
    it('shows Restaurer only on a REMOVED_BY_ADMIN announcement', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [removedAnn], loading: false },
      })
      expect(wrapper.find('[data-test="restore-a4"]').exists()).toBe(true)
    })

    it('does not show Restaurer on an ACTIVE announcement', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      expect(wrapper.find('[data-test="restore-a1"]').exists()).toBe(false)
    })

    it('emits restore with the id directly, without a confirmation dialog', async () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [removedAnn], loading: false },
      })
      await wrapper.find('[data-test="restore-a4"]').trigger('click')
      expect(wrapper.emitted('restore')![0]).toEqual(['a4'])
      expect(wrapper.find('[data-test="overlay"]').exists()).toBe(false)
    })
  })

  describe('error and busy (backend failures, double-submission)', () => {
    it('shows the backend error message near the table when the error prop is set', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false, error: 'Des colis acceptés sont en cours sur cette annonce.' },
      })
      const banner = wrapper.find('[data-test="ann-error"]')
      expect(banner.exists()).toBe(true)
      expect(banner.text()).toBe('Des colis acceptés sont en cours sur cette annonce.')
    })

    it('shows no error banner when the error prop is absent', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false },
      })
      expect(wrapper.find('[data-test="ann-error"]').exists()).toBe(false)
    })

    it('disables Retirer while busy, preventing a double submission', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0]], loading: false, busy: true },
      })
      expect(wrapper.find('[data-test="remove-a1"]').attributes('disabled')).toBeDefined()
    })

    it('disables Restaurer while busy', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [removedAnn], loading: false, busy: true },
      })
      expect(wrapper.find('[data-test="restore-a4"]').attributes('disabled')).toBeDefined()
    })

    it('leaves Retirer and Restaurer enabled when not busy', () => {
      const wrapper = mount(AnnouncementsTable, {
        props: { announcements: [anns[0], removedAnn], loading: false, busy: false },
      })
      expect(wrapper.find('[data-test="remove-a1"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-test="restore-a4"]').attributes('disabled')).toBeUndefined()
    })
  })
})
