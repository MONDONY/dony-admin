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
const priorityMock = vi.fn()
vi.mock('@/features/support/services/supportService', () => ({
  supportService: {
    list: (...a: unknown[]) => listMock(...a),
    get: (...a: unknown[]) => getMock(...a),
    assign: (...a: unknown[]) => assignMock(...a),
    reassign: (...a: unknown[]) => reassignMock(...a),
    reply: (...a: unknown[]) => replyMock(...a),
    resolve: (...a: unknown[]) => resolveMock(...a),
    setPriority: (...a: unknown[]) => priorityMock(...a),
  },
}))
import { SUPPORT_PAGE_SIZE, useSupportTickets } from '@/features/support/composables/useSupportTickets'

const ticket = {
  id: 't1', category: 'PAYMENT', subject: 'Paiement bloque', status: 'NEW',
  priority: 'NORMAL', userId: 'u1', userDisplayName: 'Awa D.',
  assignedAdminId: null, assignedAdminEmail: null,
  createdAt: '2026-09-05T10:00:00', lastMessageAt: '2026-09-05T10:00:00',
  resolvedAt: null, messages: null,
}
const page = { content: [ticket], totalElements: 1, totalPages: 1, number: 0, size: 100 }

describe('useSupportTickets', () => {
  beforeEach(() => {
    for (const m of [listMock, getMock, assignMock, reassignMock, replyMock, resolveMock, priorityMock]) {
      m.mockReset()
    }
  })

  it('fetchTickets charge une page de 100 sur « Tous », sans statut', async () => {
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    await s.fetchTickets()
    expect(listMock).toHaveBeenCalledWith('all', 'TOUS', 0, SUPPORT_PAGE_SIZE)
    expect(SUPPORT_PAGE_SIZE).toBe(100)
    expect(s.tickets.value).toHaveLength(1)
    expect(s.truncated.value).toBe(false)
    expect(s.isLoading.value).toBe(false)
  })

  it('signale une page tronquée quand le serveur a plus de conversations', async () => {
    listMock.mockResolvedValue({ ...page, totalElements: 250 })
    const s = useSupportTickets()
    await s.fetchTickets()
    expect(s.truncated.value).toBe(true)
  })

  it('un échec de lecture laisse une phrase', async () => {
    listMock.mockRejectedValue(Object.assign(new Error('x'), { data: { detail: 'Base indisponible' } }))
    const s = useSupportTickets()
    await s.fetchTickets()
    expect(s.error.value).toBe('Base indisponible')
    expect(s.isLoading.value).toBe(false)
  })

  it('openTicket charge le détail, closeTicket le vide', async () => {
    getMock.mockResolvedValue({ ...ticket, messages: [] })
    const s = useSupportTickets()
    await s.openTicket('t1')
    expect(s.selected.value?.id).toBe('t1')
    expect(s.isDetailLoading.value).toBe(false)
    s.closeTicket()
    expect(s.selected.value).toBeNull()
  })

  it('deux ouvertures rapprochées : seule la dernière compte', async () => {
    let releaseFirst: (_t: unknown) => void = () => {}
    getMock.mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve }))
    getMock.mockResolvedValueOnce({ ...ticket, id: 't2', messages: [] })
    const s = useSupportTickets()
    const first = s.openTicket('t1')
    await s.openTicket('t2')
    releaseFirst({ ...ticket, id: 't1', messages: [] })
    await first
    expect(s.selected.value?.id).toBe('t2')
    expect(s.isDetailLoading.value).toBe(false)
  })

  it('un échec de lecture du fil laisse une phrase ; fermer pendant la lecture l’annule', async () => {
    getMock.mockRejectedValueOnce(Object.assign(new Error('x'), { data: { detail: 'Ticket introuvable.' } }))
    const s = useSupportTickets()
    await s.openTicket('zz')
    expect(s.actionError.value).toBe('Ticket introuvable.')
    let release: (_t: unknown) => void = () => {}
    getMock.mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    const pending = s.openTicket('t1')
    s.closeTicket()
    release({ ...ticket, messages: [] })
    await pending
    expect(s.selected.value).toBeNull()
    expect(s.isDetailLoading.value).toBe(false)
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

  it('reassign et resolve passent par le même rechargement', async () => {
    reassignMock.mockResolvedValue({})
    resolveMock.mockResolvedValue({})
    getMock.mockResolvedValue({ ...ticket, messages: [] })
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    expect(await s.reassign('t1', 'a2')).toBe(true)
    expect(reassignMock).toHaveBeenCalledWith('t1', 'a2')
    expect(await s.resolve('t1')).toBe(true)
    expect(resolveMock).toHaveBeenCalledWith('t1')
  })

  it('setPriority envoie la priorité puis recharge', async () => {
    priorityMock.mockResolvedValue({})
    getMock.mockResolvedValue({ ...ticket, priority: 'HIGH', messages: [] })
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    expect(await s.setPriority('t1', 'HIGH')).toBe(true)
    expect(priorityMock).toHaveBeenCalledWith('t1', 'HIGH')
    expect(s.selected.value?.priority).toBe('HIGH')
  })

  it('reply envoie le contenu puis recharge', async () => {
    replyMock.mockResolvedValue({ id: 'm1' })
    getMock.mockResolvedValue({ ...ticket, status: 'WAITING_USER', messages: [] })
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    const ok = await s.reply('t1', 'Bonjour')
    expect(ok).toBe(true)
    expect(replyMock).toHaveBeenCalledWith('t1', 'Bonjour', [])
    expect(s.selected.value?.status).toBe('WAITING_USER')
  })

  it('une réponse avec seulement des images envoie un contenu nul', async () => {
    replyMock.mockResolvedValue({ id: 'm1' })
    getMock.mockResolvedValue({ ...ticket, messages: [] })
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    await s.reply('t1', '', ['k1'])
    expect(replyMock).toHaveBeenCalledWith('t1', null, ['k1'])
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

  it('affiche le detail du ProblemDetail plutôt que le message technique', async () => {
    resolveMock.mockRejectedValue(Object.assign(new Error('500 Internal Server Error'), { data: { detail: 'Détail lisible du back' } }))
    const s = useSupportTickets()
    const ok = await s.resolve('t1')
    expect(ok).toBe(false)
    expect(s.actionError.value).toBe('Détail lisible du back')
    expect(s.isActing.value).toBe(false)
    expect(getMock).not.toHaveBeenCalled()
  })

  it('setUserFilter transmet userId', async () => {
    listMock.mockResolvedValue({ ...page, content: [{ ...ticket, userId: 'u1' }] })
    const s = useSupportTickets()
    await s.setUserFilter('u1')
    expect(s.userId.value).toBe('u1')
    expect(listMock).toHaveBeenLastCalledWith('all', 'TOUS', 0, 100, 'u1')
  })

  it('ancien back qui ignore userId : les tickets d’autres utilisateurs sont écartés', async () => {
    listMock.mockResolvedValue({
      ...page,
      content: [{ ...ticket, id: 'a', userId: 'u1' }, { ...ticket, id: 'b', userId: 'u2' }],
      totalElements: 2,
    })
    const s = useSupportTickets()
    await s.setUserFilter('u1')
    expect(s.tickets.value.map((t) => t.id)).toEqual(['a'])
    expect(s.userFilterIgnored.value).toBe(true)
  })

  it('nouveau back : rien n’est écarté, le filtre est honoré', async () => {
    listMock.mockResolvedValue({ ...page, content: [{ ...ticket, userId: 'u1' }] })
    const s = useSupportTickets()
    await s.setUserFilter('u1')
    expect(s.userFilterIgnored.value).toBe(false)
  })

  it('retirer le filtre utilisateur recharge sans userId', async () => {
    listMock.mockResolvedValue(page)
    const s = useSupportTickets()
    await s.setUserFilter('u1')
    await s.setUserFilter(null)
    expect(s.userId.value).toBeNull()
    expect(listMock).toHaveBeenLastCalledWith('all', 'TOUS', 0, 100)
  })
})
