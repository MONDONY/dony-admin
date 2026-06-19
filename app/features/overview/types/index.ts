export interface AdminOverview {
  users: {
    total: number; active: number; suspended: number; banned: number; pendingDeletion: number
    kycVerified: number; kycPending: number; pro: number; newLast7d: number; newLast30d: number
  }
  trips: { active: number; inProgress: number; completed: number; cancelled: number }
  bids: { pending: number; accepted: number; inTransit: number; completed: number; cancelled: number; total: number }
  gmv: { escrowHeldCents: number; releasedCents: number; refundedCents: number; commissionCents: number }
  queues: { openDisputes: number; pendingNoShows: number; unresolvedAlerts: number; pendingKyc: number; escrowJ48: number }
}
