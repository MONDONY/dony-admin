import { currencyDecimals } from '@/features/incidents/types/index'

/** Longueur maximale de la note de résolution, alignée sur le back (422 au-delà). */
export const RESOLUTION_NOTE_MAX = 500

export type PaidAmountCheck = { ok: true; value: number } | { ok: false; error: string }

/**
 * Montant prérempli dans le champ : le montant demandé, avec les décimales de la devise
 * (« 500 » en XOF, « 45,00 » en EUR), virgule décimale comme le reste du back-office.
 */
export function initialPaidAmount(amount: number, currency: string): string {
  return amount.toFixed(currencyDecimals(currency)).replace('.', ',')
}

/**
 * Mêmes règles que le back (yadony-back #575), pour refuser avant l'envoi plutôt qu'après un
 * 422 : strictement positif, au plus le montant demandé, sans plus de décimales que la devise
 * n'en permet (aucune en XOF et XAF, deux en EUR). Accepte la virgule et les espaces de milliers.
 */
export function checkPaidAmount(raw: string, requested: number, currency: string): PaidAmountCheck {
  const text = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.')
  if (text === '') return { ok: false, error: 'Saisissez le montant versé.' }
  if (!/^-?\d+(\.\d+)?$/.test(text)) return { ok: false, error: 'Montant invalide.' }
  const value = Number(text)
  if (value <= 0) return { ok: false, error: 'Le montant versé doit être supérieur à zéro.' }
  const decimals = currencyDecimals(currency)
  const fraction = (text.split('.')[1] ?? '').replace(/0+$/, '')
  if (fraction.length > decimals) {
    return {
      ok: false,
      error: decimals === 0
        ? `Pas de décimales en ${currency}.`
        : `${decimals} décimales au plus en ${currency}.`,
    }
  }
  if (value > requested) return { ok: false, error: 'Le montant versé ne peut pas dépasser le montant demandé.' }
  return { ok: true, value }
}
