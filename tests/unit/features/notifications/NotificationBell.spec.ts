import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const countersMock = vi.fn()
const feedMock = vi.fn()
const markSeenMock = vi.fn()
vi.mock('@/features/notifications/services/notificationsService', () => ({
  notificationsService: {
    counters: (...a: unknown[]) => countersMock(...a),
    feed: (...a: unknown[]) => feedMock(...a),
    markSeen: (...a: unknown[]) => markSeenMock(...a),
  },
}))
const navigateToMock = vi.fn()
vi.stubGlobal('navigateTo', navigateToMock)

import NotificationBell from '@/features/notifications/components/NotificationBell.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore, FEED_PAGE_SIZE, MARK_SEEN_DELAY_MS } from '@/stores/notifications'
import { makeAdmin } from '../../../helpers/auth'

const item = (id: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'REPORT_CREATED', title: `Titre ${id}`, summary: `Résumé ${id}`, severity: 'INFO', createdAt, link: '/signalements', ...extra,
})
const FEED = {
  items: [
    item('new', '2026-09-28T11:55:00Z', { type: 'KYC_IN_REVIEW', severity: 'WARNING', link: '/kyc?status=IN_REVIEW&open=u1' }),
    item('old', '2026-09-28T08:00:00Z', { severity: 'CRITICAL' }),
  ],
  unreadCount: 1,
  lastSeenAt: '2026-09-28T10:00:00Z',
}

