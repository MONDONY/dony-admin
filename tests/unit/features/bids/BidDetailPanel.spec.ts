/**
 * Fiche colis : chaque section (en-tête, trajet, personnes, colis, argent, chronologie,
 * actions, identifiants), chaque statut, actions selon les droits, et ancien back.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BidDetailPanel from '@/features/bids/components/BidDetailPanel.vue'
import { formatMajorAmount } from '@/features/finance/types/index'
import type { AdminBidDetail, BidStatus } from '@/features/bids/types/index'
import { seedAuth } from '~/tests/helpers/auth'

const NuxtLink = { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' }
const stubs = {
  NuxtLink,
  StripeResyncPanel: { props: ['paymentId', 'currency'], template: '<div data-test="resync-stub">{{ paymentId }}</div>' },
  StartSupportConversationDialog: { props: ['open', 'recipient'], template: '<div v-if="open" data-test="support-dialog">{{ recipient?.name }}</div>' },
}

/** Ancien back : uniquement les champs historiques. */
const legacyBid: AdminBidDetail = {
  id: 'db1c5742-1a56-4a66-a729-47ab29987b32', status: 'ACCEPTED', announcementId: 'ann-1',
  senderName: 'Awa Ndiaye', travelerName: 'Moussa Diallo', corridor: 'Paris → Bamako',
  weightKg: 5, netEur: 40, currency: 'EUR', paymentMethod: 'STRIPE', createdAt: '2026-10-06T18:53:35',
  contentCategory: 'Vêtements', recipientName: 'Fatou', trackingNumber: 'DON-8ANH6EZR',
  commissionRate: 0.12, refusalReason: null,
}

const fullBid: AdminBidDetail = {
  ...legacyBid,
  description: 'Deux pagnes et des chaussures',
  trip: {
    announcementId: 'ann-1', status: 'ACTIVE', departureCity: 'Paris', arrivalCity: 'Bamako',
    departureCountryCode: 'FR', arrivalCountryCode: 'ML',
    departureDate: '2026-10-12', departureTime: '09:30:00', departureAt: null,
    arrivalDate: '2026-10-13', arrivalTime: null, timezone: 'Europe/Paris',
    pickupAddressLabel: 'Aéroport CDG, terminal 2', deliveryAddressLabel: 'Aéroport de Bamako-Sénou',
    transportMode: 'PLANE', totalKg: 23, availableKg: 15, reservedKg: 0, capacityUnit: 'KG', pricePerKg: 8,
    tripGroupId: null, tripLegIndex: null, handoverDeadline: '2026-10-11T18:00:00', otherBidsCount: 2,
  },
  sender: {
    id: 'u-s', name: 'Awa Ndiaye', username: 'awa', phoneMasked: '•••• 5678', status: 'ACTIVE', kycStatus: 'NOT_STARTED',
    stripeAccountStatus: null, stripeConnectUsable: null, mobileMoneyStatus: null, mobileMoneyUsable: null,
  },
  traveler: {
    id: 'u-t', name: 'Moussa Diallo', username: 'moussa', phoneMasked: '•••• 1234', status: 'ACTIVE', kycStatus: 'VERIFIED',
    stripeAccountStatus: 'ONBOARDING_COMPLETE', stripeConnectUsable: true, mobileMoneyStatus: 'NOT_CONFIGURED', mobileMoneyUsable: false,
  },
  recipient: { name: 'Fatou Keita', phoneMasked: '•••• 1122' },
  money: {
    paymentId: 'pay-1', status: 'ESCROW', rail: 'STRIPE', amountCents: 4800, commissionCents: 576, refundedCents: 0,
    currency: 'EUR', capturedAt: '2026-10-06T19:00:00Z', escrowReleasedAt: null, payoutHeldAt: null, disputed: false,
  },
  links: { negotiationThreadId: 'thr-1', disputeId: null, disputeStatus: null, conversationId: 'fs-42', cancellationId: null },
  confirmationCodePresent: true,
  photoUrls: ['https://r2.test/p1?sig=1'],
  milestones: { handoverLocation: 'Gare de Lyon', handoverDeadline: null, arrivedAt: null, deliveredAt: null, noShowAt: null, returnedAt: null },
}

