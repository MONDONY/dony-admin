import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/features/promo/services/promoService')
import { usePromoCodes } from '@/features/promo/composables/usePromoCodes'
import { promoService } from '@/features/promo/services/promoService'
const svc = promoService as any

const INPUT = {
  code: 'X', rate: 0.1, target: 'ANY' as const,
  validFrom: null, validTo: null, maxRedemptions: null, perUserLimit: 1,
}

function makeCode(id: string, status: 'ACTIVE' | 'DISABLED' = 'ACTIVE') {
  return {
    id, code: id.toUpperCase(), rate: 0.1, target: 'ANY', validFrom: null, validTo: null,
    maxRedemptions: null, perUserLimit: 1, redeemedCount: 0, status, createdAt: '2026-01-01T00:00:00',
  }
}

describe('usePromoCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    svc.list = vi.fn().mockResolvedValue([])
    svc.create = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.update = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.setStatus = vi.fn().mockResolvedValue({ id: 'p1' })
    svc.remove = vi.fn().mockResolvedValue(undefined)
  })

  it('fetchCodes loads the list', async () => {
    svc.list.mockResolvedValue([makeCode('p1')])
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(p.codes.value).toHaveLength(1)
  })

  it('setStatusFilter filters client-side and resets page', async () => {
    svc.list.mockResolvedValue([makeCode('p1', 'ACTIVE'), makeCode('p2', 'DISABLED')])
    const p = usePromoCodes()
    await p.fetchCodes()
    p.goToPage(2)
    p.setStatusFilter('DISABLED')
    expect(p.currentPage.value).toBe(0)
    expect(p.codes.value).toHaveLength(1)
    expect(p.codes.value[0].id).toBe('p2')
  })

  it('create calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.create(INPUT)
    expect(svc.create).toHaveBeenCalledWith(INPUT)
    expect(svc.list).toHaveBeenCalled()
  })

  it('update calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.update('p1', INPUT)
    expect(svc.update).toHaveBeenCalledWith('p1', INPUT)
    expect(svc.list).toHaveBeenCalled()
  })

  it('setStatus calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.setStatus('p1', 'DISABLED')
    expect(svc.setStatus).toHaveBeenCalledWith('p1', 'DISABLED')
    expect(svc.list).toHaveBeenCalled()
  })

  it('remove calls service then refetches', async () => {
    const p = usePromoCodes()
    await p.remove('p1')
    expect(svc.remove).toHaveBeenCalledWith('p1')
    expect(svc.list).toHaveBeenCalled()
  })

  it('captures errors', async () => {
    svc.list.mockRejectedValue(new Error('promo boom'))
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(p.error.value).toBe('promo boom')
  })

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    svc.list.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(p.error.value).toBe('Détail lisible du back')
  })

  it('setOriginFilter relance la liste avec origin et remet la page à 0', async () => {
    const p = usePromoCodes()
    await p.fetchCodes()
    expect(svc.list).toHaveBeenLastCalledWith('ALL')
    p.goToPage(2)
    await p.setOriginFilter('REFERRAL')
    expect(p.filters.origin).toBe('REFERRAL')
    expect(p.currentPage.value).toBe(0)
    expect(svc.list).toHaveBeenLastCalledWith('REFERRAL')
    await p.setOriginFilter('ADMIN')
    expect(svc.list).toHaveBeenLastCalledWith('ADMIN')
    await p.setOriginFilter('ALL')
    expect(svc.list).toHaveBeenLastCalledWith('ALL')
  })

  it('le filtre d\'origine se combine avec le filtre de statut', async () => {
    svc.list.mockResolvedValue([makeCode('p1', 'ACTIVE'), makeCode('p2', 'DISABLED')])
    const p = usePromoCodes()
    await p.setOriginFilter('REFERRAL')
    p.setStatusFilter('DISABLED')
    expect(p.codes.value.map((c) => c.id)).toEqual(['p2'])
    await p.fetchCodes()
    expect(svc.list).toHaveBeenLastCalledWith('REFERRAL')
    expect(p.codes.value.map((c) => c.id)).toEqual(['p2'])
  })

  it('un refetch après une action garde l\'origine choisie', async () => {
    const p = usePromoCodes()
    await p.setOriginFilter('REFERRAL')
    await p.setStatus('p1', 'DISABLED')
    expect(svc.list).toHaveBeenLastCalledWith('REFERRAL')
  })

  it('409 sur update : message clair, pas d\'exception, pas de refetch', async () => {
    svc.update.mockRejectedValue(Object.assign(new Error('409'), { status: 409, statusCode: 409 }))
    const p = usePromoCodes()
    await expect(p.update('p1', INPUT)).resolves.toBeUndefined()
    expect(p.actionError.value).toMatch(/parrainage.*ne peut pas être modifié/i)
    p.clearActionError()
    expect(p.actionError.value).toBeNull()
  })

  it('409 sur remove : message clair', async () => {
    svc.remove.mockRejectedValue(Object.assign(new Error('409'), { response: { status: 409 } }))
    const p = usePromoCodes()
    await p.remove('p1')
    expect(p.actionError.value).toMatch(/parrainage.*ne peut pas être supprimé/i)
  })

  it('autre erreur sur update : message du back', async () => {
    svc.update.mockRejectedValue(Object.assign(new Error('x'), { data: { detail: 'Refusé' } }))
    const p = usePromoCodes()
    await p.update('p1', INPUT)
    expect(p.actionError.value).toBe('Refusé')
  })

  it('ignore une réponse périmée arrivée après la plus récente (liste et isLoading)', async () => {
    let resolveFirst!: (v: unknown[]) => void
    let resolveSecond!: (v: unknown[]) => void
    svc.list
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r }))
    const p = usePromoCodes()
    const first = p.setOriginFilter('ADMIN')
    const second = p.setOriginFilter('REFERRAL')
    resolveSecond([makeCode('ref')])
    await second
    expect(p.codes.value.map((c) => c.id)).toEqual(['ref'])
    expect(p.isLoading.value).toBe(false)
    resolveFirst([makeCode('adm')])
    await first
    expect(p.codes.value.map((c) => c.id)).toEqual(['ref'])
    expect(p.isLoading.value).toBe(false)
  })

  it('isLoading reste vrai tant que la dernière requête n\'est pas revenue', async () => {
    let resolveFirst!: (v: unknown[]) => void
    let resolveSecond!: (v: unknown[]) => void
    svc.list
      .mockImplementationOnce(() => new Promise((r) => { resolveFirst = r }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r }))
    const p = usePromoCodes()
    const first = p.setOriginFilter('ADMIN')
    const second = p.setOriginFilter('REFERRAL')
    resolveFirst([makeCode('adm')])
    await first
    expect(p.isLoading.value).toBe(true)
    expect(p.codes.value).toHaveLength(0)
    resolveSecond([makeCode('ref')])
    await second
    expect(p.isLoading.value).toBe(false)
  })

  it('une erreur périmée n\'écrase pas la liste de la dernière requête', async () => {
    let rejectFirst!: (e: Error) => void
    let resolveSecond!: (v: unknown[]) => void
    svc.list
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectFirst = rej }))
      .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r }))
    const p = usePromoCodes()
    const first = p.setOriginFilter('ADMIN')
    const second = p.setOriginFilter('REFERRAL')
    resolveSecond([makeCode('ref')])
    await second
    rejectFirst(new Error('périmée'))
    await first
    expect(p.error.value).toBeNull()
    expect(p.codes.value).toHaveLength(1)
  })

  it('un basculement de statut refusé affiche actionError sans exception', async () => {
    svc.setStatus.mockRejectedValue(Object.assign(new Error('x'), { data: { detail: 'Basculement refusé' } }))
    const p = usePromoCodes()
    await expect(p.setStatus('p1', 'DISABLED')).resolves.toBeUndefined()
    expect(p.actionError.value).toBe('Basculement refusé')
  })

  it('un basculement refusé sans détail utilise le message de repli', async () => {
    svc.setStatus.mockRejectedValue(Object.assign(new Error('[PUT] "u": 500'), {}))
    const p = usePromoCodes()
    await p.setStatus('p1', 'DISABLED')
    expect(p.actionError.value).toBe('Impossible de changer le statut du code promo')
  })

  it('actionError est effacée par un changement de filtre et après une action réussie', async () => {
    svc.remove.mockRejectedValueOnce(Object.assign(new Error('409'), { statusCode: 409 }))
    const p = usePromoCodes()
    await p.remove('p1')
    expect(p.actionError.value).not.toBeNull()
    p.setStatusFilter('ACTIVE')
    expect(p.actionError.value).toBeNull()

    svc.remove.mockRejectedValueOnce(Object.assign(new Error('409'), { statusCode: 409 }))
    await p.remove('p1')
    expect(p.actionError.value).not.toBeNull()
    await p.setOriginFilter('ADMIN')
    expect(p.actionError.value).toBeNull()

    svc.update.mockRejectedValueOnce(Object.assign(new Error('409'), { statusCode: 409 }))
    await p.update('p1', INPUT)
    expect(p.actionError.value).not.toBeNull()
    await p.setStatus('p1', 'DISABLED')
    expect(p.actionError.value).toBeNull()
  })
})
