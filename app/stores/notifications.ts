import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { notificationsService } from '@/features/notifications/services/notificationsService'
import { badgeLabel, isUnread as isUnreadByDate } from '@/features/notifications/lib/format'
import { isEndpointMissing } from '@/lib/endpointMissing'
import { extractProblemMessage } from '@/lib/problemDetail'
import {
  COUNTER_KEYS, type AdminNotification, type NotificationCounts,
} from '@/features/notifications/types/index'

export const POLL_INTERVAL_MS = 30_000
export const MAX_BACKOFF_MS = 120_000
export const FEED_PAGE_SIZE = 30

const FEED_ERROR = 'Impossible de charger les notifications.'

type FeedStatus = 'idle' | 'loading' | 'ready' | 'error'

const isClient = () => typeof window !== 'undefined' && typeof document !== 'undefined'
const isHidden = () => document.visibilityState === 'hidden'

function toCount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0
}

/** Ne garde que les compteurs connus et numériques : une clé absente reste absente (pas de permission). */
function sanitizeCounts(raw: unknown): NotificationCounts {
  const out: NotificationCounts = {}
  if (!raw || typeof raw !== 'object') return out
  for (const key of COUNTER_KEYS) {
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = Math.floor(v)
  }
  return out
}

function sanitizeItems(raw: unknown): AdminNotification[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((i): i is AdminNotification =>
    !!i && typeof i === 'object' && typeof i.id === 'string' && typeof i.createdAt === 'string')
}

/**
 * Notifications du panel : compteurs (cloche + menu) rafraîchis toutes les 30 s, fil chargé
 * à la demande. Un seul minuteur quel que soit le nombre de composants abonnés ; rien ne
 * tourne côté serveur, onglet caché, déconnecté, ou face à un back qui n'a pas encore les
 * endpoints (règle des PR jumelles).
 */
