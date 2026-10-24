import { describe, it, expect } from 'vitest'
import { readFilters, writeFilters } from '@/lib/urlFilters'
import { PAYMENT_URL_SPECS, fromCents, legacyHeldToFilters, paymentActiveChips, paymentInitialView, paymentStateFromQuery, paymentUrlValues, readPaymentFilters, toCents } from '@/features/payments/lib/paymentPageFilters'
import type { PaymentsFilterState } from '@/features/payments/types/index'

const U1 = '11111111-1111-4111-8111-111111111111'
const U2 = '22222222-2222-4222-8222-222222222222'
const U3 = '33333333-3333-4333-8333-333333333333'
const base = (): PaymentsFilterState => ({ status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null })

describe('toCents / fromCents', () => {
  it('toCents', () => {
    expect(toCents('100')).toBe(10000)
    expect(toCents('12,5')).toBe(1250)
    expect(toCents('12.5')).toBe(1250)
    expect(toCents(' 0.07 ')).toBe(7)
    for (const bad of ['', 'abc', '-3', '1.234', '12.', '1e3', null, undefined]) expect(toCents(bad as string)).toBeNull()
  })
  it('fromCents', () => {
    expect(fromCents(10000)).toBe('100')
    expect(fromCents(1250)).toBe('12.5')
    expect(fromCents(7)).toBe('0.07')
    expect(fromCents(null)).toBe('')
    expect(fromCents(undefined)).toBe('')
  })
})

describe('URL', () => {
  it('conserve les clés existantes et leurs défauts', () => {
    expect(PAYMENT_URL_SPECS.status.default).toBe('TOUS')
    expect(PAYMENT_URL_SPECS.method.allowed).toEqual(['TOUS', 'STRIPE', 'PAWAPAY'])
    expect(PAYMENT_URL_SPECS.currency.default).toBe('TOUTES')
    expect(PAYMENT_URL_SPECS.hideAbandoned.default).toBe(true)
    expect(PAYMENT_URL_SPECS.query.param).toBe('query')
  })
  it('lit les valeurs valides, ignore les inconnues', () => {
    const q = { status: 'ESCROW', view: 'REFUNDED', alert: 'HELD', hideAbandoned: 'false', amountMin: '100', amountMax: '12,5', query: 'awa' }
    expect(readFilters(q, PAYMENT_URL_SPECS)).toMatchObject({ status: 'ESCROW', view: 'REFUNDED', alert: 'HELD', hideAbandoned: false, amountMin: '100', amountMax: '12,5', query: 'awa' })
    expect(readFilters({ view: 'PIRATE', alert: 'X', status: 'Y' }, PAYMENT_URL_SPECS)).toEqual({})
  })
  it('readPaymentFilters ignore les UUID invalides et les montants invalides', () => {
    expect(readPaymentFilters({ partyId: U1, announcementId: U2, bidId: U3 })).toMatchObject({ partyId: U1, announcementId: U2, bidId: U3 })
    const bad = readPaymentFilters({ partyId: '../x', announcementId: 'abc', bidId: '1', amountMin: 'abc', amountMax: '-4' })
    expect(bad).toEqual({})
  })
  it('write : la vue par défaut dépend des autres paramètres', () => {
    const vals = { status: 'TOUS', method: 'TOUS', currency: 'TOUTES', dateFrom: null, dateTo: null, hideAbandoned: true, view: 'ATTENTION', alert: null, partyId: '', announcementId: '', bidId: '', query: '', amountMin: '', amountMax: '' }
    expect(writeFilters({ tab: 'payments' }, vals, PAYMENT_URL_SPECS)).toEqual({ tab: 'payments' })
    expect(writeFilters({}, { ...vals, view: 'ALL' }, PAYMENT_URL_SPECS)).toEqual({ view: 'ALL' })
    expect(writeFilters({}, { ...vals, view: 'ALL', status: 'ESCROW' }, PAYMENT_URL_SPECS)).toEqual({ status: 'ESCROW' })
    expect(writeFilters({}, { ...vals, view: 'ESCROW' }, PAYMENT_URL_SPECS)).toEqual({ view: 'ESCROW' })
  })
})

