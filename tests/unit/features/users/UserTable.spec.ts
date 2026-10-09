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

describe('UserTable — sélection (mode recette)', () => {
  const two = [
    { ...users[0], recetteTester: true },
    { ...users[0], id: 'u2', firstName: 'Awa', recetteTester: false },
  ]

  it('sans selectable : ni cases ni badge', () => {
    const w = mount(UserTable, { props: { users: two, loading: false } })
    expect(w.find('[data-test="select-page"]').exists()).toBe(false)
    expect(w.find('[data-test="select-u1"]').exists()).toBe(false)
    expect(w.find('[data-test="recette-tester-badge"]').exists()).toBe(false)
  })

  it('cases par ligne sans ouvrir la fiche, case de page, badge Testeur', async () => {
    const w = mount(UserTable, { props: { users: two, loading: false, selectable: true, selectedIds: new Set(['u1']) } })
    expect(w.findAll('[data-test="recette-tester-badge"]')).toHaveLength(1)
    expect((w.get('[data-test="select-u1"]').element as HTMLInputElement).checked).toBe(true)
    expect((w.get('[data-test="select-page"]').element as HTMLInputElement).indeterminate).toBe(true)

    await w.get('[data-test="select-u2"]').trigger('change')
    expect(w.emitted('toggle')?.[0]).toEqual(['u2'])
    await w.get('[data-test="select-u2"]').trigger('click')
    expect(w.emitted('select')).toBeUndefined()

    await w.get('[data-test="select-page"]').trigger('change')
    expect(w.emitted('toggle-page')?.[0]).toEqual([['u1', 'u2']])

    await w.setProps({ selectedIds: new Set(['u1', 'u2']) })
    const header = w.get('[data-test="select-page"]').element as HTMLInputElement
    expect(header.checked).toBe(true)
    expect(header.indeterminate).toBe(false)
  })
})
