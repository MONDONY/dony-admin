import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore, POLL_INTERVAL_MS, MAX_BACKOFF_MS, FEED_PAGE_SIZE } from '@/stores/notifications'
import { makeAdmin } from '../../helpers/auth'

const missing = () => Object.assign(new Error('404 Not Found'), { statusCode: 404, data: { detail: 'No endpoint' } })
const boom = () => Object.assign(new Error('500'), { statusCode: 500, data: { detail: 'Panne du serveur.' } })
const item = (id: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id, type: 'REPORT_CREATED', title: `Titre ${id}`, summary: 'Résumé', severity: 'INFO', createdAt, link: '/signalements', ...extra,
})
const counters = (unreadCount: number, counts: Record<string, number> = {}) => ({ counts, unreadCount })

let visibility: 'visible' | 'hidden' = 'visible'
function setVisibility(v: 'visible' | 'hidden') {
  visibility = v
  document.dispatchEvent(new Event('visibilitychange'))
}

/** Laisse les promesses des appels mockés se résoudre. */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** Désabonnements à rejouer en fin de test : un store d'un test précédent écouterait encore visibilitychange. */
const stops: (() => void)[] = []
function sub(s: ReturnType<typeof useNotificationsStore>) {
  const stop = s.subscribe()
  stops.push(stop)
  return stop
}

function login() {
  useAuthStore().setSession('t', makeAdmin('ADMIN'))
}

