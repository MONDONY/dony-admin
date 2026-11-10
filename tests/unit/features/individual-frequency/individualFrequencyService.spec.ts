import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { individualFrequencyService } from '@/features/individual-frequency/services/individualFrequencyService'

describe('individualFrequencyService', () => {
  beforeEach(() => { apiMock.mockReset() })

  it('list() lit GET /admin/individual-frequency-flags (tableau du contrat)', async () => {
    const rows = [{ flagId: 'f1', userId: 'u1', displayName: 'Awa', tripsCount: 5, windowDays: 30, threshold: 4, detectedAt: '2026-11-10T04:30:00Z' }]
    apiMock.mockResolvedValue(rows)
    expect(await individualFrequencyService.list()).toEqual(rows)
    expect(apiMock).toHaveBeenCalledWith('/admin/individual-frequency-flags')
  })

  it('list() tolère une page Spring ({ content })', async () => {
    apiMock.mockResolvedValue({ content: [{ flagId: 'f1', userId: 'u1' }] })
    expect(await individualFrequencyService.list()).toEqual([{ flagId: 'f1', userId: 'u1' }])
  })

  it('list() rend un tableau vide pour une réponse inattendue', async () => {
    apiMock.mockResolvedValue(null)
    expect(await individualFrequencyService.list()).toEqual([])
    apiMock.mockResolvedValue({ foo: 1 })
    expect(await individualFrequencyService.list()).toEqual([])
  })

  it('dismiss() poste sur le drapeau, identifiant encodé', async () => {
    apiMock.mockResolvedValue(undefined)
    await individualFrequencyService.dismiss('f1')
    await individualFrequencyService.dismiss('f/../1')
    expect(apiMock.mock.calls[0]).toEqual(['/admin/individual-frequency-flags/f1/dismiss', { method: 'POST' }])
    expect(apiMock.mock.calls[1]).toEqual(['/admin/individual-frequency-flags/f%2F..%2F1/dismiss', { method: 'POST' }])
  })
})
