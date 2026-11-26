import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ALLOW_API_PROMISE_RESOLVE, ALLOW_AUTH_SET_DELETE, callRe, callSurface, crawl, importsOf, isMobileFile, listFiles, ROOT,
  violations, withoutComments, wordRe, type Allow,
} from './helpers/importGraph'

/**
 * Surface réseau de l'app mobile, en un seul endroit : ce que les écrans `/m` (et leur layout) peuvent
 * appeler, statiquement (graphe d'imports, appels par fichier, primitives réseau, écritures) et à
 * l'exécution (chaque page montée avec `useApi` remplacé par un enregistreur). Toute nouvelle entrée
 * fait échouer ce fichier jusqu'à ce qu'un relecteur l'ajoute ici en connaissance de cause.
 */

// ---------------------------------------------------------------------------------------------------
// 1. Garde statique
// ---------------------------------------------------------------------------------------------------

const PAGES = listFiles('app/pages/m')
const LAYOUT = 'app/layouts/mobile.vue'
const SCOPE = [...listFiles('app/features/mobile'), ...PAGES, LAYOUT]
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')

/**
 * Appels permis, fichier par fichier (voir `callSurface` : `useX()` composable, `nom()` fonction importée
 * d'un service/store/composable, `x.m()` appel, `x.m` lecture d'un store ou d'un service, `useY().m`
 * membre déstructuré). Tout fichier sous `app/features/mobile/**`, `app/pages/m/**` et le layout y figure.
 */
