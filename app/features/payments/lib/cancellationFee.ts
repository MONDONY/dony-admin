import type { CanFn } from '@/lib/adminLinks'
import type { AdminCancellationFee, CancellationFeeReason, CancellationFeeStatus } from '../types/index'

export const FEE_STATUS_LABEL: Record<CancellationFeeStatus, string> = {
  DUE: 'Due',
  RETAINED: 'Retenue',
  PAYOUT_PENDING: 'Versement en attente',
  PAID_OUT: 'Versé',
  NOT_APPLICABLE: 'Sans objet',
}

export const FEE_STATUS_TONE: Record<CancellationFeeStatus, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  DUE: 'warning',
  RETAINED: 'info',
  PAYOUT_PENDING: 'danger',
  PAID_OUT: 'success',
  NOT_APPLICABLE: 'neutral',
}

export const FEE_REASON_LABEL: Record<CancellationFeeReason, string> = {
  SENDER_CANCEL: 'Annulation par l’expéditeur',
  SENDER_NO_SHOW: 'Absence de l’expéditeur confirmée',
  SENDER_CANCEL_AFTER_HANDOVER: 'Annulation après remise',
}

export const feeStatusLabel = (s: string): string => FEE_STATUS_LABEL[s as CancellationFeeStatus] ?? s
export const feeStatusTone = (s: string) => FEE_STATUS_TONE[s as CancellationFeeStatus] ?? 'neutral'
export const feeReasonLabel = (r: string): string => FEE_REASON_LABEL[r as CancellationFeeReason] ?? r

/** Devises sans centimes : le franc CFA s'affiche sans décimales. */
const ZERO_DECIMAL = new Set(['XOF', 'XAF'])

/** Montant de la retenue, en UNITÉS de sa devise (« 6 600 XOF », « 12,50 EUR »). */
export function formatFeeAmount(amount: number, currency: string): string {
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2
  const text = amount.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return `${text} ${currency}`
}

/** Taux en pourcentage : 0.2 -> « 20 % », 0.125 -> « 12,5 % ». */
export function formatFeeRate(rate: number): string {
  return `${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %`
}

export type FeeGestureId = 'waive' | 'retry-payout'
export interface FeeGesture { id: FeeGestureId; label: string; enabled: boolean; reason?: string }

const FORBIDDEN_REFUND = 'Permission manquante : réservé aux admins qui peuvent rembourser.'
const FORBIDDEN_RELEASE = 'Permission manquante : réservé aux admins qui peuvent débloquer les paiements.'

/**
 * Gestes de la carte. Un geste n'existe que si le back le dit possible (`waivable`,
 * `payoutRetryable`) ; sans la permission du mouvement d'argent qu'il ouvre, il reste affiché,
 * grisé, avec sa raison.
 */
export function feeGestures(fee: AdminCancellationFee, can: CanFn): FeeGesture[] {
  const out: FeeGesture[] = []
  if (fee.waivable) {
    out.push(can('PAYMENT_REFUND')
      ? { id: 'waive', label: 'Renoncer à la retenue', enabled: true }
      : { id: 'waive', label: 'Renoncer à la retenue', enabled: false, reason: FORBIDDEN_REFUND })
  }
  if (fee.payoutRetryable) {
    out.push(can('PAYMENT_RELEASE')
      ? { id: 'retry-payout', label: 'Relancer le versement', enabled: true }
      : { id: 'retry-payout', label: 'Relancer le versement', enabled: false, reason: FORBIDDEN_RELEASE })
  }
  return out
}
