import { useApi } from '@/composables/useApi'
import type { AdminWalletPage, AdminMobileMoneyPage, AdminCashCommissionPage, AdminMobileMoneyCommissions, AdminWalletRefundRequest, AdminWalletRefundRequestPage } from '@/features/finance/types/index'

/**
 * Onglets financiers. Seule écriture : la résolution d'une demande de
 * remboursement wallet, une fois le virement fait hors plateforme.
 */
export const financeService = {
  listWallets(page: number, size: number): Promise<AdminWalletPage> {
    return useApi()<AdminWalletPage>('/admin/wallets', { query: { page, size } })
  },
  listMobileMoneyPayments(page: number, size: number): Promise<AdminMobileMoneyPage> {
    return useApi()<AdminMobileMoneyPage>('/admin/mobile-money-payments', { query: { page, size } })
  },
  listCashCommissions(page: number, size: number): Promise<AdminCashCommissionPage> {
    return useApi()<AdminCashCommissionPage>('/admin/cash-commissions', { query: { page, size } })
  },
  /**
   * Commissions du rail mobile money sur une période. Sans bornes, le backend retient les
   * 12 derniers mois — l'écran n'invente donc pas de période par défaut de son côté.
   */
  getMobileMoneyCommissions(from?: string, to?: string): Promise<AdminMobileMoneyCommissions> {
    return useApi()<AdminMobileMoneyCommissions>('/admin/mobile-money-commissions', { query: { from, to } })
  },
  /** Même appel, bornes saisies au jour : du début du premier jour à la fin du dernier. */
  getMobileMoneyCommissionsForDays(dateFrom: string | null, dateTo: string | null): Promise<AdminMobileMoneyCommissions> {
    return financeService.getMobileMoneyCommissions(
      dateFrom ? `${dateFrom}T00:00:00` : undefined,
      dateTo ? `${dateTo}T23:59:59` : undefined,
    )
  },
  /** Demandes de remboursement wallet en attente (suppression de compte). */
  listWalletRefundRequests(page: number, size: number): Promise<AdminWalletRefundRequestPage> {
    return useApi()<AdminWalletRefundRequestPage>('/admin/wallet-refund-requests', { query: { page, size } })
  },
  /** Marque une demande résolue après le virement manuel ; le backend vide alors le portefeuille. */
  resolveWalletRefundRequest(id: string): Promise<AdminWalletRefundRequest> {
    return useApi()<AdminWalletRefundRequest>(`/admin/wallet-refund-requests/${id}/resolve`, { method: 'POST' })
  },
}
