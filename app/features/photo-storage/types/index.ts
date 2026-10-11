export interface PhotoPurgeRun {
  kind: 'PURGE' | 'RECONCILE'
  dryRun: boolean
  triggerSource: 'SCHEDULE' | 'ADMIN'
  /** LocalDateTime UTC sans fuseau. */
  startedAt: string
  finishedAt: string | null
  eligible: number
  deleted: number
  failed: number
  error: string | null
}

export interface PhotoStorageStatus {
  purgeEnabled: boolean
  retentionDays: number
  running: boolean
  lastPurges: PhotoPurgeRun[]
  lastReconciles: PhotoPurgeRun[]
  uploads24h: number
  bytes24h: number
  uploads7d: number
  bytes7d: number
}