const SURFACE: Record<string, string[]> = {
  'app/features/mobile/components/MobileAlertCard.vue': [],
  'app/features/mobile/components/MobileConversationCard.vue': [],
  'app/features/mobile/components/MobileNotificationSummary.vue': [],
  'app/features/mobile/components/MobileSupportCard.vue': [],
  'app/features/mobile/components/PeriodChips.vue': [],
  'app/features/mobile/components/PushToggle.vue': [
    'usePushSubscription()', 'usePushSubscription().disable', 'usePushSubscription().enable', 'usePushSubscription().error',
    'usePushSubscription().refresh', 'usePushSubscription().state',
  ],
  'app/features/mobile/composables/useIdleLock.ts': [
    'auth.clear()', 'auth.isAuthenticated', 'auth.user', 'useAuthStore()', 'useFirebaseAuth()', 'useFirebaseAuth().signOut', 'useRoute()',
  ],
  'app/features/mobile/composables/useMobileAlertDetail.ts': [
    'auth.can()', 'auth.user', 'mobileAlertsService.claim', 'mobileAlertsService.get()', 'mobileAlertsService.release', 'useAuthStore()',
  ],
  // Le fil se lit (openPanel, items, isUnread, état) : jamais markRead, markAllSeen ni loadMore. ALERT_VIEW décide
  // seulement de la liste des alertes.
  'app/features/mobile/composables/useMobileAlertList.ts': [
    'auth.can()', 'mobileAlertsService.list()', 'notifications.feedError', 'notifications.feedStatus', 'notifications.isUnread',
    'notifications.items', 'notifications.openPanel()', 'notifications.unavailable', 'useAuthStore()', 'useNotificationsStore()',
  ],
  'app/features/mobile/composables/useMobileMessageList.ts': ['mobileMessagesService.listConversations()'],
  'app/features/mobile/composables/useMobileMessageThread.ts': ['mobileMessagesService.getContext()', 'mobileMessagesService.getMessages()'],
  'app/features/mobile/composables/useMobileNotifyOne.ts': [
    'auth.can()', 'mobileNotifyService.sendToOne()', 'mobileUsersService.get()', 'picker.clear()', 'picker.search()', 'useAuthStore()',
    'useMobileUserSearch()',
  ],
  'app/features/mobile/composables/useMobileOverview.ts': ['auth.can()', 'overviewService.fetch()', 'useAuthStore()'],
  'app/features/mobile/composables/useMobileSupportList.ts': ['mobileSupportService.list()'],
  'app/features/mobile/composables/useMobileSupportTicket.ts': [
    'auth.can()', 'auth.user', 'mobileSupportService.assign()', 'mobileSupportService.get()', 'mobileSupportService.reply()', 'useAuthStore()',
  ],
  'app/features/mobile/composables/useMobileTabs.ts': ['auth.can()', 'useAuthStore()'],
  'app/features/mobile/composables/useMobileUserSearch.ts': ['mobileUsersService.list()'],
  'app/features/mobile/composables/usePushSubscription.ts': [
    'buildWebDeviceName()', 'mobileService.registerDevice()', 'mobileService.unregisterDevice()', 'useAuthStore()', 'useAuthStore().user',
    'useNuxtApp()', 'useRuntimeConfig()', 'useRuntimeConfig().app',
  ],
  // `baseURL` vient de `useRuntimeConfig()` : `.replace()` est celui d'une chaîne.
  'app/features/mobile/composables/useSwNavigation.ts': ['baseURL.replace()', 'useRuntimeConfig()', 'useRuntimeConfig().app'],
  'app/features/mobile/lib/lockState.ts': [],
  'app/features/mobile/lib/mobileAlerts.ts': [],
  'app/features/mobile/lib/mobileMessages.ts': [],
  'app/features/mobile/lib/mobileNotify.ts': [],
  'app/features/mobile/lib/mobileOverview.ts': [],
  'app/features/mobile/lib/mobileSupport.ts': [],
  'app/features/mobile/lib/pushStorage.ts': [],
  // Les seuls fichiers qui parlent au réseau (`useApi()`), chacun limité à ses méthodes (specs des services).
  'app/features/mobile/services/mobileAlertsService.ts': ['useApi()'],
  'app/features/mobile/services/mobileMessagesService.ts': ['useApi()'],
  'app/features/mobile/services/mobileNotifyService.ts': ['useApi()'],
  'app/features/mobile/services/mobileService.ts': ['useApi()'],
  'app/features/mobile/services/mobileSupportService.ts': ['useApi()'],
  'app/features/mobile/services/mobileUsersService.ts': ['useApi()'],
  'app/pages/m/alertes/[id].vue': [
    'useMobileAlertDetail()', 'useMobileAlertDetail().alert', 'useMobileAlertDetail().canClaim', 'useMobileAlertDetail().canRelease',
    'useMobileAlertDetail().claim', 'useMobileAlertDetail().claimBusy', 'useMobileAlertDetail().claimError', 'useMobileAlertDetail().claimedBy',
    'useMobileAlertDetail().error', 'useMobileAlertDetail().facts', 'useMobileAlertDetail().guide', 'useMobileAlertDetail().isLoading',
    'useMobileAlertDetail().load', 'useMobileAlertDetail().notFound', 'useMobileAlertDetail().release', 'useRoute()',
  ],
  'app/pages/m/alertes/index.vue': [
    'useMobileAlertList()', 'useMobileAlertList().canViewAlerts', 'useMobileAlertList().chip', 'useMobileAlertList().chips',
    'useMobileAlertList().error', 'useMobileAlertList().feed', 'useMobileAlertList().feedError', 'useMobileAlertList().feedSettled',
    'useMobileAlertList().isLoading', 'useMobileAlertList().isUnread', 'useMobileAlertList().item', 'useMobileAlertList().itemInvalid',
    'useMobileAlertList().itemNotification', 'useMobileAlertList().load', 'useMobileAlertList().ready', 'useMobileAlertList().selectChip',
    'useMobileAlertList().sorted', 'useRoute()',
  ],
  'app/pages/m/diffuser.vue': [
    'useMobileNotifyOne()', 'useMobileNotifyOne().account', 'useMobileNotifyOne().backToEdit', 'useMobileNotifyOne().backToForm',
    'useMobileNotifyOne().body', 'useMobileNotifyOne().bodyMax', 'useMobileNotifyOne().busy', 'useMobileNotifyOne().canConfirm',
    'useMobileNotifyOne().canReview', 'useMobileNotifyOne().canSearch', 'useMobileNotifyOne().changeRecipient', 'useMobileNotifyOne().choose',
    'useMobileNotifyOne().confirm', 'useMobileNotifyOne().error', 'useMobileNotifyOne().identity', 'useMobileNotifyOne().lockSeconds',
    'useMobileNotifyOne().pickError', 'useMobileNotifyOne().recipient', 'useMobileNotifyOne().resendAnyway', 'useMobileNotifyOne().reset',
    'useMobileNotifyOne().results', 'useMobileNotifyOne().retryAccount', 'useMobileNotifyOne().review', 'useMobileNotifyOne().searchError',
    'useMobileNotifyOne().searched', 'useMobileNotifyOne().searching', 'useMobileNotifyOne().sentTo', 'useMobileNotifyOne().setTerm',
    'useMobileNotifyOne().step', 'useMobileNotifyOne().term', 'useMobileNotifyOne().title', 'useMobileNotifyOne().titleMax',
    'useMobileNotifyOne().unreachableReason',
  ],
  'app/pages/m/ensemble.vue': [
    'useMobileOverview()', 'useMobileOverview().canOpenAlerts', 'useMobileOverview().data', 'useMobileOverview().error',
    'useMobileOverview().hasPeriod', 'useMobileOverview().isLoading', 'useMobileOverview().load', 'useMobileOverview().period',
    'useMobileOverview().queueRows', 'useMobileOverview().selectPeriod', 'useMobileOverview().tiles',
  ],
  'app/pages/m/index.vue': ['auth.isAuthenticated', 'useAuthStore()', 'useMobileTabs()', 'useNuxtApp()', 'useNuxtApp().ssrContext'],
  'app/pages/m/messages/[id].vue': [
    'useMobileMessageThread()', 'useMobileMessageThread().bubbles', 'useMobileMessageThread().closeImage', 'useMobileMessageThread().error',
    'useMobileMessageThread().invalid', 'useMobileMessageThread().isLoading', 'useMobileMessageThread().load', 'useMobileMessageThread().openImage',
    'useMobileMessageThread().participants', 'useMobileMessageThread().reasons', 'useMobileMessageThread().showImage', 'useRoute()',
  ],
  'app/pages/m/messages/index.vue': [
    'useMobileMessageList()', 'useMobileMessageList().chip', 'useMobileMessageList().error', 'useMobileMessageList().hasMore',
    'useMobileMessageList().isLoading', 'useMobileMessageList().isLoadingMore', 'useMobileMessageList().items', 'useMobileMessageList().load',
    'useMobileMessageList().loadMore', 'useMobileMessageList().search', 'useMobileMessageList().selectChip', 'useMobileMessageList().setSearch',
  ],
  'app/pages/m/support/[id].vue': [
    'useMobileSupportTicket()', 'useMobileSupportTicket().assign', 'useMobileSupportTicket().assignError', 'useMobileSupportTicket().assigning',
    'useMobileSupportTicket().canAssign', 'useMobileSupportTicket().canReply', 'useMobileSupportTicket().canSend', 'useMobileSupportTicket().draft',
    'useMobileSupportTicket().error', 'useMobileSupportTicket().heldByColleague', 'useMobileSupportTicket().isLoading',
    'useMobileSupportTicket().isResolved', 'useMobileSupportTicket().load', 'useMobileSupportTicket().messages', 'useMobileSupportTicket().notFound',
    'useMobileSupportTicket().send', 'useMobileSupportTicket().sendError', 'useMobileSupportTicket().sending', 'useMobileSupportTicket().ticket',
    'useRoute()',
  ],
  'app/pages/m/support/index.vue': [
    'useMobileSupportList()', 'useMobileSupportList().chip', 'useMobileSupportList().error', 'useMobileSupportList().isLoading',
    'useMobileSupportList().load', 'useMobileSupportList().selectChip', 'useMobileSupportList().sorted',
  ],
  // Connexion de l'ordinateur (mot de passe puis TOTP), sans rien de plus.
  'app/pages/m/verrouille.vue': [
    'useFirebaseAuth()', 'useFirebaseAuth().cancelTotpSignIn', 'useFirebaseAuth().completeTotpSignIn', 'useFirebaseAuth().signIn',
  ],
  // Pastilles (counts) et sondage des compteurs (subscribe) : jamais le fil ni les marquages « lu ».
  'app/layouts/mobile.vue': [
    'notifications.counts', 'notifications.subscribe()', 'useHead()', 'useIdleLock()', 'useMobileTabs()', 'useNotificationsStore()', 'useRoute()',
    'useRuntimeConfig()', 'useRuntimeConfig().app', 'useSwNavigation()',
  ],
}

