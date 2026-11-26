import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.stubGlobal('definePageMeta', vi.fn())
const U = '3f2a9c1e-1111-4222-8333-444455556666'
const routeState: { query: Record<string, unknown> } = { query: {} }
vi.stubGlobal('useRoute', () => routeState)

const svc = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/features/alerts/services/alertsService', () => ({ alertsService: svc }))
const notif = vi.hoisted(() => ({ feed: vi.fn(), counters: vi.fn(), markSeen: vi.fn(), markRead: vi.fn() }))
vi.mock('@/features/notifications/services/notificationsService', () => ({ notificationsService: notif }))

import Page from '@/pages/m/alertes/index.vue'
import { alertGuide } from '@/features/alerts/lib/alertCatalog'
import { seedAuth } from '../../helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" v-bind="$attrs"><slot /></a>' }
const a = (id: string, severity: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'PAYOUT_HELD_x', severity, payload: {}, resolved: false, resolvedAt: null, createdAt, ...extra,
})
const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 100 })
const feedItem = (over: Record<string, unknown>) => ({
  id: 'n1', type: 'DISPUTE_OPENED', title: 'Litige ouvert', summary: 'Colis non reçu', severity: 'WARNING',
  createdAt: '2026-11-26T08:00:00Z', link: null, ...over,
})
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
    expect(svc.list.mock.calls.at(-1)![0]).toMatchObject({ resolved: 'OPEN' })
    await w.findAll('[data-test="alert-chip"]')[1]!.trigger('click'); await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0]).toMatchObject({ resolved: 'SNOOZED' })
    await w.findAll('[data-test="alert-chip"]')[2]!.trigger('click'); await flushPromises()
    expect(svc.list.mock.calls.at(-1)![0]).toMatchObject({ resolved: 'RESOLVED' })
    expect(w.findAll('[data-test="alert-chip"]')[2]!.attributes('aria-selected')).toBe('true')
  })

  it('shows empty and error states', async () => {
    let w = await mountPage()
    expect(w.find('[data-test="alerts-empty"]').exists()).toBe(true)
    svc.list.mockRejectedValue(Object.assign(new Error('x'), { statusCode: 500, data: { detail: 'Panne' } }))
    w = await mountPage()
    expect(w.find('[data-test="alerts-error"]').text()).toBe('Panne')
  })

  it('lists "Autres nouveautés" read-only with routes per type, greying read ones', async () => {
    notif.feed.mockResolvedValue({
      items: [
        feedItem({ id: 'n-alert', type: 'ADMIN_ALERT', title: 'Alerte', link: `/alertes?open=${U}` }),
        feedItem({ id: 'n-sup', type: 'SUPPORT_MESSAGE_RECEIVED', title: 'Message', link: `/support?ticket=${U}` }),
        feedItem({ id: U, type: 'DISPUTE_OPENED', title: 'Litige ouvert' }),
      ],
      unreadCount: 1, lastSeenAt: '2026-11-26T08:30:00Z', readIds: [],
    })
    const w = await mountPage()
    expect(w.find('h2').text()).toBe('Autres nouveautés')
    const items = w.findAll('[data-test="mobile-feed-item"]')
    expect(items.map(i => i.attributes('href'))).toEqual([`/m/alertes/${U}`, `/m/support/${U}`, `/m/alertes?item=DISPUTE_OPENED:${U}`])
    expect(items[2]!.text()).toContain('Colis non reçu')
    expect(items[0]!.classes()).toContain('opacity-60')
  })

  it('item=<TYPE>:<uuid> shows the read-only note and summary from the feed', async () => {
    routeState.query = { item: `DISPUTE_OPENED:${U}` }
    notif.feed.mockResolvedValue({ items: [feedItem({ id: U })], unreadCount: 0, lastSeenAt: null })
    const w = await mountPage()
    const box = w.find('[data-test="item-detail"]')
    expect(box.text()).toContain('À traiter sur ordinateur')
    expect(box.text()).toContain('Colis non reçu')
    expect(box.find('button').exists()).toBe(false)
  })

  it('item not in the feed shows a friendly empty state; invalid item too', async () => {
    routeState.query = { item: `DISPUTE_OPENED:${U}` }
    let w = await mountPage()
    expect(w.find('[data-test="item-empty"]').text()).toContain('n’est plus dans votre fil')
    routeState.query = { item: '../x' }
    w = await mountPage()
    expect(w.find('[data-test="item-empty"]').exists()).toBe(true)
    routeState.query = {}
    w = await mountPage()
    expect(w.find('[data-test="item-detail"]').exists()).toBe(false)
  })

  it('uses one-line labels without em dash', async () => {
    const w = await mountPage()
    expect(w.text()).not.toContain('—')
  })
})
