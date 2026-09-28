/**
 * Contrat de GET /admin/notifications/* (dony-back feature/admin-notifications-cloche).
 * Le back filtre déjà selon les permissions de l'admin connecté : une clé de compteur absente
 * veut dire « pas la permission », jamais « zéro ».
 */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type KnownNotificationType =
  | 'REPORT_CREATED'
  | 'SUPPORT_TICKET_CREATED'
  | 'SUPPORT_MESSAGE_RECEIVED'
  | 'DISPUTE_OPENED'
  | 'NOSHOW_PENDING'
  | 'KYC_IN_REVIEW'
  | 'PAYOUT_HELD'
  | 'WALLET_REFUND_REQUESTED'
  | 'GDPR_REQUESTED'
  | 'ADMIN_ALERT'

export interface AdminNotification {
  id: string
  /** Un type inconnu (back plus récent que le front) garde une icône générique. */
  type: KnownNotificationType | (string & {})
  title: string
  summary: string
  severity: NotificationSeverity | (string & {})
  createdAt: string
  /** Route interne de l'admin, ex. `/kyc?status=IN_REVIEW&open=<id>`. */
  link: string | null
}

export interface NotificationFeed {
  items: AdminNotification[]
  unreadCount: number
  unreadCapped?: boolean
  lastSeenAt: string | null
}

export const COUNTER_KEYS = [
  'reports', 'support', 'incidents', 'kyc', 'heldPayouts', 'walletRefunds', 'gdpr', 'alerts',
] as const
export type CounterKey = (typeof COUNTER_KEYS)[number]
export type NotificationCounts = Partial<Record<CounterKey, number>>

export interface NotificationCounters {
  counts: NotificationCounts
  unreadCount: number
  unreadCapped?: boolean
}
