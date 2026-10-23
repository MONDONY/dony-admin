import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAccountActions } from '@/features/user-profile/composables/useAccountActions'

const svc = {
  suspend: vi.fn(), ban: vi.fn(), unsuspend: vi.fn(), suspendPublishing: vi.fn(), liftPublishingSuspension: vi.fn(),
  muteMessaging: vi.fn(), unmuteMessaging: vi.fn(), setCommissionRate: vi.fn(), grantPro: vi.fn(), revokePro: vi.fn(),
  cancelDeletion: vi.fn(), get: vi.fn(),
}
vi.mock('@/features/users/services/usersService', () => ({ usersService: new Proxy({}, { get: (_t, k: string) => (...a: unknown[]) => (svc as Record<string, ReturnType<typeof vi.fn>>)[k]!(...a) }) }))

const DETAIL = { id: 'u1', status: 'SUSPENDED' }
let currentId: string | null
const onUpdate = vi.fn()
const make = () => useAccountActions({ getId: () => currentId, onUpdate })

describe('useAccountActions', () => {
  beforeEach(() => {
    currentId = 'u1'; onUpdate.mockReset()
    Object.values(svc).forEach(f => { f.mockReset(); f.mockResolvedValue(DETAIL) })
  })

  it.each([
    ['suspend', (a: ReturnType<typeof make>) => a.suspend('r'), 'suspend', ['u1', 'r']],
    ['ban', (a: ReturnType<typeof make>) => a.ban('r'), 'ban', ['u1', 'r']],
    ['unsuspend', (a: ReturnType<typeof make>) => a.unsuspend(), 'unsuspend', ['u1']],
    ['mute 24', (a: ReturnType<typeof make>) => a.muteMessaging(24, 'r'), 'muteMessaging', ['u1', 24, 'r']],
    ['mute 168', (a: ReturnType<typeof make>) => a.muteMessaging(168, 'r'), 'muteMessaging', ['u1', 168, 'r']],
    ['mute indéfini', (a: ReturnType<typeof make>) => a.muteMessaging(null, 'r'), 'muteMessaging', ['u1', null, 'r']],
    ['unmute', (a: ReturnType<typeof make>) => a.unmuteMessaging(), 'unmuteMessaging', ['u1']],
    ['commission', (a: ReturnType<typeof make>) => a.setCommissionRate(0.08), 'setCommissionRate', ['u1', 0.08]],
    ['reset commission', (a: ReturnType<typeof make>) => a.setCommissionRate(null), 'setCommissionRate', ['u1', null]],
    ['grantPro', (a: ReturnType<typeof make>) => a.grantPro('r'), 'grantPro', ['u1', 'r']],
    ['revokePro', (a: ReturnType<typeof make>) => a.revokePro(), 'revokePro', ['u1']],
  ])('%s : bon appel et mise à jour de la fiche', async (_n, call, fn, args) => {
    const a = make()
    await call(a)
    expect(svc[fn as keyof typeof svc]).toHaveBeenCalledWith(...args)
    expect(onUpdate).toHaveBeenCalledWith(DETAIL)
    expect(a.busy.value).toBe(false)
    expect(a.error.value).toBeNull()
  })

  it('suspendre la publication : appel puis relecture de la fiche', async () => {
    const a = make()
    await a.suspendPublishing('r')
    expect(svc.suspendPublishing).toHaveBeenCalledWith('u1', 'r')
    expect(svc.get).toHaveBeenCalledWith('u1')
    expect(onUpdate).toHaveBeenCalledWith(DETAIL)
  })

  it('lever la suspension de publication : appel puis relecture', async () => {
    const a = make()
    await a.liftPublishing()
    expect(svc.liftPublishingSuspension).toHaveBeenCalledWith('u1')
    expect(svc.get).toHaveBeenCalledWith('u1')
  })

  it('erreur : message du serveur, ou texte de repli du tiroir', async () => {
    svc.suspend.mockRejectedValue({ data: { detail: 'Trop tard' } })
    const a = make()
    await a.suspend('r')
    expect(a.error.value).toBe('Trop tard')
    expect(onUpdate).not.toHaveBeenCalled()
    expect(a.busy.value).toBe(false)
    svc.ban.mockRejectedValue({})
    await a.ban('r')
    expect(a.error.value).toBe('Action échouée')
  })

  it('busy pendant l’appel, et un second geste est ignoré', async () => {
    const d = Promise.withResolvers<unknown>()
    svc.suspend.mockReturnValue(d.promise)
    const a = make()
    const p = a.suspend('r')
    expect(a.busy.value).toBe(true)
    await a.ban('r')
    expect(svc.ban).not.toHaveBeenCalled()
    d.resolve(DETAIL); await p
    expect(a.busy.value).toBe(false)
  })

  it('réponse tardive après changement de compte : ignorée', async () => {
    const d = Promise.withResolvers<unknown>()
    svc.suspend.mockReturnValue(d.promise)
    const a = make()
    const p = a.suspend('r')
    currentId = 'u2'
    d.resolve(DETAIL); await p
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('erreur tardive après changement de compte : non affichée', async () => {
    const d = Promise.withResolvers<unknown>()
    svc.suspend.mockReturnValue(d.promise)
    const a = make()
    const p = a.suspend('r')
    currentId = 'u2'
    d.reject(new Error('x')); await p
    expect(a.error.value).toBeNull()
  })

  it('reset : efface erreur, occupation et états d’annulation', async () => {
    svc.suspend.mockRejectedValue(new Error('x'))
    const a = make()
    await a.suspend('r')
    a.reset()
    expect(a.error.value).toBeNull()
    expect(a.busy.value).toBe(false)
  })

  it('sans compte courant : rien ne part', async () => {
    currentId = null
    const a = make()
    await a.suspend('r')
    expect(svc.suspend).not.toHaveBeenCalled()
    expect(await a.cancelDeletion('un motif assez long')).toBe(false)
  })

  describe('cancelDeletion', () => {
    it('succès : true et fiche mise à jour', async () => {
      const a = make()
      expect(await a.cancelDeletion('un motif assez long')).toBe(true)
      expect(svc.cancelDeletion).toHaveBeenCalledWith('u1', 'un motif assez long')
      expect(onUpdate).toHaveBeenCalledWith(DETAIL)
    })
    it('endpoint absent : indisponible, sans erreur', async () => {
      svc.cancelDeletion.mockRejectedValue({ statusCode: 404 })
      const a = make()
      expect(await a.cancelDeletion('un motif assez long')).toBe(false)
      expect(a.cancelDeletionUnavailable.value).toBe(true)
      expect(a.error.value).toBeNull()
    })
    it('422 : message de motif, dialogue gardé ouvert, pas d’erreur de fiche', async () => {
      svc.cancelDeletion.mockRejectedValue({ statusCode: 422, data: { violations: { reason: 'Motif trop court' } } })
      const a = make()
      expect(await a.cancelDeletion('court')).toBe(false)
      expect(a.cancelDeletionReasonError.value).toBe('Motif trop court')
      expect(a.error.value).toBeNull()
    })
    it('autre erreur : message de la fiche', async () => {
      svc.cancelDeletion.mockRejectedValue({ statusCode: 409, data: { detail: 'Plus annulable' } })
      const a = make()
      expect(await a.cancelDeletion('un motif assez long')).toBe(false)
      expect(a.error.value).toBe('Plus annulable')
      svc.cancelDeletion.mockRejectedValue({})
      await a.cancelDeletion('un motif assez long')
      expect(a.error.value).toBe('Impossible d’annuler la suppression')
    })
    it('réponse tardive après changement de compte : ignorée', async () => {
      const d = Promise.withResolvers<unknown>()
      svc.cancelDeletion.mockReturnValue(d.promise)
      const a = make()
      const p = a.cancelDeletion('un motif assez long')
      currentId = 'u2'
      d.resolve(DETAIL)
      expect(await p).toBe(false)
      expect(onUpdate).not.toHaveBeenCalled()
    })
  })
})
