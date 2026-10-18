import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RetryWalletRefundDialog from '@/features/finance/components/RetryWalletRefundDialog.vue'
import type { AdminWalletRefundRequest, WalletRefundRetryPreview } from '@/features/finance/types/index'

const REQUEST: AdminWalletRefundRequest = {
  id: 'r1', userId: 'u1', currency: 'XOF', amount: 500, status: 'PENDING', requestedAt: '2026-10-18T10:00:00',
  channel: 'MANUAL_ADMIN', sourceRail: 'PAWAPAY', userName: 'Awa Diop',
}
const OK: WalletRefundRetryPreview = {
  requestId: 'r1', currency: 'XOF', country: 'CI', provider: 'ORANGE_CIV', msisdnMasked: '+225 •••• 90', grossAmount: 500,
  amountDue: 477, walletBalance: 491.5, maxSafeAmount: 477, suggestedAmount: 477, topUpNeeded: 0, refundRatePercent: 3,
  retryAvailable: true, unavailableReason: null,
}
// Cas réel du 18/10 : wallet CI XOF à 487,50, dû 477, sûr 473, il manque 4 XOF.
const SHORT: WalletRefundRetryPreview = {
  ...OK, walletBalance: 487.5, maxSafeAmount: 473, suggestedAmount: null, topUpNeeded: 4, retryAvailable: false,
  unavailableReason: 'pawapay-insufficient-funds',
}

function mountDialog(props: Record<string, unknown> = {}) {
  return mount(RetryWalletRefundDialog, { props: { open: true, request: REQUEST, preview: OK, ...props } })
}
const confirmBtn = (w: ReturnType<typeof mountDialog>) => w.find('[data-test="wrr-retry-confirm"]').element as HTMLButtonElement

describe('RetryWalletRefundDialog', () => {
  it('ne rend rien fermé ou sans demande', () => {
    expect(mountDialog({ open: false }).find('[data-test="wrr-retry-dialog"]').exists()).toBe(false)
    expect(mountDialog({ request: null }).find('[data-test="wrr-retry-dialog"]').exists()).toBe(false)
  })

  it('affiche dû, solde (pays et devise), montant sûr et numéro masqué, puis verse le dû', async () => {
    const w = mountDialog()
    expect(w.find('[data-test="wrr-retry-due"]').text()).toBe('477 XOF')
    expect(w.find('[data-test="wrr-retry-balance"]').text()).toContain('491,50 XOF')
    expect(w.find('[data-test="wrr-retry-balance"]').text()).toMatch(/Ivoire, XOF/)
    expect(w.find('[data-test="wrr-retry-safe"]').text()).toBe('477 XOF')
    expect(w.find('[data-test="wrr-retry-msisdn"]').text()).toBe('+225 •••• 90')
    expect((w.find('[data-test="wrr-retry-amount"]').element as HTMLInputElement).value).toBe('477')
    expect(w.find('[data-test="wrr-retry-topup"]').exists()).toBe(false)
    expect(w.find('[data-test="wrr-retry-refresh"]').exists()).toBe(false)
    expect(w.text()).toContain('montant dû entier')
    await w.find('[data-test="wrr-retry-confirm"]').trigger('click')
    expect(w.emitted('confirm')?.[0]).toEqual([{ amount: 477 }])
  })

  it('wallet trop bas : encadré du manque, envoi fermé, Actualiser émis', async () => {
    const w = mountDialog({ preview: SHORT })
    const box = w.find('[data-test="wrr-retry-topup"]').text()
    expect(box).toContain('Il manque 4 XOF dans le wallet pawaPay')
    expect(box).toMatch(/Ivoire/)
    expect(w.find('[data-test="wrr-retry-safe"]').text()).toBe('473 XOF')
    expect(w.find('[data-test="wrr-retry-balance"]').text()).toContain('487,50 XOF')
    expect((w.find('[data-test="wrr-retry-amount"]').element as HTMLInputElement).value).toBe('')
    expect(confirmBtn(w).disabled).toBe(true)
    await w.find('[data-test="wrr-retry-confirm"]').trigger('click')
    expect(w.emitted('confirm')).toBeUndefined()
    await w.find('[data-test="wrr-retry-refresh"]').trigger('click')
    expect(w.emitted('refresh')).toHaveLength(1)
  })

  it('solde illisible : message, envoi fermé', () => {
    const w = mountDialog({ preview: { ...OK, walletBalance: null, maxSafeAmount: null, suggestedAmount: null, topUpNeeded: null, retryAvailable: false, unavailableReason: 'pawapay-balance-unavailable' } })
    expect(w.find('[data-test="wrr-retry-balance"]').text()).toContain('—')
    expect(w.find('[data-test="wrr-retry-blocker"]').text()).toContain('illisible')
    expect(confirmBtn(w).disabled).toBe(true)
  })

  it('chargement, erreur d’aperçu et erreur d’envoi', async () => {
    expect(mountDialog({ preview: null, loading: true }).find('[data-test="wrr-retry-loading"]').exists()).toBe(true)
    const failed = mountDialog({ preview: null, previewError: 'Demande non éligible' })
    expect(failed.find('[data-test="wrr-retry-preview-error"]').text()).toBe('Demande non éligible')
    expect(confirmBtn(failed).disabled).toBe(true)
    const w = mountDialog({ error: 'Le wallet pawaPay ne couvre pas le montant dû', busy: true })
    expect(w.find('[data-test="wrr-retry-error"]').text()).toContain('ne couvre pas')
    expect(confirmBtn(w).disabled).toBe(true)
    expect(confirmBtn(w).textContent).toContain('Envoi')
    await w.find('[data-test="wrr-retry-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
