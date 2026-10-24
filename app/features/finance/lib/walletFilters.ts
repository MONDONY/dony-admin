import type { WalletBalanceSign } from '@/features/finance/types/index'

/** Devises des portefeuilles (mêmes codes que le filtre des paiements). */
export const WALLET_CURRENCIES = ['EUR', 'USD', 'CAD', 'GBP', 'CHF', 'XOF', 'XAF'] as const

export const WALLET_CURRENCY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Toutes les devises' },
  ...WALLET_CURRENCIES.map(c => ({ value: c, label: c })),
]

export const WALLET_BALANCE_SIGNS: readonly WalletBalanceSign[] = ['POSITIVE', 'NEGATIVE', 'ZERO']

export const WALLET_BALANCE_SIGN_OPTIONS: { value: WalletBalanceSign | ''; label: string }[] = [
  { value: '', label: 'Tous les soldes' },
  { value: 'POSITIVE', label: 'Solde positif' },
  { value: 'NEGATIVE', label: 'Solde négatif' },
  { value: 'ZERO', label: 'Solde nul' },
]
