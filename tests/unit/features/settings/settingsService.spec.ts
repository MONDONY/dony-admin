import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { settingsService } from '@/features/settings/services/settingsService'

describe('settingsService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list() interroge /admin/settings', async () => {
    apiMock.mockResolvedValue([])
    await settingsService.list()
    expect(apiMock).toHaveBeenCalledWith('/admin/settings')
  })

  it('list() renvoie les réglages tels que renvoyés par le back', async () => {
    const settings = [
      { key: 'commission_rate_percent', value: '10', type: 'DECIMAL', updatedAt: null, updatedByEmail: null },
      { key: 'urgency_threshold_days', value: '3', type: 'INT', updatedAt: null, updatedByEmail: null },
    ]
    apiMock.mockResolvedValue(settings)
    const res = await settingsService.list()
    expect(res).toEqual(settings)
  })

  it('update() PUTe la nouvelle valeur sur la clé du réglage', async () => {
    apiMock.mockResolvedValue({
      key: 'urgency_threshold_days',
      value: '5',
      type: 'INT',
      updatedAt: '2026-08-19T10:00:00Z',
      updatedByEmail: 'admin@yadony.com',
    })
    const res = await settingsService.update('urgency_threshold_days', '5')
    expect(apiMock).toHaveBeenCalledWith('/admin/settings/urgency_threshold_days', {
      method: 'PUT',
      body: { value: '5' },
    })
    expect(res.value).toBe('5')
    expect(res.updatedByEmail).toBe('admin@yadony.com')
  })

  it('update() appelle le même chemin pour sms_enabled que pour les autres clés — aucun raccourci', async () => {
    apiMock.mockResolvedValue({ key: 'sms_enabled', value: 'false', type: 'BOOLEAN', updatedAt: null, updatedByEmail: null })
    await settingsService.update('sms_enabled', 'false')
    expect(apiMock).toHaveBeenCalledWith('/admin/settings/sms_enabled', {
      method: 'PUT',
      body: { value: 'false' },
    })
  })

  it('update() PUTe la clé reimbursement_cap_eur', async () => {
    apiMock.mockResolvedValue({ key: 'reimbursement_cap_eur', value: '80', type: 'DECIMAL', updatedAt: null, updatedByEmail: null })
    await settingsService.update('reimbursement_cap_eur', '80')
    expect(apiMock).toHaveBeenCalledWith('/admin/settings/reimbursement_cap_eur', {
      method: 'PUT',
      body: { value: '80' },
    })
  })
})
