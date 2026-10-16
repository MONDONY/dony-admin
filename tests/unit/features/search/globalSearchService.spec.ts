import { describe, it, expect, vi, beforeEach } from 'vitest'
const apiMock = vi.fn()
vi.mock('@/composables/useApi', () => ({ useApi: () => apiMock }))
import { SEARCH_SOURCES } from '@/features/search/services/globalSearchService'

const source = (group: string) => SEARCH_SOURCES.find(s => s.group === group)!

describe('SEARCH_SOURCES', () => {
  beforeEach(() => apiMock.mockReset())

  it('utilisateurs : nom, téléphone masqué, fiche ouverte', async () => {
    apiMock.mockResolvedValue({ content: [{ id: 'u1', firstName: 'Awa', lastName: 'Diop', phoneNumber: '+33612345678', city: 'Paris', status: 'BANNED' }] })
    const [item] = await source('users').run('awa')
    expect(apiMock).toHaveBeenCalledWith('/admin/users', { query: { query: 'awa', page: 0, size: 5 } })
    expect(item.title).toBe('Awa Diop')
    expect(item.subtitle).toBe('•• •• 5678 · Paris · banned')
    expect(item.subtitle).not.toContain('612345678')
    expect(item.to).toEqual({ path: '/users', query: { query: 'u1', open: 'u1' } })
  })

  it('utilisateur sans nom ni téléphone', async () => {
    apiMock.mockResolvedValue({ content: [{ id: 'u2', firstName: null, lastName: null, status: 'ACTIVE' }] })
    const [item] = await source('users').run('u2')
    expect(item.title).toBe('Utilisateur sans nom')
    expect(item.subtitle).toBe('')
  })

  it('colis : numéro de suivi, repli sur l’identifiant', async () => {
    apiMock.mockResolvedValue({ content: [
      { id: 'b1-aaaa-bbbb', trackingNumber: 'DON-4F2A', senderName: 'Awa', corridor: 'Paris → Dakar', status: 'ACCEPTED' },
      { id: 'b2xxxxxxyyyy', trackingNumber: null, senderName: null, corridor: '', status: 'PENDING' },
    ] })
    const items = await source('bids').run('DON-4F2A')
    expect(items[0].title).toBe('DON-4F2A')
    expect(items[0].subtitle).toBe('Awa · Paris → Dakar · accepted')
    expect(items[0].to).toEqual({ path: '/colis', query: { open: 'b1-aaaa-bbbb' } })
    expect(items[1].title).toBe('Colis b2xxxxxx')
  })

  it('trajets, demandes, paiements, remboursements, signalements, support', async () => {
    apiMock.mockResolvedValueOnce({ content: [{ id: 'a1', corridor: 'Lyon → Bamako', travelerName: 'Moussa', departureDate: '2026-10-20' }] })
    const [ann] = await source('announcements').run('lyon')
    expect(ann.to).toEqual({ path: '/colis', query: { tab: 'announcements', announcement: 'a1' } })
    expect(ann.subtitle).toContain('Moussa')

    apiMock.mockResolvedValueOnce({ content: [{ id: 'r1', senderName: 'Awa', departureCity: 'Paris', arrivalCity: 'Dakar', status: 'OPEN' }] })
    const [req] = await source('requests').run('paris')
    expect(req.title).toBe('Paris → Dakar')
    expect(req.to).toEqual({ path: '/colis', query: { tab: 'demandes', open: 'r1' } })

    apiMock.mockResolvedValueOnce({ content: [{ id: 'p1', amountCents: 4500, currency: 'EUR', status: 'ESCROW', insight: { sender: { name: 'Awa D' } } }] })
    const [pay] = await source('payments').run('DON-1')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/payments', { query: { q: 'DON-1', page: 0, size: 5 } })
    expect(pay.subtitle).toBe('Awa D · escrow')
    expect(pay.to).toEqual({ path: '/transactions', query: { open: 'p1' } })

    apiMock.mockResolvedValueOnce({ content: [{ id: 'w1', userId: 'u1', amount: 9.05, currency: 'EUR', status: 'REFUNDED', requestedAt: '2026-10-14', userName: 'Fatou' }] })
    const [refund] = await source('walletRefunds').run('fatou')
    expect(refund.subtitle).toBe('Fatou · Remboursée')
    expect(refund.to).toEqual({ path: '/transactions', query: { tab: 'wallet-refunds' } })

    apiMock.mockResolvedValueOnce({ content: [{ id: 's1', reason: 'SPAM', reporterName: 'Awa', description: 'x'.repeat(80) }] })
    const [report] = await source('reports').run('spam')
    expect(report.title).toBe('Spam')
    expect(report.subtitle).toBe(`Awa · ${'x'.repeat(60)}`)
    expect(report.to).toEqual({ path: '/signalements', query: { open: 's1' } })

    apiMock.mockResolvedValueOnce({ content: [{ id: 't1', subject: 'Colis bloqué', userDisplayName: 'Awa', status: 'NEW' }] })
    const [ticket] = await source('support').run('bloqué')
    expect(apiMock).toHaveBeenLastCalledWith('/admin/support/tickets', { query: { query: 'bloqué', page: 0, size: 5 } })
    expect(ticket.to).toEqual({ path: '/support', query: { ticket: 't1' } })
  })
})
