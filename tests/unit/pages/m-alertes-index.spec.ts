import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, renderToString } from '@vue/test-utils'

const metaSpy = vi.fn()
vi.stubGlobal('definePageMeta', metaSpy)
const U = '3f2a9c1e-1111-4222-8333-444455556666'
const routeState: { query: Record<string, unknown> } = { query: {} }
vi.stubGlobal('useRoute', () => routeState)

const svc = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/features/mobile/services/mobileAlertsService', () => ({ mobileAlertsService: svc }))
const notif = vi.hoisted(() => ({ feed: vi.fn(), counters: vi.fn(), markSeen: vi.fn(), markRead: vi.fn() }))
vi.mock('@/features/notifications/services/notificationsService', () => ({ notificationsService: notif }))

import Page from '@/pages/m/alertes/index.vue'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import { seedAuth } from '../../helpers/auth'
import { ALERTS_FEED_PERMISSIONS } from '@/features/mobile/lib/mobileAlerts'

/** Admin qui suit les litiges mais pas les alertes opérationnelles (pas d'ALERT_VIEW). */
const disputesOnly = () => seedAuth('ADMIN', { ...Object.fromEntries(ALERTS_FEED_PERMISSIONS.map(p => [p, false])), DISPUTE_VIEW: true })

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" v-bind="$attrs"><slot /></a>' }
const a = (id: string, severity: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'PAYOUT_HELD_x', severity, payload: {}, resolved: false, resolvedAt: null, createdAt, ...extra,
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })
const T = '9b8c7d6e-2222-4333-8444-555566667777'
const M = '1a2b3c4d-5555-4666-8777-888899990000'
/** Contrat réel du fil : id composite `<TYPE>:<uuid>`, lien interne de l'ordinateur. */
const feedItem = (over: Record<string, unknown> = {}) => ({
  id: `DISPUTE_OPENED:${U}`, type: 'DISPUTE_OPENED', title: 'Litige ouvert', summary: 'Colis non reçu', severity: 'WARNING',
  createdAt: '2026-11-26T08:00:00Z', link: `/litiges?open=${U}`, ...over,
})
const deferred = () => {
  // eslint-disable-next-line no-unused-vars
  let resolve!: (v: unknown) => void
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}
const mountPage = async () => {
  const w = mount(Page, { global: { stubs: { NuxtLink } } })
  await flushPromises()
  return w
}

