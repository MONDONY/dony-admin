import { describe, it, expect } from 'vitest'
import {
  MOBILE_MONEY_VIEWS, MM_URL_PARAMS, defaultMobileMoneyView, readMobileMoneyQuery, writeMobileMoneyQuery,
} from '@/features/finance/lib/mobileMoneyViews'

const counts = (attention: number) => ({ failed: 2, open: 1, done: 7, all: 10, attention })

describe('MOBILE_MONEY_VIEWS', () => {
  it('quatre vues dans l’ordre Échecs, En cours, Réussies, Toutes ; seule Échecs est une alerte, lue sur attention', () => {
    expect(MOBILE_MONEY_VIEWS.map(v => [v.id, v.label, v.countKey])).toEqual([
      ['FAILED', 'Échecs', 'failed'], ['OPEN', 'En cours', 'open'], ['DONE', 'Réussies', 'done'], ['ALL', 'Toutes', 'all'],
    ])
    expect(MOBILE_MONEY_VIEWS.filter(v => v.alert).map(v => [v.id, v.alertKey])).toEqual([['FAILED', 'attention']])
  })
})

describe('defaultMobileMoneyView', () => {
  it('Échecs quand il y a de l’attention, sinon Toutes', () => {
    expect(defaultMobileMoneyView(counts(3))).toBe('FAILED')
    expect(defaultMobileMoneyView(counts(0))).toBe('ALL')
  })
  it('sans nombres (ancien back) : Toutes', () => {
    expect(defaultMobileMoneyView(null)).toBe('ALL')
  })
})

describe('readMobileMoneyQuery', () => {
  it('lit view (minuscule dans l’URL), kind, provider et query', () => {
    expect(readMobileMoneyQuery({ view: 'failed', kind: 'PAYOUT', provider: 'ORANGE_CIV', query: 'awa' }))
      .toEqual({ view: 'FAILED', kind: 'PAYOUT', provider: 'ORANGE_CIV', query: 'awa' })
  })
  it('accepte la vue en majuscules, ignore les valeurs inconnues', () => {
    expect(readMobileMoneyQuery({ view: 'DONE' })).toEqual({ view: 'DONE' })
    expect(readMobileMoneyQuery({ view: 'ESCROW', kind: 'PIRATE', provider: 'x y;drop' })).toEqual({})
  })
  it('ne lit rien d’autre (pas de paramètres des Paiements)', () => {
    expect(readMobileMoneyQuery({ alert: 'HELD', partyId: 'x' })).toEqual({})
  })
})

describe('writeMobileMoneyQuery', () => {
  it('écrit la vue en minuscules et retire les filtres vides, en gardant tab et le reste', () => {
    const q = writeMobileMoneyQuery({ tab: 'mobile-money', foo: '1', kind: 'DEPOSIT' }, { view: 'FAILED', kind: '', provider: '', query: '' }, true)
    expect(q).toEqual({ tab: 'mobile-money', foo: '1', view: 'failed' })
  })
  it('sans vues (ancien back) : aucun paramètre view', () => {
    const q = writeMobileMoneyQuery({ tab: 'mobile-money', view: 'failed' }, { view: 'ALL', kind: 'REFUND', provider: 'WAVE_SEN', query: 'x' }, false)
    expect(q).toEqual({ tab: 'mobile-money', kind: 'REFUND', provider: 'WAVE_SEN', query: 'x' })
  })
  it('MM_URL_PARAMS liste les quatre paramètres', () => {
    expect([...MM_URL_PARAMS].sort()).toEqual(['kind', 'provider', 'query', 'view'])
  })
})
