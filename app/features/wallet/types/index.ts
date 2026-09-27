import { formatMajorAmount } from '@/features/finance/types/index'
import { isEndpointMissing } from '@/lib/endpointMissing'

/**
 * Un compte du portefeuille d'un utilisateur : un par devise. Montants en unités
 * principales (euros, francs CFA), comme le reste du domaine wallet côté backend.
 * `frozen` = une demande de remboursement est en cours : aucune correction possible.
 */
export interface AdminWalletAccount {
  currency: string
  balance: number
  /**
   * Part du solde remboursable vers un moyen de paiement (le reste est non cash). `null`
   * quand le back ne sait pas la calculer (rejeu du journal incohérent).
   */
  refundEligibleAmount: number | null
  frozen: boolean
}
export interface AdminUserWallet { accounts: AdminWalletAccount[] }

export const WALLET_TRANSACTION_TYPES = [
  'TOP_UP', 'BID_PAYMENT', 'COMMISSION_DEDUCTED', 'REFUND', 'REFERRAL_REWARD',
  'ADMIN_REFUND_OUT', 'SELF_REFUND_OUT', 'FORFEITED_ON_DELETION', 'ADMIN_CREDIT', 'ADMIN_DEBIT',
] as const
export type WalletTransactionType = typeof WALLET_TRANSACTION_TYPES[number]

const TYPE_LABELS: Record<WalletTransactionType, string> = {
  TOP_UP: 'Recharge',
  BID_PAYMENT: 'Paiement d\'une demande',
  COMMISSION_DEDUCTED: 'Commission prélevée',
  REFUND: 'Remboursement',
  REFERRAL_REWARD: 'Récompense de parrainage',
  ADMIN_REFUND_OUT: 'Remboursement manuel par un admin',
  SELF_REFUND_OUT: 'Remboursement demandé par l\'utilisateur',
  FORFEITED_ON_DELETION: 'Solde non remboursable perdu à la suppression',
  ADMIN_CREDIT: 'Crédit manuel par un admin',
  ADMIN_DEBIT: 'Débit manuel par un admin',
}

/** Libellé lisible ; un type ajouté côté back avant le front s'affiche tel quel. */
export function walletTransactionTypeLabel(type: string): string {
  return TYPE_LABELS[type as WalletTransactionType] ?? type
}

export function isAdjustmentTransaction(type: string): boolean {
  return type === 'ADMIN_CREDIT' || type === 'ADMIN_DEBIT'
}

/**
 * Mouvement du journal. `amount` est SIGNÉ par le backend (un débit est stocké négatif),
 * le sens se lit donc sur le signe, pas sur le type.
 */
export interface AdminWalletTransaction {
  id: string
  currency: string
  type: string
  amount: number
  balanceAfter?: number | null
  bidId?: string | null
  paymentRef?: string | null
  createdAt: string
  /** Présents seulement sur un ajustement admin (ADMIN_CREDIT, ADMIN_DEBIT). */
  adminReason?: string | null
  adminActorId?: string | null
  adminActorEmail?: string | null
}
export interface AdminWalletTransactionPage {
  content: AdminWalletTransaction[]; totalElements: number; totalPages: number; number: number; size: number
}
export interface WalletTransactionFilters { currency: string | null; type: string | null }

export type WalletAdjustmentDirection = 'CREDIT' | 'DEBIT'
export interface WalletAdjustmentRequest {
  currency: string
  direction: WalletAdjustmentDirection
  /** Toujours positif : le sens est porté par `direction`. */
  amount: number
  reason: string
}
export interface WalletAdjustmentResult { account: AdminWalletAccount; transaction: AdminWalletTransaction }

/** Bornes du motif, miroir de la validation backend (400 `wallet-adjustment-reason-invalid`). */
export const WALLET_ADJUSTMENT_REASON_MIN = 10
export const WALLET_ADJUSTMENT_REASON_MAX = 500
export function reasonLengthValid(reason: string): boolean {
  const n = reason.trim().length
  return n >= WALLET_ADJUSTMENT_REASON_MIN && n <= WALLET_ADJUSTMENT_REASON_MAX
}

/** « +12,50 EUR » / « −5,00 XOF » : le signe moins typographique, lisible en colonne. */
export function formatSignedAmount(amount: number, currency: string): string {
  const abs = formatMajorAmount(Math.abs(amount), currency)
  if (amount > 0) return `+${abs}`
  if (amount < 0) return `−${abs}`
  return abs
}

/**
 * Endpoint du portefeuille absent (ancien back) : alias de l'helper générique de `app/lib/`,
 * conservé pour ne pas toucher aux appels du lot 2.
 */
export const isWalletEndpointMissing = isEndpointMissing
