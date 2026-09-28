import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/incidents/services/incidentsService')
import { useNoShows } from '@/features/incidents/composables/useNoShows'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import type { AdminNoShow } from '@/features/incidents/types/index'
const svc = incidentsService as any

const row = (over: Partial<AdminNoShow> = {}): AdminNoShow => ({
  id: 'c1', bidId: 'b1', legacy: false, scope: 'HANDOVER', reason: 'SENDER_NO_SHOW', status: 'PENDING_CONFIRMATION',
  contestationDeadline: null, remainingMinutes: 300, createdAt: '2026-09-28T10:00:00Z',
  declarant: { role: 'TRAVELER', name: 'Awa D.' }, accused: { role: 'SENDER', name: 'Moussa K.' }, trip: null, handoverAt: null,
  amount: 45, currency: 'EUR', paymentMethod: 'CASH', paymentStatus: null, bidStatus: null, dispute: null, canConfirm: true, canReject: true,
  ...over,
})
const page = (content: AdminNoShow[], number = 0, totalPages = 1) => ({ content, totalElements: content.length, totalPages, number, size: 20 })
const httpError = (status: number, data: Record<string, unknown> = {}) => Object.assign(new Error(`${status}`), { statusCode: status, data })

describe('useNoShows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.listNoShows = vi.fn().mockResolvedValue(page([row()]))
    svc.confirmNoShow = vi.fn()
    svc.rejectNoShow = vi.fn()
    svc.confirmLegacyNoShow = vi.fn()
  })

  describe('liste', () => {
    it('charge « En attente », toutes portées, page 0', async () => {
      const n = useNoShows()
      await n.fetch()
      expect(svc.listNoShows).toHaveBeenCalledWith({ status: 'PENDING_CONFIRMATION', scope: 'ALL' }, 0, 20)
      expect(n.rows.value).toHaveLength(1)
      expect(n.isLoading.value).toBe(false)
    })

    it('setStatus et setScope rechargent depuis la première page', async () => {
      svc.listNoShows.mockResolvedValueOnce(page([row()], 0, 3)).mockResolvedValueOnce(page([row()], 2, 3))
      const n = useNoShows()
      await n.fetch()
      await n.goToPage(2)
      expect(n.currentPage.value).toBe(2)
      await n.setStatus('CONTESTED')
      expect(svc.listNoShows).toHaveBeenLastCalledWith({ status: 'CONTESTED', scope: 'ALL' }, 0, 20)
      expect(n.currentPage.value).toBe(0)
      await n.setScope('DELIVERY')
      expect(svc.listNoShows).toHaveBeenLastCalledWith({ status: 'CONTESTED', scope: 'DELIVERY' }, 0, 20)
    })

    it('un échec garde la page affichée et montre le détail du ProblemDetail', async () => {
      const n = useNoShows()
      await n.fetch()
      svc.listNoShows.mockRejectedValueOnce(httpError(500, { detail: 'Détail lisible du back' }))
      await n.goToPage(1)
      expect(n.currentPage.value).toBe(0)
      expect(n.error.value).toBe('Détail lisible du back')
      svc.listNoShows.mockRejectedValueOnce({})
      await n.fetch()
      expect(n.error.value).toBe('Impossible de charger les no-shows')
    })
  })

  describe('sélection et ?open=', () => {
    it('select puis close', () => {
      const n = useNoShows()
      n.select(row())
      expect(n.selected.value?.id).toBe('c1')
      n.close()
      expect(n.selected.value).toBeNull()
    })

    it('openById trouve la ligne dans la page chargée', async () => {
      const n = useNoShows()
      await n.fetch()
      expect(await n.openById('c1')).toBe(true)
      expect(n.selected.value?.id).toBe('c1')
      expect(svc.listNoShows).toHaveBeenCalledTimes(1)
    })

    it('openById élargit aux filtres « Tous » si la ligne n’est pas affichée', async () => {
      svc.listNoShows.mockResolvedValueOnce(page([row()])).mockResolvedValueOnce(page([row(), row({ id: 'c9', status: 'CONFIRMED' })]))
      const n = useNoShows()
      await n.fetch()
      expect(await n.openById('c9')).toBe(true)
      expect(n.filters.status).toBe('ALL')
      expect(n.filters.scope).toBe('ALL')
      expect(n.selected.value?.id).toBe('c9')
    })

    it('openById introuvable : message clair', async () => {
      const n = useNoShows()
      await n.fetch()
      expect(await n.openById('absent')).toBe(false)
      expect(n.openError.value).toMatch(/introuvable/)
      expect(await n.openById('absent')).toBe(false)
      expect(svc.listNoShows).toHaveBeenCalledTimes(2)
    })
  })

  describe('décisions', () => {
    it('confirmer au départ : motif envoyé, ligne mise à jour, liste rechargée, message de succès', async () => {
      svc.confirmNoShow.mockResolvedValue(row({ status: 'CONFIRMED', canConfirm: false, canReject: false }))
      const n = useNoShows()
      await n.fetch()
      n.select(n.rows.value[0]!)
      const res = await n.confirm(n.rows.value[0]!, '  Absent, confirmé au téléphone  ')
      expect(svc.confirmNoShow).toHaveBeenCalledWith('c1', 'Absent, confirmé au téléphone')
      expect(res.ok).toBe(true)
      expect(res.message).toMatch(/remboursé/)
      expect(n.success.value).toBe(res.message)
      expect(n.selected.value?.status).toBe('CONFIRMED')
      expect(svc.listNoShows).toHaveBeenCalledTimes(2)
    })

    it('confirmer à l’arrivée : message de litige', async () => {
      svc.confirmNoShow.mockResolvedValue(row({ scope: 'DELIVERY', status: 'CONFIRMED', dispute: { id: 'd1', status: 'OPEN' } }))
      const n = useNoShows()
      const res = await n.confirm(row({ scope: 'DELIVERY' }), 'Destinataire injoignable')
      expect(res.message).toMatch(/Litige ouvert/)
    })

    it('rejeter : appelle reject et ne touche pas une autre ligne sélectionnée', async () => {
      svc.rejectNoShow.mockResolvedValue(row({ status: 'RESOLVED' }))
      const n = useNoShows()
      n.select(row({ id: 'autre' }))
      const res = await n.reject(row(), 'Remise faite, photo à l’appui')
      expect(svc.rejectNoShow).toHaveBeenCalledWith('c1', 'Remise faite, photo à l’appui')
      expect(res).toMatchObject({ ok: true })
      expect(n.selected.value?.id).toBe('autre')
    })

    it('409 déjà tranché : message dans le résultat, liste rechargée, actions retirées', async () => {
      svc.confirmNoShow.mockRejectedValue(httpError(409, { code: 'noshow-already-decided', detail: 'Déjà tranché' }))
      svc.listNoShows.mockResolvedValue(page([]))
      const n = useNoShows()
      const r = row()
      n.select(r)
      const res = await n.confirm(r, 'Absent, confirmé au téléphone')
      expect(res).toEqual({ ok: false, code: 'noshow-already-decided', message: expect.stringMatching(/déjà été tranchée/) })
      expect(svc.listNoShows).toHaveBeenCalledTimes(1)
      expect(n.selected.value).toMatchObject({ canConfirm: false, canReject: false })
    })

    it('409 déjà tranché : reprend la ligne relue si elle est encore listée', async () => {
      svc.rejectNoShow.mockRejectedValue(httpError(409, { code: 'noshow-already-decided' }))
      svc.listNoShows.mockResolvedValue(page([row({ status: 'CONFIRMED', canConfirm: false, canReject: false })]))
      const n = useNoShows()
      n.select(row())
      await n.reject(row(), 'Remise faite, photo à l’appui')
      expect(n.selected.value?.status).toBe('CONFIRMED')
    })

    it('422 : messages de validation par champ (objet ou liste)', async () => {
      svc.confirmNoShow.mockRejectedValueOnce(httpError(422, { violations: { reason: 'Le motif doit faire au moins 10 caractères' } }))
      const n = useNoShows()
      expect((await n.confirm(row(), 'court motif')).message).toBe('Le motif doit faire au moins 10 caractères')
      svc.confirmNoShow.mockRejectedValueOnce(httpError(422, { violations: [{ field: 'reason', message: 'Trop long' }], detail: 'Invalide' }))
      expect((await n.confirm(row(), 'court motif')).message).toBe('Trop long')
      svc.confirmNoShow.mockRejectedValueOnce(httpError(422, { detail: 'Motif invalide' }))
      expect((await n.confirm(row(), 'court motif')).message).toBe('Motif invalide')
    })

    it('403, endpoint absent et erreur inconnue', async () => {
      const n = useNoShows()
      svc.confirmNoShow.mockRejectedValueOnce(httpError(403, {}))
      expect((await n.confirm(row(), 'motif assez long')).message).toMatch(/permission/)
      svc.confirmNoShow.mockRejectedValueOnce(httpError(404, {}))
      expect((await n.confirm(row(), 'motif assez long')).message).toMatch(/pas encore à jour/)
      svc.confirmNoShow.mockRejectedValueOnce({})
      const res = await n.confirm(row(), 'motif assez long')
      expect(res).toEqual({ ok: false, code: null, message: 'La décision n’a pas pu être enregistrée.' })
      expect(n.success.value).toBeNull()
    })

    it('ancien back : confirmation par bid via l’ancien endpoint, rejet refusé', async () => {
      const legacy = row({ legacy: true, scope: null, canReject: false })
      svc.confirmLegacyNoShow.mockResolvedValue(undefined)
      svc.listNoShows.mockResolvedValue(page([]))
      const n = useNoShows()
      n.select(legacy)
      const res = await n.confirm(legacy, '')
      expect(svc.confirmLegacyNoShow).toHaveBeenCalledWith('b1')
      expect(svc.confirmNoShow).not.toHaveBeenCalled()
      expect(res).toEqual({ ok: true, message: 'Absence confirmée.' })
      expect(n.selected.value).toMatchObject({ status: 'CONFIRMED', canConfirm: false })

      const rej = await n.reject(legacy, 'motif assez long')
      expect(rej.ok).toBe(false)
      expect(svc.rejectNoShow).not.toHaveBeenCalled()
    })

    it('ancien back : l’erreur est rendue', async () => {
      svc.confirmLegacyNoShow.mockRejectedValue(httpError(404, { code: 'cancellation-not-found', detail: 'Aucune annulation en attente pour ce bid' }))
      const n = useNoShows()
      const res = await n.confirm(row({ legacy: true, scope: null }), '')
      expect(res).toMatchObject({ ok: false, message: 'Aucune annulation en attente pour ce bid' })
    })
  })
})
