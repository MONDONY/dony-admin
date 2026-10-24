import { paymentsService } from '@/features/payments/services/paymentsService'
import { FINANCE_PAGE_SIZE, useFinanceList } from '@/features/finance/composables/useFinanceList'
import { CHARGEBACK_VIEWS, defaultChargebackView, isChargebackCounts } from '@/features/finance/lib/chargebackViews'
import type { AdminChargeback, ChargebackCounts, ChargebackView } from '@/features/payments/types/index'

/**
 * Litiges bancaires : vues Ouverts / Gagnés / Perdus / Tous à nombres (qui suivent la recherche),
 * recherche (n° de suivi, nom, trajet), ligne ouverte par `?open=<litige>` (lien « Litige bancaire »
 * du tiroir paiement), mise en évidence dans la liste.
 */
export function useChargebacks() {
  return useFinanceList<AdminChargeback, { query: string }, ChargebackCounts>({
    filters: { query: '' },
    specs: { query: { scope: true } },
    views: { ids: CHARGEBACK_VIEWS.map(v => v.id), all: 'ALL', source: 'counts' },
    counts: {
      fetch: f => paymentsService.chargebackCounts(f.query),
      is: isChargebackCounts,
      defaultView: defaultChargebackView,
    },
    fetch: (f, page) => paymentsService.listChargebacks({ view: f.view as ChargebackView, q: f.query, page, size: FINANCE_PAGE_SIZE }),
    rowId: c => c.id,
    errorLabel: 'Impossible de charger les litiges bancaires',
  })
}
