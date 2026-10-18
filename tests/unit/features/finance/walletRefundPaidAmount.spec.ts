import { describe, it, expect } from 'vitest'
import { checkPaidAmount, initialPaidAmount, RESOLUTION_NOTE_MAX } from '@/features/finance/components/walletRefundPaidAmount'

describe('walletRefundPaidAmount', () => {
  it('préremplit le montant demandé avec les décimales de la devise', () => {
    expect(initialPaidAmount(500, 'XOF')).toBe('500')
    expect(initialPaidAmount(45, 'EUR')).toBe('45,00')
    expect(initialPaidAmount(9.05, 'eur')).toBe('9,05')
  })

  it('accepte un montant inférieur ou égal à la demande, virgule et espaces compris', () => {
    expect(checkPaidAmount('487', 500, 'XOF')).toEqual({ ok: true, value: 487 })
    expect(checkPaidAmount('500,00', 500, 'XOF')).toEqual({ ok: true, value: 500 })
    expect(checkPaidAmount('1 200', 15000, 'XOF')).toEqual({ ok: true, value: 1200 })
    expect(checkPaidAmount('43,5', 45, 'EUR')).toEqual({ ok: true, value: 43.5 })
    expect(checkPaidAmount('44.12', 45, 'EUR')).toEqual({ ok: true, value: 44.12 })
  })

  it('refuse un champ vide, un texte, zéro ou un négatif', () => {
    expect(checkPaidAmount('  ', 500, 'XOF')).toMatchObject({ ok: false, error: 'Saisissez le montant versé.' })
    expect(checkPaidAmount('abc', 500, 'XOF')).toMatchObject({ ok: false, error: 'Montant invalide.' })
    expect(checkPaidAmount('0', 500, 'XOF')).toMatchObject({ ok: false, error: 'Le montant versé doit être supérieur à zéro.' })
    expect(checkPaidAmount('-5', 500, 'XOF')).toMatchObject({ ok: false, error: 'Le montant versé doit être supérieur à zéro.' })
  })

  it('refuse un montant supérieur à la demande', () => {
    expect(checkPaidAmount('501', 500, 'XOF')).toMatchObject({ ok: false, error: 'Le montant versé ne peut pas dépasser le montant demandé.' })
  })

  it('refuse les décimales que la devise ne permet pas', () => {
    expect(checkPaidAmount('487,5', 500, 'XOF')).toMatchObject({ ok: false, error: 'Pas de décimales en XOF.' })
    expect(checkPaidAmount('487,5', 500, 'XAF')).toMatchObject({ ok: false, error: 'Pas de décimales en XAF.' })
    expect(checkPaidAmount('44,125', 45, 'EUR')).toMatchObject({ ok: false, error: '2 décimales au plus en EUR.' })
  })

  it('aligne la longueur de la note sur le back', () => {
    expect(RESOLUTION_NOTE_MAX).toBe(500)
  })
})
