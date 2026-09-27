import { describe, it, expect } from 'vitest'
import {
  walletTransactionTypeLabel, formatSignedAmount, isAdjustmentTransaction, WALLET_TRANSACTION_TYPES,
  isWalletEndpointMissing, reasonLengthValid,
} from '@/features/wallet/types/index'

describe('libellés des mouvements', () => {
  it('chaque type connu a un libellé français sans tiret cadratin', () => {
    for (const t of WALLET_TRANSACTION_TYPES) {
      const label = walletTransactionTypeLabel(t)
      expect(label).not.toBe(t)
      expect(label).not.toContain('—')
    }
  })
  it('un type inconnu est affiché brut', () => {
    expect(walletTransactionTypeLabel('NOUVEAU_TYPE')).toBe('NOUVEAU_TYPE')
  })
  it('reconnaît les ajustements admin', () => {
    expect(isAdjustmentTransaction('ADMIN_CREDIT')).toBe(true)
    expect(isAdjustmentTransaction('ADMIN_DEBIT')).toBe(true)
    expect(isAdjustmentTransaction('TOP_UP')).toBe(false)
  })
})

describe('formatSignedAmount', () => {
  it('préfixe un crédit par +', () => {
    expect(formatSignedAmount(12.5, 'EUR')).toBe('+12,50 EUR')
  })
  it('préfixe un débit par le signe moins', () => {
    expect(formatSignedAmount(-5, 'XOF')).toBe('−5,00 XOF')
  })
  it('un montant nul reste sans signe', () => {
    expect(formatSignedAmount(0, 'EUR')).toBe('0,00 EUR')
  })
})

describe('isWalletEndpointMissing', () => {
  it('404 sans code métier : endpoint absent (ancien back)', () => {
    expect(isWalletEndpointMissing({ statusCode: 404, data: { detail: 'No endpoint matches this path' } })).toBe(true)
  })
  it('405 sans code métier : endpoint absent', () => {
    expect(isWalletEndpointMissing({ status: 405 })).toBe(true)
  })
  it('lit aussi le statut de la réponse', () => {
    expect(isWalletEndpointMissing({ response: { status: 404 } })).toBe(true)
  })
  it('404 avec code métier : vraie erreur', () => {
    expect(isWalletEndpointMissing({ statusCode: 404, data: { code: 'user-not-found' } })).toBe(false)
  })
  it('500 : vraie erreur', () => {
    expect(isWalletEndpointMissing({ statusCode: 500 })).toBe(false)
  })
  it('erreur sans statut : vraie erreur', () => {
    expect(isWalletEndpointMissing(new Error('réseau'))).toBe(false)
    expect(isWalletEndpointMissing(undefined)).toBe(false)
  })
})

describe('reasonLengthValid', () => {
  it('exige 10 à 500 caractères utiles', () => {
    expect(reasonLengthValid('court')).toBe(false)
    expect(reasonLengthValid('   dix  car   ')).toBe(false)
    expect(reasonLengthValid('0123456789')).toBe(true)
    expect(reasonLengthValid('a'.repeat(500))).toBe(true)
    expect(reasonLengthValid('a'.repeat(501))).toBe(false)
  })
})
