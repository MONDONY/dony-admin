/** Les sept identifiants historiques de `?tab=` : ils restent les adresses des listes. */
export type TransactionTab = 'payments' | 'chargebacks' | 'mobile-money' | 'mm-commissions' | 'wallets' | 'wallet-refunds' | 'cash-commissions'
export type TransactionSection = 'payments' | 'mobile-money' | 'wallets' | 'chargebacks'

export const SECTIONS: { id: TransactionSection; label: string }[] = [
  { id: 'payments', label: 'Paiements' },
  { id: 'mobile-money', label: 'Mobile money' },
  { id: 'wallets', label: 'Soldes' },
  { id: 'chargebacks', label: 'Litiges bancaires' },
]

/** Sous-onglets des sections à plusieurs listes ; les autres sections n'en ont pas. */
export const SUB_TABS: Partial<Record<TransactionSection, { id: TransactionTab; label: string }[]>> = {
  'mobile-money': [
    { id: 'mobile-money', label: 'Opérations' },
    { id: 'mm-commissions', label: 'Commissions' },
  ],
  wallets: [
    { id: 'wallets', label: 'Portefeuilles' },
    { id: 'wallet-refunds', label: 'Remboursements wallet' },
    { id: 'cash-commissions', label: 'Commissions cash' },
  ],
}

/** Section et sous-onglet (= l'identifiant `?tab=`) de chaque ancien onglet. */
export const TAB_TO_SECTION: Record<TransactionTab, { section: TransactionSection; sub: TransactionTab }> = {
  payments: { section: 'payments', sub: 'payments' },
  chargebacks: { section: 'chargebacks', sub: 'chargebacks' },
  'mobile-money': { section: 'mobile-money', sub: 'mobile-money' },
  'mm-commissions': { section: 'mobile-money', sub: 'mm-commissions' },
  wallets: { section: 'wallets', sub: 'wallets' },
  'wallet-refunds': { section: 'wallets', sub: 'wallet-refunds' },
  'cash-commissions': { section: 'wallets', sub: 'cash-commissions' },
}

export const sectionOf = (tab: TransactionTab): TransactionSection => TAB_TO_SECTION[tab].section

export const isTab = (v: unknown): v is TransactionTab => typeof v === 'string' && Object.hasOwn(TAB_TO_SECTION, v)

/** Onglet affiché à l'ouverture d'une section. */
export const defaultTabOfSection = (section: TransactionSection): TransactionTab => SUB_TABS[section]?.[0]?.id ?? section as TransactionTab

/** Repli (ancien back sans nombres de sections) : les sept onglets à plat, groupés par section. */
export const ALL_TABS: { id: TransactionTab; label: string; group: string }[] = [
  { id: 'payments', label: 'Paiements', group: 'Paiements' },
  { id: 'chargebacks', label: 'Litiges bancaires', group: 'Paiements' },
  { id: 'mobile-money', label: 'Mobile money', group: 'Mobile money' },
  { id: 'mm-commissions', label: 'Commissions mobile money', group: 'Mobile money' },
  { id: 'wallets', label: 'Portefeuilles', group: 'Soldes' },
  { id: 'wallet-refunds', label: 'Remboursements wallet', group: 'Soldes' },
  { id: 'cash-commissions', label: 'Commissions cash', group: 'Soldes' },
]
