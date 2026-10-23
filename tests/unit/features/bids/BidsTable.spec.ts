import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import BidsTable from '@/features/bids/components/BidsTable.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import { seedAuth } from '~/tests/helpers/auth'
import type { AdminBidListItem } from '@/features/bids/types/index'

const NuxtLinkStub = { name: 'NuxtLink', template: '<a :href="to" @click.prevent><slot /></a>', props: ['to'] }

const bid: AdminBidListItem = {
  id: 'b1', status: 'COMPLETED', announcementId: 'a1',
  senderName: 'Jean', travelerName: 'Awa', corridor: 'Paris → Dakar',
  weightKg: 5, netEur: 30, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-06-01T10:00:00Z',
  senderId: 'u-s', travelerId: 'u-t', recipientName: 'Moussa', departureDate: '2026-10-12', updatedAt: '2026-06-02T10:00:00Z', alert: null,
}
const mountTable = (props: Record<string, unknown> = {}) =>
  mount(BidsTable, { props: { bids: [bid], loading: false, ...props }, global: { stubs: { NuxtLink: NuxtLinkStub } } })

describe('BidsTable', () => {
  beforeEach(() => { seedAuth('ADMIN') })

  it('affiche les colonnes enrichies et émet select', async () => {
    const w = mountTable()
    for (const h of ['Suivi', 'Colis', 'Trajet', 'Personnes', 'Net voyageur', 'Statut', 'Mis à jour']) expect(w.text()).toContain(h)
    expect(w.text()).toContain('Paris → Dakar')
    expect(w.text()).toContain('Départ')
    expect(w.text()).toContain('octobre 2026')
    expect(w.text()).toContain('Pour Moussa')
    expect(w.text()).toContain('Livré')
    expect(w.text()).toContain('5 kg')
    await w.find('[data-test="bid-row-b1"]').trigger('click')
    expect(w.emitted('select')![0]).toEqual(['b1'])
  })

  it('affiche le net dans la devise de la demande, avec le mode de paiement', () => {
    const w = mountTable({ bids: [{ ...bid, id: 'b2', netEur: 6000, currency: 'XOF', paymentMethod: 'WAVE' }] })
    expect(w.find('[data-test="bid-net-b2"]').text()).toContain(formatMajorAmount(6000, 'XOF'))
    expect(w.find('[data-test="bid-net-b2"]').text()).toContain('Wave')
    expect(w.find('[data-test="bid-net-b2"]').text()).not.toContain('€')
  })

  it('sans prix négocié, le net est un tiret', () => {
    const w = mountTable({ bids: [{ ...bid, id: 'b3', netEur: null }] })
    expect(w.find('[data-test="bid-net-b3"]').text()).toContain('—')
    expect(w.find('[data-test="bid-net-b3"]').text()).not.toContain('null')
  })

  it('empty state', () => {
    expect(mountTable({ bids: [] }).text()).toMatch(/Aucun colis/i)
  })
  it('BidsTable_customEmptyLabelAndHint', () => {
    const w = mountTable({ bids: [], emptyLabel: 'Rien à traiter pour l’instant.', emptyHint: 'Tout est en ordre.' })
    expect(w.find('[data-test="state-empty"]').text()).toContain('Rien à traiter pour l’instant.')
    expect(w.find('[data-test="state-empty"]').text()).toContain('Tout est en ordre.')
  })
  it('loading state', () => {
    expect(mountTable({ bids: [], loading: true }).text()).toMatch(/Chargement/i)
  })

  it('BidsTable_linksUseUsersIdRoute', () => {
    const w = mountTable()
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/users/u-s')
    expect(hrefs).toContain('/users/u-t')
  })

  it('BidsTable_personLink_stopsRowClick', async () => {
    const w = mountTable()
    await w.find('a[href="/users/u-s"]').trigger('click')
    expect(w.emitted('select')).toBeUndefined()
  })

  it('BidsTable_withoutUserView_noLinks', () => {
    seedAuth('SUPPORT', { USER_VIEW: false })
    const w = mountTable()
    expect(w.findAll('a')).toHaveLength(0)
    expect(w.text()).toContain('Jean')
    expect(w.text()).toContain('Awa')
  })

  it('sans identifiant de personne, texte simple', () => {
    const w = mountTable({ bids: [{ ...bid, senderId: null, travelerId: undefined }] })
    expect(w.findAll('a')).toHaveLength(0)
    expect(w.text()).toContain('Jean')
  })

  it('BidsTable_legacyRow_showsDashes : ancien back sans les nouveaux champs', () => {
    const legacy: AdminBidListItem = {
      id: 'b9', status: 'PENDING', announcementId: 'a1', senderName: null, travelerName: null, corridor: 'Paris → Dakar',
      weightKg: 2, netEur: null, currency: null, paymentMethod: 'STRIPE', createdAt: '2026-06-01T10:00:00Z',
    }
    const w = mountTable({ bids: [legacy] })
    expect(w.find('[data-test="bid-recipient-b9"]').text()).toBe('—')
    expect(w.find('[data-test="bid-updated-b9"]').text()).toBe('—')
    expect(w.find('[data-test="bid-departure-b9"]').text()).toBe('—')
    expect(w.find('[data-test="bid-alert"]').exists()).toBe(false)
  })

  it('BidsTable_alertBadgeShown', () => {
    const w = mountTable({ bids: [{ ...bid, alert: 'DISPUTE_OPEN' }] })
    expect(w.find('[data-test="bid-alert"]').text()).toBe('Litige')
  })

  it('contenu multi-catégories : tronqué avec le texte complet en title', () => {
    const w = mountTable({ bids: [{ ...bid, contentCategory: 'Vêtements, Chaussures, Livres' }] })
    const c = w.find('[data-test="bid-content-b1"]')
    expect(c.text()).toBe('Vêtements, Chaussures, Livres')
    expect(c.attributes('title')).toBe('Vêtements, Chaussures, Livres')
    expect(c.classes()).toContain('truncate')
  })

  it('n° de suivi affiché en monospace', () => {
    const w = mountTable({ bids: [{ ...bid, trackingNumber: 'YD-42' }] })
    expect(w.find('[data-test="bid-tracking-b1"]').text()).toBe('YD-42')
  })
})