/** Fichiers hors mobile que les écrans `/m` atteignent : bibliothèques pures, stores, et trois services lus. */
const REACHED_OUTSIDE_MOBILE = [
  'app/composables/useApi.ts',
  'app/composables/useDeviceRegistration.ts',
  'app/features/alerts/components/alertSeverity.ts',
  'app/features/alerts/lib/alertCatalog.ts',
  'app/features/auth/components/PasswordField.vue',
  'app/features/auth/composables/useFirebaseAuth.ts',
  'app/features/notifications/lib/format.ts',
  'app/features/notifications/lib/notificationMeta.ts',
  'app/features/notifications/services/notificationsService.ts',
  'app/features/notifications/types/index.ts',
  'app/features/overview/services/overviewService.ts',
  'app/features/signalements/reportReasons.ts',
  'app/features/support/lib/constants.ts',
  'app/features/support/lib/supportWorkbench.ts',
  'app/features/support/utils/format.ts',
  'app/layouts/mobile.vue',
  'app/lib/adminLinks.ts',
  'app/lib/deviceId.ts',
  'app/lib/endpointMissing.ts',
  'app/lib/firebaseConfig.ts',
  'app/lib/problemDetail.ts',
  'app/lib/safeInput.ts',
  'app/lib/serverDate.ts',
  'app/lib/violations.ts',
  'app/stores/auth.ts',
  'app/stores/notifications.ts',
]

/** Modules du poste ordinateur qu'aucun module mobile n'importe, même indirectement. */
const DESKTOP_FORBIDDEN = /features\/(users\/services\/usersService|support\/services\/supportService|alerts\/services\/alertsService|alerts\/composables\/useAlerts|broadcast\/|moderation\/(services|components)\/|support\/components\/)/

/**
 * Primitives réseau hors `app/features/mobile/services/**` (commentaires retirés), ligne entière exacte.
 * Exceptions : la définition de `useApi`, les lectures du fil et des compteurs (le store de notifications ;
 * markSeen/markRead existent mais ne sont jamais appelés, voir le test à l'exécution), la vue d'ensemble
 * (GET), et la connexion de l'ordinateur reprise par la page de verrouillage (GET /admin/me, appareil web).
 */
