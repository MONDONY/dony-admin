import { currencyDecimals } from '@/features/incidents/types/index'

export type TopupCodeDisplayStatus = 'ACTIVE' | 'EXPIRED' | 'EXHAUSTED' | 'REVOKED'

export interface AdminTopupCode {
  id: string
  code: string
  /** Unités principales (2000 = 2 000 XOF ; 10 = 10,00 EUR). */
  amount: number
  currency: string
  maxRedemptions: number
  redeemedCount: number
  remaining: number
  expiresAt: string
  displayStatus: TopupCodeDisplayStatus
  note: string | null
  createdAt: string
  createdBy: string | null
  createdByEmail: string | null
  revokedAt: string | null
}

export interface TopupCodeRedemption {
  id: string
  userId: string
  userName: string | null
  amount: number
  currency: string
  createdAt: string
}

export interface TopupCodeInput {
  /** null = code généré par le back. */
  code: string | null
  amount: number
  currency: string
  maxRedemptions: number
  /** ISO local (UTC) ; null = J+90. */
  expiresAt: string | null
  note: string | null
}

export interface TopupCodeFilterState {
  status: TopupCodeDisplayStatus | null
}

export const TOPUP_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'CAD', 'GBP', 'CHF'] as const

export const TOPUP_STATUS_META: Record<TopupCodeDisplayStatus, { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' }> = {
  ACTIVE: { label: 'Actif', tone: 'success' },
  EXHAUSTED: { label: 'Épuisé', tone: 'neutral' },
  EXPIRED: { label: 'Expiré', tone: 'warning' },
  REVOKED: { label: 'Révoqué', tone: 'danger' },
}

/** « 2 000 XOF », « 10,00 EUR » : le franc CFA n'a pas de centimes. */
export function formatTopupAmount(amount: number, currency: string): string {
  const d = currencyDecimals(currency)
  return amount.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' ' + currency
}

/**
 * Le back sérialise ses LocalDateTime UTC sans « Z » : sans fuseau explicite, `new Date()`
 * les lirait en heure locale. On ajoute « Z » quand aucun designateur (Z, +hh:mm, -hhmm) n'est présent.
 */
export function parseUtc(d: string): Date {
  const hasZone = /(Z|[+-]\d{2}(:?\d{2})?)$/i.test(d.slice(10))
  return new Date(hasZone ? d : d + 'Z')
}
