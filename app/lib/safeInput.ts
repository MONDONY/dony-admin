/**
 * Garde-fous des valeurs reçues de l'URL ou du back avant qu'elles ne deviennent un segment
 * d'appel d'API, un lien ou une source d'image : un `?open=../../admin/x` ne doit jamais
 * atteindre un autre endpoint, une URL `javascript:` ou `data:` jamais un `href`/`src`.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Identifiant Firestore (conversations) : lettres, chiffres, tiret et souligné. */
const FIRESTORE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/** Paramètre d'URL (string attendue) devenu un UUID valide, sinon null. */
export function uuidParam(value: unknown): string | null {
  return isUuid(value) ? value : null
}

export function firestoreIdParam(value: unknown): string | null {
  return typeof value === 'string' && FIRESTORE_ID_RE.test(value) ? value : null
}

/** URL `https:` seulement (photos présignées) ; tout autre schéma est refusé. */
export function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    return new URL(value).protocol === 'https:' ? value : null
  } catch {
    return null
  }
}
