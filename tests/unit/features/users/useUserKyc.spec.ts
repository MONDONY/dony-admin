import { describe, it, expect, vi, beforeEach } from 'vitest'

const getKyc = vi.fn()
const resetKyc = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: { getKyc: (...a: unknown[]) => getKyc(...a), resetKyc: (...a: unknown[]) => resetKyc(...a) },
}))

import { useUserKyc } from '@/features/users/composables/useUserKyc'

const KYC = {
  userId: 'u1', kycStatus: 'REJECTED', verificationStatus: 'REJECTED',
  rejectionReason: 'document_expired', rejectionCode: 'document_expired',
  stripeSessionId: 'vs_001', stripeStatus: 'requires_input',
  stripeLastErrorCode: 'document_expired', stripeLastErrorReason: 'The document has expired.',
  stripeCreatedAt: '2026-08-01T10:00:00', stripeUnavailable: false,
}

describe('useUserKyc', () => {
  beforeEach(() => { getKyc.mockReset(); resetKyc.mockReset() })

  it('load() remplit kyc et retombe isLoading à false', async () => {
    getKyc.mockResolvedValue(KYC)
    const c = useUserKyc()
    await c.load('u1')
    expect(getKyc).toHaveBeenCalledWith('u1')
    expect(c.kyc.value?.stripeSessionId).toBe('vs_001')
    expect(c.isLoading.value).toBe(false)
    expect(c.error.value).toBeNull()
  })

  it('load() expose le detail RFC 7807 en cas d\'erreur', async () => {
    getKyc.mockRejectedValue({ data: { detail: 'Utilisateur introuvable' } })
    const c = useUserKyc()
    await c.load('u1')
    expect(c.error.value).toBe('Utilisateur introuvable')
    expect(c.kyc.value).toBeNull()
  })

  it('reset() remplace kyc par la réponse du back', async () => {
    getKyc.mockResolvedValue(KYC)
    resetKyc.mockResolvedValue({ ...KYC, kycStatus: 'NOT_STARTED', verificationStatus: 'PENDING', stripeSessionId: null })
    const c = useUserKyc()
    await c.load('u1')
    await c.reset('u1', 'document illisible')
    expect(resetKyc).toHaveBeenCalledWith('u1', 'document illisible')
    expect(c.kyc.value?.kycStatus).toBe('NOT_STARTED')
    expect(c.kyc.value?.stripeSessionId).toBeNull()
    expect(c.busy.value).toBe(false)
  })

  it('reset() en échec expose le message et laisse kyc inchangé', async () => {
    getKyc.mockResolvedValue(KYC)
    resetKyc.mockRejectedValue({ data: { detail: "Cet utilisateur n'a jamais démarré de vérification d'identité" } })
    const c = useUserKyc()
    await c.load('u1')
    await c.reset('u1', 'motif')
    expect(c.error.value).toBe("Cet utilisateur n'a jamais démarré de vérification d'identité")
    expect(c.kyc.value?.kycStatus).toBe('REJECTED')
  })

  it('refresh() relit la fiche sans la vider ni afficher le chargement', async () => {
    getKyc.mockResolvedValueOnce(KYC)
    const c = useUserKyc()
    await c.load('u1')
    let resolve!: (_value: unknown) => void
    getKyc.mockReturnValueOnce(new Promise((r) => { resolve = r }))
    const pending = c.refresh('u1')
    expect(c.kyc.value?.kycStatus).toBe('REJECTED')
    expect(c.isLoading.value).toBe(false)
    resolve({ ...KYC, kycStatus: 'VERIFIED' })
    await pending
    expect(c.kyc.value?.kycStatus).toBe('VERIFIED')
  })

  it('refresh() en échec garde la fiche affichée', async () => {
    getKyc.mockResolvedValueOnce(KYC)
    const c = useUserKyc()
    await c.load('u1')
    getKyc.mockRejectedValueOnce({ data: { detail: 'Réseau' } })
    await c.refresh('u1')
    expect(c.kyc.value?.kycStatus).toBe('REJECTED')
  })

  it('set() remplace la fiche par celle renvoyée par une décision', () => {
    const c = useUserKyc()
    c.set({ ...KYC, kycStatus: 'VERIFIED' } as never)
    expect(c.kyc.value?.kycStatus).toBe('VERIFIED')
    expect(c.error.value).toBeNull()
  })

  describe('lectures concurrentes', () => {
    const other = { ...KYC, userId: 'u2' }
    // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
    const deferred = () => { let release: (v: unknown) => void = () => {}; const promise = new Promise((r) => { release = r }); return { promise, release } }

    it('une réponse tardive d’un autre utilisateur n’écrase pas le dossier affiché', async () => {
      const slow = deferred()
      getKyc.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(other)
      const c = useUserKyc()
      const first = c.load('u1')
      await c.load('u2')
      slow.release(KYC)
      await first
      expect(c.kyc.value?.userId).toBe('u2')
      expect(c.isLoading.value).toBe(false)
    })

    it('une erreur tardive n’efface ni le dossier ni ne pose de message', async () => {
      // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
      let fail: (e: unknown) => void = () => {}
      getKyc.mockReturnValueOnce(new Promise((_, rej) => { fail = rej })).mockResolvedValueOnce(other)
      const c = useUserKyc()
      const first = c.load('u1')
      await c.load('u2')
      fail({ data: { detail: 'Panne' } })
      await first
      expect(c.error.value).toBeNull()
      expect(c.kyc.value?.userId).toBe('u2')
    })

    it('refresh, reset et set écartent une lecture plus ancienne encore en vol', async () => {
      const slow = deferred()
      getKyc.mockReturnValueOnce(slow.promise)
      const c = useUserKyc()
      const pending = c.load('u1')
      c.set(other as never)
      slow.release(KYC)
      await pending
      expect(c.kyc.value?.userId).toBe('u2')

      const slowRefresh = deferred()
      getKyc.mockReturnValueOnce(slowRefresh.promise)
      const refreshing = c.refresh('u1')
      resetKyc.mockResolvedValueOnce({ ...other, kycStatus: 'NOT_STARTED' })
      await c.reset('u2', 'Document illisible')
      slowRefresh.release(KYC)
      await refreshing
      expect(c.kyc.value?.userId).toBe('u2')
      expect(c.kyc.value?.kycStatus).toBe('NOT_STARTED')
    })

    it('une réinitialisation en échec tardive ne pose pas son message sur un autre dossier', async () => {
      // eslint-disable-next-line no-unused-vars -- paramètre d'un type de fonction, pas une variable
      let fail: (e: unknown) => void = () => {}
      resetKyc.mockReturnValueOnce(new Promise((_, rej) => { fail = rej }))
      getKyc.mockResolvedValueOnce(other)
      const c = useUserKyc()
      const resetting = c.reset('u1', 'Document illisible')
      await c.load('u2')
      fail({ data: { detail: 'Refusée' } })
      await resetting
      expect(c.error.value).toBeNull()
      expect(c.busy.value).toBe(false)
    })
  })
})