describe('legacyHeldToFilters', () => {
  it('held=true devient view=ATTENTION + alert=HELD et disparaît', () => {
    expect(legacyHeldToFilters({ held: 'true', tab: 'payments' })).toEqual({ tab: 'payments', view: 'ATTENTION', alert: 'HELD' })
  })
  it('n’écrase ni view ni alert explicites', () => {
    expect(legacyHeldToFilters({ held: 'true', view: 'ALL' })).toEqual({ view: 'ALL', alert: 'HELD' })
    expect(legacyHeldToFilters({ held: 'true', alert: 'MM_FAILED' })).toEqual({ view: 'ATTENTION', alert: 'MM_FAILED' })
  })
  it('sans held=true, query inchangée (held=false ou absent)', () => {
    expect(legacyHeldToFilters({ alert: 'HELD' })).toEqual({ alert: 'HELD' })
    expect(legacyHeldToFilters({ held: 'false' })).toEqual({ held: 'false' })
    expect(legacyHeldToFilters({ held: ['true'] })).toEqual({ view: 'ATTENTION', alert: 'HELD' })
  })
})

describe('paymentInitialView', () => {
  it('paramètres valides seulement', () => {
    expect(paymentInitialView({})).toBe('ATTENTION')
    expect(paymentInitialView({ tab: 'payments', open: U1 })).toBe('ATTENTION')
    expect(paymentInitialView({ status: 'PIRATE' })).toBe('ATTENTION')
    expect(paymentInitialView({ partyId: 'nope' })).toBe('ATTENTION')
    expect(paymentInitialView({ view: 'PIRATE' })).toBe('ATTENTION')
    expect(paymentInitialView({ status: 'ESCROW' })).toBe('ALL')
    expect(paymentInitialView({ partyId: U1 })).toBe('ALL')
    expect(paymentInitialView({ view: 'FAILED' })).toBe('FAILED')
  })
  it('held=true : ATTENTION + alerte HELD ; view explicite respectée', () => {
    expect(paymentInitialView({ held: 'true' })).toBe('ATTENTION')
    expect(paymentInitialView({ held: 'true', view: 'ALL' })).toBe('ALL')
  })
})

describe('paymentActiveChips', () => {
  it('aucun filtre : aucune puce (la vue et hideAbandoned n’en font pas)', () => {
    expect(paymentActiveChips({ ...base(), view: 'ESCROW', hideAbandoned: false }, {})).toEqual([])
  })
  it('ordre et libellés', () => {
    const f: PaymentsFilterState = {
      ...base(), partyId: U1, announcementId: U2, bidId: U3, alert: 'HELD', status: 'ESCROW', method: 'STRIPE', currency: 'EUR',
      amountMin: 10000, amountMax: 20000, dateFrom: '2026-10-01', dateTo: '2026-10-15', query: ' awa ',
    }
    const chips = paymentActiveChips(f, { party: 'Awa Diallo', trip: 'Paris → Dakar', bid: 'YD-123' })
    expect(chips).toEqual([
      { key: 'party', label: 'Personne : Awa Diallo' },
      { key: 'trip', label: 'Trajet : Paris → Dakar' },
      { key: 'bid', label: 'Colis : YD-123' },
      { key: 'alert', label: 'Alerte : Versement retenu' },
      { key: 'status', label: 'Statut : En séquestre' },
      { key: 'method', label: 'Méthode : Carte' },
      { key: 'currency', label: 'Devise : EUR' },
      { key: 'amount', label: 'Montant : 100 – 200 €' },
      { key: 'period', label: 'Période : 01/10 → 15/10' },
      { key: 'search', label: 'Recherche : awa' },
    ])
  })
  it('repli sur l’identifiant abrégé sans libellé fourni', () => {
    const chips = paymentActiveChips({ ...base(), partyId: U1, announcementId: U2, bidId: U3 }, {})
    expect(chips.map(c => c.label)).toEqual(['Personne : 11111111', 'Trajet : 22222222', 'Colis : 33333333'])
  })
  it('montant : bornes ouvertes, décimales, devise autre que EUR', () => {
    expect(paymentActiveChips({ ...base(), amountMin: 10000 }, {})[0]!.label).toBe('Montant : ≥ 100 €')
    expect(paymentActiveChips({ ...base(), amountMax: 1250 }, {})[0]!.label).toBe('Montant : ≤ 12,5 €')
    expect(paymentActiveChips({ ...base(), amountMin: 0, currency: 'XOF' }, {})[1]!.label).toBe('Montant : ≥ 0 XOF')
  })
  it('période ouverte, méthode PAWAPAY, statut, held ignoré', () => {
    expect(paymentActiveChips({ ...base(), dateFrom: '2026-10-01' }, {})[0]!.label).toBe('Période : depuis le 01/10')
    expect(paymentActiveChips({ ...base(), dateTo: '2026-10-15' }, {})[0]!.label).toBe('Période : jusqu’au 15/10')
    expect(paymentActiveChips({ ...base(), method: 'PAWAPAY', status: 'CANCELLED' }, {}).map(c => c.label)).toEqual(['Statut : Annulé', 'Méthode : Mobile money'])
    expect(paymentActiveChips({ ...base(), held: true }, {})).toEqual([])
  })
})

