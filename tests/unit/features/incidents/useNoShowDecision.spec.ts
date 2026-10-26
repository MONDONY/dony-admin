import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
vi.mock('@/features/incidents/services/incidentsService')
import { useNoShowDecision, DISPUTE_REFRESH_MS } from '@/features/incidents/composables/useNoShowDecision'
import { incidentsService } from '@/features/incidents/services/incidentsService'
import { noShow as row } from './noShowFixtures'
const svc = incidentsService as any

const httpError = (status: number, data: Record<string, unknown> = {}) => Object.assign(new Error(`${status}`), { statusCode: status, data })

describe('useNoShowDecision', () => {
  const reload = vi.fn()
  beforeEach(() => {
    vi.clearAllMocks()
    reload.mockResolvedValue(undefined)
    svc.confirmNoShow = vi.fn()
    svc.rejectNoShow = vi.fn()
    svc.confirmLegacyNoShow = vi.fn()
  })
  const decide = () => useNoShowDecision(reload).decide

  it('confirmer au départ : motif nettoyé, file relue, message de succès', async () => {
    svc.confirmNoShow.mockResolvedValue(row({ status: 'CONFIRMED', canConfirm: false, canReject: false }))
    const res = await decide()(row(), 'confirm', '  Absent, confirmé au téléphone  ')
    expect(svc.confirmNoShow).toHaveBeenCalledWith('c1', 'Absent, confirmé au téléphone')
    expect(res.ok).toBe(true)
    expect(res.message).toMatch(/remboursé/)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('confirmer à l’arrivée : message de litige', async () => {
    svc.confirmNoShow.mockResolvedValue(row({ scope: 'DELIVERY', status: 'CONFIRMED', adminDecision: 'CONFIRMED', dispute: { id: 'd1', status: 'OPEN' } }))
    const res = await decide()(row({ scope: 'DELIVERY' }), 'confirm', 'Destinataire injoignable')
    expect(res.message).toMatch(/Litige ouvert/)
    expect(res.ok && res.disputePending).toBeFalsy()
  })

  describe('litige créé après la réponse (dispute: null)', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('annonce le litige puis relit la file environ une seconde plus tard', async () => {
      svc.confirmNoShow.mockResolvedValue(row({ scope: 'DELIVERY', status: 'CONFIRMED', adminDecision: 'CONFIRMED', dispute: null }))
      const res = await decide()(row({ scope: 'DELIVERY' }), 'confirm', 'Destinataire injoignable')
      expect(res).toMatchObject({ ok: true, disputePending: true, message: expect.stringMatching(/Un litige va être ouvert/) })
      expect(reload).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(DISPUTE_REFRESH_MS)
      expect(reload).toHaveBeenCalledTimes(2)
    })
  })

  it('404 noshow-not-found : message clair et file relue', async () => {
    svc.confirmNoShow.mockRejectedValue(httpError(404, { code: 'noshow-not-found', detail: 'Not found' }))
    const res = await decide()(row(), 'confirm', 'motif assez long')
    expect(res).toMatchObject({ ok: false, code: 'noshow-not-found', message: expect.stringMatching(/n’existe plus/) })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('409 déjà tranché : message dans le résultat et file relue', async () => {
    svc.confirmNoShow.mockRejectedValue(httpError(409, { code: 'noshow-already-decided', detail: 'Déjà tranché' }))
    const res = await decide()(row(), 'confirm', 'Absent, confirmé au téléphone')
    expect(res).toEqual({ ok: false, code: 'noshow-already-decided', message: expect.stringMatching(/déjà été tranchée/) })
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('rejeter : appelle reject', async () => {
    svc.rejectNoShow.mockResolvedValue(row({ status: 'RESOLVED', adminDecision: 'REJECTED' }))
    const res = await decide()(row(), 'reject', 'Remise faite, photo à l’appui')
    expect(svc.rejectNoShow).toHaveBeenCalledWith('c1', 'Remise faite, photo à l’appui')
    expect(res).toMatchObject({ ok: true, message: expect.stringMatching(/rejetée/) })
  })

  it('422 : messages de validation par champ (objet ou liste)', async () => {
    const d = decide()
    svc.confirmNoShow.mockRejectedValueOnce(httpError(422, { violations: { reason: 'Le motif doit faire au moins 10 caractères' } }))
    expect((await d(row(), 'confirm', 'court motif')).message).toBe('Le motif doit faire au moins 10 caractères')
    svc.confirmNoShow.mockRejectedValueOnce(httpError(422, { violations: [{ field: 'reason', message: 'Trop long' }], detail: 'Invalide' }))
    expect((await d(row(), 'confirm', 'court motif')).message).toBe('Trop long')
    svc.confirmNoShow.mockRejectedValueOnce(httpError(422, { detail: 'Motif invalide' }))
    expect((await d(row(), 'confirm', 'court motif')).message).toBe('Motif invalide')
  })

  it('403, endpoint absent et erreur inconnue : pas de relecture', async () => {
    const d = decide()
    svc.confirmNoShow.mockRejectedValueOnce(httpError(403, {}))
    expect((await d(row(), 'confirm', 'motif assez long')).message).toMatch(/permission/)
    svc.confirmNoShow.mockRejectedValueOnce(httpError(404, {}))
    expect((await d(row(), 'confirm', 'motif assez long')).message).toMatch(/pas encore à jour/)
    svc.confirmNoShow.mockRejectedValueOnce({})
    expect(await d(row(), 'confirm', 'motif assez long')).toEqual({ ok: false, code: null, message: 'La décision n’a pas pu être enregistrée.' })
    expect(reload).not.toHaveBeenCalled()
  })

  it('ancien back : confirmation par colis via l’ancien endpoint, rejet refusé', async () => {
    const legacy = row({ legacy: true, scope: null, canReject: false })
    svc.confirmLegacyNoShow.mockResolvedValue(undefined)
    const d = decide()
    expect(await d(legacy, 'confirm', '')).toEqual({ ok: true, message: 'Absence confirmée.' })
    expect(svc.confirmLegacyNoShow).toHaveBeenCalledWith(legacy.bidId)
    expect(svc.confirmNoShow).not.toHaveBeenCalled()
    expect(reload).toHaveBeenCalledTimes(1)

    const rej = await d(legacy, 'reject', 'motif assez long')
    expect(rej.ok).toBe(false)
    expect(svc.rejectNoShow).not.toHaveBeenCalled()
  })

  it('ancien back : l’erreur est rendue', async () => {
    svc.confirmLegacyNoShow.mockRejectedValue(httpError(404, { code: 'cancellation-not-found', detail: 'Aucune annulation en attente pour ce bid' }))
    const res = await decide()(row({ legacy: true, scope: null }), 'confirm', '')
    expect(res).toMatchObject({ ok: false, message: 'Aucune annulation en attente pour ce bid' })
  })
})
