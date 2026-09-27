import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PackageRequestDetailPanel from '@/features/package-requests/components/PackageRequestDetailPanel.vue'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { name: 'NuxtLink', props: ['to'], template: '<a :href="to" data-stub="nuxt-link"><slot /></a>' }

const detail = (over: Record<string, unknown> = {}) => ({
  id: 'pr1', senderId: 's1', senderName: 'Awa Ndiaye', departureCity: 'Paris', arrivalCity: 'Dakar',
  desiredDate: '2026-10-01', dateToleranceDays: 3, recipientCity: 'Rufisque', weightKg: 4, parcelSize: 'SMALL', transportMode: 'PLANE', status: 'NEGOTIATING',
  currency: 'EUR', targetPrice: 40, createdAt: '2026-09-20T10:00:00Z', reportCount: 1, openNegotiationCount: 2,
  description: 'Deux paires de chaussures', contentCategory: 'Vêtements',
  pickupNeighborhood: 'Belleville', deliveryNeighborhood: 'Plateau',
  pickupAddressLabel: '12 rue de Belleville, Paris', deliveryAddressLabel: 'Avenue Pompidou, Dakar',
  acceptedPaymentMethods: ['STRIPE', 'CASH'], negotiable: true, statusBeforeRemoval: null,
  photos: [{ url: 'https://r2.example/p1.jpg?sig=a' }, { url: 'https://r2.example/p2.jpg?sig=b' }],
  negotiations: [
    { id: 'n1', travelerId: 't1', travelerName: 'Karim', status: 'OPEN', lastPrice: 35, currency: 'EUR', updatedAt: '2026-09-21T10:00:00Z' },
    { id: 'n2', travelerId: 't2', travelerName: null, status: 'REJECTED', lastPrice: null, currency: null, updatedAt: '2026-09-21T11:00:00Z' },
  ],
  reports: [{ id: 'r1', reporterId: 'u2', reporterName: 'Moussa', reason: 'SCAM_ATTEMPT', details: 'prix louche', status: 'OPEN', createdAt: '2026-09-22T09:00:00Z' }],
  canRemove: true, removeBlockedReason: null, canRestore: false,
  ...over,
})

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(PackageRequestDetailPanel, {
    props: { request: detail(), busy: false, error: null, ...props } as never,
    global: { stubs: { NuxtLink } },
  })
}

