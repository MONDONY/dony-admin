import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { broadcastService } from '@/features/broadcast/services/broadcastService'

describe('broadcastService', () => {
  beforeEach(() => apiMock.mockReset())

  it('preview POSTe le ciblage et ne renvoie que le compteur', async () => {
    apiMock.mockResolvedValue({ recipientCount: 128 })
    const res = await broadcastService.preview({ type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/preview', {
      method: 'POST',
      body: { type: 'CORRIDOR', origin: 'Paris', destination: 'Dakar' },
    })
    expect(res.recipientCount).toBe(128)
  })

  it('preview omet les villes pour un ciblage non-corridor', async () => {
    apiMock.mockResolvedValue({ recipientCount: 3 })
    await broadcastService.preview({ type: 'ALL' })
    expect(apiMock.mock.calls[0][1].body).toEqual({ type: 'ALL' })
  })

  it('send POSTe titre, corps, ciblage et le choix du push', async () => {
    apiMock.mockResolvedValue({ id: 'b1', recipientCount: 12 })
    await broadcastService.send('Titre', 'Corps', { type: 'USER', userId: 'u1' }, true)
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast', {
      method: 'POST',
      body: { title: 'Titre', body: 'Corps', target: { type: 'USER', userId: 'u1' }, push: true },
    })
  })

  it('presets GETe le catalogue des audiences prêtes', async () => {
    apiMock.mockResolvedValue([{ key: 'activation', label: 'À activer', description: 'd', rule: {}, messages: {} }])
    const res = await broadcastService.presets()
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/presets')
    expect(res[0].key).toBe('activation')
  })

  it('send transmet push: false explicitement', async () => {
    apiMock.mockResolvedValue({ id: 'b1', recipientCount: 12 })
    await broadcastService.send('Titre', 'Corps', { type: 'ALL' }, false)
    expect(apiMock.mock.calls[0][1].body.push).toBe(false)
  })

  it('listHistory GETe une page', async () => {
    apiMock.mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 })
    await broadcastService.listHistory(1, 20)
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcasts', { query: { page: 1, size: 20 } })
  })
})

describe('broadcastService : règles d’audience', () => {
  beforeEach(() => apiMock.mockReset())

  const rule = { kind: 'group' as const, id: 'g1', op: 'AND' as const, children: [
    { kind: 'condition' as const, id: 'c1', field: 'created_request', operator: 'EVER', value: null },
  ] }
  const wireRule = { op: 'AND', children: [{ field: 'created_request', operator: 'EVER', value: null }] }

  it('serializeTarget_rule_nEnvoiePasSegmentId', async () => {
    apiMock.mockResolvedValue({ recipientCount: 1 })
    await broadcastService.preview({ type: 'RULE', rule, segmentId: 'seg-1' })
    expect(apiMock.mock.calls[0][1].body).toEqual({ type: 'RULE', rule: wireRule })
  })

  it('serializeTarget envoie segmentId seul quand il n’y a pas de règle', async () => {
    apiMock.mockResolvedValue({ recipientCount: 1 })
    await broadcastService.preview({ type: 'RULE', segmentId: 'seg-1' })
    expect(apiMock.mock.calls[0][1].body).toEqual({ type: 'RULE', segmentId: 'seg-1' })
  })

  it('fields GETe le catalogue', async () => {
    apiMock.mockResolvedValue([])
    await broadcastService.fields()
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/fields')
  })

  it('recipients POSTe le ciblage avec la pagination', async () => {
    apiMock.mockResolvedValue({ content: [] })
    await broadcastService.recipients({ type: 'ALL' }, 2, 50)
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/recipients', {
      method: 'POST', query: { page: 2, size: 50 }, body: { type: 'ALL' },
    })
  })

  it('downloadRecipientsCsv télécharge le blob', async () => {
    const blob = new Blob(['x'])
    apiMock.mockResolvedValue(blob)
    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    await broadcastService.downloadRecipientsCsv({ type: 'ALL' })
    expect(apiMock).toHaveBeenCalledWith('/admin/notifications/broadcast/recipients.csv', {
      method: 'POST', body: { type: 'ALL' }, responseType: 'blob',
    })
    expect(spy).toHaveBeenCalledWith(blob)
    const a = document.createElement('a')
    const nameSpy = vi.spyOn(document, 'createElement').mockReturnValue(a)
    await broadcastService.downloadRecipientsCsv({ type: 'ALL' })
    expect(a.download).toMatch(/^destinataires-\d{8}-\d{4}\.csv$/)
    nameSpy.mockRestore()
  })

  it('segments : list, get, create, update, remove', async () => {
    apiMock.mockResolvedValue({})
    await broadcastService.segments.list(1, 10)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/broadcast-segments', { query: { page: 1, size: 10 } })
    await broadcastService.segments.get('s1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/broadcast-segments/s1')
    await broadcastService.segments.create('N', 'D', rule)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/broadcast-segments', {
      method: 'POST', body: { name: 'N', description: 'D', rule: wireRule },
    })
    await broadcastService.segments.update('s1', 'N', null, rule)
    expect(apiMock).toHaveBeenLastCalledWith('/admin/broadcast-segments/s1', {
      method: 'PUT', body: { name: 'N', description: null, rule: wireRule },
    })
    await broadcastService.segments.remove('s1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/broadcast-segments/s1', { method: 'DELETE' })
  })
})
