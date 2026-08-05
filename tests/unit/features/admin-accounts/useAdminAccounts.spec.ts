import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/admin-accounts/services/adminAccountsService')
import { useAdminAccounts } from '@/features/admin-accounts/composables/useAdminAccounts'
import { adminAccountsService } from '@/features/admin-accounts/services/adminAccountsService'
const svc = adminAccountsService as any

describe('useAdminAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn()
    svc.create = vi.fn()
    svc.update = vi.fn()
    svc.resetPassword = vi.fn()
  })

  it('fetchAccounts loads page', async () => {
    svc.list.mockResolvedValue({ content: [{ id: 'a1', email: 'admin@yadony.com' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.fetchAccounts()
    expect(p.accounts.value).toHaveLength(1)
    expect(p.accounts.value[0].email).toBe('admin@yadony.com')
  })

  it('createAccount returns temporary credentials and reloads list', async () => {
    const tempCreds = { email: 'new@yadony.com', temporaryPassword: 'temp123' }
    svc.create.mockResolvedValue(tempCreds)
    svc.list.mockResolvedValue({ content: [{ id: 'a1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.createAccount('new@yadony.com', 'ADMIN')
    expect(p.temporaryCredentials.value).toEqual(tempCreds)
    expect(p.accounts.value).toHaveLength(1)
  })

  it('setRole updates role and reloads list', async () => {
    svc.update.mockResolvedValue({})
    svc.list.mockResolvedValue({ content: [{ id: 'a1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.setRole('a1', 'SUPPORT')
    expect(svc.update).toHaveBeenCalledWith('a1', { role: 'SUPPORT' })
    expect(p.accounts.value).toHaveLength(1)
  })

  it('setStatus updates status and reloads list', async () => {
    svc.update.mockResolvedValue({})
    svc.list.mockResolvedValue({ content: [{ id: 'a1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.setStatus('a1', 'DISABLED')
    expect(svc.update).toHaveBeenCalledWith('a1', { status: 'DISABLED' })
    expect(p.accounts.value).toHaveLength(1)
  })

  it('resetPassword returns temporary credentials and reloads list', async () => {
    const tempCreds = { email: 'admin@yadony.com', temporaryPassword: 'newtemp123' }
    svc.resetPassword.mockResolvedValue(tempCreds)
    svc.list.mockResolvedValue({ content: [{ id: 'a1' }], totalElements: 1, totalPages: 1, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.resetPassword('a1')
    expect(p.temporaryCredentials.value).toEqual(tempCreds)
    expect(p.accounts.value).toHaveLength(1)
  })

  it('clearTemporaryCredentials clears credentials', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.fetchAccounts()
    p.temporaryCredentials.value = { email: 'test@yadony.com', temporaryPassword: 'temp' }
    p.clearTemporaryCredentials()
    expect(p.temporaryCredentials.value).toBeNull()
  })

  it('captures errors on fetchAccounts', async () => {
    const err = new Error('network error')
    svc.list.mockRejectedValue(err)
    const p = useAdminAccounts()
    await p.fetchAccounts()
    expect(p.error.value).toBe('network error')
  })

  it('has pagination refs', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 50, totalPages: 3, number: 0, size: 20 })
    const p = useAdminAccounts()
    await p.fetchAccounts()
    expect(p.pagination.totalElements).toBe(50)
    expect(p.pagination.totalPages).toBe(3)
    expect(p.pagination.currentPage).toBe(0)
    expect(p.pagination.pageSize).toBe(20)
  })

  it('sets loading state', async () => {
    svc.list.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const p = useAdminAccounts()
    const promise = p.fetchAccounts()
    expect(p.loading.value).toBe(true)
    await promise
    expect(p.loading.value).toBe(false)
  })
})