const NET_RE = /\buseApi\s*\(|\$fetch\b|(?<![.\w$])fetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b|\bWebSocket\b|\bEventSource\b/
const NET_ALLOW: Allow[] = [
  { file: 'app/composables/useApi.ts', line: 'export function useApi(): ReturnType<typeof $fetch.create> {' },
  { file: 'app/composables/useApi.ts', line: 'const instance = $fetch.create({' },
  { file: 'app/features/notifications/services/notificationsService.ts', line: "return useApi()<NotificationFeed>('/admin/notifications/feed', { query })" },
  { file: 'app/features/notifications/services/notificationsService.ts', line: "return useApi()<NotificationCounters>('/admin/notifications/counters')" },
  { file: 'app/features/notifications/services/notificationsService.ts', line: "return useApi()<void>('/admin/notifications/mark-seen', { method: 'POST', body: upTo ? { upTo } : {} })" },
  { file: 'app/features/notifications/services/notificationsService.ts', line: "return useApi()<void>(`/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })" },
  { file: 'app/features/overview/services/overviewService.ts', line: 'fetch(period?: OverviewPeriod): Promise<AdminOverview> {' },
  { file: 'app/features/overview/services/overviewService.ts', line: "if (!period) return useApi()<AdminOverview>('/admin/metrics/overview')" },
  { file: 'app/features/overview/services/overviewService.ts', line: "return useApi()<AdminOverview>('/admin/metrics/overview', { query: { period } })" },
  { file: 'app/features/auth/composables/useFirebaseAuth.ts', line: 'const api = useApi()' },
  { file: 'app/composables/useDeviceRegistration.ts', line: 'const api = useApi()' },
]

/** Toutes les écritures (POST/PUT/PATCH/DELETE) du graphe, ligne entière exacte. */
const WRITE_RE = /method:\s*['"](POST|PUT|PATCH|DELETE)['"]/i
const WRITE_ALLOW: Allow[] = [
  { file: 'app/features/mobile/services/mobileAlertsService.ts', line: "return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}/claim`, { method: 'POST' })" },
  { file: 'app/features/mobile/services/mobileAlertsService.ts', line: "return useApi()<AdminAlert>(`/admin/alerts/${encodeURIComponent(id)}/claim`, { method: 'DELETE' })" },
  { file: 'app/features/mobile/services/mobileSupportService.ts', line: "method: 'POST'," },
  { file: 'app/features/mobile/services/mobileSupportService.ts', line: "return useApi()<AdminSupportTicket>(`/admin/support/tickets/${encodeURIComponent(id)}/assign`, { method: 'POST' })" },
  { file: 'app/features/mobile/services/mobileNotifyService.ts', line: "method: 'POST'," },
  { file: 'app/features/mobile/services/mobileService.ts', line: "await useApi()('/admin/mobile/devices', { method: 'POST', body })" },
  { file: 'app/features/mobile/services/mobileService.ts', line: "await useApi()('/admin/mobile/devices', { method: 'DELETE', query: { fcmToken } })" },
  // Définies, jamais appelées depuis le mobile (voir le test à l'exécution) :
  { file: 'app/features/notifications/services/notificationsService.ts', line: "return useApi()<void>('/admin/notifications/mark-seen', { method: 'POST', body: upTo ? { upTo } : {} })" },
  { file: 'app/features/notifications/services/notificationsService.ts', line: "return useApi()<void>(`/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' })" },
  // Connexion de l'ordinateur : enregistrement de la session web (POST /users/me/devices).
  { file: 'app/composables/useDeviceRegistration.ts', line: "method: 'POST'," },
]

describe('mobile network surface: static guard', () => {
  const g = withoutComments(crawl([...PAGES, LAYOUT]))

  it('every file under app/features/mobile, app/pages/m and the layout has an exact, reviewed call surface', () => {
    expect(Object.keys(SURFACE).sort()).toEqual([...SCOPE].sort())
    for (const f of SCOPE) expect(callSurface(read(f)), f).toEqual(SURFACE[f])
  })

  it('the pages reach outside mobile only an explicit list of modules, never a desktop service with writes', () => {
    expect(g.files.filter(f => !isMobileFile(f)).sort()).toEqual(REACHED_OUTSIDE_MOBILE)
    expect(g.files.filter(f => DESKTOP_FORBIDDEN.test(f))).toEqual([])
    // Même un module mobile qu'aucune page n'atteint n'importe pas ces modules.
    const direct = SCOPE.flatMap(f => importsOf(read(f)).filter(s => DESKTOP_FORBIDDEN.test(s)).map(s => `${f}: ${s}`))
    expect(direct).toEqual([])
    expect([...g.autoImports]).toEqual([])
  })

  it('no network primitive (useApi, $fetch, fetch, XHR, beacon, socket) outside app/features/mobile/services, except the listed lines', () => {
    expect(violations(g, NET_RE, NET_ALLOW, f => !f.startsWith('app/features/mobile/services/'))).toEqual([])
  })

  it('every write method of the graph is one of the listed lines', () => {
    expect(violations(g, WRITE_RE, WRITE_ALLOW)).toEqual([])
    expect(violations(g, /\.(post|put|patch)\s*\(/i)).toEqual([])
  })

  it('alerts pages: no resolve, snooze, unsnooze, reopen or resolveMany anywhere in their import graph', () => {
    const a = crawl(['app/pages/m/alertes/index.vue', 'app/pages/m/alertes/[id].vue'])
    expect(a.files).toContain('app/features/mobile/services/mobileAlertsService.ts')
    const names = ['resolve', 'resolveBatch', 'resolveMany', 'snooze', 'unsnooze', 'reopen']
    expect(violations(a, callRe(names), [ALLOW_API_PROMISE_RESOLVE])).toEqual([])
    expect(violations(a, wordRe(names), [], isMobileFile)).toEqual([])
    expect(violations(a, /\b(markRead|markAllSeen|markSeen|loadMore)\b/, [], isMobileFile)).toEqual([])
  })

  it('overview page: no write call anywhere in its import graph', () => {
    const o = crawl(['app/pages/m/ensemble.vue'])
    expect(o.files).toContain('app/features/overview/services/overviewService.ts')
    expect(violations(o, /\.(post|put|patch|delete)\s*\(|method:\s*['"](POST|PUT|PATCH|DELETE)/i, [ALLOW_AUTH_SET_DELETE])).toEqual([])
  })

  it('diffuser page: no group send, audience, recipients export or user write in its import graph', () => {
    const d = crawl(['app/pages/m/diffuser.vue'])
    expect(d.files).toContain('app/features/mobile/services/mobileUsersService.ts')
    expect(d.files.filter(f => /broadcast|users\/services/.test(f))).toEqual([])
    expect(violations(d, /downloadRecipientsCsv|recipients\.csv|broadcast\/(preview|recipients)|serializeRule|segmentId/)).toEqual([])
    expect(violations(d, /\.(put|patch|delete)\s*\(|method:\s*['"](PUT|PATCH|DELETE)/i, [ALLOW_AUTH_SET_DELETE])).toEqual([])
    const writes = ['suspend', 'ban', 'unsuspend', 'deleteUser', 'executeGdprDeletion', 'approveKyc', 'rejectKyc', 'revokeKyc', 'resetKyc', 'grantPro', 'muteMessaging']
    expect(violations(d, wordRe(writes), [], isMobileFile)).toEqual([])
  })

  it('support pages: no resolve, reassign, upload, priority, start, note or template in their import graph', () => {
    const s = crawl(['app/pages/m/support/index.vue', 'app/pages/m/support/[id].vue'])
    expect(s.files).toContain('app/features/mobile/services/mobileSupportService.ts')
    const names = [
      'resolve', 'reassign', 'uploadAttachment', 'setPriority', 'startTicket', 'addNote', 'listTemplates', 'createTemplate', 'updateTemplate',
      'deleteTemplate', 'getContext', 'listByUser',
    ]
    expect(violations(s, callRe(names), [ALLOW_API_PROMISE_RESOLVE])).toEqual([])
    expect(violations(s, wordRe(names), [], isMobileFile)).toEqual([])
    // `assign` (prise en charge d'un billet libre) : seulement le service, son composable et la page du billet.
    const assignFiles = [
      'app/features/mobile/composables/useMobileSupportTicket.ts', 'app/features/mobile/services/mobileSupportService.ts', 'app/pages/m/support/[id].vue',
    ]
    expect(s.files.filter(f => isMobileFile(f) && wordRe(['assign']).test(s.sources.get(f)!) && !assignFiles.includes(f))).toEqual([])
    expect(violations(s, /SupportAttachmentUploader|StartSupportConversation|type="file"|useSupportTickets|support\/components\//)).toEqual([])
  })

  it('messages pages: no delete, restore, note or desktop moderation code in their import graph', () => {
    const m = crawl(['app/pages/m/messages/index.vue', 'app/pages/m/messages/[id].vue'])
    expect(m.files).toContain('app/features/mobile/services/mobileMessagesService.ts')
    expect(violations(m, /deleteMessage|restoreMessage|addNote|moderationService|features\/moderation\/components|features\/moderation\/services/)).toEqual([])
    expect([...m.tags.values()].flat().filter(t => /^Moderation/.test(t))).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------------
// 2. À l'exécution : chaque page montée, `useApi` remplacé par un enregistreur
// ---------------------------------------------------------------------------------------------------

const U = '3f2a9c1e-1111-4222-8333-444455556666'
const T = '9b8c7d6e-2222-4333-8444-555566667777'
const UID = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-11-26T08:00:00'

/** Lectures permises (méthode + chemin, identifiants remplacés). */
const ALLOWED_READS = [
  'GET /admin/alerts',
  'GET /admin/alerts/{uuid}',
  'GET /admin/conversations',
  'GET /admin/conversations/{conversationId}/context',
  'GET /admin/conversations/{conversationId}/messages',
  'GET /admin/metrics/overview',
  'GET /admin/notifications/counters',
  'GET /admin/notifications/feed',
  'GET /admin/support/tickets',
  'GET /admin/support/tickets/{uuid}',
  'GET /admin/users',
  'GET /admin/users/{uuid}',
]
/** Les sept écritures de l'app mobile, et aucune autre. */
const ALLOWED_WRITES = [
  'DELETE /admin/alerts/{uuid}/claim',
  'DELETE /admin/mobile/devices',
  'POST /admin/alerts/{uuid}/claim',
  'POST /admin/mobile/devices',
  'POST /admin/notifications/broadcast',
  'POST /admin/support/tickets/{uuid}/assign',
  'POST /admin/support/tickets/{uuid}/messages',
]
const ALLOWED = new Set([...ALLOWED_READS, ...ALLOWED_WRITES])

const net = vi.hoisted(() => ({
  calls: [] as string[],
  state: { claimed: false, assigned: false },
  // eslint-disable-next-line no-unused-vars
  respond: null as null | ((method: string, url: string, opts: { body?: Record<string, unknown> }) => unknown),
}))
vi.mock('@/composables/useApi', () => ({
  useApi: () => async (url: string, opts: { method?: string; body?: Record<string, unknown> } = {}) => {
    const method = (opts.method ?? 'GET').toUpperCase()
    const path = url
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}')
      .replace(/^\/admin\/conversations\/(?!\{)[^/]+/, '/admin/conversations/{conversationId}')
    net.calls.push(`${method} ${path}`)
    return net.respond!(method, url, opts)
  },
}))
const messaging = vi.hoisted(() => ({ getToken: vi.fn(), deleteToken: vi.fn(), getMessaging: vi.fn(() => ({})) }))
vi.mock('firebase/messaging', () => messaging)
const firebaseAuth = vi.hoisted(() => ({ signIn: vi.fn(), completeTotpSignIn: vi.fn(), cancelTotpSignIn: vi.fn(), signOut: vi.fn() }))
vi.mock('@/features/auth/composables/useFirebaseAuth', () => ({ useFirebaseAuth: () => firebaseAuth }))

const routeState: { path: string; fullPath: string; params: Record<string, unknown>; query: Record<string, unknown>; meta: Record<string, unknown> } = {
  path: '/m/alertes', fullPath: '/m/alertes', params: {}, query: {}, meta: {},
}
vi.stubGlobal('useRoute', () => routeState)
vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/siragbe/' }, public: { firebaseVapidKey: 'VAPID', firebaseAppId: '1:424242:web:abc' } }))
vi.stubGlobal('useNuxtApp', () => ({ $firebaseApp: { name: 'app' }, $firebaseAuth: null, ssrContext: undefined }))
// Téléphone Android qui accepte les notifications : le bouton du layout peut enregistrer puis retirer l'appareil.
const registration = { scope: '/siragbe/m/', active: { state: 'activated' }, pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }
vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission: 'default', requestPermission: vi.fn().mockResolvedValue('granted') }))
vi.stubGlobal('PushManager', class {})
vi.stubGlobal('matchMedia', () => ({ matches: false }))
Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile', configurable: true })
Object.defineProperty(navigator, 'serviceWorker', {
  configurable: true,
  value: { register: vi.fn().mockResolvedValue(registration), getRegistration: vi.fn().mockResolvedValue(registration), addEventListener: vi.fn(), removeEventListener: vi.fn() },
})

import { seedAuth } from '../../../helpers/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { ALERTS_FEED_PERMISSIONS } from '@/features/mobile/lib/mobileAlerts'
import { notificationsService } from '@/features/notifications/services/notificationsService'
import AlertsPage from '@/pages/m/alertes/index.vue'
import AlertPage from '@/pages/m/alertes/[id].vue'
import OverviewPage from '@/pages/m/ensemble.vue'
import SupportListPage from '@/pages/m/support/index.vue'
import SupportPage from '@/pages/m/support/[id].vue'
import MessagesPage from '@/pages/m/messages/index.vue'
import ThreadPage from '@/pages/m/messages/[id].vue'
import DiffuserPage from '@/pages/m/diffuser.vue'
import IndexPage from '@/pages/m/index.vue'
import LockPage from '@/pages/m/verrouille.vue'
import MobileLayout from '@/layouts/mobile.vue'

const page = (content: unknown[]) => ({ content, totalElements: content.length, totalPages: 1, number: 0, size: 20 })
const alert = () => ({
  id: U, type: 'PAYOUT_HELD_x', severity: 'CRITICAL', payload: {}, resolved: false, resolvedAt: null, createdAt: NOW,
  claimedAt: net.state.claimed ? NOW : null, claimedByName: net.state.claimed ? 'admin@yadony.com' : null, claimedById: net.state.claimed ? 'u1' : null,
})
const ticket = () => ({
  id: T, category: 'ACCOUNT', subject: 'Sujet', status: net.state.assigned ? 'ASSIGNED' : 'OPEN', priority: 'NORMAL', userId: 'u9',
  userDisplayName: 'Mariam Traoré', assignedAdminId: net.state.assigned ? 'u1' : null, assignedAdminEmail: null, createdAt: NOW, lastMessageAt: NOW,
  resolvedAt: null, lastMessagePreview: 'Bonjour', lastMessageAuthor: 'USER',
  messages: [{ id: 'm1', authorType: 'USER', content: 'Bonjour', createdAt: NOW }],
})
const user = { id: UID, firstName: 'Aïcha', lastName: 'Traoré', email: 'aicha@example.com', phoneNumber: null, status: 'ACTIVE' }
const feedItems = [
  { id: `DISPUTE_OPENED:${U}`, type: 'DISPUTE_OPENED', title: 'Litige ouvert', summary: 'Colis non reçu', severity: 'WARNING', createdAt: NOW, link: '/litiges' },
  { id: `SUPPORT_MESSAGE_RECEIVED:${UID}`, type: 'SUPPORT_MESSAGE_RECEIVED', title: 'Message', summary: 'Bonjour', severity: 'INFO', createdAt: NOW, link: `/support?ticket=${T}` },
  { id: `ADMIN_ALERT:${U}`, type: 'ADMIN_ALERT', title: 'Alerte', summary: 'Versement retenu', severity: 'CRITICAL', createdAt: NOW, link: '/alertes' },
]

net.respond = (method, url, opts) => {
  const routes: Record<string, () => unknown> = {
    'GET /admin/notifications/counters': () => ({ counts: { alerts: 1, support: 1 }, unreadCount: 3 }),
    'GET /admin/notifications/feed': () => ({ items: feedItems, unreadCount: 3, lastSeenAt: null, readIds: [] }),
    'GET /admin/alerts': () => page([alert()]),
    [`GET /admin/alerts/${U}`]: alert,
    [`POST /admin/alerts/${U}/claim`]: () => { net.state.claimed = true; return alert() },
    [`DELETE /admin/alerts/${U}/claim`]: () => { net.state.claimed = false; return alert() },
    'GET /admin/metrics/overview': () => ({
      bids: { accepted: 2, inTransit: 3 }, queues: { unresolvedAlerts: 1, openDisputes: 0, pendingNoShows: 0, heldPayouts: 0 },
      period: { name: 'D7', signups: 4, deletedAccounts: 1, parcelsCancelled: 0, kycInProgress: 2 },
    }),
    'GET /admin/support/tickets': () => page([ticket()]),
    [`GET /admin/support/tickets/${T}`]: ticket,
    [`POST /admin/support/tickets/${T}/assign`]: () => { net.state.assigned = true; return ticket() },
    [`POST /admin/support/tickets/${T}/messages`]: () => ({ id: 'm2', authorType: 'ADMIN', content: opts.body?.content, createdAt: NOW }),
    'GET /admin/conversations': () => page([{ id: 'conv_1', bidId: null, participantA: 'Aïcha Traoré', participantB: 'Moussa Diallo', lastMessageAt: NOW, messageCount: 2, flagged: true, createdAt: NOW, openReportCount: 1 }]),
    'GET /admin/conversations/conv_1/messages': () => [{ id: 'x1', conversationId: 'conv_1', senderName: 'Aïcha Traoré', content: 'Salut', flagged: false, deleted: false, type: 'TEXT', imageUrl: null, thumbUrl: null, createdAt: NOW }],
    'GET /admin/conversations/conv_1/context': () => ({ history: [], notes: [], reports: [], participants: [] }),
    'GET /admin/users': () => page([user]),
    [`GET /admin/users/${UID}`]: () => ({ ...user }),
    'POST /admin/notifications/broadcast': () => ({ recipientCount: 1 }),
    'POST /admin/mobile/devices': () => undefined,
    'DELETE /admin/mobile/devices': () => undefined,
  }
  const handler = routes[`${method} ${url}`]
  if (!handler) throw Object.assign(new Error(`unexpected ${method} ${url}`), { statusCode: 599 })
  return handler()
}

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" v-bind="$attrs"><slot /></a>' }
const mounted: VueWrapper[] = []
async function show(component: object, route: Partial<typeof routeState> = {}) {
  Object.assign(routeState, { path: '/m', fullPath: '/m', params: {}, query: {}, meta: {} }, route)
  const w = mount(component, { global: { stubs: { NuxtLink } } })
  mounted.push(w)
  await flushPromises()
  return w
}
const seen = new Set<string>()
/** Les appels de ce scénario, dédoublonnés, et l'ensemble de tous les scénarios. */
function take(): string[] {
  const out = [...new Set(net.calls)].sort()
  out.forEach(c => seen.add(c))
  net.calls.length = 0
  return out
}
const outside = (calls: string[]) => calls.filter(c => !ALLOWED.has(c))

describe('mobile network surface: at runtime', () => {
  beforeEach(() => {
    net.calls.length = 0
    net.state.claimed = false
    net.state.assigned = false
    seedAuth('SUPER_ADMIN')
  })
  afterEach(() => {
    while (mounted.length) mounted.pop()!.unmount()
    vi.useRealTimers()
  })

  it('alerts list: opening the feed reads it, never marks anything read or seen (store and service spied)', async () => {
    const store = useNotificationsStore()
    const spies = [vi.spyOn(store, 'markRead'), vi.spyOn(store, 'markAllSeen'), vi.spyOn(store, 'loadMore'),
      vi.spyOn(notificationsService, 'markRead'), vi.spyOn(notificationsService, 'markSeen')]
    let w = await show(AlertsPage, { path: '/m/alertes' })
    for (const chip of w.findAll('[data-test="alert-chip"]')) { await chip.trigger('click'); await flushPromises() }
    for (const a of w.findAll('a')) { await a.trigger('click'); await flushPromises() }
    w = await show(AlertsPage, { path: '/m/alertes', query: { item: `DISPUTE_OPENED:${U}` } })
    expect(w.find('[data-test="item-detail"]').text()).toContain('Colis non reçu')
    const calls = take()
    expect(calls).toEqual(['GET /admin/alerts', 'GET /admin/notifications/feed'])
    for (const s of spies) expect(s).not.toHaveBeenCalled()
  })

  it('alerts list without ALERT_VIEW (disputes only): the feed read alone', async () => {
    seedAuth('ADMIN', { ...Object.fromEntries(ALERTS_FEED_PERMISSIONS.map(p => [p, false])), DISPUTE_VIEW: true })
    await show(AlertsPage, { path: '/m/alertes', query: { item: `DISPUTE_OPENED:${U}` } })
    expect(take()).toEqual(['GET /admin/notifications/feed'])
  })

  it('alert detail: read, claim (POST) and release (DELETE) only', async () => {
    const w = await show(AlertPage, { path: `/m/alertes/${U}`, params: { id: U } })
    await w.find('[data-test="claim-button"]').trigger('click'); await flushPromises()
    await w.find('[data-test="release-button"]').trigger('click'); await flushPromises()
    for (const b of w.findAll('button')) { await b.trigger('click'); await flushPromises() }
    const calls = take()
    expect(outside(calls)).toEqual([])
    expect(calls).toEqual(['DELETE /admin/alerts/{uuid}/claim', 'GET /admin/alerts/{uuid}', 'POST /admin/alerts/{uuid}/claim'])
  })

  it('overview: one read per period, nothing else', async () => {
    const w = await show(OverviewPage, { path: '/m/ensemble' })
    for (const chip of w.findAll('[data-test="period-chip"]')) { await chip.trigger('click'); await flushPromises() }
    expect(take()).toEqual(['GET /admin/metrics/overview'])
  })

  it('support: list, read, assign (POST) and reply (POST) only', async () => {
    const list = await show(SupportListPage, { path: '/m/support' })
    for (const chip of list.findAll('[data-test="support-chip"]')) { await chip.trigger('click'); await flushPromises() }
    const w = await show(SupportPage, { path: `/m/support/${T}`, params: { id: T } })
    await w.find('[data-test="assign-button"]').trigger('click'); await flushPromises()
    await w.find('[data-test="reply-input"]').setValue('Je regarde')
    await w.find('[data-test="reply-form"]').trigger('submit'); await flushPromises()
    const calls = take()
    expect(outside(calls)).toEqual([])
    expect(calls).toEqual([
      'GET /admin/support/tickets', 'GET /admin/support/tickets/{uuid}', 'POST /admin/support/tickets/{uuid}/assign',
      'POST /admin/support/tickets/{uuid}/messages',
    ])
  })

  it('messages: list, search, thread and context reads only', async () => {
    vi.useFakeTimers()
    const list = await show(MessagesPage, { path: '/m/messages' })
    await list.find('[data-chip="ALL"]').trigger('click'); await flushPromises()
    await list.find('[data-test="messages-search"]').setValue('Aïcha')
    vi.advanceTimersByTime(400); await flushPromises()
    vi.useRealTimers()
    await show(ThreadPage, { path: '/m/messages/conv_1', params: { id: 'conv_1' } })
    expect(take()).toEqual(['GET /admin/conversations', 'GET /admin/conversations/{conversationId}/context', 'GET /admin/conversations/{conversationId}/messages'])
  })

  it('diffuser: user reads (search, pasted id) and one notify-one POST only', async () => {
    vi.useFakeTimers()
    const w = await show(DiffuserPage, { path: '/m/diffuser' })
    await w.find('[data-test="notify-search"]').setValue(UID); await flushPromises()
    await w.find('[data-test="notify-change"]').trigger('click')
    await w.find('[data-test="notify-search"]').setValue('Aïcha')
    vi.advanceTimersByTime(400); await flushPromises()
    await w.find('[data-test="notify-result"]').trigger('click'); await flushPromises()
    await w.find('[data-test="notify-title"]').setValue('Titre')
    await w.find('[data-test="notify-body"]').setValue('Message')
    await w.find('[data-test="notify-review"]').trigger('click')
    await w.find('[data-test="notify-confirm-send"]').trigger('click'); await flushPromises()
    expect(w.find('[data-test="notify-sent"]').exists()).toBe(true)
    expect(take()).toEqual(['GET /admin/users', 'GET /admin/users/{uuid}', 'POST /admin/notifications/broadcast'])
  })

  it('layout: counters read, push on (device POST) and off (device DELETE) only', async () => {
    messaging.getToken.mockResolvedValue('tok-1')
    const w = await show(MobileLayout, { path: '/m/alertes' })
    await w.find('[data-test="push-enable"]').trigger('click'); await flushPromises()
    await w.find('[data-test="push-disable"]').trigger('click'); await flushPromises()
    expect(take()).toEqual(['DELETE /admin/mobile/devices', 'GET /admin/notifications/counters', 'POST /admin/mobile/devices'])
  })

  it('entry and lock pages: no request of their own (the sign-in is the desktop one, listed in the static guard)', async () => {
    await show(IndexPage, { path: '/m' })
    firebaseAuth.signIn.mockResolvedValue({ mustChangePassword: false })
    const w = await show(LockPage, { path: '/m/verrouille' })
    await w.find('input#email').setValue('admin@yadony.com')
    await w.find('input#password').setValue('secret')
    await w.find('form').trigger('submit'); await flushPromises()
    expect(firebaseAuth.signIn).toHaveBeenCalled()
    expect(take()).toEqual([])
  })

  // Dernier test du bloc (ordre séquentiel) : chaque lecture et chaque écriture permise a été vue au moins une fois.
  it('across all pages: nothing outside the list, and every listed read and write was exercised', () => {
    expect([...seen].filter(c => !ALLOWED.has(c))).toEqual([])
    expect([...seen].filter(c => !c.startsWith('GET ')).sort()).toEqual(ALLOWED_WRITES)
    expect([...seen].filter(c => c.startsWith('GET ')).sort()).toEqual(ALLOWED_READS)
  })
})
