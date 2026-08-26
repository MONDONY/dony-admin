import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserTable from '@/features/users/components/UserTable.vue'

const users = [
  { id: 'u1', firstName: 'Jean', lastName: 'Dupont', phoneNumber: '+33600', email: 'jean@x.fr', city: 'Paris', country: 'FR', status: 'ACTIVE', kycStatus: 'VERIFIED', isProAccount: false, averageRating: 4.5, totalTrips: 2, totalShipments: 3, createdAt: '2026-01-01' },
]

describe('UserTable', () => {
  it('renders a row per user and emits select on click', async () => {
    const w = mount(UserTable, { props: { users, loading: false } })
    expect(w.text()).toContain('Jean')
    await w.find('[data-test="row-u1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['u1'])
  })
  it('shows an empty state when no users and not loading', () => {
    const w = mount(UserTable, { props: { users: [], loading: false } })
    expect(w.text()).toMatch(/Aucun utilisateur/i)
  })
})
