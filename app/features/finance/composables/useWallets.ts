import { computed } from 'vue'
import { financeService } from '@/features/finance/services/financeService'
import { FINANCE_PAGE_SIZE, useFinanceList } from '@/features/finance/composables/useFinanceList'
import { WALLET_BALANCE_SIGNS, WALLET_CURRENCIES } from '@/features/finance/lib/walletFilters'
import { shortId } from '@/features/payments/lib/paymentLabels'
import type { AdminWallet, WalletBalanceSign } from '@/features/finance/types/index'

/**
 * Portefeuilles de la section Soldes : recherche (nom, pseudo, identifiant du titulaire), devise,
 * signe du solde et titulaire (`?partyId=`, lien « Portefeuille » de la fiche utilisateur, puce
 * « Titulaire : … » retirable). Pas de vues ni de nombres.
 */
export function useWallets() {
  const list = useFinanceList<AdminWallet, { query: string; currency: string; balanceSign: string; partyId: string }>({
    filters: { query: '', currency: '', balanceSign: '', partyId: '' },
    specs: {
      query: {},
      currency: { allowed: WALLET_CURRENCIES },
      balanceSign: { allowed: WALLET_BALANCE_SIGNS },
      partyId: { uuid: true },
    },
    fetch: (f, page) => financeService.listWallets({
      q: f.query, currency: f.currency, balanceSign: f.balanceSign as WalletBalanceSign | '', partyId: f.partyId, page, size: FINANCE_PAGE_SIZE,
    }),
    errorLabel: 'Impossible de charger les portefeuilles',
  })

  /** Puce du titulaire : son nom quand une ligne le porte, sinon l'identifiant abrégé. */
  const chips = computed(() => {
    const id = list.filters.partyId
    if (!id) return []
    const name = list.rows.value.find(w => w.userId === id)?.userName
    return [{ key: 'partyId', label: `Titulaire : ${name || shortId(id)}` }]
  })
  const removeChip = (key: string) => (key === 'partyId' ? list.setFilter('partyId', '') : Promise.resolve())
  const clearChips = () => list.setFilter('partyId', '')

  return { ...list, chips, removeChip, clearChips }
}
