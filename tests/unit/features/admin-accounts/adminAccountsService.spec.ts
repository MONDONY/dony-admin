import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { adminAccountsService } from '@/features/admin-accounts/services/adminAccountsService'

describe('adminAccountsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list GETs paged accounts', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await adminAccountsService.list(0, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/admins', { query: { page: 0, size: 20 } })
  })

  it('creates an ADMIN without sending a password', async () => {
    apiMock.mockResolvedValue({ email: 'new@yadony.com', temporaryPassword: 'temp123' })
    await adminAccountsService.create('new@yadony.com', 'ADMIN')
    expect(apiMock).toHaveBeenCalledWith('/admin/admins', {
      method: 'POST',
      body: { email: 'new@yadony.com', role: 'ADMIN' },
    })
  })

  it('creates a SUPPORT without sending a password', async () => {
    apiMock.mockResolvedValue({ email: 'new@yadony.com', temporaryPassword: 'temp123' })
    await adminAccountsService.create('new@yadony.com', 'SUPPORT')
    expect(apiMock).toHaveBeenCalledWith('/admin/admins', {
      method: 'POST',
      body: { email: 'new@yadony.com', role: 'SUPPORT' },
    })
  })

  it('updates admin role', async () => {
    apiMock.mockResolvedValue({})
    await adminAccountsService.update('id-1', { role: 'SUPPORT' })
    expect(apiMock).toHaveBeenCalledWith('/admin/admins/id-1', {
      method: 'PATCH',
      body: { role: 'SUPPORT' },
    })
  })

  it('updates admin status', async () => {
    apiMock.mockResolvedValue({})
    await adminAccountsService.update('id-1', { status: 'DISABLED' })
    expect(apiMock).toHaveBeenCalledWith('/admin/admins/id-1', {
      method: 'PATCH',
      body: { status: 'DISABLED' },
    })
  })

  it('updates both role and status', async () => {
    apiMock.mockResolvedValue({})
    await adminAccountsService.update('id-1', { role: 'ADMIN', status: 'ACTIVE' })
    expect(apiMock).toHaveBeenCalledWith('/admin/admins/id-1', {
      method: 'PATCH',
      body: { role: 'ADMIN', status: 'ACTIVE' },
    })
  })

  it('resets a password and returns one-time credentials', async () => {
    apiMock.mockResolvedValue({ email: 'test@yadony.com', temporaryPassword: 'newtemp123' })
    await adminAccountsService.resetPassword('id-1')
    expect(apiMock).toHaveBeenCalledWith('/admin/admins/id-1/reset-password', { method: 'POST' })
  })
})
