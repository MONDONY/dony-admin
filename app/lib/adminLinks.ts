import { firestoreIdParam, uuidParam } from '@/lib/safeInput'
import type { AdminPermission } from '@/stores/auth'

/**
 * Registre unique des URL internes de l'admin. Chaque constructeur est pur et renvoie une route
 * `{ path, query }` (ou `null` si l'identifiant manque ou n'est pas un UUID) : jamais de
 * « undefined » dans une URL, jamais de segment venu d'ailleurs. La permission de la destination
 * se pose avec `gate`, la sérialisation (tests, liens hors NuxtLink) avec `toHref`.
 */
export interface AdminRoute { path: string; query?: Record<string, string> }
// eslint-disable-next-line no-unused-vars
export type CanFn = (permission: AdminPermission) => boolean
// eslint-disable-next-line no-unused-vars
type IdCheck = (value: unknown) => string | null

export type UserTab = 'overview' | 'parcels' | 'money' | 'incidents' | 'identity' | 'support' | 'manage'
export type BidSection = 'tracking' | 'money' | 'chat' | 'incidents'
export type PaymentSection = 'incidents' | 'money' | 'timeline' | 'references'
export type TransactionsView = 'ATTENTION' | 'ESCROW' | 'RELEASED_RECENT' | 'REFUNDED' | 'FAILED' | 'ALL'
export type TransactionsAlert = 'HELD' | 'CHARGEBACK_OPEN' | 'MM_FAILED' | 'ESCROW_J48'

/** Même contrat pour les deux jeux : seule la vérification d'identifiant change. */
function makeRoutes(check: IdCheck) {
  // eslint-disable-next-line no-unused-vars
  const withId = (id: unknown, build: (id: string) => AdminRoute): AdminRoute | null => {
    const ok = check(id)
    return ok ? build(ok) : null
  }
  return {
    userRoute: (id: unknown, tab?: UserTab) =>
      withId(id, i => (tab ? { path: `/users/${i}`, query: { tab } } : { path: `/users/${i}` })),
    /** Ancienne forme `/users?query=&open=` (redirigée vers la fiche), gardée là où elle est émise. */
    userLegacyRoute: (id: unknown) => withId(id, i => ({ path: '/users', query: { query: i, open: i } })),
    supportOfRoute: (userId: unknown) => withId(userId, i => ({ path: '/support', query: { userId: i } })),
    supportTicketRoute: (ticketId: unknown) => withId(ticketId, i => ({ path: '/support', query: { ticket: i } })),
    bidRoute: (id: unknown, section?: BidSection) =>
      withId(id, (i) => {
        const query: Record<string, string> = { open: i }
        if (section) query.section = section
        return { path: '/colis', query }
      }),
    tripRoute: (announcementId: unknown) =>
      withId(announcementId, i => ({ path: '/colis', query: { tab: 'announcements', announcement: i } })),
    tripBidsRoute: (announcementId: unknown) =>
      withId(announcementId, i => ({ path: '/colis', query: { announcementId: i } })),
    packageRequestRoute: (id: unknown) => withId(id, i => ({ path: '/colis', query: { tab: 'demandes', open: i } })),
    disputeRoute: (id: unknown) => withId(id, i => ({ path: '/incidents', query: { open: i } })),
    noShowRoute: (cancellationId: unknown) =>
      withId(cancellationId, i => ({ path: '/incidents', query: { tab: 'noshows', open: i } })),
    alertRoute: (id: unknown) => withId(id, i => ({ path: '/alertes', query: { open: i } })),
    auditRoute: (entityType: string, entityId: unknown) =>
      withId(entityId, i => ({ path: '/audit', query: { entityType, entityId: i } })),
    reportRoute: (id: unknown) => withId(id, i => ({ path: '/signalements', query: { open: i } })),
    paymentRoute: (id: unknown, section?: PaymentSection) =>
      withId(id, (i) => {
        const query: Record<string, string> = { open: i }
        if (section) query.section = section
        return { path: '/transactions', query }
      }),
    paymentsOfTripRoute: (announcementId: unknown) =>
      withId(announcementId, i => ({ path: '/transactions', query: { announcementId: i } })),
    paymentsOfPartyRoute: (userId: unknown) =>
      withId(userId, i => ({ path: '/transactions', query: { partyId: i } })),
    paymentsOfBidRoute: (bidId: unknown) =>
      withId(bidId, i => ({ path: '/transactions', query: { bidId: i, view: 'ALL' } })),
    chargebackRoute: (id: unknown) =>
      withId(id, i => ({ path: '/transactions', query: { tab: 'chargebacks', open: i } })),
    walletRefundRoute: (id: unknown) =>
      withId(id, i => ({ path: '/transactions', query: { tab: 'wallet-refunds', open: i } })),
    walletsOfPartyRoute: (userId: unknown) =>
      withId(userId, i => ({ path: '/transactions', query: { tab: 'wallets', partyId: i } })),
  }
}

