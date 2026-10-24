/**
 * Nombres « à traiter » des quatre sections Transactions (`GET /admin/finance/counts`, PAYMENT_VIEW).
 * `soldes` = remboursements du solde en attente + commissions cash à traiter ; `details` donne les
 * nombres dont ils sont la somme. Ancien back : la route manque (404/405 sans `code`) et aucune
 * pastille ne s'affiche, jamais de « 0 » inventé.
 */
export interface FinanceCountsDetails {
  paymentsAttention: number
  mobileMoneyAttention: number
  walletRefundsPending: number
  cashCommissionsAttention: number
  chargebacksOpen: number
}

export interface FinanceCounts {
  payments: number
  mobileMoney: number
  soldes: number
  chargebacks: number
  details: FinanceCountsDetails
}
