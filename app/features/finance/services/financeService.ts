import { useApi } from '@/composables/useApi'
import type { AdminWalletPage, AdminMobileMoneyPage, AdminCashCommissionPage } from '@/features/finance/types/index'

/**
 * Trois onglets financiers en lecture seule — aucune méthode d'écriture ici,
 * volontairement. Le backend (T10) n'est pas encore livré : ce contrat fait foi.
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
}
