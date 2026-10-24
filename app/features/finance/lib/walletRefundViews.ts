import type { WalletRefundView } from '@/features/finance/types/index'

/**
 * Vue d'ouverture des remboursements wallet : « À traiter » quand des tickets attendent (même
 * nombre que la pastille du menu), sinon « Toutes ». Nombre inconnu (ancien back) : Toutes.
 */
export function defaultWalletRefundView(pending: number | null): WalletRefundView {
  return pending && pending > 0 ? 'pending' : 'all'
}