export const useNotificationsStore = defineStore('notifications', () => {
  const auth = useAuthStore()

  const items = ref<AdminNotification[]>([])
  const unreadCount = ref(0)
  const unreadCapped = ref(false)
  const lastSeenAt = ref<string | null>(null)
  const counts = ref<NotificationCounts>({})
  const feedStatus = ref<FeedStatus>('idle')
  const feedError = ref<string | null>(null)
  const feedLoaded = ref(false)
  const hasMore = ref(false)
  const loadingMore = ref(false)
  const loadMoreError = ref<string | null>(null)
  const markSeenError = ref<string | null>(null)
  /** Notifications lues une à une : celles du serveur, plus celles cliquées depuis le dernier chargement. */
  const readIds = ref<string[]>([])
  /** Ancien back : endpoints absents, on se tait jusqu'à la prochaine session. */
  const unavailable = ref(false)

  const badge = computed(() =>
    !unavailable.value && unreadCount.value > 0 ? badgeLabel(unreadCount.value, unreadCapped.value) : null)

  let subscribers = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let ticking = false
  let failures = 0
  let visibilityBound = false
  /** Clics dont le POST n'a pas encore répondu. */
  const pendingReads = new Set<string>()
  /** Lectures dont le serveur a répondu 204 : un fil arrivé avant ce POST ne doit pas les rallumer. */
  const confirmedReads = new Set<string>()
  /** Lectures gardées pour la session faute d'endpoint côté serveur. */
  const localReads = new Set<string>()

  function currentDelay(): number {
    return failures === 0 ? POLL_INTERVAL_MS : Math.min(POLL_INTERVAL_MS * 2 ** failures, MAX_BACKOFF_MS)
  }

  function canPoll(): boolean {
    return isClient() && subscribers > 0 && auth.isAuthenticated && !unavailable.value
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  function schedule() {
    clearTimer()
    if (!canPoll() || isHidden()) return
    timer = setTimeout(() => { void tick() }, currentDelay())
  }

  async function tick() {
    if (ticking) return
    ticking = true
    clearTimer()
    try {
      await refreshCounters()
    } finally {
      ticking = false
    }
    schedule()
  }

  function start() {
    if (!canPoll() || isHidden() || ticking || timer !== null) return
    void tick()
  }

  function markUnavailable() {
    unavailable.value = true
    clearTimer()
  }

  function reset() {
    clearTimer()
    failures = 0
    items.value = []
    unreadCount.value = 0
    unreadCapped.value = false
    lastSeenAt.value = null
    counts.value = {}
    feedStatus.value = 'idle'
    feedError.value = null
    feedLoaded.value = false
    hasMore.value = false
    loadMoreError.value = null
    markSeenError.value = null
    readIds.value = []
    pendingReads.clear()
    confirmedReads.clear()
    localReads.clear()
    unavailable.value = false
  }

  async function refreshCounters() {
    if (!auth.isAuthenticated) return
    try {
      const res = await notificationsService.counters()
      if (!auth.isAuthenticated) return
      failures = 0
      const previous = unreadCount.value
      counts.value = sanitizeCounts(res?.counts)
      // Back sans lecture individuelle : il compte encore ce que la session a lu, on le retranche.
      unreadCount.value = Math.max(0, toCount(res?.unreadCount) - localReads.size)
      unreadCapped.value = res?.unreadCapped === true
      if (unreadCount.value > previous && feedLoaded.value) void fetchFeed()
    } catch (e) {
      if (isEndpointMissing(e)) markUnavailable()
      else failures++
    }
  }

  /**
   * Lectures du serveur pour la page chargée, plus les clics encore en vol : un rafraîchissement
   * qui arrive avant la fin d'un POST ne doit pas rallumer la notification qu'on vient de lire.
   * Un back plus ancien n'envoie pas `readIds` : on garde ce que la session a lu.
   */
  function mergeReadIds(raw: unknown) {
    const fromServer = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []
    readIds.value = [...new Set([...fromServer, ...pendingReads, ...confirmedReads, ...localReads])]
  }

  /** Non lue : plus récente que « Tout marquer comme lu » et pas lue individuellement. */
  function isUnread(n: AdminNotification): boolean {
    return isUnreadByDate(n.createdAt, lastSeenAt.value) && !readIds.value.includes(n.id)
  }

  /**
   * Un clic sur une notification la marque lue, elle seule : la pastille baisse tout de suite, le
   * POST suit. Un échec rend la notification non lue et le dit ; un back sans l'endpoint garde la
   * lecture pour la session (rien n'est marqué automatiquement, jamais).
   */
  async function markRead(n: AdminNotification) {
    if (unavailable.value || !isUnread(n)) return
    const wasUnread = unreadCount.value
    markSeenError.value = null
    pendingReads.add(n.id)
    readIds.value = [...readIds.value, n.id]
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    try {
      await notificationsService.markRead(n.id)
      confirmedReads.add(n.id)
    } catch (e) {
      if (isEndpointMissing(e)) {
        localReads.add(n.id)
      } else {
        readIds.value = readIds.value.filter((id) => id !== n.id)
        unreadCount.value = Math.max(unreadCount.value, wasUnread)
        markSeenError.value = extractProblemMessage(e, 'Impossible de marquer la notification comme lue.')
      }
    } finally {
      pendingReads.delete(n.id)
    }
  }

  async function fetchFeed() {
    if (!feedLoaded.value) feedStatus.value = 'loading'
    feedError.value = null
    try {
      const res = await notificationsService.feed({ limit: FEED_PAGE_SIZE })
      if (!auth.isAuthenticated) return
      items.value = sanitizeItems(res?.items)
      unreadCount.value = toCount(res?.unreadCount)
      unreadCapped.value = res?.unreadCapped === true
      lastSeenAt.value = typeof res?.lastSeenAt === 'string' ? res.lastSeenAt : null
      mergeReadIds(res?.readIds)
      hasMore.value = items.value.length >= FEED_PAGE_SIZE
      loadMoreError.value = null
      feedLoaded.value = true
      feedStatus.value = 'ready'
    } catch (e) {
      if (isEndpointMissing(e)) {
        markUnavailable()
        return
      }
      // Un rafraîchissement raté garde la liste déjà affichée.
      if (feedLoaded.value) return
      feedError.value = extractProblemMessage(e, FEED_ERROR)
      feedStatus.value = 'error'
    }
  }

  /** Ouverture de la cloche : le fil est toujours rechargé, sans squelette s'il l'a déjà été. */
  async function openPanel() {
    if (unavailable.value) return
    markSeenError.value = null
    await fetchFeed()
  }

  async function loadMore() {
    const last = items.value.at(-1)
    if (loadingMore.value || !hasMore.value || !last) return
    loadingMore.value = true
    loadMoreError.value = null
    try {
      const res = await notificationsService.feed({ limit: FEED_PAGE_SIZE, before: last.createdAt })
      const page = sanitizeItems(res?.items)
      const known = new Set(items.value.map((i) => i.id))
      items.value = [...items.value, ...page.filter((i) => !known.has(i.id))]
      hasMore.value = page.length >= FEED_PAGE_SIZE
    } catch (e) {
      loadMoreError.value = extractProblemMessage(e, FEED_ERROR)
    } finally {
      loadingMore.value = false
    }
  }

  async function markAllSeen() {
    if (unavailable.value || unreadCount.value === 0) return
    const upTo = items.value[0]?.createdAt
    markSeenError.value = null
    try {
      await notificationsService.markSeen(upTo)
      unreadCount.value = 0
      unreadCapped.value = false
      lastSeenAt.value = upTo ?? new Date().toISOString()
      localReads.clear()
      confirmedReads.clear()
    } catch (e) {
      if (isEndpointMissing(e)) markUnavailable()
      else markSeenError.value = extractProblemMessage(e, 'Impossible de marquer les notifications comme lues.')
    }
  }

  function onVisibilityChange() {
    if (isHidden()) {
      clearTimer()
      return
    }
    // Retour sur l'onglet : on rattrape tout de suite au lieu d'attendre le prochain tour.
    if (canPoll() && !ticking) void tick()
  }

  /** À appeler au montage ; renvoie la fonction de désabonnement (idempotente). */
  function subscribe(): () => void {
    subscribers++
    if (isClient() && !visibilityBound) {
      document.addEventListener('visibilitychange', onVisibilityChange)
      visibilityBound = true
    }
    start()
    let done = false
    return () => {
      if (done) return
      done = true
      subscribers = Math.max(0, subscribers - 1)
      if (subscribers === 0) {
        clearTimer()
        if (visibilityBound) document.removeEventListener('visibilitychange', onVisibilityChange)
        visibilityBound = false
      }
    }
  }

  watch(() => auth.isAuthenticated, (authenticated) => {
    if (!authenticated) reset()
    else start()
  }, { flush: 'sync' })

  return {
    items, unreadCount, unreadCapped, lastSeenAt, counts, feedStatus, feedError, hasMore,
    loadingMore, loadMoreError, markSeenError, unavailable, badge, readIds,
    isUnread, subscribe, refreshCounters, openPanel, loadMore, markAllSeen, markRead,
  }
})
