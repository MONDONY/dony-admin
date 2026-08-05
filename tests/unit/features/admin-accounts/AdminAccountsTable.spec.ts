import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminAccountsTable from '@/features/admin-accounts/components/AdminAccountsTable.vue'
import type { AdminAccount } from '@/features/admin-accounts/types/index'

const accounts: AdminAccount[] = [
  {
    id: 'root', email: 'root@dony.app', role: 'SUPER_ADMIN', status: 'ACTIVE',
    mustChangePassword: false, createdAt: '2026-01-01T00:00:00Z', lastLoginAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'a1', email: 'admin@dony.app', role: 'ADMIN', status: 'ACTIVE',
    mustChangePassword: true, createdAt: '2026-02-01T00:00:00Z', lastLoginAt: null,
  },
  {
    id: 's1', email: 'support@dony.app', role: 'SUPPORT', status: 'DISABLED',
    mustChangePassword: false, createdAt: '2026-03-01T00:00:00Z', lastLoginAt: null,
  },
]

describe('AdminAccountsTable', () => {
  it('renders accounts with email, role, status and change-required indicator', () => {
    const w = mount(AdminAccountsTable, { props: { accounts, loading: false } })
    const row = w.find('[data-test="admin-row-a1"]')
    expect(row.text()).toContain('admin@dony.app')
    expect(row.text()).toContain('ADMIN')
    expect(row.text()).toContain('Oui')
    expect(w.find('[data-test="admin-row-s1"]').text()).toContain('Désactivé')
  })

  it('disables actions on the root SUPER_ADMIN row', () => {
    const w = mount(AdminAccountsTable, { props: { accounts, loading: false } })
    expect((w.find('[data-test="toggle-role-root"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="toggle-status-root"]').element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-test="reset-root"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('emits role, status and reset for a non-root row', async () => {
    const w = mount(AdminAccountsTable, { props: { accounts, loading: false } })
    await w.find('[data-test="toggle-role-a1"]').trigger('click')
    expect(w.emitted('role')![0]).toEqual(['a1', 'SUPPORT'])

    await w.find('[data-test="toggle-status-a1"]').trigger('click')
    expect(w.emitted('status')![0]).toEqual(['a1', 'DISABLED'])

    await w.find('[data-test="reset-a1"]').trigger('click')
    expect(w.emitted('reset')![0]).toEqual(['a1'])
  })

  it('does not emit anything when clicking disabled root actions', async () => {
    const w = mount(AdminAccountsTable, { props: { accounts, loading: false } })
    await w.find('[data-test="toggle-role-root"]').trigger('click')
    await w.find('[data-test="toggle-status-root"]').trigger('click')
    await w.find('[data-test="reset-root"]').trigger('click')
    expect(w.emitted('role')).toBeFalsy()
    expect(w.emitted('status')).toBeFalsy()
    expect(w.emitted('reset')).toBeFalsy()
  })

  it('shows an empty state', () => {
    expect(mount(AdminAccountsTable, { props: { accounts: [], loading: false } }).text()).toMatch(/Aucun administrateur/i)
  })

  it('shows a loading state', () => {
    expect(mount(AdminAccountsTable, { props: { accounts: [], loading: true } }).text()).toMatch(/Chargement/i)
  })
})
