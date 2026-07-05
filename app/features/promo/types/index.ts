export type PromoTarget = 'SENDER' | 'TRAVELER' | 'ANY'
export type PromoStatus = 'ACTIVE' | 'DISABLED'

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
}

export interface PromoFilterState {
  status: PromoStatus | null
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
