import { cashCommissionStatusMeta } from '@/features/finance/components/cashCommissionStatus'
import type { CashCommissionCounts, CashCommissionStatus, CashCommissionView } from '@/features/finance/types/index'
import type { FinanceViewDef } from './financeViews'

/** Vues des commissions cash : « À traiter » (échecs, 3DS à finir, remboursements en échec), puis tout. */
export const CASH_COMMISSION_VIEWS: FinanceViewDef<CashCommissionView>[] = [
  { id: 'ATTENTION', label: 'À traiter', countKey: 'attention', alert: true },
  { id: 'ALL', label: 'Toutes', countKey: 'all' },
]

/** Vue d'ouverture : À traiter s'il y en a ; sans nombres (ancien back) : tout. */
export function defaultCashCommissionView(counts: CashCommissionCounts | null): CashCommissionView {
  return counts && counts.attention > 0 ? 'ATTENTION' : 'ALL'
}

const STATUSES: CashCommissionStatus[] = ['PENDING', 'REQUIRES_3DS', 'CHARGED', 'FAILED', 'REFUNDED', 'REFUND_FAILED']
export const CASH_COMMISSION_STATUSES: readonly string[] = STATUSES

export const CASH_COMMISSION_STATUS_OPTIONS: { value: CashCommissionStatus | ''; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  ...STATUSES.map(s => ({ value: s, label: cashCommissionStatusMeta(s).label })),
]

/** Les nombres ont la forme attendue (une page de liste renvoyée par erreur ne passe pas). */
export function isCashCommissionCounts(v: unknown): v is CashCommissionCounts {
  const c = v as Partial<Record<keyof CashCommissionCounts, unknown>> | null
  return !!c && typeof c.attention === 'number' && typeof c.all === 'number'
}
