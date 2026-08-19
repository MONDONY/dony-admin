export interface AdminWallet {
  id: string
  userId: string
  balanceCents: number
  currency: string
  updatedAt: string
}
export interface AdminWalletPage { content: AdminWallet[]; totalElements: number; totalPages: number; number: number; size: number }

export type MobileMoneyProvider = 'WAVE' | 'ORANGE_MONEY'
export type MobileMoneyPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'

export interface AdminMobileMoneyPayment {
  id: string
  bidId: string
  provider: MobileMoneyProvider
  countryCode: string
  /**
   * Déjà masqué par le back : seuls les 4 derniers chiffres arrivent jusqu'ici, le numéro
   * complet ne quitte jamais le serveur. `maskPhoneNumber` reste appliqué en second rideau —
   * la fonction est idempotente, les deux protections se cumulent sans se contredire.
   */
  phoneNumber: string
  amountCents: number
  currency: string
  status: MobileMoneyPaymentStatus
  createdAt: string
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

export function formatAmount(cents: number, currency: string): string {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency
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
