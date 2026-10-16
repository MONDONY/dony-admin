/** Compte autorisé à utiliser l'application pendant la maintenance. */
export interface MaintenanceExemption {
  userId: string
  displayName: string | null
  note: string | null
  /** ISO 8601 UTC (suffixe Z). */
  createdAt: string
  createdByEmail: string | null
}

/** GET /admin/maintenance : dates en ISO 8601 UTC (suffixe Z). */
export interface MaintenanceState {
  enabled: boolean
  message: string | null
  estimatedEndAt: string | null
  startedAt: string | null
  updatedAt: string | null
  updatedByEmail: string | null
  exemptions: MaintenanceExemption[]
}

export interface MaintenanceUpdate {
  enabled: boolean
  message: string | null
  estimatedEndAt: string | null
}
