import { reactive, ref } from 'vue'
import { walletService } from '@/features/wallet/services/walletService'
import { extractProblemMessage } from '@/lib/problemDetail'
import { isWalletEndpointMissing } from '@/features/wallet/types/index'
import type { AdminWalletAccount, AdminWalletTransaction, WalletTransactionFilters } from '@/features/wallet/types/index'

const PAGE_SIZE = 20

/**
 * Soldes et journal du portefeuille d'un utilisateur. Deux états d'erreur distincts : un
 * journal en panne ne doit pas masquer des soldes lus correctement.
 */
export function useUserWallet(userId: string) {
  const accounts = ref<AdminWalletAccount[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  /** Ancien back sans l'endpoint : mention discrète, pas d'erreur ni de correction possible. */
  const unavailable = ref(false)

  const transactions = ref<AdminWalletTransaction[]>([])
  const transactionsLoading = ref(false)
  const transactionsError = ref<string | null>(null)
  const page = ref(0)
  const totalPages = ref(0)
  const filters = reactive<WalletTransactionFilters>({ currency: null, type: null })

  async function fetchAccounts(): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const res = await walletService.getUserWallet(userId)
      accounts.value = res.accounts ?? []
      unavailable.value = false
      return true
    } catch (e) {
      if (isWalletEndpointMissing(e)) unavailable.value = true
      else error.value = extractProblemMessage(e, 'Impossible de charger le portefeuille')
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function fetchTransactions() {
    transactionsLoading.value = true
    transactionsError.value = null
    try {
      const res = await walletService.listTransactions(userId, { ...filters }, page.value, PAGE_SIZE)
      transactions.value = res.content
      totalPages.value = res.totalPages
      page.value = res.number
    } catch (e) {
      transactionsError.value = extractProblemMessage(e, 'Impossible de charger le journal du portefeuille')
    } finally {
      transactionsLoading.value = false
    }
  }

  async function load() {
    if (await fetchAccounts()) await fetchTransactions()
  }
  async function goToPage(p: number) { page.value = p; await fetchTransactions() }
  async function setCurrencyFilter(currency: string | null) { filters.currency = currency; page.value = 0; await fetchTransactions() }
  async function setTypeFilter(type: string | null) { filters.type = type; page.value = 0; await fetchTransactions() }

  return {
    accounts, isLoading, error, unavailable,
    transactions, transactionsLoading, transactionsError, page, totalPages, filters,
    load, refresh: load, fetchAccounts, fetchTransactions, goToPage, setCurrencyFilter, setTypeFilter,
  }
}
