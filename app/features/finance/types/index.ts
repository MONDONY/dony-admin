export interface AdminWallet {
  id: string
  userId: string
  balanceCents: number
  currency: string
  updatedAt: string
}
export interface AdminWalletPage { content: AdminWallet[]; totalElements: number; totalPages: number; number: number; size: number }

/**
 * Statuts d'une OPÉRATION pawaPay (`pawapay_operations.status`). L'ancien jeu
 * (`PENDING | COMPLETED | FAILED | EXPIRED`) datait des stubs Wave/Orange Money supprimés
 * depuis : il ne correspondait plus à rien de ce que le backend envoie.
 */
export type MobileMoneyOperationStatus =
  | 'CREATED' | 'ACCEPTED' | 'PROCESSING' | 'ENQUEUED'
  | 'IN_RECONCILIATION' | 'COMPLETED' | 'FAILED' | 'SUBMIT_REJECTED'

/** Sens du mouvement, côté yadony : encaissement, versement au voyageur, remboursement. */
export type MobileMoneyOperationKind = 'DEPOSIT' | 'PAYOUT' | 'REFUND'

/**
 * Une opération pawaPay. Le backend rend `paymentId` et `kind` : il n'y a plus de `bidId`
 * (une opération est rattachée au paiement, pas à la demande) ni d'opérateur en deux valeurs
 * — `provider` porte l'opérateur ET le pays (`ORANGE_CIV`, `WAVE_SEN`…).
 */
export interface AdminMobileMoneyPayment {
  id: string
  /** Absent tant que l'opération n'est rattachée à aucun paiement (cas rare, alerte admin). */
  paymentId: string | null
  kind: MobileMoneyOperationKind
  provider: string
  countryCode: string
  /**
   * Déjà masqué par le back : seuls les 4 derniers chiffres arrivent jusqu'ici, le numéro
   * complet ne quitte jamais le serveur. `maskPhoneNumber` reste appliqué en second rideau —
   * la fonction est idempotente, les deux protections se cumulent sans se contredire.
   */
  phoneNumber: string
  amountCents: number
  currency: string
  status: MobileMoneyOperationStatus
  /** Motif d'échec renvoyé par l'opérateur, absent quand l'opération n'a pas échoué. */
  failureCode?: string | null
  createdAt: string
}

/**
 * Commissions yadony du rail mobile money, par devise.
 *
 * La commission n'est versée nulle part : c'est la part de l'encaissement qui ne repart pas
 * au voyageur et qui reste sur le solde pawaPay de yadony. « Acquise » = le voyageur a été
 * versé (livraison confirmée) ; « en séquestre » = l'expéditeur a payé mais la livraison
 * n'est pas confirmée, donc la commission reste conditionnelle.
 */
export interface AdminMobileMoneyCurrencyTotals {
  currency: string
  earnedCount: number
  earnedGrossCents: number
  earnedCommissionCents: number
  earnedNetCents: number
  escrowedCount: number
  escrowedGrossCents: number
  escrowedCommissionCents: number
  refundedCount: number
  refundedCommissionCents: number
}

/** @property month mois de création des paiements, au format `YYYY-MM`. */
export interface AdminMobileMoneyMonthlyTotals {
  month: string
  currency: string
  count: number
  grossCents: number
  commissionCents: number
  netCents: number
}

export interface AdminMobileMoneyCommissions {
  from: string
  to: string
  byCurrency: AdminMobileMoneyCurrencyTotals[]
  monthly: AdminMobileMoneyMonthlyTotals[]
}
export interface AdminMobileMoneyPage { content: AdminMobileMoneyPayment[]; totalElements: number; totalPages: number; number: number; size: number }

export type CashCommissionStatus = 'PENDING' | 'REQUIRES_3DS' | 'CHARGED' | 'FAILED' | 'REFUNDED' | 'REFUND_FAILED'
export type CashCommissionChargedVia = 'WALLET' | 'CARD'

/**
 * Pas d'entité dédiée côté back : ce sont des colonnes portées par les demandes
 * (`BidEntity` — `commission_status`, `commission_charged_via`, `commission_retry_count`).
 * La vue se construit donc sur les demandes réglées en espèces, pas sur une table dédiée.
 */
export interface AdminCashCommission {
  bidId: string
  /** Absent quand la demande est hors négociation : le montant n’est pas reconstituable. */
  amountCents: number | null
  commissionCents: number | null
  currency: string
  status: CashCommissionStatus
  chargedVia: CashCommissionChargedVia | null
  retryCount: number
  createdAt: string
}
export interface AdminCashCommissionPage { content: AdminCashCommission[]; totalElements: number; totalPages: number; number: number; size: number }

/** Statuts d'une demande de remboursement wallet, miroir du backend. */
export type WalletRefundRequestStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REFUNDED' | 'FAILED'