describe('m/alertes index page', () => {
  beforeEach(() => {
    svc.list.mockReset(); Object.values(notif).forEach(f => f.mockReset())
    routeState.query = {}
    seedAuth('ADMIN')
    svc.list.mockResolvedValue(page([]))
    notif.feed.mockResolvedValue({ items: [], unreadCount: 0, lastSeenAt: null })
  })

  it('list_sortsBySeverityThenDate renders cards in order with links and the claimed flag', async () => {
    svc.list.mockResolvedValue(page([
      a('c-info', 'INFO', '2026-11-26T10:00:00'),
      a('c-crit-old', 'CRITICAL', '2026-11-01T10:00:00'),
      a('c-warn', 'WARN', '2026-11-25T10:00:00', { claimedAt: '2026-11-25T11:00:00', claimedByName: 'x@y.fr' }),
      a('c-crit-new', 'CRITICAL', '2026-11-25T10:00:00'),
    ]))
    const w = await mountPage()
    const cards = w.findAll('[data-test="mobile-alert-card"]')
    expect(cards.map(c => c.attributes('href'))).toEqual(['/m/alertes/c-crit-new', '/m/alertes/c-crit-old', '/m/alertes/c-warn', '/m/alertes/c-info'])
    expect(cards.map(c => c.attributes('data-severity'))).toEqual(['CRITICAL', 'CRITICAL', 'WARN', 'INFO'])
    expect(cards[0]!.text()).toContain(alertGuide('PAYOUT_HELD_x').title)
    expect(cards[2]!.find('[data-test="claimed-flag"]').text()).toBe('Pris en charge')
    expect(cards[0]!.find('[data-test="claimed-flag"]').exists()).toBe(false)
    expect(w.text()).not.toContain('x@y.fr')
  })

  it('chips filter via the API params (open, snoozed, resolved)', async () => {
    const w = await mountPage()
    expect(w.findAll('[data-test="alert-chip"]').map(c => c.text())).toEqual(['À traiter', 'En attente', 'Traitées'])
    expect(svc.list).toHaveBeenLastCalledWith('OPEN', 0, 100)
    await w.findAll('[data-test="alert-chip"]')[1]!.trigger('click'); await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('SNOOZED', 0, 100)
    await w.findAll('[data-test="alert-chip"]')[2]!.trigger('click'); await flushPromises()
    expect(svc.list).toHaveBeenLastCalledWith('RESOLVED', 0, 100)
    expect(w.findAll('[data-test="alert-chip"]')[2]!.attributes('aria-selected')).toBe('true')
  })

  it('shows empty and error states', async () => {
    let w = await mountPage()
    expect(w.find('[data-test="alerts-empty"]').exists()).toBe(true)
    svc.list.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    w = await mountPage()
    expect(w.find('[data-test="alerts-error"]').text()).toBe('Panne')
  })

  it('lists "Autres nouveautés" read-only with routes per type, without the alerts already listed above', async () => {
    notif.feed.mockResolvedValue({
      items: [
        feedItem({ id: `ADMIN_ALERT:${M}`, type: 'ADMIN_ALERT', title: 'Alerte', link: '/alertes', createdAt: '2026-11-26T09:00:00Z' }),
        feedItem({ id: `SUPPORT_MESSAGE_RECEIVED:${M}`, type: 'SUPPORT_MESSAGE_RECEIVED', title: 'Message', link: `/support?ticket=${T}`, createdAt: '2026-11-26T07:00:00Z' }),
        feedItem({ createdAt: '2026-11-26T09:00:00Z' }),
      ],
      unreadCount: 1, lastSeenAt: '2026-11-26T08:30:00Z', readIds: [],
    })
    const w = await mountPage()
    expect(w.find('h2').text()).toBe('Autres nouveautés')
    const items = w.findAll('[data-test="mobile-feed-item"]')
    expect(items.map(i => i.attributes('href'))).toEqual([`/m/support/${T}`, `/m/alertes?item=DISPUTE_OPENED:${U}`])
    expect(items.some(i => i.text().includes('Alerte'))).toBe(false)
    expect(items[1]!.text()).toContain('Colis non reçu')
    expect(items[0]!.classes()).toContain('opacity-60')
    expect(items[1]!.classes()).not.toContain('opacity-60')
  })

  it('push landing on ?item=DISPUTE_OPENED:<uuid> shows the read-only card from the feed', async () => {
    routeState.query = { item: `DISPUTE_OPENED:${U}` }
    notif.feed.mockResolvedValue({ items: [feedItem()], unreadCount: 0, lastSeenAt: null })
    const w = await mountPage()
    const box = w.find('[data-test="item-detail"]')
    expect(box.text()).toContain('À traiter sur ordinateur')
    expect(box.text()).toContain('Colis non reçu')
    expect(box.find('[data-test="item-empty"]').exists()).toBe(false)
    expect(box.find('button').exists()).toBe(false)
  })

  it('a tap in the list leads to a URL that opens the same card', async () => {
    notif.feed.mockResolvedValue({ items: [feedItem({ id: `KYC_IN_REVIEW:${T}`, type: 'KYC_IN_REVIEW', summary: 'Pièce à vérifier', link: '/kyc' })], unreadCount: 0, lastSeenAt: null })
    let w = await mountPage()
    const href = w.find('[data-test="mobile-feed-item"]').attributes('href')!
    expect(href).toBe(`/m/alertes?item=KYC_IN_REVIEW:${T}`)
    routeState.query = Object.fromEntries(new URLSearchParams(href.split('?')[1]))
    w = await mountPage()
    expect(w.find('[data-test="item-detail"]').text()).toContain('Pièce à vérifier')
  })

  it('while the feed loads: Chargement, never a false "plus dans votre fil"', async () => {
    routeState.query = { item: `DISPUTE_OPENED:${U}` }
    const slow = deferred()
    notif.feed.mockReturnValue(slow.promise)
    const w = await mountPage()
    expect(w.find('[data-test="item-loading"]').text()).toContain('Chargement')
    expect(w.find('[data-test="item-empty"]').exists()).toBe(false)
    slow.resolve({ items: [], unreadCount: 0, lastSeenAt: null })
    await flushPromises()
    expect(w.find('[data-test="item-loading"]').exists()).toBe(false)
    expect(w.find('[data-test="item-empty"]').text()).toContain('n’est plus dans votre fil')
  })

  it('unknown id: friendly state once the feed is ready, failed or absent from the back-end', async () => {
    routeState.query = { item: `DISPUTE_OPENED:${U}` }
    notif.feed.mockResolvedValue({ items: [feedItem({ id: `DISPUTE_OPENED:${T}` })], unreadCount: 0, lastSeenAt: null })
    let w = await mountPage()
    expect(w.find('[data-test="item-empty"]').exists()).toBe(true)
    notif.feed.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    w = await mountPage()
    expect(w.find('[data-test="item-empty"]').exists()).toBe(true)
    seedAuth('ADMIN')
    notif.feed.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 404, data: {} }))
    w = await mountPage()
    expect(w.find('[data-test="item-loading"]').exists()).toBe(false)
    expect(w.find('[data-test="item-empty"]').exists()).toBe(true)
  })

  it('an invalid item shows the friendly state at once; no item, no box', async () => {
    notif.feed.mockReturnValue(new Promise(() => {}))
    routeState.query = { item: '../x' }
    let w = await mountPage()
    expect(w.find('[data-test="item-empty"]').exists()).toBe(true)
    routeState.query = { item: U }
    w = await mountPage()
    expect(w.find('[data-test="item-empty"]').exists()).toBe(true)
    routeState.query = {}
    w = await mountPage()
    expect(w.find('[data-test="item-detail"]').exists()).toBe(false)
  })

  it('first paint (server render, before mount): Chargement, never a false "Aucune alerte"', async () => {
    const html = await renderToString(Page, { global: { stubs: { NuxtLink } } })
    expect(html).toContain('Chargement')
    expect(html).not.toContain('Aucune alerte')
    expect(svc.list).not.toHaveBeenCalled()
  })

  it('page meta: the list opens with ANY feed permission (not only ALERT_VIEW)', () => {
    expect(metaSpy).toHaveBeenCalledWith(expect.objectContaining({ middleware: 'admin-only', permissionAnyOf: ALERTS_FEED_PERMISSIONS }))
    expect(metaSpy.mock.calls.at(-1)![0]).not.toHaveProperty('permission')
  })

  it('without ALERT_VIEW: no alerts list nor request, the feed alone, a push ?item= still opens its card', async () => {
    disputesOnly()
    notif.feed.mockResolvedValue({ items: [feedItem()], unreadCount: 0, lastSeenAt: null })
    let w = await mountPage()
    expect(svc.list).not.toHaveBeenCalled()
    expect(w.find('[data-test="alert-chip"]').exists()).toBe(false)
    expect(w.find('[data-test="alerts-empty"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Chargement')
    expect(w.find('h2').text()).toBe('Nouveautés')
    expect(w.find('[data-test="mobile-feed-item"]').attributes('href')).toBe(`/m/alertes?item=DISPUTE_OPENED:${U}`)
    routeState.query = { item: `DISPUTE_OPENED:${U}` }
    w = await mountPage()
    expect(w.find('[data-test="item-detail"]').text()).toContain('Colis non reçu')
  })

  it('without ALERT_VIEW: empty and error wording speak of the feed, not of alerts', async () => {
    disputesOnly()
    let w = await mountPage()
    expect(w.find('[data-test="feed-empty"]').text()).toBe('Aucune nouveauté dans votre fil pour le moment.')
    expect(w.text()).not.toContain('Aucune alerte')
    notif.feed.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne du fil' } }))
    disputesOnly()
    w = await mountPage()
    expect(w.find('[data-test="feed-error"]').text()).toBe('Panne du fil')
    // Avec ALERT_VIEW, la liste des alertes garde son propre état vide et le fil vide se tait.
    seedAuth('ADMIN')
    notif.feed.mockResolvedValue({ items: [], unreadCount: 0, lastSeenAt: null })
    w = await mountPage()
    expect(w.find('[data-test="alerts-empty"]').exists()).toBe(true)
    expect(w.find('[data-test="feed-empty"]').exists()).toBe(false)
  })

  it('hydration: the server render does not depend on the permissions', async () => {
    const withAlerts = await renderToString(Page, { global: { stubs: { NuxtLink } } })
    disputesOnly()
    const without = await renderToString(Page, { global: { stubs: { NuxtLink } } })
    expect(without).toBe(withAlerts)
  })

  it('uses one-line labels without em dash', async () => {
    const w = await mountPage()
    expect(w.text()).not.toContain('—')
  })
})
