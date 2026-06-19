export type AlertSeverity = 'INFO' | 'WARN' | 'CRITICAL'
export type ResolvedFilter = 'ALL' | 'OPEN' | 'RESOLVED'

export interface AdminAlert {
  id: string
  type: string
  severity: AlertSeverity
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