/** Constructeurs stricts : identifiant UUID obligatoire. À utiliser pour tout nouveau code. */
export const {
  userRoute, userLegacyRoute, supportOfRoute, supportTicketRoute, bidRoute, tripRoute, tripBidsRoute,
  packageRequestRoute, disputeRoute, noShowRoute, alertRoute, auditRoute, reportRoute, paymentRoute,
  paymentsOfTripRoute, paymentsOfPartyRoute, paymentsOfBidRoute, chargebackRoute, walletRefundRoute,
  walletsOfPartyRoute,
} = makeRoutes(uuidParam)

/** Conversation de modération : identifiant Firestore, pas un UUID. */
export const conversationRoute = (firestoreId: unknown): AdminRoute | null => {
  const id = firestoreIdParam(firestoreId)
  return id ? { path: '/moderation', query: { open: id } } : null
}

const nonEmpty: IdCheck = value => (typeof value === 'string' && value ? value : null)
/**
 * Même forme, sans contrôle d'UUID (seulement non vide) : migration à l'identique des appels
 * qui recevaient déjà un identifiant typé du back sans le valider.
 * @deprecated Migration seulement : réservé aux fichiers déjà migrés (liste blanche de
 * `tests/unit/lib/adminLinksGuard.spec.ts`). Tout nouveau code utilise les constructeurs stricts.
 */
export const unchecked = makeRoutes(nonEmpty)

export function transactionsViewRoute(opts: { view?: TransactionsView; alert?: TransactionsAlert; tab?: string } = {}): AdminRoute {
  const query: Record<string, string> = {}
  if (opts.tab) query.tab = opts.tab
  if (opts.view) query.view = opts.view
  if (opts.alert) query.alert = opts.alert
  return Object.keys(query).length ? { path: '/transactions', query } : { path: '/transactions' }
}

/**
 * Mobile money, vue Échecs. `view` en minuscules : c'est la forme que la section écrit elle-même
 * (`writeMobileMoneyQuery`), le lien n'est donc pas réécrit à l'arrivée.
 */
export const mobileMoneyFailedRoute = (): AdminRoute => ({ path: '/transactions', query: { tab: 'mobile-money', view: 'failed' } })

/**
 * Mobile money, vue En cours (même forme en minuscules). Cible des alertes qui désignent une
 * opération encore en attente (INV-11 « en attente depuis plus d'une heure », MM_PAYOUT_ORPHAN_*
 * « versement repris à surveiller ») : elle n'est pas en échec, la vue Échecs ne la montrerait pas.
 */
export const mobileMoneyOpenRoute = (): AdminRoute => ({ path: '/transactions', query: { tab: 'mobile-money', view: 'open' } })

/** Versements retenus : alias historique `?held=true`. */
export const heldPayoutsRoute = (): AdminRoute => ({ path: '/transactions', query: { held: 'true' } })

/** Pages de liste sans paramètre. */
export const incidentsListRoute = (): AdminRoute => ({ path: '/incidents' })
export const alertsListRoute = (): AdminRoute => ({ path: '/alertes' })

/** La route si la permission de sa destination est détenue, sinon `null` (texte, pas de lien). */
export function gate(can: CanFn, permission: AdminPermission, route: AdminRoute | null): AdminRoute | null {
  return route && can(permission) ? route : null
}

/** `/chemin?cle=valeur&…`, valeurs encodées. */
export function toHref(route: AdminRoute): string {
  const entries = Object.entries(route.query ?? {})
  if (!entries.length) return route.path
  return `${route.path}?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
}
