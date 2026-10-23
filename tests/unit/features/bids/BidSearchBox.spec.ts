import { describe, it, expect } from 'vitest'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import BidSearchBox from '@/features/bids/components/BidSearchBox.vue'
import type { AdminBidSuggest } from '@/features/bids/types/index'

const suggestions: AdminBidSuggest = {
  senders: [{ id: 's1', name: 'Jean Dupont', count: 3 }],
  travelers: [{ id: 't1', name: 'Awa Diop', count: 2 }],
  recipients: [{ name: 'Moussa', count: 1 }],
  trips: [{ label: 'Paris → Dakar', departureCity: 'Paris', arrivalCity: 'Dakar', count: 4 }],
  parcels: [{ bidId: 'b1', trackingNumber: 'YD-42', status: 'IN_TRANSIT', content: 'Vêtements' }],
}

function mountBox(props = {}) {
  return mount(BidSearchBox, {
    props: { modelQuery: '', modelScope: 'ALL', suggestions: null, suggestionsDisabled: false, ...props },
    attachTo: document.body,
  })
}
const input = (w: ReturnType<typeof mountBox>) => w.find('[data-test="search"]')

describe('BidSearchBox', () => {
  it('émet « type » à chaque frappe', async () => {
    const w = mountBox()
    await input(w).setValue('Je')
    expect(w.emitted('type')![0]).toEqual(['Je'])
  })

  it('BidSearchBox_enterWithoutSelection_emitsQuery', async () => {
    const w = mountBox()
    await input(w).setValue('YD-42')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:query')![0]).toEqual(['YD-42'])
    expect(w.emitted('pick')).toBeUndefined()
  })

  it('le bouton « Chercher » émet la requête', async () => {
    const w = mountBox()
    await input(w).setValue('Awa')
    await w.find('[data-test="search-submit"]').trigger('click')
    expect(w.emitted('update:query')![0]).toEqual(['Awa'])
  })

  it('liste groupée avec rôles, nombres de colis et libellés de groupe', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    const list = w.find('[role="listbox"]')
    expect(list.exists()).toBe(true)
    for (const g of ['Expéditeurs', 'Voyageurs', 'Destinataires', 'Trajets', 'N° de suivi']) expect(list.text()).toContain(g)
    expect(w.findAll('[role="option"]')).toHaveLength(5)
    expect(w.find('[data-test="suggestion-sender-0"]').text()).toContain('Jean Dupont')
    expect(w.find('[data-test="suggestion-sender-0"]').text()).toContain('3 colis')
    expect(w.find('[data-test="suggestion-recipient-0"]').text()).toContain('1 colis')
  })

  it('BidSearchBox_keyboardNavigation : ↓ ↓ Entrée émet pick avec la bonne charge', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    expect(input(w).attributes('aria-activedescendant')).toBe(w.findAll('[role="option"]')[1]!.attributes('id'))
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![0]).toEqual(['traveler', suggestions.travelers[0]])
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('↑ remonte, Échap ferme la liste', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'ArrowUp' })
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![0]![0]).toBe('sender')
    await input(w).setValue('ab')
    expect(w.find('[role="listbox"]').exists()).toBe(true)
    await input(w).trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('un clic sur un colis suggéré émet pick « parcel »', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('YD')
    await w.find('[data-test="suggestion-parcel-0"]').trigger('click')
    expect(w.emitted('pick')![0]).toEqual(['parcel', suggestions.parcels[0]])
  })

  it('un clic sur un trajet ou un destinataire émet pick avec la bonne nature', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    await w.find('[data-test="suggestion-trip-0"]').trigger('click')
    await input(w).setValue('ab')
    await w.find('[data-test="suggestion-recipient-0"]').trigger('click')
    expect(w.emitted('pick')![0]).toEqual(['trip', suggestions.trips[0]])
    expect(w.emitted('pick')![1]).toEqual(['recipient', suggestions.recipients[0]])
  })

  it('BidSearchBox_suggestionsDisabled_hidesList', async () => {
    const w = mountBox({ suggestions, suggestionsDisabled: true })
    await input(w).setValue('a')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('pas de liste sans suggestions', async () => {
    const w = mountBox({ suggestions: { senders: [], travelers: [], recipients: [], trips: [], parcels: [] } })
    await input(w).setValue('a')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('BidSearchBox_scopeChange_emitsScope', async () => {
    const w = mountBox()
    const select = w.find('[data-test="search-scope"]')
    expect(select.attributes('aria-label')).toBeTruthy()
    expect(select.text()).toContain('N° de suivi')
    await select.setValue('SENDER')
    expect(w.emitted('update:scope')![0]).toEqual(['SENDER'])
  })

  it('BidSearchBox_resyncsFromProp : le champ suit modelQuery', async () => {
    const w = mountBox({ modelQuery: 'YD-1' })
    expect((input(w).element as HTMLInputElement).value).toBe('YD-1')
    await w.setProps({ modelQuery: '' })
    expect((input(w).element as HTMLInputElement).value).toBe('')
  })

  it('le blur du champ ferme la liste', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    expect(w.find('[role="listbox"]').exists()).toBe(true)
    await input(w).trigger('blur')
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('mousedown sur une option ne ferme pas la liste avant le pick', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    w.find('[data-test="suggestion-sender-0"]').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(w.find('[role="listbox"]').exists()).toBe(true)
  })

  it('un clic extérieur ferme la liste', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="listbox"]').exists()).toBe(false)
  })

  it('Échap appelle preventDefault quand la liste est ouverte', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('a')
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input(w).element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('aria-controls absent liste fermée, présent et unique par instance liste ouverte', async () => {
    // Deux instances dans la même application : useId() leur donne des ids distincts.
    const props = { modelQuery: '', modelScope: 'ALL' as const, suggestions, suggestionsDisabled: false }
    const Two = defineComponent({ components: { BidSearchBox }, setup: () => ({ props }), template: '<div><BidSearchBox v-bind="props" /><BidSearchBox v-bind="props" /></div>' })
    const w = mount(Two, { attachTo: document.body })
    const inputs = w.findAll('[data-test="search"]')
    expect(inputs[0]!.attributes('aria-controls')).toBeUndefined()
    await inputs[0]!.setValue('a')
    await inputs[1]!.setValue('a')
    const ids = inputs.map(i => i.attributes('aria-controls'))
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
    expect(w.findAll('[role="listbox"]').map(l => l.attributes('id'))).toEqual(ids)
  })

  it('après un pick, si le parent réécrit modelQuery le champ suit', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('je')
    await w.find('[data-test="suggestion-sender-0"]').trigger('click')
    await w.setProps({ modelQuery: 'Jean Dupont' })
    expect((input(w).element as HTMLInputElement).value).toBe('Jean Dupont')
  })

  it('BidSearchBox_exactTrackingEnter_picksParcel_whenListShown', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('yd-42')
    await input(w).trigger('input')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')![0]).toEqual(['parcel', suggestions.parcels[0]])
    expect(w.emitted('update:query')).toBeUndefined()
  })

  it('BidSearchBox_exactTrackingEnter_listClosed_searches', async () => {
    const w = mountBox({ suggestions })
    await input(w).setValue('YD-42')
    await input(w).trigger('input')
    await input(w).trigger('keydown', { key: 'Escape' })
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(w.emitted('pick')).toBeUndefined()
    expect(w.emitted('update:query')![0]).toEqual(['YD-42'])
  })

  it('BidSearchBox_resetKey_resyncsTextWithModel', async () => {
    const w = mountBox({ modelQuery: 'Jean' })
    await input(w).setValue('Je')
    await w.setProps({ resetKey: 1 })
    expect((input(w).element as HTMLInputElement).value).toBe('Jean')
  })
})
