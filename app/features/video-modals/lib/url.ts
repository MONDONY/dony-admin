/** Longueur maximale d'un lien externe (contrat). */
export const URL_MAX_LENGTH = 2000

/**
 * Lien externe d'un bouton : `https://` uniquement. http, javascript:, data:, mailto: et tout ce
 * qui n'est pas une URL https valide sont refusés (le back répond 422 sinon). Le schéma n'est
 * jamais ajouté automatiquement : l'admin doit coller un lien complet.
 */
export function isValidHttpsUrl(raw: string | null | undefined): boolean {
  if (typeof raw !== 'string') return false
  const value = raw.trim()
  if (!value || value.length > URL_MAX_LENGTH) return false
  if (!/^https:\/\//i.test(value) || /\s/.test(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.length > 0
  } catch {
    return false
  }
}

/** Message affiché sous le champ pour un lien refusé. */
export function httpsUrlError(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return 'Collez le lien complet, qui commence par https://'
  if (value.length > URL_MAX_LENGTH) return `Lien trop long (${URL_MAX_LENGTH} caractères au plus).`
  if (!isValidHttpsUrl(value)) return 'Seuls les liens https:// sont acceptés (pas http, mailto, javascript ni data).'
  return null
}
