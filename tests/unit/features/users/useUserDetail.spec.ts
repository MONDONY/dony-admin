import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/users/services/usersService', () => {
  const svc = {
    get: vi.fn(),
    suspend: vi.fn(),
    ban: vi.fn(),
    unsuspend: vi.fn(),
    setCommissionRate: vi.fn(),
    suspendPublishing: vi.fn(),
    liftPublishingSuspension: vi.fn(),
    muteMessaging: vi.fn(),
    unmuteMessaging: vi.fn(),
    grantPro: vi.fn(),
    revokePro: vi.fn(),
  }
  return { usersService: svc }
})

import { useUserDetail } from '@/features/users/composables/useUserDetail'
import { usersService } from '@/features/users/services/usersService'

const svc = usersService as any

describe('useUserDetail', () => {
  beforeEach(() => Object.values(svc).forEach(m => m.mockReset()))

  it('open(id) loads the user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const d = useUserDetail()
    await d.open('u1')
    expect(d.user.value?.id).toBe('u1')
  })

  // Cette couche est la seule à choisir QUEL utilisateur subit le geste : le panneau
  // n'émet qu'un motif, le service ne reçoit qu'un id. Une confusion d'identifiant ne
  // serait visible qu'ici.
  it('grantPro(motif) passe l\'id de l\'utilisateur ouvert et rafraîchit la fiche', async () => {
    svc.get.mockResolvedValue({ id: 'u1', isProAccount: false })
    svc.grantPro.mockResolvedValue({ id: 'u1', isProAccount: true })
    const d = useUserDetail()
    await d.open('u1')
    await d.grantPro('partenaire pilote')
    expect(svc.grantPro).toHaveBeenCalledWith('u1', 'partenaire pilote')
    expect(d.user.value?.isProAccount).toBe(true)
  })

  it('revokePro() passe l\'id de l\'utilisateur ouvert', async () => {
    svc.get.mockResolvedValue({ id: 'u1', isProAccount: true })
    svc.revokePro.mockResolvedValue({ id: 'u1', isProAccount: false })
    const d = useUserDetail()
    await d.open('u1')
    await d.revokePro()
    expect(svc.revokePro).toHaveBeenCalledWith('u1')
    expect(d.user.value?.isProAccount).toBe(false)
  })

  it('un échec d\'octroi remonte le message du ProblemDetail sans casser la fiche', async () => {
    svc.get.mockResolvedValue({ id: 'u1', isProAccount: false })
    svc.grantPro.mockRejectedValue(new Error('boom'))
    const d = useUserDetail()
    await d.open('u1')
    await d.grantPro('motif')
    expect(d.error.value).toBeTruthy()
    expect(d.busy.value).toBe(false)
    expect(d.user.value?.id).toBe('u1')
  })

  it('suspend(reason) calls service and refreshes user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.suspend.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })
    const d = useUserDetail()
    await d.open('u1')
    await d.suspend('fraude')
    expect(svc.suspend).toHaveBeenCalledWith('u1', 'fraude')
    expect(d.user.value?.status).toBe('SUSPENDED')
  })

  it('ban(reason) calls service', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.ban.mockResolvedValue({ id: 'u1', status: 'BANNED' })
    const d = useUserDetail()
    await d.open('u1')
    await d.ban('abus')
    expect(d.user.value?.status).toBe('BANNED')
  })

  it('close() clears the user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const d = useUserDetail()
    await d.open('u1')
    d.close()
    expect(d.user.value).toBeNull()
  })

  it('unsuspend() calls service and refreshes user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'SUSPENDED' })
    svc.unsuspend.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    const d = useUserDetail()
    await d.open('u1')
    await d.unsuspend()
    expect(svc.unsuspend).toHaveBeenCalledWith('u1')
    expect(d.user.value?.status).toBe('ACTIVE')
  })

  it('setCommissionRate() calls service with the rate', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.setCommissionRate.mockResolvedValue({ id: 'u1', commissionRateOverride: 0.1 })
    const d = useUserDetail()
    await d.open('u1')
    await d.setCommissionRate(0.1)
    expect(svc.setCommissionRate).toHaveBeenCalledWith('u1', 0.1)
  })

  it('captures errors from an action', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.suspend.mockRejectedValue(new Error('nope'))
    const d = useUserDetail()
    await d.open('u1')
    await d.suspend('x')
    expect(d.error.value).toBe('nope')
  })

  it('suspendPublishing calls the service then refetches the detail', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE', publishingSuspended: true })
    const d = useUserDetail()
    await d.open('u1')
    await d.suspendPublishing('fraude')
    expect(svc.suspendPublishing).toHaveBeenCalledWith('u1', 'fraude')
    expect(d.user.value?.publishingSuspended).toBe(true)
  })

  it('liftPublishing calls the service then refetches the detail', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE', publishingSuspended: false })
    const d = useUserDetail()
    await d.open('u1')
    await d.liftPublishing()
    expect(svc.liftPublishingSuspension).toHaveBeenCalledWith('u1')
  })

  it('muteMessaging(durationHours, reason) calls the service and refreshes the user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE', messagingMutedUntil: null })
    svc.muteMessaging.mockResolvedValue({ id: 'u1', status: 'ACTIVE', messagingMutedUntil: '2026-08-19T00:00:00Z' })
    const d = useUserDetail()
    await d.open('u1')
    await d.muteMessaging(24, 'spam')
    expect(svc.muteMessaging).toHaveBeenCalledWith('u1', 24, 'spam')
    expect(d.user.value?.messagingMutedUntil).toBe('2026-08-19T00:00:00Z')
  })

  it('muteMessaging(null, reason) requests an indefinite mute', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE', messagingMutedUntil: null })
    svc.muteMessaging.mockResolvedValue({ id: 'u1', status: 'ACTIVE', messagingMutedUntil: '9999-12-31T00:00:00Z' })
    const d = useUserDetail()
    await d.open('u1')
    await d.muteMessaging(null, 'abus répétés')
    expect(svc.muteMessaging).toHaveBeenCalledWith('u1', null, 'abus répétés')
  })

  it('unmuteMessaging() calls the service and refreshes the user', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE', messagingMutedUntil: '2026-08-19T00:00:00Z' })
    svc.unmuteMessaging.mockResolvedValue({ id: 'u1', status: 'ACTIVE', messagingMutedUntil: null })
    const d = useUserDetail()
    await d.open('u1')
    await d.unmuteMessaging()
    expect(svc.unmuteMessaging).toHaveBeenCalledWith('u1')
    expect(d.user.value?.messagingMutedUntil).toBeNull()
  })

  it('busy is true while an action is in flight and false once it settles', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    let resolveMute!: (_value: unknown) => void
    svc.muteMessaging.mockReturnValue(new Promise((resolve) => { resolveMute = resolve }))
    const d = useUserDetail()
    await d.open('u1')
    const p = d.muteMessaging(24, 'spam')
    expect(d.busy.value).toBe(true)
    resolveMute({ id: 'u1', messagingMutedUntil: '2026-08-19T00:00:00Z' })
    await p
    expect(d.busy.value).toBe(false)
  })

  it('extracts the RFC 7807 detail message from a failed action', async () => {
    svc.get.mockResolvedValue({ id: 'u1', status: 'ACTIVE' })
    svc.muteMessaging.mockRejectedValue({ data: { detail: 'Utilisateur déjà muté.' } })
    const d = useUserDetail()
    await d.open('u1')
    await d.muteMessaging(24, 'spam')
    expect(d.error.value).toBe('Utilisateur déjà muté.')
  })
})
