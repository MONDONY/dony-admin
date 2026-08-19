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
  messagingMutedUntil: string | null
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

/** Miroir de com.yadony.api.kyc.KycVerificationStatus (table kyc_schema.kyc_verifications). */
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

/**
 * Vue KYC admin. Les deux statuts sont maintenus en parallèle côté back :
 * `kycStatus` sur public.users, `verificationStatus` sur kyc_schema.
 * `'NOT_STARTED'` en `verificationStatus` signifie « aucune ligne KYC ».
 *
 * Il n'existe ni document ni historique de session : Stripe détient les pièces, et une
 * seule ligne par utilisateur est conservée (contrainte uq_kyc_user_id).
 */
export interface AdminKycDetail {
  userId: string
  kycStatus: KycStatus
  verificationStatus: KycVerificationStatus | 'NOT_STARTED'
  rejectionReason: string | null
  rejectionCode: string | null
  stripeSessionId: string | null
  stripeStatus: string | null
  stripeLastErrorCode: string | null
  stripeLastErrorReason: string | null
  stripeCreatedAt: string | null
  /** true uniquement si l'appel Stripe a échoué — pas quand il n'y a aucune session. */
  stripeUnavailable: boolean
}

/** Une ligne de la file des demandes de suppression RGPD. */
export interface AdminGdprRequest {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  status: UserStatus
  deletionRequestedAt: string
  ageDays: number
}

export interface AdminGdprRequestPage {
  content: AdminGdprRequest[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}