const timeline = { bidId: legacyBid.id, entries: [
  { at: '2026-10-06T18:53:36', kind: 'EVENT' as const, label: 'CREATED_FROM_THREAD', source: 'AUDIT' as const },
  { at: '2026-10-06T18:54:01', kind: 'EVENT' as const, label: 'PRESENCE_CONFIRMED', source: 'AUDIT' as const, actorKind: 'USER' as const, actorLabel: 'Moussa Diallo' },
] }

function mountPanel(bid: AdminBidDetail = fullBid, extra: Record<string, unknown> = {}) {
  return mount(BidDetailPanel, { props: { bid, timeline, open: true, ...extra }, global: { stubs } })
}

describe('BidDetailPanel', () => {
  beforeEach(() => { seedAuth('SUPER_ADMIN') })

  describe('en-tête', () => {
    it('n° de suivi copiable, trajet villes et pays, statut et phrase d’état', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const w = mountPanel()
      expect(w.find('[data-test="bid-tracking"]').text()).toBe('DON-8ANH6EZR')
      expect(w.find('h2').text()).toBe('Paris → Bamako')
      expect(w.find('[data-test="bid-countries"]').text()).toBe('France → Mali')
      expect(w.find('[data-test="bid-status"]').text()).toBe('Accepté')
      expect(w.find('[data-test="bid-phrase"]').text()).toBe('Accepté par le voyageur, en attente de la remise du colis.')
      await w.find('[data-test="bid-copy-tracking"]').trigger('click')
      await Promise.resolve()
      expect(writeText).toHaveBeenCalledWith('DON-8ANH6EZR')
      expect(w.find('[data-test="bid-copy-tracking"]').text()).toBe('Copié')
    })

    it('sans n° de suivi ni trajet : libellé explicite et corridor', () => {
      const w = mountPanel({ ...legacyBid, trackingNumber: null, corridor: '' })
      expect(w.find('[data-test="bid-tracking"]').text()).toBe('N° de suivi pas encore attribué')
      expect(w.find('h2').text()).toBe('Colis')
    })

    it.each<[BidStatus, string]>([
      ['PENDING', 'en attente de sa réponse'],
      ['AWAITING_PAYMENT', 'en attente du paiement'],
      ['PAYMENT_ESCROWED', 'sous séquestre'],
      ['ACCEPTED', 'en attente de la remise'],
      ['HANDED_OVER', 'en attente du départ'],
      ['IN_TRANSIT', 'en attente de la livraison'],
      ['COMPLETED', 'livré au destinataire'],
      ['REJECTED', 'refusée par le voyageur'],
      ['CANCELLED', 'annulé'],
      ['NO_SHOW', 'absence'],
      ['PARCEL_REFUSED', 'refusé le colis'],
      ['EXPIRED', 'expirée'],
    ])('statut %s : phrase « %s »', (status, words) => {
      const w = mountPanel({ ...fullBid, status })
      expect(w.find('[data-test="bid-phrase"]').text().toLowerCase()).toContain(words.toLowerCase())
    })

    it('statut inconnu du front : affiché brut, sans phrase', () => {
      const w = mountPanel({ ...fullBid, status: 'NEW_STATUS' as BidStatus })
      expect(w.find('[data-test="bid-status"]').text()).toBe('NEW_STATUS')
      expect(w.find('[data-test="bid-phrase"]').exists()).toBe(false)
    })

    it('motif du refus affiché', () => {
      const w = mountPanel({ ...fullBid, status: 'REJECTED', refusalReason: 'Trop lourd' })
      expect(w.find('[data-test="bid-refusal"]').text()).toContain('Trop lourd')
    })
  })

  describe('trajet', () => {
    it('dates, lieux, statut, capacité, transport, autres colis', async () => {
      const w = mountPanel()
      const s = w.find('[data-test="section-trip"]')
      expect(s.text()).toContain('Paris (France)')
      expect(s.text()).toContain('Bamako (Mali)')
      expect(w.find('[data-test="trip-departure"]').text()).toBe('lundi 12 octobre 2026 à 09:30')
      expect(w.find('[data-test="trip-arrival"]').text()).toBe('mardi 13 octobre 2026')
      expect(s.text()).toContain('Aéroport CDG, terminal 2')
      expect(s.text()).toContain('Aéroport de Bamako-Sénou')
      expect(w.find('[data-test="trip-status"]').text()).toBe('Publiée')
      expect(w.find('[data-test="trip-capacity"]').text()).toBe('15 kg restants sur 23 kg')
      expect(s.text()).toContain('Avion')
      expect(s.text()).toContain('Remise au plus tard')
      expect(w.find('[data-test="trip-other-bids"]').text()).toBe('2 autres colis sur ce trajet')
      await w.find('[data-test="trip-other-bids"]').trigger('click')
      expect(w.emitted('show-trip-bids')?.[0]).toEqual(['ann-1'])
      await w.find('[data-test="trip-open-announcement"]').trigger('click')
      expect(w.emitted('show-announcement')?.[0]).toEqual(['ann-1'])
    })

    it('un seul autre colis, seul colis, dates manquantes, départ horodaté, étape', () => {
      const one = mountPanel({ ...fullBid, trip: { ...fullBid.trip!, otherBidsCount: 1 } })
      expect(one.find('[data-test="trip-other-bids"]').text()).toBe('1 autre colis sur ce trajet')
      const alone = mountPanel({ ...fullBid, trip: { ...fullBid.trip!, otherBidsCount: 0, departureDate: null, departureAt: null,
        arrivalDate: null, totalKg: null, availableKg: null, transportMode: null, pricePerKg: null, handoverDeadline: null,
        pickupAddressLabel: null, deliveryAddressLabel: null, departureCountryCode: null, arrivalCountryCode: null, tripLegIndex: 2 } })
      expect(alone.find('[data-test="trip-no-other-bids"]').exists()).toBe(true)
      expect(alone.find('[data-test="trip-departure"]').text()).toBe('Non renseignée')
      expect(alone.find('[data-test="trip-arrival"]').text()).toBe('Non renseignée')
      expect(alone.find('[data-test="trip-capacity"]').text()).toBe('—')
      expect(alone.find('[data-test="bid-countries"]').exists()).toBe(false)
      expect(alone.text()).toContain('Étape 2')
      const left = mountPanel({ ...fullBid, trip: { ...fullBid.trip!, totalKg: null } })
      expect(left.find('[data-test="trip-capacity"]').text()).toBe('15 kg restants')
      const total = mountPanel({ ...fullBid, trip: { ...fullBid.trip!, availableKg: null } })
      expect(total.find('[data-test="trip-capacity"]').text()).toBe('23 kg')
      const at = mountPanel({ ...fullBid, trip: { ...fullBid.trip!, departureDate: null, departureAt: '2026-10-12T07:30:00Z' } })
      expect(at.find('[data-test="trip-departure"]').text()).toMatch(/2026/)
    })

    it('annonce supprimée : message dédié', () => {
      const w = mountPanel({ ...fullBid, trip: null })
      expect(w.find('[data-test="trip-unavailable"]').text()).toBe('L’annonce de ce colis n’existe plus.')
    })
  })

  describe('personnes', () => {
    it('expéditeur, voyageur (KYC + Stripe Connect), destinataire masqué', () => {
      const w = mountPanel()
      expect(w.find('[data-test="party-sender"]').text()).toContain('Awa Ndiaye')
      expect(w.find('[data-test="party-sender"]').text()).toContain('@awa')
      expect(w.find('[data-test="party-sender-phone"]').text()).toBe('•••• 5678')
      expect(w.find('[data-test="party-sender-link"]').attributes('data-to')).toContain('"open":"u-s"')
      expect(w.find('[data-test="party-traveler-kyc"]').text()).toContain('Validée')
      expect(w.find('[data-test="party-traveler-stripe"]').text()).toContain('Utilisable')
      expect(w.find('[data-test="party-traveler-stripe"]').text()).toContain('Compte actif')
      expect(w.find('[data-test="party-traveler-mobile-money"]').text()).toContain('Non configuré')
      expect(w.find('[data-test="party-sender-kyc"]').exists()).toBe(false)
      expect(w.find('[data-test="party-recipient"]').text()).toContain('Fatou Keita')
      expect(w.find('[data-test="recipient-phone"]').text()).toBe('•••• 1122')
    })

    it('contacter via le support ouvre le dialogue avec le destinataire imposé', async () => {
      const w = mountPanel()
      await w.find('[data-test="party-traveler-contact"]').trigger('click')
      expect(w.find('[data-test="support-dialog"]').text()).toBe('Moussa Diallo')
    })
  })

  describe('colis', () => {
    it('poids, contenu, description, code présent sans valeur, photos, lieu de remise', () => {
      const w = mountPanel()
      expect(w.find('[data-test="parcel-weight"]').text()).toBe('5 kg')
      expect(w.find('[data-test="parcel-description"]').text()).toBe('Deux pagnes et des chaussures')
      expect(w.find('[data-test="parcel-code"]').text()).toContain('Généré')
      expect(w.find('[data-test="parcel-declared"]').text()).toBe('Non enregistrée par la plateforme')
      expect(w.find('[data-test="parcel-photos"] img').attributes('src')).toBe('https://r2.test/p1?sig=1')
      expect(w.text()).toContain('Gare de Lyon')
    })

    it('pas de code, pas de photo, livré et rendu datés', () => {
      const w = mountPanel({ ...fullBid, confirmationCodePresent: false, photoUrls: [],
        milestones: { ...fullBid.milestones!, deliveredAt: '2026-10-14T10:00:00', returnedAt: '2026-10-15T10:00:00' } })
      expect(w.find('[data-test="parcel-code"]').text()).toContain('Pas encore généré')
      expect(w.find('[data-test="parcel-no-photos"]').exists()).toBe(true)
      expect(w.text()).toContain('Livré le')
      expect(w.text()).toContain('Rendu le')
    })
  })

  describe('argent', () => {
    it('montants, statut en français, encaissé, versé, lien vers le paiement', () => {
      const w = mountPanel()
      expect(w.find('[data-test="money-amount"]').text()).toBe('48,00 EUR')
      expect(w.find('[data-test="money-commission"]').text()).toBe('5,76 EUR')
      expect(w.find('[data-test="bid-detail-net"]').text()).toBe('40,00 EUR')
      expect(w.find('[data-test="bid-detail-currency"]').text()).toBe('EUR')
      expect(w.find('[data-test="money-method"]').text()).toBe('Carte')
      expect(w.find('[data-test="money-status"]').text()).toBe('Sous séquestre')
      expect(w.find('[data-test="money-captured"]').text()).toContain('Oui, le')
      expect(w.find('[data-test="money-released"]').text()).toContain('Pas encore')
      expect(w.find('[data-test="action-payment"]').attributes('data-to')).toContain('"open":"pay-1"')
    })

    it('non encaissé, versé, remboursé, retenu, litige bancaire, statut inconnu', () => {
      const w = mountPanel({ ...fullBid, money: { ...fullBid.money!, status: 'WEIRD', capturedAt: null,
        escrowReleasedAt: '2026-10-14T10:00:00', refundedCents: 1000, payoutHeldAt: '2026-10-14T10:00:00', disputed: true } })
      expect(w.find('[data-test="money-captured"]').text()).toContain('Non')
      expect(w.find('[data-test="money-released"]').text()).toContain('Le ')
      expect(w.find('[data-test="money-status"]').text()).toBe('WEIRD')
      expect(w.text()).toContain('Remboursé')
      expect(w.text()).toContain('Versement retenu')
      expect(w.text()).toContain('Litige bancaire')
    })

    it('mobile money : pas de ligne « Encaissé »', () => {
      const w = mountPanel({ ...fullBid, paymentMethod: 'MOBILE_MONEY', money: { ...fullBid.money!, rail: 'PAWAPAY', status: null } })
      expect(w.find('[data-test="money-captured"]').exists()).toBe(false)
      expect(w.find('[data-test="money-method"]').text()).toBe('Mobile money')
      expect(w.find('[data-test="action-resync"]').exists()).toBe(false)
    })

    it('net dans la devise du colis (XOF), jamais en euros', () => {
      const w = mountPanel({ ...fullBid, netEur: 6000, currency: 'XOF', money: null })
      expect(w.find('[data-test="bid-detail-net"]').text()).toBe(formatMajorAmount(6000, 'XOF'))
      expect(w.text()).not.toContain('€')
    })

    it('espèces : aucun paiement en ligne, taux de commission affiché', () => {
      const w = mountPanel({ ...fullBid, paymentMethod: 'CASH', money: null })
      expect(w.find('[data-test="money-empty"]').text()).toContain('espèces')
      expect(w.text()).toContain('12 %')
      expect(w.find('[data-test="action-payment"]').exists()).toBe(false)
    })

    it('carte sans paiement : aucun paiement enregistré', () => {
      const w = mountPanel({ ...fullBid, money: null, commissionRate: null })
      expect(w.find('[data-test="money-empty"]').text()).toBe('Aucun paiement en ligne enregistré pour ce colis.')
    })
  })

  describe('chronologie', () => {
    it('libellés en français avec auteur', () => {
      const w = mountPanel()
      const s = w.find('[data-test="section-timeline"]')
      expect(s.findAll('[data-test="timeline-entry"]')).toHaveLength(2)
      expect(s.text()).toContain('Colis créé depuis la négociation')
      expect(s.text()).toContain('Présence confirmée par le voyageur')
      expect(s.text()).toContain('par Moussa Diallo')
    })
    it('chargement et erreur transmis', () => {
      expect(mountPanel(fullBid, { timeline: null, timelineLoading: true }).find('[data-test="timeline-loading"]').exists()).toBe(true)
      expect(mountPanel(fullBid, { timeline: null, timelineError: 'Boom' }).find('[data-test="timeline-error"]').text()).toBe('Boom')
    })
  })

  describe('actions selon les droits', () => {
    it('super-admin : paiement, resync Stripe, conversation, copier ; ouvrir un litige et annuler expliqués', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
      const w = mountPanel()
      expect(w.find('[data-test="action-payment"]').exists()).toBe(true)
      expect(w.find('[data-test="resync-stub"]').text()).toBe('pay-1')
      expect(w.find('[data-test="action-conversation"]').attributes('data-to')).toContain('"open":"fs-42"')
      expect(w.find('[data-test="action-dispute"]').exists()).toBe(false)
      expect(w.find('[data-test="unavailable-dispute"]').exists()).toBe(true)
      expect(w.find('[data-test="unavailable-cancel"]').exists()).toBe(true)
      expect(w.find('[data-test="unavailable-support"]').exists()).toBe(false)
      await w.find('[data-test="action-copy-ids"]').trigger('click')
      await Promise.resolve()
      const copied = writeText.mock.calls[0][0] as string
      expect(copied).toContain('Colis : db1c5742')
      expect(copied).toContain('N° de suivi : DON-8ANH6EZR')
      expect(copied).toContain('Paiement : pay-1')
      expect(copied).toContain('Fil de négociation : thr-1')
      expect(w.find('[data-test="action-copy-ids"]').text()).toBe('Identifiants copiés')
      await w.find('[data-test="copy-payment"]').trigger('click')
      await Promise.resolve()
      expect(writeText).toHaveBeenLastCalledWith('pay-1')
    })

    it('presse-papiers refusé : rien ne s’affiche comme copié', async () => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('no')) }, configurable: true })
      const w = mountPanel()
      await w.find('[data-test="copy-bid"]').trigger('click')
      await Promise.resolve(); await Promise.resolve()
      expect(w.find('[data-test="copy-bid"]').text()).toBe('Copier')
    })

    it('litige existant : lien vers le litige avec son statut', () => {
      const w = mountPanel({ ...fullBid, links: { ...fullBid.links!, disputeId: 'dsp-1', disputeStatus: 'OPEN' } })
      expect(w.find('[data-test="action-dispute"]').text()).toBe('Voir le litige (ouvert)')
      expect(w.find('[data-test="action-dispute"]').attributes('data-to')).toContain('"open":"dsp-1"')
      expect(w.find('[data-test="unavailable-dispute"]').exists()).toBe(false)
    })

    it('absence signalée : lien vers le no-show', () => {
      const w = mountPanel({ ...fullBid, status: 'NO_SHOW', links: { ...fullBid.links!, cancellationId: 'c-1' } })
      expect(w.find('[data-test="action-noshow"]').attributes('data-to')).toContain('"tab":"noshows"')
    })

    it('admin sans droits fins : actions masquées, explication du support', () => {
      seedAuth('SUPPORT', { PAYMENT_VIEW: false, DISPUTE_VIEW: false, MODERATION_VIEW: false, USER_VIEW: false, SUPPORT_TICKET_MANAGE: false })
      const w = mountPanel({ ...fullBid, status: 'NO_SHOW', money: null,
        links: { ...fullBid.links!, disputeId: 'dsp-1', cancellationId: 'c-1' } })
      expect(w.find('[data-test="action-payment"]').exists()).toBe(false)
      expect(w.find('[data-test="action-resync"]').exists()).toBe(false)
      expect(w.find('[data-test="action-dispute"]').exists()).toBe(false)
      expect(w.find('[data-test="action-noshow"]').exists()).toBe(false)
      expect(w.find('[data-test="action-conversation"]').exists()).toBe(false)
      expect(w.find('[data-test="party-sender-link"]').exists()).toBe(false)
      expect(w.find('[data-test="party-sender-contact"]').exists()).toBe(false)
      expect(w.find('[data-test="unavailable-support"]').exists()).toBe(true)
      expect(w.find('[data-test="money-empty"]').text()).toContain('réservés aux admins')
    })

    it('fiche réduite par le back (sans USER_VIEW) : statuts annoncés comme réservés', () => {
      const w = mountPanel({ ...fullBid, sender: { ...fullBid.sender!, phoneMasked: null, status: null, kycStatus: null } })
      expect(w.find('[data-test="party-sender-restricted"]').exists()).toBe(true)
    })

    it('resynchronisation faite : la fiche demande à être relue', async () => {
      const Resync = { props: ['paymentId'], emits: ['done'], template: '<button data-test="resync-stub" @click="$emit(\'done\')" />' }
      const w = mount(BidDetailPanel, { props: { bid: fullBid, timeline, open: true }, global: { stubs: { ...stubs, StripeResyncPanel: Resync } } })
      await w.find('[data-test="resync-stub"]').trigger('click')
      expect(w.emitted('resynced')).toBeTruthy()
    })
  })

  describe('ancien back', () => {
    it('sections présentes, « non disponible » au lieu de vide', () => {
      const w = mountPanel(legacyBid)
      expect(w.find('[data-test="bid-legacy"]').exists()).toBe(true)
      expect(w.find('[data-test="trip-unavailable"]').text()).toBe('Non disponible pour l’instant.')
      expect(w.find('[data-test="party-sender"]').text()).toContain('Awa Ndiaye')
      expect(w.find('[data-test="party-traveler"]').text()).toContain('Moussa Diallo')
      expect(w.find('[data-test="party-recipient"]').text()).toContain('Fatou')
      expect(w.find('[data-test="money-empty"]').text()).toBe('Détail du paiement non disponible pour l’instant.')
      expect(w.find('[data-test="bid-detail-net"]').text()).toBe('40,00 EUR')
      expect(w.find('[data-test="parcel-code"]').exists()).toBe(false)
      expect(w.find('[data-test="parcel-photos"]').exists()).toBe(false)
      expect(w.find('[data-test="id-bid"]').exists()).toBe(true)
    })

    it('noms absents : tirets', () => {
      const w = mountPanel({ ...legacyBid, senderName: null, travelerName: null, recipientName: null })
      expect(w.find('[data-test="party-sender"]').text()).toContain('—')
      expect(w.find('[data-test="party-recipient"]').text()).toContain('Non renseigné')
    })
  })

  describe('fermeture', () => {
    it('ne rend rien fermé', () => {
      const w = mount(BidDetailPanel, { props: { bid: fullBid, timeline, open: false }, global: { stubs } })
      expect(w.find('aside').exists()).toBe(false)
    })
    it('clic sur le fond et bouton Fermer', async () => {
      const w = mountPanel()
      await w.find('.fixed').trigger('click')
      await w.find('[data-test="bid-close"]').trigger('click')
      expect(w.emitted('close')).toHaveLength(2)
    })
  })
})
