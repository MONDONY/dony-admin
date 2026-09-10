/** Volumes d'une devise, en centièmes de l'unité principale : un EUR et un XOF ne s'additionnent jamais. */
export interface AdminOverviewVolume {
  currency: string
  escrowHeldCents: number
  releasedCents: number
  refundedCents: number
  commissionCents: number
}

export interface AdminOverview {
  users: {
    total: number; active: number; suspended: number; banned: number; pendingDeletion: number
    kycVerified: number; kycPending: number; pro: number; newLast7d: number; newLast30d: number
  }
  announcements: { active: number; full: number; inProgress: number; completed: number; cancelled: number }
  bids: { pending: number; accepted: number; inTransit: number; completed: number; cancelled: number; total: number }
  /** Ancien contrat (ligne EUR seule, en unités) : plus lu ici, gardé pour les back-offices antérieurs. */
  gmv: { escrowHeld: number; released: number; refunded: number; commission: number }
  /** Absent d'un backend pas encore mis à jour : la section reste vide plutôt que fausse. */
  gmvByCurrency?: AdminOverviewVolume[]
  queues: { openDisputes: number; pendingNoShows: number; unresolvedAlerts: number; pendingKyc: number; escrowJ48: number }
}
