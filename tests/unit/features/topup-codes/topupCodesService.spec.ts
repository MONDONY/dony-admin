import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { topupCodesService } from '@/features/topup-codes/services/topupCodesService'

const INPUT = { code: 'DAKAR2000', amount: 2000, currency: 'XOF', maxRedemptions: 100, expiresAt: null, note: null }

describe('topupCodesService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list GETs the full array', async () => {
    apiMock.mockResolvedValue([])
    await topupCodesService.list()
    expect(apiMock).toHaveBeenCalledWith('/admin/topup-codes')
  })

  it('create POSTs the input', async () => {
    apiMock.mockResolvedValue({ id: 't1' })
    await topupCodesService.create(INPUT)
    expect(apiMock).toHaveBeenCalledWith('/admin/topup-codes', { method: 'POST', body: INPUT })
  })

  it('redemptions GETs by id', async () => {
    apiMock.mockResolvedValue([])
    await topupCodesService.redemptions('t1')
    expect(apiMock).toHaveBeenCalledWith('/admin/topup-codes/t1/redemptions')
  })

  it('revoke POSTs on /revoke', async () => {
    apiMock.mockResolvedValue({ id: 't1' })
    await topupCodesService.revoke('t1')
    expect(apiMock).toHaveBeenCalledWith('/admin/topup-codes/t1/revoke', { method: 'POST' })
  })

  it('generateCode returns the code string', async () => {
    apiMock.mockResolvedValue({ code: 'YD-AB23-CD45' })
    await expect(topupCodesService.generateCode()).resolves.toBe('YD-AB23-CD45')
    expect(apiMock).toHaveBeenCalledWith('/admin/topup-codes/generate-code', { method: 'POST' })
  })
})
