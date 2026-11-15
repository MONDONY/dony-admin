/**
 * Numéro de téléphone international d'un réglage `PHONE_E164` (`support_whatsapp_number`).
 *
 * Même règle que le back, qui reste l'autorité : séparateurs (espaces, points, tirets, parenthèses)
 * retirés, préfixe « 00 » converti en « + », puis `+` suivi de 8 à 15 chiffres sans zéro initial. Vide permis :
 * l'application masque alors la carte WhatsApp.
 */
export function normalizeSupportPhone(raw: string | undefined | null): string {
  const compact = (raw ?? '').trim().replace(/[\s.\-()]/g, '')
  return compact.startsWith('00') ? `+${compact.slice(2)}` : compact
}

/** Message d'erreur à afficher sous le champ, `null` si la saisie est acceptée (vide comprise). */
export function supportPhoneError(raw: string | undefined | null): string | null {
  const phone = normalizeSupportPhone(raw)
  if (phone === '') return null
  return /^\+[1-9]\d{7,14}$/.test(phone)
    ? null
    : 'Numéro au format international avec l’indicatif, par exemple +33 6 12 34 56 78.'
}
