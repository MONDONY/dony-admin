import { useApi } from '@/composables/useApi'
import type {
  AdminExternalRefundHold, AdminUserWallet, AdminWalletAdjustmentRequest, AdminWalletAdjustmentRequestPage, AdminWalletTransactionPage,
  WalletAdjustmentRequest, WalletAdjustmentRequestStatus, WalletAdjustmentResult, WalletTransactionFilters,
} from '@/features/wallet/types/index'

/** Portefeuille d'un utilisateur vu par l'admin : lecture (PAYMENT_VIEW) et correction (WALLET_ADJUST). */
export const walletService = {
  getUserWallet(userId: string): Promise<AdminUserWallet> {
    return useApi()<AdminUserWallet>(`/admin/users/${userId}/wallet`)
  },
  listTransactions(userId: string, filters: WalletTransactionFilters, page: number, size: number): Promise<AdminWalletTransactionPage> {
    const query: Record<string, string | number> = { page, size }
    if (filters.currency) query.currency = filters.currency
    if (filters.type) query.type = filters.type
    return useApi()<AdminWalletTransactionPage>(`/admin/users/${userId}/wallet/transactions`, { query })
  },
  /**
   * `Idempotency-Key` obligatoire : rejouée à l'identique après une coupure réseau, la même
   * clé garantit que le solde ne bouge qu'une fois.
   */
  adjust(userId: string, body: WalletAdjustmentRequest, idempotencyKey: string): Promise<WalletAdjustmentResult> {
    return useApi()<WalletAdjustmentResult>(`/admin/users/${userId}/wallet/adjustments`, {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  },
  /** Gels posés après un remboursement Stripe fait hors de l'app (PAYMENT_VIEW). */
  listExternalRefundHolds(userId: string): Promise<AdminExternalRefundHold[]> {
    return useApi()<AdminExternalRefundHold[]>(`/admin/users/${userId}/wallet/external-refund-holds`)
  },
  /** Levée d'un gel une fois le solde régularisé (WALLET_ADJUST, note obligatoire). */
  releaseExternalRefundHold(userId: string, holdId: string, note: string): Promise<AdminExternalRefundHold> {
    return useApi()<AdminExternalRefundHold>(`/admin/users/${userId}/wallet/external-refund-holds/${holdId}/release`, {
      method: 'POST',
      body: { note },
    })
  },
  /** File d'approbation des corrections au-delà du seuil (WALLET_ADJUST). */
  listAdjustmentRequests(status: WalletAdjustmentRequestStatus, page: number, size: number): Promise<AdminWalletAdjustmentRequestPage> {
    return useApi()<AdminWalletAdjustmentRequestPage>('/admin/wallet-adjustment-requests', { query: { status, page, size } })
  },
  approveAdjustmentRequest(id: string): Promise<WalletAdjustmentResult> {
    return useApi()<WalletAdjustmentResult>(`/admin/wallet-adjustment-requests/${id}/approve`, { method: 'POST' })
  },
  rejectAdjustmentRequest(id: string, note: string): Promise<AdminWalletAdjustmentRequest> {
    return useApi()<AdminWalletAdjustmentRequest>(`/admin/wallet-adjustment-requests/${id}/reject`, {
      method: 'POST',
      body: { note },
    })
  },
}
