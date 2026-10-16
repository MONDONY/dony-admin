import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { maintenanceService } from '@/features/maintenance/services/maintenanceService'

describe('maintenanceService', () => {
  beforeEach(() => { apiMock.mockReset(); apiMock.mockResolvedValue({ enabled: false }) })

  it('get() lit /admin/maintenance', async () => {
    await maintenanceService.get()
    expect(apiMock).toHaveBeenCalledWith('/admin/maintenance')
  })

  it('update() fait un PUT avec le corps', async () => {
    const body = { enabled: true, message: 'Pause', estimatedEndAt: '2026-10-16T14:30:00.000Z' }
    await maintenanceService.update(body)
    expect(apiMock).toHaveBeenCalledWith('/admin/maintenance', { method: 'PUT', body })
  })

  it('addExemption() POSTe userId et note', async () => {
    await maintenanceService.addExemption('u1', 'Testeur')
    expect(apiMock).toHaveBeenCalledWith('/admin/maintenance/exemptions', {
      method: 'POST', body: { userId: 'u1', note: 'Testeur' },
    })
  })

  it('removeExemption() fait un DELETE', async () => {
    await maintenanceService.removeExemption('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/maintenance/exemptions/u1', { method: 'DELETE' })
  })
})