describe('store notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    countersMock.mockReset().mockResolvedValue(counters(0))
    feedMock.mockReset().mockResolvedValue({ items: [], unreadCount: 0, lastSeenAt: null })
    markSeenMock.mockReset().mockResolvedValue(undefined)
    visibility = 'visible'
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  })
  afterEach(() => {
    stops.splice(0).forEach((stop) => stop())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('polling des compteurs', () => {
    it('charge les compteurs dès l’abonnement puis toutes les 30 s', async () => {
      login()
      countersMock.mockResolvedValue(counters(2, { reports: 2 }))
      const s = useNotificationsStore()
      const stop = s.subscribe()
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)
      expect(s.unreadCount).toBe(2)
      expect(s.counts).toEqual({ reports: 2 })

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS - 1)
      expect(countersMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(countersMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(3)
      stop()
    })

    it('un seul intervalle même avec plusieurs abonnés', async () => {
      login()
      const s = useNotificationsStore()
      const a = sub(s)
      const b = sub(s)
      const c = sub(s)
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(2)
      a()
      b()
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(3)
      c()
      c() // désabonnement idempotent
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
      expect(countersMock).toHaveBeenCalledTimes(3)
    })

    it('se met en pause quand l’onglet est caché et reprend immédiatement au retour', async () => {
      login()
      const s = useNotificationsStore()
      sub(s)
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)

      setVisibility('hidden')
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4)
      expect(countersMock).toHaveBeenCalledTimes(1)

      setVisibility('visible')
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(3)
    })

    it('ne démarre pas tant que l’onglet est caché', async () => {
      login()
      visibility = 'hidden'
      const s = useNotificationsStore()
      sub(s)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
      expect(countersMock).not.toHaveBeenCalled()
      setVisibility('visible')
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)
    })

    it('recule en cas d’erreurs répétées : 30 s puis 60 s puis 120 s au plus, et revient à 30 s après un succès', async () => {
      login()
      countersMock.mockRejectedValue(boom())
      const s = useNotificationsStore()
      sub(s)
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(1) // 1re erreur : on attend 60 s
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS - 1)
      expect(countersMock).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(1)
      expect(countersMock).toHaveBeenCalledTimes(3)

      // plafonné à 120 s
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS)
      expect(countersMock).toHaveBeenCalledTimes(4)

      countersMock.mockResolvedValue(counters(1))
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS)
      expect(countersMock).toHaveBeenCalledTimes(5)
      expect(s.unreadCount).toBe(1)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).toHaveBeenCalledTimes(6)
    })

    it('s’arrête à la déconnexion et vide l’état', async () => {
      login()
      countersMock.mockResolvedValue(counters(4, { alerts: 4 }))
      const s = useNotificationsStore()
      sub(s)
      await flush()
      expect(s.unreadCount).toBe(4)

      useAuthStore().clear()
      expect(s.unreadCount).toBe(0)
      expect(s.counts).toEqual({})
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3)
      expect(countersMock).toHaveBeenCalledTimes(1)
    })

    it('ignore une réponse arrivée après la déconnexion', async () => {
      login()
      let resolve!: (_v: unknown) => void
      countersMock.mockReturnValue(new Promise((r) => { resolve = r }))
      const s = useNotificationsStore()
      sub(s)
      useAuthStore().clear()
      resolve(counters(9))
      await flush()
      expect(s.unreadCount).toBe(0)
    })

    it('reprend à la reconnexion si un composant est toujours abonné', async () => {
      const s = useNotificationsStore()
      sub(s)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      expect(countersMock).not.toHaveBeenCalled()
      login()
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)
    })

    it('ne poll pas côté serveur (SSR)', async () => {
      login()
      vi.stubGlobal('window', undefined)
      const s = useNotificationsStore()
      sub(s)
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 2)
      expect(countersMock).not.toHaveBeenCalled()
    })

    it('recharge le fil seulement si le nombre de non lus augmente et que le fil a déjà été chargé', async () => {
      login()
      const s = useNotificationsStore()
      countersMock.mockResolvedValue(counters(1))
      sub(s)
      await flush()
      expect(feedMock).not.toHaveBeenCalled() // fil jamais ouvert : rien à rafraîchir

      feedMock.mockResolvedValue({ items: [item('n1', '2026-09-28T10:00:00Z')], unreadCount: 1, lastSeenAt: null })
      await s.openPanel()
      expect(feedMock).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS) // même compte
      expect(feedMock).toHaveBeenCalledTimes(1)

      countersMock.mockResolvedValue(counters(2))
      feedMock.mockResolvedValue({ items: [item('n2', '2026-09-28T11:00:00Z')], unreadCount: 2, lastSeenAt: null })
      await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
      await flush()
      expect(feedMock).toHaveBeenCalledTimes(2)
      expect(s.items.map((i) => i.id)).toEqual(['n2'])
    })

    it('tolère une réponse mal formée sans planter', async () => {
      login()
      countersMock.mockResolvedValue({ content: [], unreadCount: 'x', counts: { reports: -1, kyc: 'a', support: 3 } })
      const s = useNotificationsStore()
      sub(s)
      await flush()
      expect(s.unreadCount).toBe(0)
      expect(s.counts).toEqual({ support: 3 })
    })

    it('lit unreadCapped s’il est renvoyé par les compteurs', async () => {
      login()
      countersMock.mockResolvedValue({ counts: {}, unreadCount: 99, unreadCapped: true })
      const s = useNotificationsStore()
      sub(s)
      await flush()
      expect(s.badge).toBe('99+')
    })
  })

  describe('ancien back (endpoints absents)', () => {
    it('404 sans code sur les compteurs : indisponible, polling arrêté', async () => {
      login()
      countersMock.mockRejectedValue(missing())
      const s = useNotificationsStore()
      sub(s)
      await flush()
      expect(s.unavailable).toBe(true)
      expect(s.badge).toBeNull()
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS * 5)
      expect(countersMock).toHaveBeenCalledTimes(1)
      setVisibility('hidden')
      setVisibility('visible')
      await flush()
      expect(countersMock).toHaveBeenCalledTimes(1)
    })

    it('405 sur le fil : indisponible, polling arrêté', async () => {
      login()
      feedMock.mockRejectedValue(Object.assign(new Error('405'), { statusCode: 405 }))
      const s = useNotificationsStore()
      sub(s)
      await flush()
      await s.openPanel()
      expect(s.unavailable).toBe(true)
      await vi.advanceTimersByTimeAsync(MAX_BACKOFF_MS * 2)
      expect(countersMock).toHaveBeenCalledTimes(1)
    })

    it('un 404 porteur d’un code reste une vraie erreur (pas « indisponible »)', async () => {
      login()
      feedMock.mockRejectedValue(Object.assign(new Error('404'), { statusCode: 404, data: { code: 'x', detail: 'Introuvable.' } }))
      const s = useNotificationsStore()
      await s.openPanel()
      expect(s.unavailable).toBe(false)
      expect(s.feedStatus).toBe('error')
      expect(s.feedError).toBe('Introuvable.')
    })
  })

  describe('fil', () => {
    it('ouvre le fil : état de chargement puis prêt, non lus et lastSeenAt', async () => {
      login()
      feedMock.mockResolvedValue({
        items: [item('a', '2026-09-28T11:00:00Z'), item('b', '2026-09-28T09:00:00Z')],
        unreadCount: 1, unreadCapped: false, lastSeenAt: '2026-09-28T10:00:00Z',
      })
      const s = useNotificationsStore()
      const p = s.openPanel()
      expect(s.feedStatus).toBe('loading')
      await p
      expect(feedMock).toHaveBeenCalledWith({ limit: FEED_PAGE_SIZE })
      expect(s.feedStatus).toBe('ready')
      expect(s.items).toHaveLength(2)
      expect(s.unreadCount).toBe(1)
      expect(s.lastSeenAt).toBe('2026-09-28T10:00:00Z')
      expect(s.hasMore).toBe(false)
    })

    it('ignore les éléments mal formés', async () => {
      login()
      feedMock.mockResolvedValue({ items: [item('a', '2026-09-28T11:00:00Z'), { id: 3 }, null], unreadCount: 0, lastSeenAt: null })
      const s = useNotificationsStore()
      await s.openPanel()
      expect(s.items.map((i) => i.id)).toEqual(['a'])
    })

    it('rouvrir un fil déjà chargé ne remet pas le squelette', async () => {
      login()
      feedMock.mockResolvedValue({ items: [item('a', '2026-09-28T11:00:00Z')], unreadCount: 0, lastSeenAt: null })
      const s = useNotificationsStore()
      await s.openPanel()
      const p = s.openPanel()
      expect(s.feedStatus).toBe('ready')
      await p
    })

    it('erreur au chargement : message du ProblemDetail', async () => {
      login()
      feedMock.mockRejectedValue(boom())
      const s = useNotificationsStore()
      await s.openPanel()
      expect(s.feedStatus).toBe('error')
      expect(s.feedError).toBe('Panne du serveur.')
    })

    it('charger plus via before = createdAt du dernier élément, sans doublon', async () => {
      login()
      const first = Array.from({ length: FEED_PAGE_SIZE }, (_, i) =>
        item(`p${i}`, new Date(Date.UTC(2026, 8, 28, 11, 59 - i)).toISOString()))
      feedMock.mockResolvedValueOnce({ items: first, unreadCount: 0, lastSeenAt: null })
      const s = useNotificationsStore()
      await s.openPanel()
      expect(s.hasMore).toBe(true)

      feedMock.mockResolvedValueOnce({ items: [first[FEED_PAGE_SIZE - 1], item('old', '2026-09-27T08:00:00Z')], unreadCount: 0, lastSeenAt: null })
      await s.loadMore()
      expect(feedMock).toHaveBeenLastCalledWith({ limit: FEED_PAGE_SIZE, before: first[FEED_PAGE_SIZE - 1]!.createdAt })
      expect(s.items).toHaveLength(FEED_PAGE_SIZE + 1)
      expect(s.items.at(-1)!.id).toBe('old')
      expect(s.hasMore).toBe(false)

      await s.loadMore() // plus rien à charger
      expect(feedMock).toHaveBeenCalledTimes(2)
    })

    it('charger plus en erreur : message dédié, liste conservée', async () => {
      login()
      const first = Array.from({ length: FEED_PAGE_SIZE }, (_, i) => item(`p${i}`, new Date(Date.UTC(2026, 8, 28, 11, 59 - i)).toISOString()))
      feedMock.mockResolvedValueOnce({ items: first, unreadCount: 0, lastSeenAt: null })
      const s = useNotificationsStore()
      await s.openPanel()
      feedMock.mockRejectedValueOnce(boom())
      await s.loadMore()
      expect(s.loadMoreError).toBe('Panne du serveur.')
      expect(s.items).toHaveLength(FEED_PAGE_SIZE)
      expect(s.loadingMore).toBe(false)
    })
  })

  describe('tout marquer comme lu', () => {
    it('envoie upTo = createdAt de l’élément le plus récent et remet le compteur à 0', async () => {
      login()
      feedMock.mockResolvedValue({ items: [item('a', '2026-09-28T11:00:00Z'), item('b', '2026-09-28T09:00:00Z')], unreadCount: 2, unreadCapped: true, lastSeenAt: null })
      const s = useNotificationsStore()
      await s.openPanel()
      await s.markAllSeen()
      expect(markSeenMock).toHaveBeenCalledWith('2026-09-28T11:00:00Z')
      expect(s.unreadCount).toBe(0)
      expect(s.unreadCapped).toBe(false)
      expect(s.lastSeenAt).toBe('2026-09-28T11:00:00Z')
      expect(s.badge).toBeNull()
    })

    it('sans élément chargé : upTo omis', async () => {
      login()
      countersMock.mockResolvedValue(counters(3))
      const s = useNotificationsStore()
      sub(s)
      await flush()
      await s.markAllSeen()
      expect(markSeenMock).toHaveBeenCalledWith(undefined)
      expect(s.unreadCount).toBe(0)
      expect(s.lastSeenAt).not.toBeNull()
    })

    it('rien à marquer : aucun appel', async () => {
      login()
      const s = useNotificationsStore()
      await s.markAllSeen()
      expect(markSeenMock).not.toHaveBeenCalled()
    })

    it('échec : le compteur reste et un message est exposé', async () => {
      login()
      countersMock.mockResolvedValue(counters(3))
      markSeenMock.mockRejectedValue(boom())
      const s = useNotificationsStore()
      sub(s)
      await flush()
      await s.markAllSeen()
      expect(s.unreadCount).toBe(3)
      expect(s.markSeenError).toBe('Panne du serveur.')
    })

    it('mark-seen absent (ancien back) : silencieux', async () => {
      login()
      countersMock.mockResolvedValue(counters(3))
      markSeenMock.mockRejectedValue(missing())
      const s = useNotificationsStore()
      sub(s)
      await flush()
      await s.markAllSeen()
      expect(s.markSeenError).toBeNull()
      expect(s.unavailable).toBe(true)
    })
  })
})
