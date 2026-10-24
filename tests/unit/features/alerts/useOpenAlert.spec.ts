/** Alerte ouverte par lien profond (`/alertes?open=<id>`) : liste chargée d'abord, sinon `GET /admin/alerts/{id}`. */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { AdminAlert } from '@/features/alerts/types/index'

const svc = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))

import { useOpenAlert } from '@/features/alerts/composables/useOpenAlert'

const A = '0a1b2c3d-1111-4222-8333-444455556666'
const B = '9f8e7d6c-aaaa-4bbb-8ccc-ddddeeeeffff'
const alert = (id: string, over: Partial<AdminAlert> = {}) => ({
  id, type: 'ESCROW_J48_TIMEOUT', severity: 'WARN', detail: null, payload: {}, resolved: false, resolvedAt: null, createdAt: '2026-10-06T12:00:00', ...over,
}) as AdminAlert

describe('useOpenAlert', () => {
  beforeEach(() => { svc.get.mockReset() })

  it('alerte déjà dans la liste : ouverte sans appel', async () => {
    const o = useOpenAlert(ref([alert(A)]))
    await o.openById(A)
    expect(o.selected.value?.id).toBe(A)
    expect(svc.get).not.toHaveBeenCalled()
  })

  it('hors de la liste : lue par identifiant', async () => {
    svc.get.mockResolvedValue(alert(B, { resolved: true }))
    const o = useOpenAlert(ref([alert(A)]))
    await o.openById(B)
    expect(svc.get).toHaveBeenCalledWith(B)
    expect(o.selected.value?.id).toBe(B)
    expect(o.openError.value).toBeNull()
  })

  it('404 : « Alerte introuvable », pas de panneau', async () => {
    svc.get.mockRejectedValue(Object.assign(new Error('Not Found'), { statusCode: 404 }))
    const o = useOpenAlert(ref([]))
    await o.openById(B)
    expect(o.selected.value).toBeNull()
    expect(o.openError.value).toBe('Alerte introuvable')
  })

  it('autre erreur : message du back', async () => {
    svc.get.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500, data: { detail: 'Base indisponible' } }))
    const o = useOpenAlert(ref([]))
    await o.openById(B)
    expect(o.openError.value).toBe('Base indisponible')
  })

  it('identifiant mal formé : ignoré, aucun appel', async () => {
    const o = useOpenAlert(ref([]))
    await o.openById('../x')
    expect(svc.get).not.toHaveBeenCalled()
    expect(o.selected.value).toBeNull()
    expect(o.openError.value).toBeNull()
  })

  it('fermé pendant la lecture : la réponse arrivée après ne rouvre rien', async () => {
    let resolve!: (_a: AdminAlert) => void
    svc.get.mockReturnValue(new Promise<AdminAlert>((r) => { resolve = r }))
    const o = useOpenAlert(ref([]))
    const p = o.openById(B)
    o.close()
    resolve(alert(B))
    await p
    expect(o.selected.value).toBeNull()
  })

  it('open / close : erreur effacée', async () => {
    svc.get.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 404 }))
    const o = useOpenAlert(ref([]))
    await o.openById(B)
    o.open(alert(A))
    expect(o.openError.value).toBeNull()
    expect(o.selected.value?.id).toBe(A)
    o.close()
    expect(o.selected.value).toBeNull()
  })
})
