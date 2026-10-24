import { computed } from 'vue'
import { financeService } from '@/features/finance/services/financeService'
import { FINANCE_PAGE_SIZE, useFinanceList } from '@/features/finance/composables/useFinanceList'
import {
  CASH_COMMISSION_STATUSES, CASH_COMMISSION_VIEWS, defaultCashCommissionView, isCashCommissionCounts,
} from '@/features/finance/lib/cashCommissionViews'
import { shortId } from '@/features/payments/lib/paymentLabels'
import type { AdminCashCommission, CashCommissionCounts, CashCommissionStatus, CashCommissionView } from '@/features/finance/types/index'

/**
 * Commissions cash de la section Soldes : vues « À traiter » / « Toutes » à nombres (qui suivent
 * la recherche et le voyageur, jamais la vue ni le statut), statut, recherche, voyageur
 * (`?partyId=`, puce « Voyageur : … »).
 */
export function useCashCommissions() {
  const list = useFinanceList<AdminCashCommission, { query: string; status: string; partyId: string }, CashCommissionCounts>({
    filters: { query: '', status: '', partyId: '' },
    specs: {
      query: { scope: true },
      status: { allowed: CASH_COMMISSION_STATUSES },
      partyId: { uuid: true, scope: true },
    },
    views: { ids: CASH_COMMISSION_VIEWS.map(v => v.id), all: 'ALL', source: 'counts' },
    counts: {
      fetch: f => financeService.cashCommissionCounts({ q: f.query, partyId: f.partyId }),
      is: isCashCommissionCounts,
      defaultView: defaultCashCommissionView,
    },
    fetch: (f, page) => financeService.listCashCommissions({
      view: f.view as CashCommissionView, status: f.status as CashCommissionStatus | '', q: f.query, partyId: f.partyId, page, size: FINANCE_PAGE_SIZE,
    }),
    errorLabel: 'Impossible de charger les commissions cash',
  })

  const chips = computed(() => {
    const id = list.filters.partyId
    if (!id) return []
    const name = list.rows.value.find(c => c.travelerId === id)?.travelerName
    return [{ key: 'partyId', label: `Voyageur : ${name || shortId(id)}` }]
  })
  const removeChip = (key: string) => (key === 'partyId' ? list.setFilter('partyId', '') : Promise.resolve())
  const clearChips = () => list.setFilter('partyId', '')

  return { ...list, chips, removeChip, clearChips }
}
