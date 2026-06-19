export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_DELETION'
export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
export type UserStatusFilter = 'TOUS' | UserStatus

export interface AdminUserListItem {
  id: string
  firstName: string | null
  lastName: string | null
  phoneNumber: string
  city: string | null
  country: string | null
  status: UserStatus
  kycStatus: KycStatus
  isProAccount: boolean
  averageRating: number | null
  totalTrips: number
  totalShipments: number
  createdAt: string
}

export interface AdminUserDetail extends AdminUserListItem {
  email: string | null
  roles: string[]
  stripeAccountStatus: string | null
  commissionRateOverride: number | null
  publishingSuspended: boolean
  kiloPro: boolean
  cancellationCount: number
  noShowCount: number
  refusedCount: number
  senderHandoverIncidentCount: number
  ratingCount: number
  deletionRequestedAt: string | null
}

export interface AdminUserPage {
  content: AdminUserListItem[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface UsersFilterState {
  status: UserStatusFilter
  role: string | null
  kyc: string | null
  pro: boolean | null
  city: string | null
  query: string
}
