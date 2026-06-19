export type PromoType = 'PERCENT' | 'FIXED_AMOUNT'

export interface AdminPromoCode {
  id: string
  code: string
  type: PromoType
  value: number
  maxRedemptions: number | null
  redemptionCount: number
  expiresAt: string | null
  active: boolean
  createdAt: string
}

export interface AdminPromoCodePage {
  content: AdminPromoCode[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface PromoFilterState {
  active: boolean | null
}

export interface PromoCodeInput {
  code: string
  type: PromoType
  value: number
  maxRedemptions: number | null
  expiresAt: string | null
  active: boolean
}

export function formatPromoValue(type: PromoType, value: number): string {
  if (type === 'PERCENT') return `${value} %`
  return (value / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}
