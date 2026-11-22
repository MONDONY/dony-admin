import type { AdminCancellationFee } from '@/features/payments/types/index'

export const feeOf = (over: Partial<AdminCancellationFee> = {}): AdminCancellationFee => ({
  id: 'fee-1', bidId: 'bid-1', status: 'DUE', reason: 'SENDER_CANCEL', rate: 0.2, grossFee: 6600, refundFees: 150,
  commission: 780, travelerNet: 5670, currency: 'XOF', payoutRef: null, payoutPendingReason: null,
  createdAt: '2026-11-20T10:00:00', updatedAt: '2026-11-20T11:30:00', waivable: true, payoutRetryable: false, ...over,
})
