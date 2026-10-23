import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BidViewTabs from '@/features/bids/components/BidViewTabs.vue'
import type { AdminBidCounts } from '@/features/bids/types/index'

const counts: AdminBidCounts = {
  todo: 3, active: 12, recent: 4, completed: 40, closed: 7, all: 66,
  alerts: { disputeOpen: 1, noShow: 0, paymentPending: 2, late: 0 },
}

describe('BidViewTabs', () => {
  it('affiche les six vues avec leurs nombres et émet la vue choisie', async () => {
    const w = mount(BidViewTabs, { props: { modelValue: 'TODO', counts } })
    expect(w.text()).toContain('À traiter')
    expect(w.text()).toContain('Livrés depuis 3 jours')
    expect(w.text()).toContain('Annulés / refusés')
    expect(w.find('[data-test="bid-view-ACTIVE"]').text()).toContain('12')
    await w.find('[data-test="bid-view-ALL"]').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['ALL'])
  })

  it('BidViewTabs_todoZeroStillShown : « À traiter » garde son 0, les autres vues le masquent', () => {
    const w = mount(BidViewTabs, { props: { modelValue: 'ALL', counts: { ...counts, todo: 0, recent: 0 } } })
    expect(w.find('[data-test="bid-view-TODO"] [data-test="tab-count"]').text()).toBe('0')
    expect(w.find('[data-test="bid-view-RECENT"] [data-test="tab-count"]').exists()).toBe(false)
  })

  it('la pastille « À traiter » est rouge quand il reste du travail', () => {
    const w = mount(BidViewTabs, { props: { modelValue: 'ALL', counts } })
    expect(w.find('[data-test="bid-view-TODO"] [data-test="tab-count"]').classes()).toContain('text-danger')
    expect(w.find('[data-test="bid-view-ACTIVE"] [data-test="tab-count"]').classes()).not.toContain('text-danger')
  })

  it('sans nombres (chargement ou ancien back) : pas de pastille ni de texte d’aide', () => {
    const w = mount(BidViewTabs, { props: { modelValue: 'TODO', counts: null } })
    expect(w.find('[data-test="tab-count"]').exists()).toBe(false)
    expect(w.find('[data-test="bid-view-help"]').exists()).toBe(false)
  })

  it('avec les nombres, explique que « À traiter » recoupe les autres vues', () => {
    const w = mount(BidViewTabs, { props: { modelValue: 'TODO', counts } })
    expect(w.find('[data-test="bid-view-help"]').text()).toContain('se recoupent')
  })
})
