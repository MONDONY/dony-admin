import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ listRejectionCodes: vi.fn(), listVerifications: vi.fn() }))
vi.mock('@/features/kyc/services/kycService', () => ({ kycService: svc }))

import { useKycRejectionCodes, resetKycRejectionCodesCache, toDecisionCodes } from '@/features/kyc/composables/useKycRejectionCodes'
import { KYC_DECISION_CODES } from '@/features/kyc/types/index'

describe('useKycRejectionCodes', () => {
  beforeEach(() => { svc.listRejectionCodes.mockReset(); resetKycRejectionCodesCache() })

  it('charge le catalogue du back, libellés français, code inconnu affiché brut', async () => {
    svc.listRejectionCodes.mockResolvedValue(['document_expired', 'nouveau_code'])
    const c = useKycRejectionCodes()
    await c.load()
    expect(c.source.value).toBe('server')
    expect(c.codes.value.map((x) => x.label)).toEqual(['Document expiré', 'nouveau_code'])
    expect(c.codes.value[1]!.userMessage).toContain('Nous n\'avons pas pu vérifier')
  })

  it('un seul appel partagé entre les instances', async () => {
    svc.listRejectionCodes.mockResolvedValue(['other'])
    await Promise.all([useKycRejectionCodes().load(), useKycRejectionCodes().load()])
    const c = useKycRejectionCodes()
    await c.load()
    expect(svc.listRejectionCodes).toHaveBeenCalledTimes(1)
    expect(c.codes.value.map((x) => x.value)).toEqual(['other'])
  })

  it('ancien back (404 sans code) : repli sur la liste locale', async () => {
    svc.listRejectionCodes.mockRejectedValueOnce({ statusCode: 404, data: {} })
    const c = useKycRejectionCodes()
    await c.load()
    expect(c.source.value).toBe('local')
    expect(c.codes.value).toEqual(KYC_DECISION_CODES)
  })

  it('autre échec ou liste vide : repli local, sans bloquer la décision', async () => {
    svc.listRejectionCodes.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'panne' } })
    const c = useKycRejectionCodes()
    await c.load()
    expect(c.codes.value).toEqual(KYC_DECISION_CODES)
    resetKycRejectionCodesCache()
    svc.listRejectionCodes.mockResolvedValueOnce([])
    const d = useKycRejectionCodes()
    await d.load()
    expect(d.codes.value).toEqual(KYC_DECISION_CODES)
  })

  it('toDecisionCodes ignore les valeurs non textuelles', () => {
    expect(toDecisionCodes(['other', 3 as unknown as string]).map((c) => c.value)).toEqual(['other'])
  })
})