/** Canal d'une demande : automatique (rien à faire) ou ticket manuel à rembourser hors plateforme. */
export type WalletRefundChannel = 'AUTOMATIC_STRIPE' | 'AUTOMATIC_PAWAPAY' | 'MANUAL_ADMIN'
/** Origine déduite par le backend : suppression du compte, ou demande depuis l'écran portefeuille. */
export type WalletRefundOrigin = 'ACCOUNT_DELETION' | 'WALLET'

/**
 * Demande de remboursement du solde wallet. Le cas courant (suppression de compte) est un
 * remboursement AUTOMATIQUE sur la carte (Stripe) ou le mobile money (pawaPay) : à suivre,
 * rien à exécuter. Seul un ticket MANUAL_ADMIN en attente se rembourse hors plateforme puis
 * se marque résolu (le backend vide alors le portefeuille). Les champs facultatifs manquent
 * sur un ancien backend.
 */
export interface AdminWalletRefundRequest {
  id: string
  userId: string
  currency: string
  /** Montant en unités principales, dans `currency`. */
  amount: number
  status: WalletRefundRequestStatus
  requestedAt: string
  channel?: WalletRefundChannel | null
  parentRequestId?: string | null
  resolvedAt?: string | null
  userName?: string | null
  origin?: WalletRefundOrigin | null
  /**
   * Montant réellement versé hors plateforme à la résolution manuelle, dans `currency` (nul si
   * l'admin ne l'a pas saisi, ou demande non résolue à la main). L'écart avec `amount` est le
   * frais d'opérateur à la charge de l'utilisateur ; le solde, lui, est débité en entier.
   */
  paidAmount?: number | null
  /** Note de l'admin à la résolution manuelle. */
  resolutionNote?: string | null
  /** Frais retenus par le rail (somme des items hors échec), nul sans item. */
  feeAmount?: number | null
}
/** Corps facultatif de POST /admin/wallet-refund-requests/{id}/resolve (yadony-back #575). */
export interface ResolveWalletRefundBody {
  paidAmount: number
  note?: string | null
}
export interface AdminWalletRefundRequestPage { content: AdminWalletRefundRequest[]; totalElements: number; totalPages: number; number: number; size: number }

export const WALLET_REFUND_CHANNEL_LABELS: Record<WalletRefundChannel, string> = {
  AUTOMATIC_STRIPE: 'Carte, automatique',
  AUTOMATIC_PAWAPAY: 'Mobile money, automatique',
  MANUAL_ADMIN: 'Manuel',
}

export const WALLET_REFUND_ORIGIN_LABELS: Record<WalletRefundOrigin, string> = {
  ACCOUNT_DELETION: 'Suppression du compte',
  WALLET: 'Demande depuis le portefeuille',
}

/** Filtres de l'onglet : chaque vue correspond à une liste de statuts côté backend. */
export type WalletRefundView = 'all' | 'pending' | 'processing' | 'failed' | 'done'
export const WALLET_REFUND_VIEWS: readonly { key: WalletRefundView; label: string; statuses: WalletRefundRequestStatus[] }[] = [
  { key: 'all', label: 'Toutes', statuses: ['PENDING', 'PROCESSING', 'FAILED', 'REFUNDED', 'RESOLVED'] },
  { key: 'pending', label: 'À traiter', statuses: ['PENDING'] },
  { key: 'processing', label: 'En cours', statuses: ['PROCESSING'] },
  { key: 'failed', label: 'Échecs', statuses: ['FAILED'] },
  { key: 'done', label: 'Remboursées', statuses: ['REFUNDED', 'RESOLVED'] },
]

export const WALLET_REFUND_STATUS_LABELS: Record<WalletRefundRequestStatus, string> = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  RESOLVED: 'Résolue',
  REFUNDED: 'Remboursée',
  FAILED: 'Échec',
}

export function formatAmount(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
}

/**
 * Montant déjà en unités principales (net d'une demande, prix au kilo) dans sa devise.
 * Sans devise (backend pas encore déployé), le montant sort nu plutôt qu'en euros.
 */
export function formatMajorAmount(amount: number | null | undefined, currency?: string | null): string {
  if (amount === null || amount === undefined) return '—'
  const text = amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? text + ' ' + currency : text
}

/**
 * Masque un numéro de téléphone : seuls les 4 derniers chiffres restent visibles.
 * `mobile_money_payments.phone_number` est une donnée personnelle stockée en clair en
 * base — rien ne justifie de l'étaler dans une vue de consultation.
 */
export function maskPhoneNumber(phone: string): string {
  const VISIBLE = 4
  if (phone.length <= VISIBLE) return phone
  return '•'.repeat(phone.length - VISIBLE) + phone.slice(-VISIBLE)
}
