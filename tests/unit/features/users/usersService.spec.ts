import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))

import { usersService } from '@/features/users/services/usersService'

describe('usersService', () => {
  beforeEach(() => apiMock.mockReset())

  it('list() requests /admin/users with filter + paging query params', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'SUSPENDED', role: null, kyc: null, pro: null, city: null, query: 'jean' }, 1, 20)
    const [url, opts] = apiMock.mock.calls[0]
    expect(url).toBe('/admin/users')
    expect(opts.query).toMatchObject({ status: 'SUSPENDED', query: 'jean', page: 1, size: 20 })
    expect(opts.query.role).toBeUndefined()
  })

  it('list() omits TOUS status', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: null, kyc: null, pro: null, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.status).toBeUndefined()
  })

  it('suspend() POSTs reason', async () => {
    apiMock.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })
    const r = await usersService.suspend('u1', 'fraude')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/suspend', { method: 'POST', body: { reason: 'fraude' } })
    expect(r.status).toBe('SUSPENDED')
  })

  it('ban() POSTs reason', async () => {
    apiMock.mockResolvedValue({ id: 'u1', status: 'BANNED' })
    await usersService.ban('u1', 'abus')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/ban', { method: 'POST', body: { reason: 'abus' } })
  })

  it('setCommissionRate() PUTs rate', async () => {
    apiMock.mockResolvedValue({ id: 'u1' })
    await usersService.setCommissionRate('u1', 0.1)
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/commission-rate', { method: 'PUT', body: { rate: 0.1 } })
  })

  it('get() fetches a single user', async () => {
    apiMock.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const r = await usersService.get('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1')
    expect(r.id).toBe('u1')
  })

  it('unsuspend() POSTs without body', async () => {
    apiMock.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    await usersService.unsuspend('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/unsuspend', { method: 'POST' })
  })

  it('suspendPublishing POSTs reason as query param', async () => {
    await usersService.suspendPublishing('u1', 'annonces frauduleuses')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/suspend-publishing', {
      method: 'POST',
      query: { reason: 'annonces frauduleuses' },
    })
  })

  it('liftPublishingSuspension POSTs without body', async () => {
    await usersService.liftPublishingSuspension('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/lift-publishing-suspension', {
      method: 'POST',
    })
  })

  it('muteMessaging() POSTs durationHours and reason', async () => {
    apiMock.mockResolvedValue({ id: 'u1', messagingMutedUntil: '2026-08-19T00:00:00Z' })
    const r = await usersService.muteMessaging('u1', 24, 'spam')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/mute-messaging', {
      method: 'POST',
      body: { durationHours: 24, reason: 'spam' },
    })
    expect(r.messagingMutedUntil).toBe('2026-08-19T00:00:00Z')
  })

  it('muteMessaging() with a null duration means an indefinite mute', async () => {
    apiMock.mockResolvedValue({ id: 'u1' })
    await usersService.muteMessaging('u1', null, 'abus répétés')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/mute-messaging', {
      method: 'POST',
      body: { durationHours: null, reason: 'abus répétés' },
    })
  })

  it('unmuteMessaging() POSTs without body', async () => {
    apiMock.mockResolvedValue({ id: 'u1', messagingMutedUntil: null })
    await usersService.unmuteMessaging('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/unmute-messaging', {
      method: 'POST',
    })
  })

  it('getKyc() interroge /admin/users/{id}/kyc', async () => {
    apiMock.mockResolvedValue({ userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED' })
    const r = await usersService.getKyc('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc')
    expect(r.kycStatus).toBe('REJECTED')
  })

  it('resetKyc() POSTe le motif sur /kyc/reset', async () => {
    apiMock.mockResolvedValue({ userId: 'u1', kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING' })
    const r = await usersService.resetKyc('u1', 'document illisible')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/kyc/reset', {
      method: 'POST',
      body: { reason: 'document illisible' },
    })
    expect(r.kycStatus).toBe('NOT_STARTED')
  })

  it('listGdprRequests() interroge la file paginée', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.listGdprRequests(1, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/users/gdpr-requests', { query: { page: 1, size: 20 } })
  })

  it('executeGdprDeletion() POSTe le motif sur /gdpr-execute', async () => {
    apiMock.mockResolvedValue(undefined)
    await usersService.executeGdprDeletion('u1', 'demande confirmée')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/gdpr-execute', {
      method: 'POST',
      body: { reason: 'demande confirmée' },
    })
  })

  it('getDeletionImpact() interroge le rapport d\'impact', async () => {
    apiMock.mockResolvedValue({ blocked: false, findings: [] })
    const r = await usersService.getDeletionImpact('u1')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/deletion-impact')
    expect(r.blocked).toBe(false)
  })

  it('deleteUser() POSTe le motif catalogué et le motif libre', async () => {
    apiMock.mockResolvedValue(undefined)
    await usersService.deleteUser('u1', 'FRAUD', 'faux documents')
    expect(apiMock).toHaveBeenCalledWith('/admin/users/u1/delete', {
      method: 'POST',
      body: { reasonCode: 'FRAUD', reason: 'faux documents' },
    })
  })

  // Branches buildQuery — role, kyc, pro, city (lignes 10-13)
  it('list() inclut role quand il est fourni', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: 'TRAVELER', kyc: null, pro: null, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.role).toBe('TRAVELER')
  })

  it('list() inclut kyc quand il est fourni', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: null, kyc: 'APPROVED', pro: null, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.kyc).toBe('APPROVED')
  })

  it('list() inclut pro=true quand fourni', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: null, kyc: null, pro: true, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.pro).toBe(true)
  })

  it('list() inclut pro=false quand fourni', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: null, kyc: null, pro: false, city: null, query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.pro).toBe(false)
  })

  it('list() inclut city quand fournie', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await usersService.list({ status: 'TOUS', role: null, kyc: null, pro: null, city: 'Paris', query: '' }, 0, 20)
    expect(apiMock.mock.calls[0][1].query.city).toBe('Paris')
  })
})
