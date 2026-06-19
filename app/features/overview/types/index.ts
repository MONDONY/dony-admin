export interface AdminOverview {
  users: {
    total: number; active: number; suspended: number; banned: number; pendingDeletion: number
    kycVerified: number; kycPending: number; pro: number; newLast7d: number; newLast30d: number
  }
  announcements: { active: number; full: number; inProgress: number; completed: number; cancelled: number }
  bids: { pending: number; accepted: number; inTransit: number; completed: number; cancelled: number; total: number }
  gmv: { escrowHeld: number; released: number; refunded: number; commission: number }
  queues: { openDisputes: number; pendingNoShows: number; unresolvedAlerts: number; pendingKyc: number; escrowJ48: number }
}