let wrapper: VueWrapper | null = null
async function mountBell() {
  wrapper = mount(NotificationBell, { attachTo: document.body })
  await flushPromises()
  return wrapper
}
const trigger = () => wrapper!.find('[data-test="notif-bell"]')
const panel = () => wrapper!.find('[data-test="notif-panel"]')
async function open() {
  await trigger().trigger('click')
  await flushPromises()
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-09-28T12:00:00Z'))
    setActivePinia(createPinia())
    useAuthStore().setSession('t', makeAdmin('ADMIN'))
    countersMock.mockReset().mockResolvedValue({ counts: {}, unreadCount: 1 })
    feedMock.mockReset().mockResolvedValue(FEED)
    markSeenMock.mockReset().mockResolvedValue(undefined)
    navigateToMock.mockReset()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.useRealTimers()
  })

  describe('pastille', () => {
    it('affiche le nombre de non lus et un aria-label explicite', async () => {
      await mountBell()
      expect(wrapper!.find('[data-test="notif-badge"]').text()).toBe('1')
      expect(trigger().attributes('aria-label')).toBe('Notifications, 1 non lue')
      expect(trigger().attributes('aria-expanded')).toBe('false')
    })

    it('« 99+ » si le back a plafonné le compte', async () => {
      countersMock.mockResolvedValue({ counts: {}, unreadCount: 99, unreadCapped: true })
      await mountBell()
      expect(wrapper!.find('[data-test="notif-badge"]').text()).toBe('99+')
      expect(trigger().attributes('aria-label')).toBe('Notifications, plus de 99 non lues')
    })

    it('pluriel dans l’aria-label', async () => {
      countersMock.mockResolvedValue({ counts: {}, unreadCount: 4 })
      await mountBell()
      expect(trigger().attributes('aria-label')).toBe('Notifications, 4 non lues')
    })

    it('pas de pastille à 0', async () => {
      countersMock.mockResolvedValue({ counts: {}, unreadCount: 0 })
      await mountBell()
      expect(wrapper!.find('[data-test="notif-badge"]').exists()).toBe(false)
      expect(trigger().attributes('aria-label')).toBe('Notifications')
    })
  })

  describe('panneau', () => {
    it('s’ouvre au clic, liste les nouveautés et met en évidence les non lus', async () => {
      await mountBell()
      await open()
      expect(panel().exists()).toBe(true)
      expect(trigger().attributes('aria-expanded')).toBe('true')
      const rows = wrapper!.findAll('[data-test="notif-item"]')
      expect(rows).toHaveLength(2)
      expect(rows[0]!.text()).toContain('Titre new')
      expect(rows[0]!.text()).toContain('Résumé new')
      expect(rows[0]!.text()).toMatch(/il y a 5\smin/)
      expect(rows[0]!.attributes('data-unread')).toBe('true')
      expect(rows[1]!.attributes('data-unread')).toBe('false')
      // date complète au survol
      expect(rows[0]!.find('time').attributes('title')).toMatch(/septembre 2026/)
      expect(rows[0]!.find('time').attributes('datetime')).toBe('2026-09-28T11:55:00Z')
      // sévérité et icône
      expect(rows[0]!.find('[data-test="notif-icon"]').classes().join(' ')).toContain('warning')
      expect(rows[1]!.find('[data-test="notif-icon"]').classes().join(' ')).toContain('danger')
    })

    it('squelette pendant le chargement', async () => {
      let resolve!: (_v: unknown) => void
      feedMock.mockReturnValue(new Promise((r) => { resolve = r }))
      await mountBell()
      await trigger().trigger('click')
      expect(wrapper!.find('[data-test="notif-skeleton"]').exists()).toBe(true)
      resolve(FEED)
      await flushPromises()
      expect(wrapper!.find('[data-test="notif-skeleton"]').exists()).toBe(false)
    })

    it('état vide : « Rien de nouveau »', async () => {
      feedMock.mockResolvedValue({ items: [], unreadCount: 0, lastSeenAt: null })
      await mountBell()
      await open()
      expect(wrapper!.find('[data-test="notif-empty"]').text()).toContain('Rien de nouveau')
    })

    it('état d’erreur : message et « Réessayer »', async () => {
      feedMock.mockRejectedValueOnce(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Panne du serveur.' } }))
      await mountBell()
      await open()
      expect(wrapper!.find('[data-test="notif-error"]').text()).toContain('Panne du serveur.')
      await wrapper!.find('[data-test="notif-retry"]').trigger('click')
      await flushPromises()
      expect(wrapper!.findAll('[data-test="notif-item"]')).toHaveLength(2)
    })

    it('clic sur un élément : navigation vers son lien et fermeture', async () => {
      await mountBell()
      await open()
      await wrapper!.findAll('[data-test="notif-item"]')[0]!.trigger('click')
      expect(navigateToMock).toHaveBeenCalledWith('/kyc?status=IN_REVIEW&open=u1')
      expect(panel().exists()).toBe(false)
    })

    it('un lien externe n’est jamais suivi', async () => {
      feedMock.mockResolvedValue({ ...FEED, items: [item('x', '2026-09-28T11:00:00Z', { link: 'https://evil.example' })] })
      await mountBell()
      await open()
      await wrapper!.find('[data-test="notif-item"]').trigger('click')
      expect(navigateToMock).not.toHaveBeenCalled()
      expect(panel().exists()).toBe(false)
    })

    it('« Tout marquer comme lu » : mark-seen puis pastille retirée', async () => {
      await mountBell()
      await open()
      await wrapper!.find('[data-test="notif-mark-all"]').trigger('click')
      await flushPromises()
      expect(markSeenMock).toHaveBeenCalledWith('2026-09-28T11:55:00Z')
      expect(wrapper!.find('[data-test="notif-badge"]').exists()).toBe(false)
      expect(wrapper!.find('[data-test="notif-mark-all"]').exists()).toBe(false)
    })

    it('échec de « Tout marquer comme lu » : message affiché', async () => {
      markSeenMock.mockRejectedValue(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Impossible pour le moment.' } }))
      await mountBell()
      await open()
      await wrapper!.find('[data-test="notif-mark-all"]').trigger('click')
      await flushPromises()
      expect(wrapper!.find('[data-test="notif-mark-error"]').text()).toContain('Impossible pour le moment.')
    })

    it('marque comme lu après 2 s d’affichage, en gardant la mise en évidence pendant la session', async () => {
      await mountBell()
      await open()
      await vi.advanceTimersByTimeAsync(MARK_SEEN_DELAY_MS - 1)
      expect(markSeenMock).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      await flushPromises()
      expect(markSeenMock).toHaveBeenCalledOnce()
      expect(wrapper!.find('[data-test="notif-badge"]').exists()).toBe(false)
      expect(wrapper!.findAll('[data-test="notif-item"]')[0]!.attributes('data-unread')).toBe('true')
    })

    it('une ouverture furtive (< 2 s) ne marque rien', async () => {
      await mountBell()
      await open()
      await vi.advanceTimersByTimeAsync(500)
      await trigger().trigger('click') // referme
      await vi.advanceTimersByTimeAsync(MARK_SEEN_DELAY_MS * 2)
      expect(markSeenMock).not.toHaveBeenCalled()
    })

    it('aucun non lu : pas de marquage automatique', async () => {
      countersMock.mockResolvedValue({ counts: {}, unreadCount: 0 })
      feedMock.mockResolvedValue({ ...FEED, unreadCount: 0 })
      await mountBell()
      await open()
      await vi.advanceTimersByTimeAsync(MARK_SEEN_DELAY_MS * 2)
      expect(markSeenMock).not.toHaveBeenCalled()
    })

    it('« Charger plus » via before', async () => {
      const page = Array.from({ length: FEED_PAGE_SIZE }, (_, i) => item(`p${i}`, new Date(Date.UTC(2026, 8, 28, 11, 59 - i)).toISOString()))
      feedMock.mockResolvedValueOnce({ items: page, unreadCount: 0, lastSeenAt: null })
      await mountBell()
      await open()
      feedMock.mockResolvedValueOnce({ items: [item('older', '2026-09-27T08:00:00Z')], unreadCount: 0, lastSeenAt: null })
      await wrapper!.find('[data-test="notif-load-more"]').trigger('click')
      await flushPromises()
      expect(feedMock).toHaveBeenLastCalledWith({ limit: FEED_PAGE_SIZE, before: page.at(-1)!.createdAt })
      expect(wrapper!.findAll('[data-test="notif-item"]')).toHaveLength(FEED_PAGE_SIZE + 1)
      expect(wrapper!.find('[data-test="notif-load-more"]').exists()).toBe(false)
    })

    it('erreur de « Charger plus » : message affiché', async () => {
      const page = Array.from({ length: FEED_PAGE_SIZE }, (_, i) => item(`p${i}`, new Date(Date.UTC(2026, 8, 28, 11, 59 - i)).toISOString()))
      feedMock.mockResolvedValueOnce({ items: page, unreadCount: 0, lastSeenAt: null })
      await mountBell()
      await open()
      feedMock.mockRejectedValueOnce(Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Suite indisponible.' } }))
      await wrapper!.find('[data-test="notif-load-more"]').trigger('click')
      await flushPromises()
      expect(wrapper!.find('[data-test="notif-load-more-error"]').text()).toContain('Suite indisponible.')
    })
  })

  describe('clavier et focus', () => {
    it('Échap ferme le panneau et rend le focus à la cloche', async () => {
      await mountBell()
      await open()
      expect(panel().element.contains(document.activeElement)).toBe(true)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await flushPromises()
      expect(panel().exists()).toBe(false)
      expect(document.activeElement).toBe(trigger().element)
    })

    it('un clic en dehors ferme le panneau', async () => {
      await mountBell()
      await open()
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
      expect(panel().exists()).toBe(false)
    })

    it('un clic dans le panneau ne le ferme pas', async () => {
      await mountBell()
      await open()
      panel().element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await flushPromises()
      expect(panel().exists()).toBe(true)
    })

    it('les autres touches ne ferment rien', async () => {
      await mountBell()
      await open()
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
      await flushPromises()
      expect(panel().exists()).toBe(true)
    })
  })

  describe('ancien back', () => {
    it('cloche sans pastille et panneau « Notifications indisponibles pour le moment »', async () => {
      countersMock.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404 }))
      await mountBell()
      expect(wrapper!.find('[data-test="notif-badge"]').exists()).toBe(false)
      await open()
      expect(wrapper!.find('[data-test="notif-unavailable"]').text()).toContain('Notifications indisponibles pour le moment')
      expect(feedMock).not.toHaveBeenCalled()
    })
  })

  it('se désabonne au démontage', async () => {
    await mountBell()
    const s = useNotificationsStore()
    wrapper!.unmount()
    wrapper = null
    await vi.advanceTimersByTimeAsync(120_000)
    expect(countersMock).toHaveBeenCalledTimes(1)
    expect(s.unreadCount).toBe(1)
  })
})
