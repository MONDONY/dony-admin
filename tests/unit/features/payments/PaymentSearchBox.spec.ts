import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PaymentSearchBox from '@/features/payments/components/PaymentSearchBox.vue'
import type { PaymentSuggest } from '@/features/payments/types/index'

const suggestions: PaymentSuggest = {
  senders: [{ id: 's1', name: 'Jean Dupont', count: 3 }],
  travelers: [{ id: 't1', name: 'Awa Diop', count: 1 }],
  trips: [{ label: 'Paris → Dakar', departureCity: 'Paris', arrivalCity: 'Dakar', count: 4 }],
  parcels: [{ paymentId: 'p9', trackingNumber: 'YD-42', status: 'ESCROW', amountCents: 5000, currency: 'EUR' }],
}

function mountBox(props = {}) {
  return mount(PaymentSearchBox, {
    props: { modelQuery: '', suggestions: null, suggestionsDisabled: false, ...props },
    attachTo: document.body,
  })
}
const input = (w: ReturnType<typeof mountBox>) => w.find('[data-test="payment-search"]')

describe('PaymentSearchBox', () => {
  it('émet « type » et soumet la requête', async () => {
    const w = mountBox()
    await input(w).setValue('YD')
    expect(w.emitted('type')![0]).toEqual(['YD'])
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:query')![0]).toEqual(['YD'])
  })

  it('groupes Expéditeurs, Voyageurs, Trajets, N° de suivi avec « N paiements »', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('aw')
    const list = w.find('[role="listbox"]').text()
    for (const g of ['Expéditeurs', 'Voyageurs', 'Trajets', 'N° de suivi']) expect(list).toContain(g)
    expect(w.find('[data-test="payment-suggestion-sender-0"]').text()).toContain('3 paiements')
    expect(w.find('[data-test="payment-suggestion-traveler-0"]').text()).toContain('1 paiement')
    expect(w.find('[data-test="payment-suggestion-traveler-0"]').text()).not.toContain('1 paiements')
    expect(w.find('[data-test="payment-suggestion-parcel-0"]').text()).toContain('YD-42')
  })

  it('choisir une option émet pick(kind, charge)', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('aw')
    await w.find('[data-test="payment-suggestion-trip-0"]').trigger('click')
    expect(w.emitted('pick')![0]).toEqual(['trip', suggestions.trips[0]])
    await input(w).setValue('aw2')
    await w.find('[data-test="payment-suggestion-parcel-0"]').trigger('click')
    expect(w.emitted('pick')![1]).toEqual(['parcel', suggestions.parcels[0]])
  })

  it('référence exacte : Entrée sans option active ouvre le paiement', async () => {
    const w = mountBox({ suggestions: { ...suggestions, exactPaymentId: 'p-exact' } })
    await input(w).setValue('pi_123')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('open-payment')![0]).toEqual(['p-exact'])
    expect(w.emitted('update:query')).toBeUndefined()
  })

  it('référence exacte mais option active : l’option gagne', async () => {
    const w = mountBox({ suggestions: { ...suggestions, exactPaymentId: 'p-exact' } })
    await input(w).setValue('aw')
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![0]![0]).toBe('sender')
    expect(w.emitted('open-payment')).toBeUndefined()
  })

  it('suggestions désactivées (ancien back) : recherche simple, pas de liste', async () => {
    const w = mountBox({ suggestions, suggestionsDisabled: true })
    await input(w).setValue('aw')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:query')![0]).toEqual(['aw'])
  })
})
