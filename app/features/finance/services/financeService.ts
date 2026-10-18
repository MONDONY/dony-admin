import { useApi } from '@/composables/useApi'
import type { AdminWalletPage, AdminMobileMoneyPage, AdminCashCommissionPage, AdminMobileMoneyCommissions, AdminWalletRefundRequest, AdminWalletRefundRequestPage, ResolveWalletRefundBody, RetryWalletRefundBody, WalletRefundRequestStatus, WalletRefundRetryPreview, WalletRefundRetryResult } from '@/features/finance/types/index'

/**
 * Onglets financiers. Seule écriture : la résolution d'un ticket manuel de
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
  /**
   * Demandes de remboursement wallet. Sans statut : file « à traiter » (tickets manuels en
   * attente). Avec statuts : suivi des remboursements automatiques, échecs et historique.
   */
  listWalletRefundRequests(page: number, size: number, statuses?: WalletRefundRequestStatus[]): Promise<AdminWalletRefundRequestPage> {
    const query = statuses?.length ? { page, size, status: statuses.join(',') } : { page, size }
    return useApi()<AdminWalletRefundRequestPage>('/admin/wallet-refund-requests', { query })
  },
  /**
   * Marque une demande résolue après le virement manuel ; le backend vide alors le portefeuille.
   * Avec `body`, le montant réellement versé et la note sont gardés sur la demande et dans
   * l'audit (yadony-back #575) ; sans, la résolution se fait comme avant.
   */
  resolveWalletRefundRequest(id: string, body?: ResolveWalletRefundBody): Promise<AdminWalletRefundRequest> {
    return useApi()<AdminWalletRefundRequest>(`/admin/wallet-refund-requests/${id}/resolve`,
      body ? { method: 'POST', body } : { method: 'POST' })
  },
  /**
   * Aperçu d'une relance du remboursement mobile money : dû, solde du wallet pawaPay, montant
   * sûr, manque à alimenter et numéro masqué. 422 si la demande n'est pas éligible.
   */
  getWalletRefundRetryPreview(id: string): Promise<WalletRefundRetryPreview> {
    return useApi()<WalletRefundRetryPreview>(`/admin/wallet-refund-requests/${id}/retry-preview`)
  },
  /** Verse réellement le dû sur le numéro de la recharge (rail pawaPay). 422 si non couvert. */
  retryWalletRefundRequest(id: string, body: RetryWalletRefundBody): Promise<WalletRefundRetryResult> {
    return useApi()<WalletRefundRetryResult>(`/admin/wallet-refund-requests/${id}/retry`, { method: 'POST', body })
  },
}
