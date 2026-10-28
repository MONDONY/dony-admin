export interface AdminWallet {
  id: string
  userId: string
  balanceCents: number
  currency: string
  updatedAt: string
  /** « Prénom Nom (@pseudo) » ; absent pour un compte supprimé ou un ancien back. */
  userName?: string | null
}
/** Paramètres des listes finance : les valeurs par défaut ne sont pas envoyées. */
export type WalletBalanceSign = 'POSITIVE' | 'NEGATIVE' | 'ZERO'
export interface WalletListParams { q?: string; currency?: string; balanceSign?: WalletBalanceSign | ''; partyId?: string; page?: number; size?: number }
export type MobileMoneyView = 'ALL' | 'FAILED' | 'OPEN' | 'DONE'
export interface MobileMoneyListParams { view?: MobileMoneyView; kind?: MobileMoneyOperationKind | ''; provider?: string; q?: string; page?: number; size?: number }
export type CashCommissionView = 'ALL' | 'ATTENTION'
export interface CashCommissionListParams { view?: CashCommissionView; status?: CashCommissionStatus | ''; q?: string; partyId?: string; page?: number; size?: number }

/** Nombres des vues mobile money, comptés PAR OPÉRATION (peuvent dépasser `alerts.mmFailed` des paiements). */
export interface MobileMoneyCounts { failed: number; open: number; done: number; all: number; attention: number }
/** `attention` = FAILED, REQUIRES_3DS et REFUND_FAILED. */
export interface CashCommissionCounts { attention: number; all: number }

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
  /** Champs du nouveau back (NON_NULL, tous absents d'un ancien back). */
  purpose?: string | null
  personId?: string | null
  personName?: string | null
  role?: 'SENDER' | 'TRAVELER' | 'USER' | null
  bidId?: string | null
  trackingNumber?: string | null
  /** « Paris → Dakar ». */
  corridor?: string | null
  walletRefundRequestId?: string | null
  /** La relance du versement ou du remboursement serait acceptée. */
  retryable?: boolean
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
  /** Colis et voyageur (nouveau back) ; le nom manque pour un compte supprimé, l'identifiant reste. */
  trackingNumber?: string | null
  corridor?: string | null
  travelerId?: string | null
  travelerName?: string | null
}
export interface AdminCashCommissionPage { content: AdminCashCommission[]; totalElements: number; totalPages: number; number: number; size: number }

/** Statuts d'une demande de remboursement wallet, miroir du backend. */
export type WalletRefundRequestStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'REFUNDED' | 'FAILED'

/**
 * Canal d'une demande : automatique (rien à faire) ou ticket manuel à rembourser hors plateforme.
 * AUTOMATIC_MIXED (yadony-back) : recharges carte ET mobile money dans la même devise, chaque
 * recharge repart automatiquement vers son rail d'origine.
 */
export type WalletRefundChannel = 'AUTOMATIC_STRIPE' | 'AUTOMATIC_PAWAPAY' | 'AUTOMATIC_MIXED' | 'MANUAL_ADMIN'
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
  /**
   * Rail des recharges remboursées (yadony-back, relance mobile money) : PAWAPAY, STRIPE, MIXED,
   * nul sans item. Absent sur un ancien backend.
   */
  sourceRail?: WalletRefundSourceRail | null
  /** Dernier motif d'échec connu (items de la demande, sinon de la demande parente). */
  failureReason?: string | null
}

export type WalletRefundSourceRail = 'PAWAPAY' | 'STRIPE' | 'MIXED'

/**
 * Aperçu d'une relance mobile money (GET /admin/wallet-refund-requests/{id}/retry-preview).
 * La relance verse le dû entier, jamais une partie : `suggestedAmount` vaut le dû quand le
 * wallet pawaPay le couvre en sécurité, sinon il est nul et `topUpNeeded` dit ce qu'il manque.
 * Solde illisible : `walletBalance`, `maxSafeAmount`, `suggestedAmount` et `topUpNeeded` nuls.
 */
export interface WalletRefundRetryPreview {
  requestId: string
  currency: string
  /** Pays du wallet pawaPay, en ISO alpha-2 (CI, SN…). */
  country: string
  provider: string
  /** Numéro de la recharge, toujours masqué par le backend. */
  msisdnMasked: string | null
  grossAmount: number
  amountDue: number
  walletBalance: number | null
  maxSafeAmount: number | null
  suggestedAmount: number | null
  topUpNeeded: number | null
  refundRatePercent: number
  retryAvailable: boolean
  unavailableReason: 'pawapay-balance-unavailable' | 'pawapay-insufficient-funds' | string | null
}
/** Corps de POST /admin/wallet-refund-requests/{id}/retry : `amount` confirme le dû affiché. */
export interface RetryWalletRefundBody {
  amount: number
}
export interface WalletRefundRetryResult {
  request: AdminWalletRefundRequest
  amount: number
  amountDue: number
  walletBalance: number
  maxSafeAmount: number
}

/** Libellés des motifs d'échec connus ; un motif inconnu s'affiche tel quel. */
export const WALLET_REFUND_FAILURE_LABELS: Record<string, string> = {
  PAWAPAY_WALLET_OUT_OF_FUNDS: 'Wallet pawaPay sans fonds',
  'pawapay-wallet-balance-short': 'Wallet pawaPay trop bas, rien n’a été envoyé',
  'balance-short': 'Solde de l’utilisateur insuffisant',
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
  AUTOMATIC_MIXED: 'Carte et mobile money, automatique',
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
