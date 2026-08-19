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
})
