export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL'
export type ResolvedFilter = 'ALL' | 'OPEN' | 'RESOLVED'

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
