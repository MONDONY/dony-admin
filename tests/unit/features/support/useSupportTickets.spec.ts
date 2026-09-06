import { describe, it, expect, vi, beforeEach } from 'vitest'

// Les mocks sont référencés par des wrappers : `vi.mock` est hoisté au-dessus des
// déclarations, une factory qui renverrait directement l'objet lirait une variable
// encore dans sa zone morte.
const listMock = vi.fn()
const getMock = vi.fn()
const assignMock = vi.fn()
const reassignMock = vi.fn()
const replyMock = vi.fn()
const resolveMock = vi.fn()
vi.mock('@/features/support/services/supportService', () => ({
  supportService: {
    list: (...a: unknown[]) => listMock(...a),
    get: (...a: unknown[]) => getMock(...a),
    assign: (...a: unknown[]) => assignMock(...a),
    reassign: (...a: unknown[]) => reassignMock(...a),
    reply: (...a: unknown[]) => replyMock(...a),
    resolve: (...a: unknown[]) => resolveMock(...a),
  },
}))
import { useSupportTickets } from '@/features/support/composables/useSupportTickets'

const ticket = {
  id: 't1', category: 'PAYMENT', subject: 'Paiement bloque', status: 'NEW',
  priority: 'NORMAL', userId: 'u1', userDisplayName: 'Awa D.',
  assignedAdminId: null, assignedAdminEmail: null,
  createdAt: '2026-09-05T10:00:00', lastMessageAt: '2026-09-05T10:00:00',
  resolvedAt: null, messages: null,
}
const page = { content: [ticket], totalElements: 1, totalPages: 1, number: 0, size: 20 }

describe('useSupportTickets', () => {
  beforeEach(() => {
    for (const m of [listMock, getMock, assignMock, reassignMock, replyMock, resolveMock]) {
      m.mockReset()
    }
  })

  it('fetchTickets charge la page du scope courant', async () => {
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    await s.fetchTickets()
    expect(listMock).toHaveBeenCalledWith('unassigned', 'TOUS', 0, 20)
    expect(s.tickets.value).toHaveLength(1)
    expect(s.totalElements.value).toBe(1)
    expect(s.isLoading.value).toBe(false)
  })

  it('setScope repart page 0 et recharge', async () => {
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    await s.goToPage(3)
    await s.setScope('mine')
    expect(s.currentPage.value).toBe(0)
    expect(listMock).toHaveBeenLastCalledWith('mine', 'TOUS', 0, 20)
  })

  it('setStatusFilter recharge avec le statut', async () => {
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    await s.setStatusFilter('RESOLVED')
    expect(listMock).toHaveBeenLastCalledWith('unassigned', 'RESOLVED', 0, 20)
  })

  it('openTicket charge le détail, closeTicket le vide', async () => {
    getMock.mockResolvedValue({ ...ticket, messages: [] })
    const s = useSupportTickets()
    await s.openTicket('t1')
    expect(s.selected.value?.id).toBe('t1')
    s.closeTicket()
    expect(s.selected.value).toBeNull()
  })

  it('assign recharge le détail et la liste après succès', async () => {
    assignMock.mockResolvedValue({ ...ticket, status: 'ASSIGNED' })
    getMock.mockResolvedValue({ ...ticket, status: 'ASSIGNED', messages: [] })
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    const ok = await s.assign('t1')
    expect(ok).toBe(true)
    expect(assignMock).toHaveBeenCalledWith('t1')
    expect(getMock).toHaveBeenCalledWith('t1')
    expect(listMock).toHaveBeenCalled()
    expect(s.selected.value?.status).toBe('ASSIGNED')
  })

  it('reply envoie le contenu puis recharge', async () => {
    replyMock.mockResolvedValue({ id: 'm1' })
    getMock.mockResolvedValue({ ...ticket, status: 'WAITING_USER', messages: [] })
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    const ok = await s.reply('t1', 'Bonjour')
    expect(ok).toBe(true)
    expect(replyMock).toHaveBeenCalledWith('t1', 'Bonjour')
    expect(s.selected.value?.status).toBe('WAITING_USER')
  })

  it("une action refusée capture l'erreur sans écraser le détail", async () => {
    resolveMock.mockRejectedValue(new Error('409'))
    const s = useSupportTickets()
    const ok = await s.resolve('t1')
    expect(ok).toBe(false)
    expect(s.actionError.value).toBe('409')
    expect(s.isActing.value).toBe(false)
    expect(getMock).not.toHaveBeenCalled()
  })
})
