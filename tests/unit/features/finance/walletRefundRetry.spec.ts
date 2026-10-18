import { describe, it, expect } from 'vitest'
import { canRetryWalletRefund, countryLabel, failureLabel, retryBlocker } from '@/features/finance/components/walletRefundRetry'
import type { AdminWalletRefundRequest, WalletRefundRetryPreview } from '@/features/finance/types/index'

const BASE: AdminWalletRefundRequest = { id: 'r1', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00' }
const PREVIEW: WalletRefundRetryPreview = {
  requestId: 'r1', currency: 'XOF', country: 'CI', provider: 'ORANGE_CIV', msisdnMasked: '+225 •••• 90', grossAmount: 500,
  amountDue: 477, walletBalance: 491.5, maxSafeAmount: 477, suggestedAmount: 477, topUpNeeded: 0, refundRatePercent: 3,
  retryAvailable: true, unavailableReason: null,
}

describe('walletRefundRetry', () => {
  it('canRetryWalletRefund : ticket manuel en attente, recharge mobile money ou rail inconnu (ancien back)', () => {
    expect(canRetryWalletRefund({ ...BASE, channel: 'MANUAL_ADMIN', sourceRail: 'PAWAPAY' })).toBe(true)
    expect(canRetryWalletRefund({ ...BASE })).toBe(true)
    expect(canRetryWalletRefund({ ...BASE, channel: 'MANUAL_ADMIN', sourceRail: 'STRIPE' })).toBe(false)
    expect(canRetryWalletRefund({ ...BASE, channel: 'MANUAL_ADMIN', sourceRail: 'MIXED' })).toBe(false)
    expect(canRetryWalletRefund({ ...BASE, channel: 'MANUAL_ADMIN', sourceRail: null })).toBe(false)
    expect(canRetryWalletRefund({ ...BASE, channel: 'AUTOMATIC_PAWAPAY', sourceRail: 'PAWAPAY' })).toBe(false)
    expect(canRetryWalletRefund({ ...BASE, status: 'FAILED', sourceRail: 'PAWAPAY' })).toBe(false)
  })

  it('countryLabel : nom français, code tel quel sinon', () => {
    expect(countryLabel('CI')).toMatch(/Ivoire/)
    expect(countryLabel(null)).toBe('—')
    expect(countryLabel('??')).toBe('??')
  })

  it('failureLabel : libellé connu, motif brut sinon, rien sans motif', () => {
    expect(failureLabel('PAWAPAY_WALLET_OUT_OF_FUNDS')).toBe('Wallet pawaPay sans fonds')
    expect(failureLabel('pawapay-wallet-balance-short')).toContain('rien n’a été envoyé')
    expect(failureLabel('INVALID_RECIPIENT')).toBe('INVALID_RECIPIENT')
    expect(failureLabel(null)).toBeNull()
  })

  it('retryBlocker : ouvert seulement si le wallet couvre le dû entier', () => {
    expect(retryBlocker(PREVIEW)).toBeNull()
    expect(retryBlocker(null)).toBe('Aperçu indisponible.')
    expect(retryBlocker({ ...PREVIEW, walletBalance: null, maxSafeAmount: null, suggestedAmount: null, topUpNeeded: null, retryAvailable: false, unavailableReason: 'pawapay-balance-unavailable' }))
      .toContain('illisible')
    expect(retryBlocker({ ...PREVIEW, walletBalance: 487.5, maxSafeAmount: 473, suggestedAmount: null, topUpNeeded: 4, retryAvailable: false, unavailableReason: 'pawapay-insufficient-funds' }))
      .toContain('ne couvre pas')
  })
})