describe('PackageRequestDetailPanel', () => {
  beforeEach(() => seedAuth('ADMIN'))

  it('affiche les informations de la demande', () => {
    const text = mountPanel().text()
    for (const s of ['Paris → Dakar', 'Awa Ndiaye', 'Deux paires de chaussures', 'Vêtements', 'Belleville', 'Avenue Pompidou, Dakar', 'Carte, Espèces', 'Avion', 'Petit (5 kg max)', 'En négociation', 'Prix négociable']) {
      expect(text).toContain(s)
    }
    expect(text).not.toContain('—')
  })

  it('vignettes de photos ; clic ouvre la visionneuse, qui se ferme', async () => {
    const w = mountPanel()
    expect(w.findAll('[data-test^="pr-photo-"]')).toHaveLength(2)
    expect(w.find('[data-test="photo-viewer"]').exists()).toBe(false)
    await w.find('[data-test="pr-photo-1"]').trigger('click')
    expect(w.find('[data-test="photo-viewer"]').findAll('img')).toHaveLength(2)
    await w.find('[data-test="photo-viewer-close"]').trigger('click')
    expect(w.find('[data-test="photo-viewer"]').exists()).toBe(false)
  })

  it('sans photo : mention', () => {
    expect(mountPanel({ request: detail({ photos: [] }) }).find('[data-test="pr-no-photo"]').exists()).toBe(true)
  })

  it('négociations avec statut et dernier prix', () => {
    const w = mountPanel()
    expect(w.find('[data-test="pr-negotiation-n1"]').text()).toContain('Karim')
    expect(w.find('[data-test="pr-negotiation-n1"]').text()).toContain('En cours')
    expect(w.find('[data-test="pr-negotiation-n1"]').text()).toContain('35,00 EUR')
    expect(w.find('[data-test="pr-negotiation-n2"]').text()).toContain('Voyageur inconnu')
    expect(w.find('[data-test="pr-negotiation-n2"]').text()).toContain('Aucun prix')
  })

  it('tolérance de date, ville du destinataire et libellé « Budget »', () => {
    const w = mountPanel()
    expect(w.find('[data-test="pr-date-tolerance"]').text()).toBe('± 3 jours')
    expect(w.find('[data-test="pr-recipient-city"]').text()).toBe('Rufisque')
    expect(w.find('[data-test="pr-budget"]').text()).toContain('40,00 EUR')
    expect(w.text()).toContain('Budget')
    expect(w.text()).not.toContain('Prix visé')
  })

  it('ville du destinataire absente : pas de ligne', () => {
    expect(mountPanel({ request: detail({ recipientCity: null }) }).find('[data-test="pr-recipient-city"]').exists()).toBe(false)
  })

  it('statut de chaque signalement en badge (libellés de la page Signalements)', () => {
    expect(mountPanel().find('[data-test="pr-report-status-r1"]').text()).toBe('Ouvert')
    const w = mountPanel({ request: detail({ reports: [{ id: 'r2', reporterId: 'u', reporterName: null, reason: 'FALSE_INFORMATION', details: null, status: 'DISMISSED', createdAt: '2026-09-22T09:00:00Z' }] }) })
    expect(w.find('[data-test="pr-report-status-r2"]').text()).toBe('Rejeté')
    expect(w.find('[data-test="pr-report-r2"]').text()).toContain('Informations fausses ou trompeuses')
  })

  it('canRemove faux pour un brouillon : explication dédiée', () => {
    const w = mountPanel({ request: detail({ status: 'DRAFT', canRemove: false, removeBlockedReason: 'package-request-draft' }) })
    expect(w.find('[data-test="pr-remove-blocked"]').text()).toContain('brouillon')
    expect(w.find('[data-test="pr-disputes-link"]').exists()).toBe(false)
  })

  it('signalements avec motif en français', () => {
    const r = mountPanel().find('[data-test="pr-report-r1"]')
    expect(r.text()).toContain('Moussa')
    expect(r.text()).toContain('Tentative d’arnaque')
    expect(r.text()).toContain('prix louche')
  })

  it('listes vides : mentions explicites', () => {
    const w = mountPanel({ request: detail({ negotiations: [], reports: [] }) })
    expect(w.text()).toContain('Aucune négociation')
    expect(w.text()).toContain('Aucun signalement')
  })

  it('fermer émet close (bouton et fond)', async () => {
    const w = mountPanel()
    await w.find('[data-test="pr-close"]').trigger('click')
    await w.find('[data-test="pr-detail-overlay"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
  })

  describe('Retirer', () => {
    it('le dialogue dit que seul le motif public part à l’expéditeur et que les négociations ouvertes seront annulées', async () => {
      const w = mountPanel()
      await w.find('[data-test="pr-remove"]').trigger('click')
      const overlay = w.find('[data-test="overlay"]')
      expect(overlay.text()).toContain('Seul le motif public est envoyé à l’expéditeur')
      expect(overlay.text()).toContain('Les 2 négociations ouvertes seront annulées')
      expect(overlay.text()).toContain('voyageurs concernés seront prévenus')
      expect(overlay.findAll('option').map((o) => o.text())).toContain('Demande en double')
      expect(overlay.text()).not.toContain('—')
      expect((w.find('[data-test="reason"]').element as HTMLTextAreaElement).placeholder).not.toContain('—')
    })

    it('sans négociation ouverte, le dialogue le dit', async () => {
      const w = mountPanel({ request: detail({ openNegotiationCount: 0 }) })
      await w.find('[data-test="pr-remove"]').trigger('click')
      expect(w.find('[data-test="overlay"]').text()).toContain('Aucune négociation ouverte')
    })

    it('une seule négociation ouverte : accord au singulier', async () => {
      const w = mountPanel({ request: detail({ openNegotiationCount: 1 }) })
      await w.find('[data-test="pr-remove"]').trigger('click')
      expect(w.find('[data-test="overlay"]').text()).toContain('La négociation ouverte sera annulée et le voyageur concerné sera prévenu')
    })

    it('émet le motif public et la note interne séparément', async () => {
      const w = mountPanel()
      await w.find('[data-test="pr-remove"]').trigger('click')
      expect((w.find('[data-test="confirm"]').element as HTMLButtonElement).disabled).toBe(true)
      await w.find('[data-test="reason-choice"]').setValue('SUSPECTED_FRAUD')
      await w.find('[data-test="reason"]').setValue('signalé par Moussa')
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('remove')![0]).toEqual(['SUSPECTED_FRAUD', 'signalé par Moussa'])
      expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    })

    it('annuler ferme sans émettre', async () => {
      const w = mountPanel()
      await w.find('[data-test="pr-remove"]').trigger('click')
      await w.find('[data-test="cancel"]').trigger('click')
      expect(w.emitted('remove')).toBeUndefined()
      expect(w.find('[data-test="overlay"]').exists()).toBe(false)
    })

    it('canRemove faux : bouton désactivé avec l’explication liée au code, lien vers les litiges', () => {
      const w = mountPanel({ request: detail({ canRemove: false, removeBlockedReason: 'package-request-has-active-shipment' }) })
      expect(w.find('[data-test="pr-remove"]').attributes('disabled')).toBeDefined()
      expect(w.find('[data-test="pr-remove-blocked"]').text()).toMatch(/envoi est en cours/)
      expect(w.find('[data-test="pr-disputes-link"]').attributes('href')).toBe('/incidents')
    })

    it('canRemove faux pour une autre raison : explication, pas de lien litiges', () => {
      const w = mountPanel({ request: detail({ canRemove: false, removeBlockedReason: 'SOMETHING_NEW' }) })
      expect(w.find('[data-test="pr-remove-blocked"]').text()).toBe('Retrait impossible pour le moment (SOMETHING_NEW).')
      expect(w.find('[data-test="pr-disputes-link"]').exists()).toBe(false)
    })

    it('une demande retirée ne propose pas Retirer', () => {
      const w = mountPanel({ request: detail({ status: 'REMOVED_BY_ADMIN', canRemove: false, removeBlockedReason: 'ALREADY_REMOVED', canRestore: true }) })
      expect(w.find('[data-test="pr-remove"]').exists()).toBe(false)
      expect(w.find('[data-test="pr-remove-blocked"]').exists()).toBe(false)
    })

    it('occupé : boutons désactivés', () => {
      const w = mountPanel({ busy: true })
      expect(w.find('[data-test="pr-remove"]').attributes('disabled')).toBeDefined()
    })
  })

  describe('Restaurer', () => {
    const removed = () => detail({
      status: 'REMOVED_BY_ADMIN', statusBeforeRemoval: 'OPEN', canRemove: false,
      removeBlockedReason: 'ALREADY_REMOVED', canRestore: true, openNegotiationCount: 0,
    })

    it('affiche le statut avant retrait', () => {
      expect(mountPanel({ request: removed() }).find('[data-test="pr-status-before"]').text()).toContain('Ouverte')
    })

    it('confirmation qui précise que les négociations annulées ne reviennent pas', async () => {
      const w = mountPanel({ request: removed() })
      await w.find('[data-test="pr-restore"]').trigger('click')
      const overlay = w.find('[data-test="overlay"]')
      expect(overlay.text()).toContain('Les négociations annulées lors du retrait ne reviennent pas')
      expect(w.find('[data-test="confirm"]').classes()).toContain('bg-primary')
      await w.find('[data-test="confirm"]').trigger('click')
      expect(w.emitted('restore')).toHaveLength(1)
    })

    it('annuler la restauration', async () => {
      const w = mountPanel({ request: removed() })
      await w.find('[data-test="pr-restore"]').trigger('click')
      await w.find('[data-test="cancel"]').trigger('click')
      expect(w.emitted('restore')).toBeUndefined()
    })

    it('pas de Restaurer si canRestore est faux', () => {
      expect(mountPanel().find('[data-test="pr-restore"]').exists()).toBe(false)
    })
  })

  it('sans CONTENT_REMOVE (SUPPORT) : aucune action, la fiche reste lisible', () => {
    seedAuth('SUPPORT')
    const w = mountPanel()
    expect(w.find('[data-test="pr-actions"]').exists()).toBe(false)
    expect(w.text()).toContain('Paris → Dakar')
  })

  it('erreur d’action affichée ; lien litiges pour un 409 envoi en cours', () => {
    const w = mountPanel({ error: 'Un envoi est en cours : ouvrez un litige.', errorCode: 'package-request-has-active-shipment' })
    expect(w.find('[data-test="pr-action-error"]').text()).toContain('Un envoi est en cours : ouvrez un litige.')
    expect(w.find('[data-test="pr-action-error"] [data-test="pr-error-disputes-link"]').exists()).toBe(true)
  })

  it('erreur sans code : pas de lien', () => {
    const w = mountPanel({ error: 'Action échouée' })
    expect(w.find('[data-test="pr-error-disputes-link"]').exists()).toBe(false)
  })

  it('prix cible absent et non négociable', () => {
    const w = mountPanel({ request: detail({ targetPrice: null, negotiable: false, description: null, contentCategory: null, photos: [] }) })
    expect(w.find('[data-test="pr-budget"]').text()).toBe('À négocier')
    expect(w.text()).toContain('Prix ferme')
    expect(w.text()).toContain('Aucune description')
  })
})
