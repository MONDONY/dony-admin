import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/users/services/usersService', () => {
  const svc = { get: vi.fn(), suspend: vi.fn(), ban: vi.fn(), unsuspend: vi.fn(), setCommissionRate: vi.fn() }
  return { usersService: svc }
})

import { useUserDetail } from '@/features/users/composables/useUserDetail'
import { usersService } from '@/features/users/services/usersService'

const svc = usersService as any

describe('useUserDetail', () => {
  beforeEach(() => Object.values(svc).forEach(m => m.mockReset()))

  it('open(id) loads the user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const d = useUserDetail()
    await d.open('u1')
    expect(d.user.value?.id).toBe('u1')
  })

  it('suspend(reason) calls service and refreshes user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.suspend.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })
    const d = useUserDetail()
    await d.open('u1')
    await d.suspend('fraude')
    expect(svc.suspend).toHaveBeenCalledWith('u1', 'fraude')
    expect(d.user.value?.status).toBe('SUSPENDED')
  })

  it('ban(reason) calls service', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.ban.mockResolvedValue({ id: 'u1', status: 'BANNED' })
    const d = useUserDetail()
    await d.open('u1')
    await d.ban('abus')
    expect(d.user.value?.status).toBe('BANNED')
  })

  it('close() clears the user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const d = useUserDetail()
    await d.open('u1')
    d.close()
    expect(d.user.value).toBeNull()
  })

  it('unsuspend() calls service and refreshes user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })
    svc.unsuspend.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const d = useUserDetail()
    await d.open('u1')
    await d.unsuspend()
    expect(svc.unsuspend).toHaveBeenCalledWith('u1')
    expect(d.user.value?.status).toBe('ACTIVE')
  })

  it('setCommissionRate() calls service with the rate', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.setCommissionRate.mockResolvedValue({ id: 'u1', commissionRateOverride: 0.1 })
    const d = useUserDetail()
    await d.open('u1')
    await d.setCommissionRate(0.1)
    expect(svc.setCommissionRate).toHaveBeenCalledWith('u1', 0.1)
  })

  it('captures errors from an action', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.suspend.mockRejectedValue(new Error('nope'))
    const d = useUserDetail()
    await d.open('u1')
    await d.suspend('x')
    expect(d.error.value).toBe('nope')
  })
})
