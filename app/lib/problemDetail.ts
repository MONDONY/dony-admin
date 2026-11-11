/**
 * Message technique d'ofetch (`[POST] "https://…": 500 Internal Server Error`) : en anglais et
 * inutile à un humain. Il laisse la place au texte de repli, écrit en français.
 */
function plainMessage(e: unknown): string | null {
  const m = (e as Error | undefined)?.message
  return m && !m.startsWith('[') ? m : null
}

/**
 * Le backend renvoie du RFC 7807 (`ProblemDetail`) : `detail` porte le message écrit pour
 * un humain, `code` le slug technique. `useApi()` (ofetch) expose le corps parsé via
 * `error.data`. On ne retombe sur `error.message` (générique, type « 422 Unprocessable
 * Entity ») que si `data.detail` est absent ou vide.
 */
export function extractProblemMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { detail?: string } } | undefined)?.data
  if (typeof data?.detail === 'string' && data.detail.trim().length > 0) return data.detail
  return plainMessage(e) ?? fallback
}

/**
 * Variante pour les requêtes en `responseType: 'blob'` (exports CSV) : ofetch y livre aussi
 * le corps d'erreur en Blob, qu'il faut lire comme du JSON pour atteindre `detail`.
 */
export async function extractProblemMessageAsync(e: unknown, fallback: string): Promise<string> {
  const data = (e as { data?: unknown } | undefined)?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { detail?: unknown }
      if (typeof parsed?.detail === 'string' && parsed.detail.trim().length > 0) return parsed.detail
    } catch { /* corps non JSON : on retombe sur le message */ }
    return plainMessage(e) ?? fallback
  }
  return extractProblemMessage(e, fallback)
}

/**
 * Corps JSON d'une erreur, y compris reçu en Blob (requête `responseType: 'blob'`). Sert à lire
 * un champ métier (`blockers` d'un refus d'export) que `detail` ne porte pas. Null si absent
 * ou illisible.
 */
export async function readProblemBody(e: unknown): Promise<Record<string, unknown> | null> {
  let data = (e as { data?: unknown } | undefined)?.data
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    try { data = JSON.parse(await data.text()) } catch { return null }
  }
  return data !== null && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : null
}
