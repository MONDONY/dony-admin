import { describe, it, expect, vi, beforeEach } from 'vitest'

const list = vi.fn()
vi.mock('@/features/kyc/services/kycService', () => ({ kycService: { listVerifications: (...a: unknown[]) => list(...a) } }))

import { useKycQueue } from '@/features/kyc/composables/useKycQueue'

const ROW = {
  userId: 'u1', userName: 'Awa Diop', userPhone: '+221 77 *** ** 12', provider: 'DIDIT', kycStatus: 'IN_REVIEW',
  submittedAt: '2026-09-25T10:00:00Z', waitingHours: 50,
}
const page = (content: unknown[], number = 0, totalPages = 3) => ({ content, totalElements: 41, totalPages, number, size: 20 })
const missing = () => ({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })

describe('useKycQueue', () => {
  beforeEach(() => list.mockReset())

  it('charge la première page de la file « En attente de décision » par défaut', async () => {
    list.mockResolvedValue(page([ROW]))
    const q = useKycQueue()
    await q.load()
    expect(list).toHaveBeenCalledWith({ status: 'IN_REVIEW', provider: null, query: '', from: null, to: null }, 0, 20)
    expect(q.items.value).toHaveLength(1)
    expect(q.totalPages.value).toBe(3)
    expect(q.totalElements.value).toBe(41)
    expect(q.isLoading.value).toBe(false)
  })

  it('pagination serveur : la page courante suit la réponse', async () => {
    list.mockResolvedValue(page([ROW], 2))
    const q = useKycQueue()
    await q.goToPage(2)
    expect(list.mock.calls[0][1]).toBe(2)
    expect(q.currentPage.value).toBe(2)
  })

  it('un échec garde la page précédente et affiche le detail', async () => {
    list.mockResolvedValueOnce(page([ROW], 1))
    const q = useKycQueue()
    await q.goToPage(1)
    list.mockRejectedValueOnce({ statusCode: 500, data: { detail: 'Base indisponible' } })
    await q.goToPage(2)
    expect(q.error.value).toBe('Base indisponible')
    expect(q.currentPage.value).toBe(1)
    expect(q.items.value).toHaveLength(1)
  })

  it('chaque filtre revient en page 0', async () => {
    list.mockResolvedValue(page([]))
    const q = useKycQueue()
    await q.setStatus('REJECTED')
    await q.setProvider('STRIPE')
    await q.setDateRange('2026-09-01', '2026-09-10')
    await q.setQuery('  awa ')
    expect(list.mock.calls.map((c) => c[1])).toEqual([0, 0, 0, 0])
    expect(list.mock.calls[3][0]).toEqual({ status: 'REJECTED', provider: 'STRIPE', query: 'awa', from: '2026-09-01', to: '2026-09-10' })
  })

  it('une recherche identique ne relance pas la requête', async () => {
    list.mockResolvedValue(page([]))
    const q = useKycQueue()
    await q.setQuery('awa')
    await q.setQuery(' awa ')
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('ancien back (404 sans code) : file indisponible, sans erreur rouge', async () => {
    list.mockRejectedValueOnce(missing())
    const q = useKycQueue()
    await q.load()
    expect(q.unavailable.value).toBe(true)
    expect(q.error.value).toBeNull()
  })

  it('un 404 porteur d’un code reste une erreur', async () => {
    list.mockRejectedValueOnce({ statusCode: 404, data: { code: 'kyc-queue-x', detail: 'Filtre inconnu' } })
    const q = useKycQueue()
    await q.load()
    expect(q.unavailable.value).toBe(false)
    expect(q.error.value).toBe('Filtre inconnu')
  })

  it('tolère une page sans content', async () => {
    list.mockResolvedValue({ totalElements: 0, totalPages: 0, number: 0, size: 20 })
    const q = useKycQueue()
    await q.load()
    expect(q.items.value).toEqual([])
    expect(q.totalPages.value).toBe(0)
  })

  it('tolère une page réduite à son contenu', async () => {
    list.mockResolvedValue({ content: [ROW] })
    const q = useKycQueue()
    await q.goToPage(1)
    expect(q.totalElements.value).toBe(1)
    expect(q.totalPages.value).toBe(0)
    expect(q.currentPage.value).toBe(1)
  })

  it('400 kyc-queue-status-invalid : le detail est affiché, ce n’est pas un ancien back', async () => {
    list.mockRejectedValueOnce({ statusCode: 400, data: { code: 'kyc-queue-status-invalid', detail: 'Statut de file inconnu.' } })
    const q = useKycQueue()
    await q.setStatus('IN_PROGRESS')
    expect(list.mock.calls[0][0].status).toBe('IN_PROGRESS')
    expect(q.error.value).toBe('Statut de file inconnu.')
    expect(q.unavailable.value).toBe(false)
  })
})
