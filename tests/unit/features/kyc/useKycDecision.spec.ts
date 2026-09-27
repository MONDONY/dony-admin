import { describe, it, expect, vi, beforeEach } from 'vitest'

const svc = vi.hoisted(() => ({ approveKyc: vi.fn(), rejectKyc: vi.fn(), revokeKyc: vi.fn() }))
vi.mock('@/features/users/services/usersService', () => ({ usersService: svc }))

import { useKycDecision } from '@/features/kyc/composables/useKycDecision'

const UPDATED = { userId: 'u1', kycStatus: 'VERIFIED', verificationStatus: 'VERIFIED', decisionKind: 'APPROVED' }
const problem = (status: number, code?: string, detail?: string) => ({ statusCode: status, data: { code, detail } })

describe('useKycDecision', () => {
  beforeEach(() => { svc.approveKyc.mockReset(); svc.rejectKyc.mockReset(); svc.revokeKyc.mockReset() })

  it('approve() appelle le back avec le motif nettoyé et rend la fiche à jour', async () => {
    svc.approveKyc.mockResolvedValue(UPDATED)
    const d = useKycDecision(() => 'u1')
    const res = await d.approve('  pièces contrôlées chez Didit  ')
    expect(svc.approveKyc).toHaveBeenCalledWith('u1', 'pièces contrôlées chez Didit')
    expect(res).toEqual(UPDATED)
    expect(d.busy.value).toBe(false)
    expect(d.error.value).toBeNull()
  })

  it('reject() et revoke() transmettent code et motif', async () => {
    svc.rejectKyc.mockResolvedValue(UPDATED)
    svc.revokeKyc.mockResolvedValue(UPDATED)
    const d = useKycDecision(() => 'u1')
    await d.reject('document_expired', 'passeport expiré')
    await d.revoke('suspected_fraud', 'fraude confirmée après contrôle')
    expect(svc.rejectKyc).toHaveBeenCalledWith('u1', 'document_expired', 'passeport expiré')
    expect(svc.revokeKyc).toHaveBeenCalledWith('u1', 'suspected_fraud', 'fraude confirmée après contrôle')
  })

  it('409 kyc-already-verified : message du back, code conservé, relecture demandée', async () => {
    svc.approveKyc.mockRejectedValue(problem(409, 'kyc-already-verified', 'Cette identité est déjà vérifiée.'))
    const onStale = vi.fn()
    const d = useKycDecision(() => 'u1', { onStale })
    expect(await d.approve('motif suffisamment long')).toBeNull()
    expect(d.error.value).toBe('Cette identité est déjà vérifiée.')
    expect(d.errorCode.value).toBe('kyc-already-verified')
    expect(onStale).toHaveBeenCalledTimes(1)
    expect(d.unavailable.value).toBe(false)
  })

  it('sans detail, un code connu donne un message français', async () => {
    svc.approveKyc.mockRejectedValue(problem(422, 'kyc-no-provider-session'))
    const d = useKycDecision(() => 'u1')
    await d.approve('motif suffisamment long')
    expect(d.error.value).toContain('Aucune session chez le fournisseur')
  })

  it('codes connus : refus invalide et révocation d’une identité non validée', async () => {
    svc.rejectKyc.mockRejectedValue(problem(400, 'kyc-reject-code-invalid'))
    svc.revokeKyc.mockRejectedValue(problem(409, 'kyc-not-verified'))
    const onStale = vi.fn()
    const d = useKycDecision(() => 'u1', { onStale })
    await d.reject('x', 'motif suffisamment long')
    expect(d.error.value).toContain('Code de refus')
    expect(onStale).not.toHaveBeenCalled()
    await d.revoke('other', 'motif suffisamment long pour révoquer')
    expect(d.error.value).toContain('n’est pas validée')
    expect(onStale).toHaveBeenCalledTimes(1)
  })

  it('400 kyc-reject-code-invalid : retient allowedCodes pour réaligner le catalogue', async () => {
    svc.rejectKyc.mockRejectedValue({ statusCode: 400, data: { code: 'kyc-reject-code-invalid', detail: 'Code inconnu.', allowedCodes: ['other', 'suspected_fraud'] } })
    const d = useKycDecision(() => 'u1')
    await d.reject('x', 'motif suffisamment long')
    expect(d.error.value).toBe('Code inconnu.')
    expect(d.allowedCodes.value).toEqual(['other', 'suspected_fraud'])
  })

  it('422 de validation : le detail du back est affiché', async () => {
    svc.revokeKyc.mockRejectedValue({ statusCode: 422, data: { detail: 'Le motif doit faire au moins 20 caractères.' } })
    const d = useKycDecision(() => 'u1')
    await d.revoke('other', 'court')
    expect(d.error.value).toBe('Le motif doit faire au moins 20 caractères.')
    expect(d.unavailable.value).toBe(false)
  })

  it('422 kyc-no-provider-session aussi sur un refus', async () => {
    svc.rejectKyc.mockRejectedValue({ statusCode: 422, data: { code: 'kyc-no-provider-session' } })
    const d = useKycDecision(() => 'u1')
    await d.reject('other', 'motif suffisamment long')
    expect(d.error.value).toContain('Aucune session chez le fournisseur')
  })

  it('erreur sans code ni detail : message générique', async () => {
    svc.approveKyc.mockRejectedValue(problem(500))
    const d = useKycDecision(() => 'u1')
    await d.approve('motif suffisamment long')
    expect(d.error.value).toBe('La décision n’a pas pu être enregistrée')
  })

  it('ancien back (404/405 sans code) : décisions indisponibles, pas d’erreur rouge', async () => {
    svc.revokeKyc.mockRejectedValue({ statusCode: 405, data: {} })
    const d = useKycDecision(() => 'u1')
    await d.revoke('other', 'motif suffisamment long pour révoquer')
    expect(d.unavailable.value).toBe(true)
    expect(d.error.value).toBeNull()
  })

  it('sans utilisateur, rien n’est envoyé', async () => {
    const d = useKycDecision(() => null)
    expect(await d.approve('motif suffisamment long')).toBeNull()
    expect(svc.approveKyc).not.toHaveBeenCalled()
  })

  it('clearError() efface l’échec précédent', async () => {
    svc.approveKyc.mockRejectedValue(problem(500, undefined, 'Oups'))
    const d = useKycDecision(() => 'u1')
    await d.approve('motif suffisamment long')
    d.clearError()
    expect(d.error.value).toBeNull()
    expect(d.errorCode.value).toBeNull()
  })
})
