import { describe, it, expect } from 'vitest'
import { readFilters } from '@/lib/urlFilters'
import { BID_PAYMENT_METHODS, BID_URL_FILTERS, BID_SEARCH_SCOPES, bidActiveChips, bidDrawerSection, bidEmptyState, bidInitialView, exactParcelId, searchFromSuggestion } from '@/features/bids/lib/bidPageFilters'
import type { AdminBidSuggest, BidsFilterState } from '@/features/bids/types/index'

const base = (): BidsFilterState => ({ status: 'TOUS', announcementId: null, query: '', scope: 'ALL', view: 'ALL', paymentMethod: null, content: '', alert: null, dateFrom: null, dateTo: null })
const suggest = (parcels: AdminBidSuggest['parcels']): AdminBidSuggest => ({ senders: [], travelers: [], recipients: [], trips: [], parcels })

describe('bidPageFilters', () => {
  it('BID_PAYMENT_METHODS : exactement l’enum PaymentMethod du back, PAWAPAY (un rail) exclu', () => {
    expect([...BID_PAYMENT_METHODS].sort()).toEqual(['CASH', 'MOBILE_MONEY', 'ORANGE_MONEY', 'STRIPE', 'WAVE'])
  })
  it('?paymentMethod=PAWAPAY ignoré, MOBILE_MONEY accepté', () => {
    expect(readFilters({ paymentMethod: 'PAWAPAY' }, BID_URL_FILTERS).paymentMethod ?? null).toBeNull()
    expect(readFilters({ paymentMethod: 'MOBILE_MONEY' }, BID_URL_FILTERS).paymentMethod).toBe('MOBILE_MONEY')
  })
  it('bidDrawerSection : seuls les onglets non par défaut du tiroir passent, Résumé et inconnus donnent null', () => {
    expect(['tracking', 'money', 'chat', 'incidents'].map(bidDrawerSection)).toEqual(['tracking', 'money', 'chat', 'incidents'])
    expect(bidDrawerSection('summary')).toBeNull()
    expect(bidDrawerSection('javascript:x')).toBeNull()
    expect(bidDrawerSection(['money'])).toBeNull()
    expect(bidDrawerSection(undefined)).toBeNull()
  })

  it('portées dans l’ordre du sélecteur', () => {
    expect(BID_SEARCH_SCOPES.map(s => s.value)).toEqual(['ALL', 'TRACKING', 'SENDER', 'TRAVELER', 'RECIPIENT', 'TRIP'])
  })

  it('aucun filtre : aucune puce ; la vue et le trajet ne font pas de puce', () => {
    expect(bidActiveChips({ ...base(), view: 'TODO', announcementId: 'a1' })).toEqual([])
  })

  it('puces des filtres actifs, recherche nommée par sa portée', () => {
    expect(bidActiveChips({
      ...base(), query: 'Awa', scope: 'SENDER', status: 'IN_TRANSIT', dateFrom: '2026-07-01', dateTo: '2026-07-31',
      paymentMethod: 'CASH', content: 'livres', alert: 'LATE',
    })).toEqual([
      { key: 'search', label: 'Expéditeur : Awa' },
      { key: 'status', label: 'Statut : En transit' },
      { key: 'period', label: 'Période : 01/07/2026 → 31/07/2026' },
      { key: 'payment', label: 'Paiement : Espèces à la remise' },
      { key: 'content', label: 'Contenu : livres' },
      { key: 'alert', label: 'Alerte : En retard' },
    ])
  })

  it('recherche sans portée, période ouverte d’un côté, carte', () => {
    expect(bidActiveChips({ ...base(), query: 'DON-1', dateFrom: '2026-07-01', paymentMethod: 'STRIPE' })).toEqual([
      { key: 'search', label: 'Recherche : DON-1' },
      { key: 'period', label: 'Période : depuis le 01/07/2026' },
      { key: 'payment', label: 'Paiement : Carte' },
    ])
    expect(bidActiveChips({ ...base(), dateTo: '2026-07-31' })).toEqual([{ key: 'period', label: 'Période : jusqu’au 31/07/2026' }])
  })

  it('searchFromSuggestion : personne, destinataire et trajet deviennent une recherche à portée', () => {
    expect(searchFromSuggestion('sender', { id: 'u1', name: 'Awa Diop', count: 3 })).toEqual({ query: 'Awa Diop', scope: 'SENDER' })
    expect(searchFromSuggestion('traveler', { id: 'u2', name: 'Moussa', count: 1 })).toEqual({ query: 'Moussa', scope: 'TRAVELER' })
    expect(searchFromSuggestion('recipient', { name: 'Fatou', count: 1 })).toEqual({ query: 'Fatou', scope: 'RECIPIENT' })
    expect(searchFromSuggestion('trip', { label: 'Paris → Dakar', departureCity: 'Paris', arrivalCity: 'Dakar', count: 4 }))
      .toEqual({ query: 'Paris Dakar', scope: 'TRIP' })
    expect(searchFromSuggestion('trip', { label: 'Paris', departureCity: null, arrivalCity: null, count: 1 }))
      .toEqual({ query: 'Paris', scope: 'TRIP' })
    expect(searchFromSuggestion('parcel', { bidId: 'b1', trackingNumber: 'DON-1', status: 'PENDING', content: null })).toBeNull()
  })

  it('exactParcelId : n° de suivi exact (casse et espaces ignorés) parmi les suggestions affichées', () => {
    const s = suggest([{ bidId: 'b1', trackingNumber: 'DON-8ANH6EZR', status: 'PENDING', content: null }, { bidId: 'b2', status: 'PENDING', content: null } as never])
    expect(exactParcelId(' don-8anh6ezr ', s)).toBe('b1')
    expect(exactParcelId('DON-8ANH', s)).toBeNull()
    expect(exactParcelId('', s)).toBeNull()
    expect(exactParcelId('DON-8ANH6EZR', null)).toBeNull()
  })

  it('bidInitialView : seuls les paramètres valides font passer à « Tous »', () => {
    expect(bidInitialView({})).toBe('TODO')
    expect(bidInitialView({ tab: 'bids', open: '1c1a0000-0000-4000-8000-0000000000b1' })).toBe('TODO')
    expect(bidInitialView({ status: 'PIRATE', announcementId: 'garbage', view: 'NOPE', dateFrom: 'hier', status2: 'x' })).toBe('TODO')
    expect(bidInitialView({ status: 'TOUS', scope: 'ALL', query: '' })).toBe('TODO')
    expect(bidInitialView({ status: 'IN_TRANSIT' })).toBe('ALL')
    expect(bidInitialView({ announcementId: '2a2a0000-0000-4000-8000-0000000000a1' })).toBe('ALL')
    expect(bidInitialView({ view: 'TODO' })).toBe('ALL')
    expect(bidInitialView({ query: 'Awa' })).toBe('ALL')
  })

  it('bidEmptyState : « À traiter » sans filtre, avec filtres, autres vues, nombres pas encore reçus', () => {
    expect(bidEmptyState({ ...base(), view: 'TODO' })).toEqual({ label: 'Rien à traiter pour l’instant.', hint: 'Aucun litige, no-show, paiement en attente ni retard.', action: 'Voir tous les colis' })
    for (const over of [{ status: 'PENDING' as const }, { alert: 'LATE' as const }, { paymentMethod: 'CASH' }, { content: 'x' }, { dateTo: '2026-07-01' }, { query: 'x' }]) {
      expect(bidEmptyState({ ...base(), view: 'TODO', ...over })).toEqual({ label: 'Aucun colis à traiter pour ces filtres.', hint: undefined, action: 'Voir dans Tous' })
    }
    expect(bidEmptyState({ ...base(), view: 'ACTIVE' })).toEqual({ label: 'Aucun colis', hint: undefined, action: null })
  })
})
