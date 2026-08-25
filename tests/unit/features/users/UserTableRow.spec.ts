import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserTableRow from '@/features/users/components/UserTableRow.vue'

// Fixture de base représentant un utilisateur actif avec email.
const baseUser = {
  id: 'u1',
  firstName: 'Jean',
  lastName: 'Dupont',
  phoneNumber: '+33600',
  email: 'jean@x.fr',
  city: 'Paris',
  country: 'FR',
  status: 'ACTIVE' as const,
  kycStatus: 'VERIFIED' as const,
  isProAccount: false,
  averageRating: 4.5,
  totalTrips: 2,
  totalShipments: 3,
  createdAt: '2026-01-01',
}

describe('UserTableRow', () => {
  it('affiche l\'email dans la cellule d\'identité', () => {
    const w = mount(UserTableRow, {
      props: { user: { ...baseUser, email: 'jean@x.fr' } },
    })
    expect(w.find('[data-test="cell-identity"]').text()).toBe('jean@x.fr')
  })

  it('retombe sur l\'identifiant tronqué et expose l\'identifiant complet en title', () => {
    const w = mount(UserTableRow, {
      props: { user: { ...baseUser, email: null, id: 'abcdef12-3456-7890' } },
    })
    const cell = w.find('[data-test="cell-identity"] span')
    expect(cell.text()).toBe('abcdef12')
    expect(cell.attributes('title')).toBe('abcdef12-3456-7890')
  })
})
