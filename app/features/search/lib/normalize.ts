/** Minuscules sans accents : « Vérif » trouve « verifications ». */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** Téléphone réduit à ses 4 derniers chiffres, comme la fiche colis. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length < 4 ? null : `•• •• ${digits.slice(-4)}`
}
