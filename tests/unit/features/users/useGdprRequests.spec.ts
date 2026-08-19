import { describe, it, expect, vi, beforeEach } from 'vitest'

const listGdprRequests = vi.fn()
const executeGdprDeletion = vi.fn()
vi.mock('@/features/users/services/usersService', () => ({
  usersService: {
    listGdprRequests: (...a: unknown[]) => listGdprRequests(...a),
    executeGdprDeletion: (...a: unknown[]) => executeGdprDeletion(...a),
  },
}))

import { useGdprRequests } from '@/features/users/composables/useGdprRequests'

const PAGE = {
  content: [
    { id: 'u1', firstName: 'Jean', lastName: 'Dupont', email: 'jean@x.fr', status: 'PENDING_DELETION', deletionRequestedAt: '2026-07-01T00:00:00', ageDays: 48 },
    { id: 'u2', firstName: 'Awa', lastName: 'Diallo', email: 'awa@x.fr', status: 'PENDING_DELETION', deletionRequestedAt: '2026-08-10T00:00:00', ageDays: 8 },
  ],
  totalElements: 2, totalPages: 1, number: 0, size: 20,
}

describe('useGdprRequests', () => {
  beforeEach(() => { listGdprRequests.mockReset(); executeGdprDeletion.mockReset() })

  it('fetchRequests() charge la première page', async () => {
    listGdprRequests.mockResolvedValue(PAGE)
    const c = useGdprRequests()
    await c.fetchRequests()
    expect(listGdprRequests).toHaveBeenCalledWith(0, 20)
    expect(c.requests.value).toHaveLength(2)
    expect(c.totalPages.value).toBe(1)
    expect(c.isLoading.value).toBe(false)
  })

  it('goToPage() recharge sur la page demandée', async () => {
    listGdprRequests.mockResolvedValue({ ...PAGE, number: 1 })
    const c = useGdprRequests()
    await c.goToPage(1)
    expect(listGdprRequests).toHaveBeenCalledWith(1, 20)
    expect(c.currentPage.value).toBe(1)
  })

  it('fetchRequests() expose le detail RFC 7807 en cas d\'erreur', async () => {
    listGdprRequests.mockRejectedValue({ data: { detail: 'Accès refusé' } })
    const c = useGdprRequests()
    await c.fetchRequests()
    expect(c.error.value).toBe('Accès refusé')
    expect(c.requests.value).toHaveLength(0)
  })

  it('execute() recharge la file après une suppression réussie', async () => {
    listGdprRequests.mockResolvedValue(PAGE)
    executeGdprDeletion.mockResolvedValue(undefined)
    const c = useGdprRequests()
    await c.fetchRequests()
    listGdprRequests.mockClear()
    await c.execute('u1', 'demande confirmée')
    expect(executeGdprDeletion).toHaveBeenCalledWith('u1', 'demande confirmée')
    expect(listGdprRequests).toHaveBeenCalledTimes(1)
    expect(c.busy.value).toBe(false)
  })

  it('execute() en refus 422 expose le message et ne recharge pas', async () => {
    listGdprRequests.mockResolvedValue(PAGE)
    executeGdprDeletion.mockRejectedValue({
      data: { code: 'active-transactions', detail: 'Impossible — cet utilisateur a des transactions en cours' },
    })
    const c = useGdprRequests()
    await c.fetchRequests()
    listGdprRequests.mockClear()
    await c.execute('u1', 'motif')
    expect(c.error.value).toBe('Impossible — cet utilisateur a des transactions en cours')
    expect(listGdprRequests).not.toHaveBeenCalled()
  })
})
