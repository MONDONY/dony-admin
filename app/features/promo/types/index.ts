export type PromoTarget = 'SENDER' | 'TRAVELER' | 'ANY'
export type PromoStatus = 'ACTIVE' | 'DISABLED'
export type PromoOrigin = 'ADMIN' | 'REFERRAL_REWARD' | 'REFERRAL_WELCOME'
/** Filtre d'origine envoyé au back (`origin=`) ; ALL = pas de paramètre. */
export type PromoOriginFilter = 'ALL' | 'ADMIN' | 'REFERRAL'

export interface AdminPromoCode {
  id: string
  code: string
  /** Taux de réduction en fraction [0, 1[ — ex. 0.15 = 15 %. */
  rate: number
  target: PromoTarget
  validFrom: string | null
  validTo: string | null
  maxRedemptions: number | null
  perUserLimit: number
  redeemedCount: number
  status: PromoStatus
  createdAt: string
  /** Absent avec l'ancien back : traité comme ADMIN. */
  origin?: PromoOrigin
  ownerUserId?: string | null
  /** Prénom seul du propriétaire (codes de parrainage). */
  ownerFirstName?: string | null
}

export interface PromoFilterState {
  status: PromoStatus | null
  origin: PromoOriginFilter
}

export interface PromoCodeInput {
  code: string
  rate: number
  target: PromoTarget
  validFrom: string | null
  validTo: string | null
  maxRedemptions: number | null
  perUserLimit: number | null
}

export const PROMO_TARGET_LABELS: Record<PromoTarget, string> = {
  SENDER: 'Expéditeurs',
  TRAVELER: 'Voyageurs',
  ANY: 'Tous',
}

export function formatPromoRate(rate: number): string {
  return (rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %'
}

export const PROMO_ORIGIN_LABELS: Record<PromoOrigin, string> = {
  ADMIN: 'Créé par l\'admin',
  REFERRAL_REWARD: 'Parrainage : récompense du parrain',
  REFERRAL_WELCOME: 'Parrainage : bienvenue du filleul',
}

export const PROMO_ORIGIN_TONES: Record<PromoOrigin, 'neutral' | 'info' | 'success'> = {
  ADMIN: 'neutral',
  REFERRAL_REWARD: 'success',
  REFERRAL_WELCOME: 'info',
}

export const PROMO_ORIGIN_FILTERS: { value: PromoOriginFilter; label: string }[] = [
  { value: 'ALL', label: 'Tous' },
  { value: 'ADMIN', label: 'Créés par l\'admin' },
  { value: 'REFERRAL', label: 'Parrainage' },
]

/** Un code sans origine vient de l'ancien back : il a été créé par l'admin. */
export function promoOriginOf(code: Pick<AdminPromoCode, 'origin'>): PromoOrigin {
  return code.origin ?? 'ADMIN'
}

/** Seuls les codes créés par l'admin sont modifiables ou supprimables (le statut reste libre). */
export function isPromoEditable(code: Pick<AdminPromoCode, 'origin'>): boolean {
  return promoOriginOf(code) === 'ADMIN'
}
