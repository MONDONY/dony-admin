import { useApi } from '@/composables/useApi'
import type { AdminWalletPage, AdminMobileMoneyPage, AdminCashCommissionPage, CashCommissionCounts, CashCommissionListParams, MobileMoneyCounts, MobileMoneyListParams, WalletListParams, AdminMobileMoneyCommissions, AdminWalletRefundRequest, AdminWalletRefundRequestPage, ResolveWalletRefundBody, RetryWalletRefundBody, WalletRefundRequestStatus, WalletRefundRetryPreview, WalletRefundRetryResult } from '@/features/finance/types/index'

/** Retire les valeurs vides (chaîne vide, undefined) et rogne les textes : un défaut n'est jamais envoyé. */
function compact(values: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(values)) {
    const t = v?.trim()
    if (t) out[k] = t
  }
  return out
}

/** `ALL` est la vue par défaut : on ne l'envoie pas. */
function viewOf(view: string | undefined): string | undefined {
  return view === 'ALL' ? undefined : view
}

function pageQuery(p: { page?: number; size?: number }, filters: Record<string, string | undefined>): Record<string, string | number> {
  return { ...compact(filters), page: p.page ?? 0, size: p.size ?? 20 }
}

function mobileMoneyScope(p: MobileMoneyListParams): Record<string, string | undefined> {
  return { kind: p.kind, provider: p.provider, q: p.q }
}

/** `(page, size)` : signature historique, gardée jusqu'à la migration des appelants (Task 10) ; sinon un objet de paramètres. */
function listWallets(a: number | WalletListParams, b?: number): Promise<AdminWalletPage> {
  if (typeof a === 'number') return useApi()<AdminWalletPage>('/admin/wallets', { query: { page: a, size: b } })
  return useApi()<AdminWalletPage>('/admin/wallets', { query: pageQuery(a, { q: a.q, currency: a.currency, balanceSign: a.balanceSign, partyId: a.partyId }) })
}

function listMobileMoneyPayments(a: number | MobileMoneyListParams, b?: number): Promise<AdminMobileMoneyPage> {
  if (typeof a === 'number') return useApi()<AdminMobileMoneyPage>('/admin/mobile-money-payments', { query: { page: a, size: b } })
  return useApi()<AdminMobileMoneyPage>('/admin/mobile-money-payments', { query: pageQuery(a, { view: viewOf(a.view), ...mobileMoneyScope(a) }) })
}

function listCashCommissions(a: number | CashCommissionListParams, b?: number): Promise<AdminCashCommissionPage> {
  if (typeof a === 'number') return useApi()<AdminCashCommissionPage>('/admin/cash-commissions', { query: { page: a, size: b } })
  return useApi()<AdminCashCommissionPage>('/admin/cash-commissions', { query: pageQuery(a, { view: viewOf(a.view), status: a.status, q: a.q, partyId: a.partyId }) })
}

/**
 * Onglets financiers. Seule écriture : la résolution d'un ticket manuel de
 * remboursement wallet, une fois le virement fait hors plateforme.
 */
export const financeService = {
  listWallets,
  listMobileMoneyPayments,
  /** Nombres par vue : mêmes `kind`, `provider` et `q` que la liste, sans vue ni pagination. */
  mobileMoneyCounts(params: MobileMoneyListParams = {}): Promise<MobileMoneyCounts> {
    return useApi()<MobileMoneyCounts>('/admin/mobile-money-payments/counts', { query: compact(mobileMoneyScope(params)) })
  },
  listCashCommissions,
  /** Nombres des commissions cash : ils suivent `q` et `partyId`, jamais la vue ni le statut. */
  cashCommissionCounts(params: { q?: string; partyId?: string } = {}): Promise<CashCommissionCounts> {
    return useApi()<CashCommissionCounts>('/admin/cash-commissions/counts', { query: compact({ q: params.q, partyId: params.partyId }) })
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
