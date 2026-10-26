export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL'
/** `OPEN` = à traiter (hors reportées) ; `SNOOZED` = ouvertes mais reportées. */
export type ResolvedFilter = 'ALL' | 'OPEN' | 'SNOOZED' | 'RESOLVED'

export interface AdminAlert {
  id: string
  type: string
  severity: AlertSeverity
  /** Phrase de l'incident, absente des alertes levées avant le back V290. */
  detail?: string | null
  payload: Record<string, unknown>
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
  /**
   * Paiement visé par l'alerte (back #487) : `payload.paymentId`, sinon l'identifiant en suffixe
   * du type. Absent d'un ancien back, null si l'alerte ne vise pas un paiement.
   */
  paymentId?: string | null
  /** Reportée jusqu'à cette date (back #657) : cachée de la file « ouvertes ». Absente d'un ancien back. */
  snoozedUntil?: string | null
}

export interface AdminAlertPage {
  content: AdminAlert[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface AlertsFilterState {
  type: string | null
  severity: AlertSeverity | null
  resolved: ResolvedFilter
}

/** Lignes actuellement en faute d'une règle de cohérence de l'argent (MONEY_INVARIANT_*). */
export interface AlertViolations {
  invariant: string
  title: string
  severity: string
  total: number
  rows: Record<string, unknown>[]
}

/** Geste tracé sur une alerte dans l'audit (résolution, réouverture, report). */
export interface AlertHistoryEntry {
  action: string
  detail?: string | null
  at?: string | null
  actorEmail?: string | null
  note?: string | null
}

export interface RelatedAlert {
  id: string
  type: string
  severity: AlertSeverity
  resolved: boolean
  createdAt: string
  resolvedAt?: string | null
}

/** Contexte d'une alerte (back #657) : autres alertes sur le même paiement ou colis, et historique. */
export interface AlertContext {
  related: RelatedAlert[]
  history: AlertHistoryEntry[]
}

/** Résultat d'une résolution groupée : chaque identifiant demandé est dans une liste. */
export interface AlertBatchResult {
  resolved: string[]
  alreadyResolved: string[]
  notFound: string[]
}