describe('paymentStateFromQuery (URL → état des filtres)', () => {
  it('sans paramètre : seulement la vue par défaut', () => {
    expect(paymentStateFromQuery({})).toEqual({ view: 'ATTENTION' })
    expect(paymentStateFromQuery({ tab: 'wallets', open: U1 })).toEqual({ view: 'ATTENTION' })
  })
  it('montants en unités principales → centimes ; UUID mal formés et montants invalides ignorés', () => {
    expect(paymentStateFromQuery({ amountMin: '100', amountMax: '12,5', partyId: U1, announcementId: '../x', bidId: 'b1', query: 'awa' })).toEqual({
      amountMin: 10000, amountMax: 1250, partyId: U1, query: 'awa', view: 'ALL',
    })
    expect(paymentStateFromQuery({ amountMin: 'abc' })).toEqual({ view: 'ATTENTION' })
  })
  it('held=true → alerte HELD, vue À traiter', () => {
    expect(paymentStateFromQuery({ held: 'true' })).toEqual({ view: 'ATTENTION', alert: 'HELD' })
    expect(paymentStateFromQuery({ held: 'true', view: 'ALL', alert: 'ESCROW_J48' })).toEqual({ view: 'ALL', alert: 'ESCROW_J48' })
  })
  it('anciens filtres conservés', () => {
    expect(paymentStateFromQuery({ status: 'ESCROW', method: 'PAWAPAY', currency: 'XOF', dateFrom: '2026-10-01', hideAbandoned: 'false' })).toEqual({
      status: 'ESCROW', method: 'PAWAPAY', currency: 'XOF', dateFrom: '2026-10-01', hideAbandoned: false, view: 'ALL',
    })
  })
})

describe('paymentUrlValues (état → valeurs écrites dans l\'URL)', () => {
  it('centimes → unités principales, absents → défauts ; aller-retour stable', () => {
    const f: PaymentsFilterState = { ...base(), hideAbandoned: true, view: 'ESCROW', alert: 'HELD', partyId: U1, amountMin: 10000, amountMax: null, query: 'awa' }
    const v = paymentUrlValues(f)
    expect(v).toMatchObject({ status: 'TOUS', view: 'ESCROW', alert: 'HELD', partyId: U1, announcementId: '', bidId: '', amountMin: '100', amountMax: '', query: 'awa', hideAbandoned: true })
    const q = writeFilters({ tab: 'payments' }, v, PAYMENT_URL_SPECS)
    expect(q).toEqual({ tab: 'payments', alert: 'HELD', partyId: U1, query: 'awa', amountMin: '100', view: 'ESCROW' })
    expect(paymentStateFromQuery(q)).toEqual({ alert: 'HELD', partyId: U1, query: 'awa', amountMin: 10000, view: 'ESCROW' })
  })
  it('suit l’objet réactif (lecture à chaque accès)', () => {
    const f: PaymentsFilterState = { ...base(), amountMin: null }
    const v = paymentUrlValues(f)
    f.amountMin = 250
    expect(v.amountMin).toBe('2.5')
    expect(v.alert).toBeNull()
    expect(v.view).toBe('ALL')
    expect(v.hideAbandoned).toBe(false)
  })
})
