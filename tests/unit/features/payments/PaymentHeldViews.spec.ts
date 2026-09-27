/**
 * Versements retenus dans Transactions › Paiements : puce de filtre, badge de ligne, encart
 * du détail et bascule du dialogue de déblocage en mode dérogation.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentFilters from '@/features/payments/components/PaymentFilters.vue'
import PaymentsTable from '@/features/payments/components/PaymentsTable.vue'
import PaymentDetailPanel from '@/features/payments/components/PaymentDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>', props: ['to'] }
const global = { stubs: { NuxtLink: NuxtLinkStub } }

const filterProps = { modelStatus: 'TOUS', modelMethod: 'TOUS', modelCurrency: 'TOUTES', modelDateFrom: null, modelDateTo: null } as const

const row = { id: 'p1', bidId: 'b1', status: 'ESCROW', method: 'STRIPE', amountCents: 1000, commissionCents: 120, currency: 'EUR', createdAt: '2026-09-01T10:00:00' } as const
const detail = { ...row, refundedCents: 0, stripePaymentIntentId: 'pi_1', escrowReleasedAt: null, disputed: false }
const held = { ...detail, payoutHeldAt: '2026-09-20T10:00:00', beneficiaryHeld: true, beneficiaryHoldReason: 'BANNED', travelerId: 't1' } as const

describe('PaymentFilters : Versements retenus', () => {
  it('puce inactive par défaut, émet true au clic', async () => {
    const w = mount(PaymentFilters, { props: { ...filterProps } })
    const chip = w.find('[data-test="chip-held"]')
    expect(chip.text()).toBe('Versements retenus')
    expect(chip.attributes('aria-pressed')).toBe('false')
    await chip.trigger('click')
    expect(w.emitted('update:held')?.[0]).toEqual([true])
  })

  it('puce active : aria-pressed et émet false au clic', async () => {
    const w = mount(PaymentFilters, { props: { ...filterProps, modelHeld: true } })
    const chip = w.find('[data-test="chip-held"]')
    expect(chip.attributes('aria-pressed')).toBe('true')
    await chip.trigger('click')
    expect(w.emitted('update:held')?.[0]).toEqual([false])
  })
})

describe('PaymentsTable : badge Versement retenu', () => {
  it('badge sur une ligne retenue, absent sinon (ancien back compris)', () => {
    const w = mount(PaymentsTable, {
      props: { loading: false, payments: [{ ...row, id: 'p1', payoutHeldAt: '2026-09-20T10:00:00' }, { ...row, id: 'p2' }, { ...row, id: 'p3', beneficiaryHeld: true }] },
    })
    expect(w.find('[data-test="payment-held-p1"]').text()).toBe('Versement retenu')
    expect(w.find('[data-test="payment-held-p2"]').exists()).toBe(false)
    expect(w.find('[data-test="payment-held-p3"]').exists()).toBe(true)
  })
})

describe('PaymentDetailPanel : paiement retenu', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('ancien back : aucun encart', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: detail, open: true }, global })
    expect(w.find('[data-test="payment-hold-notice"]').exists()).toBe(false)
  })

  it('encart : motif banni, date de retenue et lien vers la fiche du voyageur', () => {
    const w = mount(PaymentDetailPanel, { props: { payment: held, open: true }, global })
    const notice = w.find('[data-test="payment-hold-notice"]')
    expect(notice.text()).toContain('Versement retenu')
    expect(notice.text()).toContain('banni')
    expect(notice.text()).toContain(new Date('2026-09-20T10:00:00').toLocaleDateString('fr-FR'))
    const link = w.find('[data-test="payment-hold-traveler-link"]')
    expect(link.attributes('href')).toContain('/users')
    expect(link.attributes('href')).toContain('t1')
    expect(notice.text()).not.toContain('—')
  })

  it('encart : identité révoquée, sans date ni identifiant de voyageur', () => {
    const w = mount(PaymentDetailPanel, {
      props: { payment: { ...detail, beneficiaryHeld: true, beneficiaryHoldReason: 'KYC_REVOKED' }, open: true }, global,
    })
    const notice = w.find('[data-test="payment-hold-notice"]')
    expect(notice.text()).toContain('a été révoquée')
    expect(notice.text()).not.toContain('depuis le')
    expect(w.find('[data-test="payment-hold-traveler-link"]').exists()).toBe(false)
  })

  it('cas normal : le déblocage ouvre le dialogue habituel, sans case de dérogation', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: detail, open: true }, global })
    await w.find('[data-test="action-release"]').trigger('click')
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
    await w.find('[data-test="reason"]').setValue('J+48 atteint')
    await w.find('[data-test="confirm"]').trigger('click')
    expect(w.emitted('force-release')?.[0]).toEqual([])
  })

  it('paiement retenu : le déblocage ouvre directement la dérogation et émet son corps', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: held, open: true }, global })
    await w.find('[data-test="action-release"]').trigger('click')
    expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(true)
    await w.find('[data-test="override-checked"]').setValue(true)
    await w.find('[data-test="override-reason"]').setValue('Livraison vérifiée par photo')
    await w.find('[data-test="override-submit"]').trigger('click')
    expect(w.emitted('force-release')?.[0]).toEqual([{ overrideHold: true, overrideReason: 'Livraison vérifiée par photo' }])
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
  })

  it('relance retenue : dérogation, puis émission retry-payout avec le corps', async () => {
    const payout = { ...held, status: 'RELEASED', method: 'PAWAPAY', pawapayPayoutId: 'po1' } as const
    const w = mount(PaymentDetailPanel, { props: { payment: payout, open: true }, global })
    await w.find('[data-test="action-retry-payout"]').trigger('click')
    expect(w.find('[data-test="override-dialog"] h2').text()).toContain('Relancer le versement')
    await w.find('[data-test="override-checked"]').setValue(true)
    await w.find('[data-test="override-reason"]').setValue('Voyageur réhabilité par le support')
    await w.find('[data-test="override-submit"]').trigger('click')
    expect(w.emitted('retry-payout')?.[0]).toEqual([{ overrideHold: true, overrideReason: 'Voyageur réhabilité par le support' }])
  })

  it('409 reçu (overrideRequest) : le dialogue bascule en dérogation pour ce geste', async () => {
    const w = mount(PaymentDetailPanel, { props: { payment: detail, open: true }, global })
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
    await w.setProps({ overrideRequest: { action: 'release', code: 'payment-disputed' } })
    expect(w.find('[data-test="override-warning"]').text()).toContain('litige bancaire')
    await w.find('[data-test="override-cancel"]').trigger('click')
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
    expect(w.emitted('override-dismiss')).toBeTruthy()
  })

  it('le relais du 409 disparu : le dialogue se ferme', async () => {
    const w = mount(PaymentDetailPanel, {
      props: { payment: detail, open: true, overrideRequest: { action: 'retry-payout', code: 'payout-beneficiary-held' } }, global,
    })
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(true)
    await w.setProps({ overrideRequest: null })
    expect(w.find('[data-test="override-dialog"]').exists()).toBe(false)
  })
})
