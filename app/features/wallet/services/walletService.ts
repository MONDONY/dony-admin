import { useApi } from '@/composables/useApi'
import type {
  AdminUserWallet, AdminWalletTransactionPage, WalletAdjustmentRequest, WalletAdjustmentResult,
  WalletTransactionFilters,
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
}
