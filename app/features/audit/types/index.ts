export interface AdminAuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  actorId: string | null
  actorName: string | null
  ipAddress: string | null
  payload: Record<string, unknown> | null
  createdAt: string
}

export interface AdminAuditPage {
  content: AdminAuditEntry[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface AuditFilterState {
  action: string | null
  entityType: string | null
  actorId: string | null
  from: string | null
  to: string | null
}
