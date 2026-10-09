import type { KycDecisionFields } from '@/features/kyc/types/index'

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_DELETION'
export type KycStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'REJECTED'
export type UserStatusFilter = 'TOUS' | UserStatus

export interface AdminUserListItem {
  id: string
  firstName: string | null
  lastName: string | null
  phoneNumber: string
  email: string | null
  city: string | null
  country: string | null
  status: UserStatus
  kycStatus: KycStatus
  isProAccount: boolean
  averageRating: number | null
  totalTrips: number
  totalShipments: number
  createdAt: string
  /** Compte testeur du mode recette (yadony-back#465) : absent d'un back plus ancien. */
  recetteTester?: boolean
}

/**
 * État d'abonnement PRO tel que l'administration le voit.
 *
 * Miroir de `com.yadony.api.billing.dto.AdminProSubscriptionView`. `source`
 * distingue les trois origines du droit : `STRIPE` (payant), `ADMIN_GRANT`
 * (offert) et `LEGACY_FREE` (grâce historique). Seul un accès `ADMIN_GRANT`
 * peut être révoqué depuis cette interface : révoquer un abonnement payant se
 * fait dans Stripe, pas ici.
 */
export interface AdminProSubscription {
  status: string
  source: 'STRIPE' | 'ADMIN_GRANT' | 'LEGACY_FREE'
  billingCycle: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  graceExpiresAt: string | null
  stripeSubscriptionId: string | null
  grantedByAdminId: string | null
  adminGrantReason: string | null
  grantedAt: string | null
}

export interface AdminUserDetail extends AdminUserListItem {
  /** UID Firebase du compte (sensible à la casse) : absent d'un back qui ne l'expose pas encore. */
  firebaseUid?: string | null
  proSubscription: AdminProSubscription | null
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
  /** Date d'exécution prévue d'une suppression demandée (nouveau back, NON_NULL). */
  deletionScheduledFor?: string | null
  messagingMutedUntil: string | null
  /** Compte de versement mobile money (pawaPay) : absent d'un backend pas encore déployé. */
  mobileMoneyStatus?: string | null
  mobileMoneyProvider?: string | null
  mobileMoneyCurrency?: string | null
  mobileMoneyCountry?: string | null
  mobileMoneyMsisdnMasked?: string | null
  /**
   * Versements retenus d'un voyageur banni ou dont l'identité est révoquée (nouveau back,
   * NON_NULL) : absents d'un ancien back, et alors aucun bandeau ne s'affiche.
   */
  payoutsHeldSince?: string | null
  /** Motif principal ; `payoutsHeldReasons` les donne tous (banni ET identité révoquée possible). */
  payoutsHeldReason?: 'BANNED' | 'KYC_REVOKED' | null
  /** Toujours présent avec le nouveau back, vide quand le compte n'est plus gelé. */
  payoutsHeldReasons?: ('BANNED' | 'KYC_REVOKED')[]
  /** Reste > 0 après la levée du gel tant que les paiements ne sont pas débloqués un par un. */
  heldPaymentsCount?: number | null
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
  /** Filtre « testeurs recette » (yadony-back#465) ; null ou absent = tous. */
  recetteTester?: boolean | null
}

/** Miroir de com.yadony.api.kyc.KycVerificationStatus (table kyc_schema.kyc_verifications). */
export type KycVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

/**
 * Vue KYC admin. Les deux statuts sont maintenus en parallèle côté back :
 * `kycStatus` sur public.users, `verificationStatus` sur kyc_schema.
 * `'NOT_STARTED'` en `verificationStatus` signifie « aucune ligne KYC ».
 *
 * Les champs `stripe*` décrivent en réalité la session du fournisseur courant (`provider`,
 * Didit ou Stripe Identity) : le back garde ces noms jusqu'au retrait de Stripe Identity.
 * Backend en NON_NULL : un champ nul est absent du JSON, d'où les champs optionnels.
 * La décision admin et l'historique (`KycDecisionFields`) n'existent qu'avec le nouveau back.
 */
export interface AdminKycDetail extends KycDecisionFields {
  userId: string
  kycStatus: KycStatus | string
  verificationStatus: KycVerificationStatus | 'NOT_STARTED' | string
  rejectionReason?: string | null
  rejectionCode?: string | null
  stripeSessionId?: string | null
  stripeStatus?: string | null
  stripeLastErrorCode?: string | null
  stripeLastErrorReason?: string | null
  stripeCreatedAt?: string | null
  /** true uniquement si l'appel au fournisseur a échoué, pas quand il n'y a aucune session. */
  stripeUnavailable?: boolean
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

/** Miroir de com.yadony.api.common.deletion.ImpactSeverity. */
export type ImpactSeverity = 'BLOCKING' | 'WARNING' | 'INFO'

/** Un compte tiers touché par la suppression, avec l'objet qui les relie. */
export interface ImpactParty {
  userId: string
  displayName: string
  relatedEntityId: string
}

/**
 * Un constat d'impact. `code` est stable et traduit côté front : le back n'envoie pas de
 * libellé, pour qu'ajouter un contributeur ne demande pas de redéployer le back pour un texte.
 */
export interface ImpactFinding {
  severity: ImpactSeverity
  code: string
  count: number
  parties: ImpactParty[]
}

export interface DeletionImpact {
  /** Vrai dès qu'un constat BLOCKING est présent : la confirmation ne doit alors pas s'afficher. */
  blocked: boolean
  findings: ImpactFinding[]
}

export type AdminDeletionReasonCode =
  | 'FRAUD' | 'ABUSE' | 'TEST_ACCOUNT' | 'DUPLICATE' | 'USER_REQUEST_OFFLINE' | 'OTHER'

/**
 * Compte testeur du mode recette (yadony-back#449, FLUTTER-FA / FLUTTER-FB).
 * `recetteModeActive` = mode ouvert dans l'environnement ET compte testeur : il est donc faux
 * pour un compte non testeur même en staging, et ne suffit pas seul à reconnaître la prod.
 */
/** `GET /admin/recette/status` : le mode recette est-il ouvert dans cet environnement ? */
export interface RecetteModeStatus {
  enabled: boolean
}

/** Réponse de `PUT /admin/users/recette-tester` (en masse). */
export interface RecetteBulkResult {
  updated: number
  unchanged: number
  notFound: string[]
}

export interface RecetteTesterStatus {
  userId: string
  recetteTester: boolean
  recetteModeActive: boolean
}
