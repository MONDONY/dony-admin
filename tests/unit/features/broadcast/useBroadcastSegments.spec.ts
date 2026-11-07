import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/broadcast/services/broadcastService')
import { useBroadcastSegments } from '@/features/broadcast/composables/useBroadcastSegments'
import { broadcastService } from '@/features/broadcast/services/broadcastService'
import { parseRule } from '@/features/broadcast/composables/audienceRule'

const segSvc = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), get: vi.fn() }
;(broadcastService as unknown as { segments: typeof segSvc }).segments = segSvc

const page = (content: unknown[] = []) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })
const rule = parseRule({ op: 'AND', children: [] })
const seg = { id: 's1', name: 'Pro', description: null, rule: { op: 'AND', children: [] }, recipientCount: -1, updatedAt: '2026-11-01T10:00:00' }

describe('useBroadcastSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    segSvc.list.mockResolvedValue(page([seg]))
    segSvc.create.mockResolvedValue(seg)
    segSvc.update.mockResolvedValue(seg)
    segSvc.remove.mockResolvedValue(undefined)
  })

  it('fetchSegments charge la liste', async () => {
    const s = useBroadcastSegments()
    await s.fetchSegments()
    expect(s.segments.value).toHaveLength(1)
    expect(s.loading.value).toBe(false)
  })

  it('fetchSegments garde l’erreur du back', async () => {
    segSvc.list.mockRejectedValue({ data: { detail: 'Accès refusé' } })
    const s = useBroadcastSegments()
    await s.fetchSegments()
    expect(s.error.value).toBe('Accès refusé')
  })

  it('create réussit, recharge la liste et renvoie null', async () => {
    const s = useBroadcastSegments()
    expect(await s.create('Pro', null, rule)).toBeNull()
    expect(segSvc.create).toHaveBeenCalledWith('Pro', null, rule)
    expect(segSvc.list).toHaveBeenCalled()
  })

  it('enregistrerSegment_409_afficheNomPris', async () => {
    segSvc.create.mockRejectedValue({ statusCode: 409, data: { detail: 'broadcast-segment-name-taken' } })
    const s = useBroadcastSegments()
    expect(await s.create('Pro', null, rule)).toBe('Ce nom est déjà pris')
    expect(segSvc.list).not.toHaveBeenCalled()
  })

  it('create renvoie le détail pour une autre erreur', async () => {
    segSvc.create.mockRejectedValue({ statusCode: 422, data: { detail: 'Règle invalide' } })
    expect(await useBroadcastSegments().create('Pro', null, rule)).toBe('Règle invalide')
  })

  it('update gère 409 et succès', async () => {
    const s = useBroadcastSegments()
    expect(await s.update('s1', 'Pro', null, rule)).toBeNull()
    segSvc.update.mockRejectedValue({ status: 409 })
    expect(await s.update('s1', 'Pro', null, rule)).toBe('Ce nom est déjà pris')
  })

  it('rename renvoie la règle du segment au back', async () => {
    const s = useBroadcastSegments()
    expect(await s.rename(seg, 'Nouveau')).toBeNull()
    expect(segSvc.update).toHaveBeenCalledWith('s1', 'Nouveau', null, expect.objectContaining({ kind: 'group', op: 'AND' }))
  })

  it('remove recharge, ou renvoie l’erreur', async () => {
    const s = useBroadcastSegments()
    expect(await s.remove('s1')).toBeNull()
    expect(segSvc.list).toHaveBeenCalled()
    segSvc.remove.mockRejectedValue({ data: { detail: 'Introuvable' } })
    expect(await s.remove('s1')).toBe('Introuvable')
  })
})
